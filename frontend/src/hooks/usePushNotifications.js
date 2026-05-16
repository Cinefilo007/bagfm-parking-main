import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

/**
 * Hook para gestionar suscripciones a Notificaciones Push VAPID.
 */
export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function checkSubscription() {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            setSubscription(sub);
            setIsSubscribed(true);
          }
        } catch (err) {
          console.error("Error al comprobar la suscripción Push:", err);
        }
      }
    }
    checkSubscription();
  }, []);

  const subscribeUser = useCallback(async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Notificaciones Push no soportadas en este navegador');
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Obtener clave pública VAPID (prioridad env, fallback API)
      let vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        console.warn('⚠️ VITE_VAPID_PUBLIC_KEY no encontrada en build, intentando recuperar del servidor...');
        try {
          const resp = await api.get('/notificaciones/config');
          vapidPublicKey = resp.data.publicKey;
        } catch (apiErr) {
          const errorMsg = 'Error Crítico: No se pudo obtener la clave VAPID ni del entorno ni del servidor.';
          console.error(errorMsg);
          setError(errorMsg);
          return;
        }
      }

      if (!vapidPublicKey) {
        setError('Clave VAPID no disponible en el sistema');
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      // Enviar al backend
      const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('p256dh'))));
      const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('auth'))));

      const payload = {
        endpoint: sub.endpoint,
        p256dh: p256dh,
        auth: auth,
        dispositivo: navigator.userAgent.substring(0, 100)
      };

      await api.post('/notificaciones/suscribir', payload);
      
      setSubscription(sub);
      setIsSubscribed(true);
      console.log('✅ Suscripción Push exitosa');
    } catch (err) {
      console.error('❌ Error suscribiendo a Push:', err);
      setError(err.message);
    }
  }, []);

  return { isSubscribed, subscription, error, subscribeUser };
}

// Helper para convertir la clave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
