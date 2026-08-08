import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import con nombre y no por defecto: `react-qr-code` es CommonJS y su export por
// defecto no sobrevive al interop del bundler; llega como objeto plano y React lo
// rechaza con el error #130. El export con nombre sí resuelve al componente.
import { QRCode } from 'react-qr-code';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';

import { pantallaService } from '../../services/pantalla.service';

/**
 * Lo que muestra el televisor mientras espera que lo autoricen.
 *
 * Es el mismo flujo que usan Netflix o HBO: la pantalla enseña un código, alguien
 * que ya tiene sesión lo escanea con el teléfono y confirma. Aquí encaja
 * especialmente bien porque la cuenta del guardia ya dice en qué alcabala está, así
 * que la pantalla hereda la garita sola y no hay nada que elegir.
 *
 * El código se ve desde la fila, y no pasa nada: no autentica. Quien recoge la
 * credencial es este aparato, con un secreto que solo él conoce.
 */

const SEGUNDOS_ENTRE_CONSULTAS = 3;

/** Se muestra partido en dos mitades: seis caracteres seguidos se leen fatal. */
const formatearCodigo = (codigo) =>
  codigo ? `${codigo.slice(0, 3)}-${codigo.slice(3)}` : '';

export const EmparejarPantalla = ({ onEmparejada }) => {
  const [sesion, setSesion] = useState(null);
  const [error, setError] = useState(null);
  const [restante, setRestante] = useState(null);
  const secretoRef = useRef(null);

  const iniciar = useCallback(async () => {
    setError(null);
    setSesion(null);
    try {
      const datos = await pantallaService.iniciarEmparejamiento();
      secretoRef.current = datos.secreto;
      setSesion(datos);
    } catch {
      setError('No se pudo contactar al servidor');
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { iniciar(); }, [iniciar]);

  // Consulta si ya confirmaron. Se para sola al vencer el código para no dejar un
  // televisor golpeando el servidor indefinidamente.
  useEffect(() => {
    if (!sesion) return undefined;

    const t = setInterval(async () => {
      try {
        const estado = await pantallaService.estadoEmparejamiento(secretoRef.current);
        if (estado.estado === 'confirmado' && estado.token) {
          clearInterval(t);
          onEmparejada(estado.token);
        } else if (estado.estado === 'expirado') {
          clearInterval(t);
          iniciar();
        }
      } catch {
        /* un fallo puntual de red no debe romper el ciclo */
      }
    }, SEGUNDOS_ENTRE_CONSULTAS * 1000);

    return () => clearInterval(t);
  }, [sesion, onEmparejada, iniciar]);

  // Cuenta atrás, para que se vea que el código caduca y no se quede ahí para siempre.
  useEffect(() => {
    if (!sesion) return undefined;

    const calcular = () => {
      const segundos = Math.max(0, Math.floor((new Date(sesion.expira_at) - Date.now()) / 1000));
      setRestante(segundos);
    };
    calcular();
    const t = setInterval(calcular, 1000);
    return () => clearInterval(t);
  }, [sesion]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-[#0b1220] text-white/60">
        <WifiOff className="h-20 w-20 text-red-400" />
        <p className="text-3xl font-bold">{error}</p>
        <button
          type="button"
          onClick={iniciar}
          className="flex items-center gap-3 rounded-2xl bg-white/10 px-8 py-4 text-2xl font-bold text-white"
        >
          <RefreshCw className="h-6 w-6" /> Reintentar
        </button>
      </div>
    );
  }

  if (!sesion) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b1220]">
        <Loader2 className="h-16 w-16 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-10 bg-[#0b1220] p-10">
      <div className="text-center">
        <p className="font-mono text-xl font-bold uppercase tracking-[0.3em] text-emerald-400">
          Control de acceso // BAGFM
        </p>
        <h1 className="mt-3 text-5xl font-black uppercase tracking-tight text-white">
          Autorizar esta pantalla
        </h1>
        <p className="mt-4 text-3xl text-white/50">
          Escanee el código con el teléfono del guardia
        </p>
      </div>

      <div className="flex items-center gap-16">
        {/* Fondo blanco fijo: un QR sobre fondo oscuro no lo lee ningún teléfono. */}
        <div className="rounded-3xl bg-white p-8">
          <QRCode value={sesion.url_confirmacion} size={320} />
        </div>

        <div className="text-center">
          <p className="text-2xl font-bold uppercase tracking-[0.2em] text-white/40">
            O escriba este código
          </p>
          <p className="mt-4 font-mono text-8xl font-black tracking-widest text-white">
            {formatearCodigo(sesion.codigo)}
          </p>
          {restante !== null && (
            <p className="mt-6 text-2xl text-white/40">
              {restante > 0
                ? `Vence en ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`
                : 'Generando un código nuevo…'}
            </p>
          )}
        </div>
      </div>

      <p className="max-w-4xl text-center text-xl leading-relaxed text-white/30">
        La pantalla quedará asignada a la alcabala del guardia que confirme, y solo
        podrá mostrar las detecciones de esa puerta.
      </p>
    </div>
  );
};
