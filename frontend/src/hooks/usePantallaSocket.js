import { useEffect, useRef, useState } from 'react';
import { pantallaService } from '../services/pantalla.service';

/**
 * WebSocket de una pantalla de garita.
 *
 * Aparte de `useNotifications` porque aquella se autentica con el JWT de una persona
 * y esta con el token del dispositivo. Reconecta sola e indefinidamente: un televisor
 * en una garita se queda solo días enteros y nadie va a ir a recargar la página
 * cuando se caiga la red.
 */
export function usePantallaSocket(token) {
  const [ultimo, setUltimo] = useState(null);
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef(null);
  const reintentoRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;

    let cancelado = false;
    let esperaMs = 3000;

    const conectar = () => {
      if (cancelado) return;

      const socket = new WebSocket(pantallaService.urlWebSocket(token));
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelado) return;
        setConectado(true);
        esperaMs = 3000; // se reinicia la espera tras una conexión buena
      };

      socket.onmessage = (evento) => {
        try {
          setUltimo(JSON.parse(evento.data));
        } catch {
          /* un mensaje ilegible no debe tumbar la pantalla */
        }
      };

      socket.onclose = () => {
        if (cancelado) return;
        setConectado(false);
        // Espera creciente hasta 30 s: si el backend está caído, reintentar cada
        // 3 s durante horas solo genera ruido y consumo.
        reintentoRef.current = setTimeout(conectar, esperaMs);
        esperaMs = Math.min(esperaMs * 2, 30000);
      };

      socket.onerror = () => socket.close();
    };

    conectar();

    return () => {
      cancelado = true;
      clearTimeout(reintentoRef.current);
      socketRef.current?.close();
    };
  }, [token]);

  return { ultimo, conectado, limpiar: () => setUltimo(null) };
}
