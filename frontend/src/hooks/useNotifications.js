import { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from '../store/auth.store';

/**
 * Hook para manejar notificaciones en tiempo real vía WebSockets.
 * Se conecta al backend y escucha eventos de infracción para alertar al usuario.
 */
export function useNotifications() {
  const { token, user } = useAuthStore();
  const [lastNotification, setLastNotification] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = import.meta.env.VITE_API_URL || 'https://bagfm-backend-production.up.railway.app/api/v1';
    
    // Extraer host de baseUrl (ej: bagfm-backend...up.railway.app)
    const host = baseUrl.replace('http://', '').replace('https://', '').split('/')[0];
    const wsUrl = `${protocol}//${host}/api/v1/ws?token=${token}`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ WebSocket Conectado');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
          const data = JSON.parse(event.data);
          console.log('🔔 Nueva Notificación:', data);
          setLastNotification(data);
          
          // Opcional: Sonido de alerta o notificación nativa
          if (data.evento === 'INFRACCION_REGISTRADA') {
              playAlertSound();
          }
      } catch (err) {
          console.error('❌ Error parseando mensaje WS:', err);
      }
    };

    socket.onclose = () => {
      console.log('❌ WebSocket Desconectado');
      setIsConnected(false);
      // Reintento automático tras 5 segundos
      setTimeout(connect, 5000);
    };

    return socket;
  }, [token]);

  useEffect(() => {
    const socket = connect();
    return () => {
      if (socket) socket.close();
    };
  }, [connect]);

  const playAlertSound = () => {
      // Logic for alert sound if needed
  };

  return { lastNotification, isConnected, setLastNotification };
}
