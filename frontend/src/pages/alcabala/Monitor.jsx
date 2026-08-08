import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Car, CheckCircle2, XCircle, AlertTriangle, TriangleAlert,
  MapPin, Clock, Wifi, WifiOff, Camera,
} from 'lucide-react';

import { useNotifications } from '../../hooks/useNotifications';
import { usePantallaSocket } from '../../hooks/usePantallaSocket';
import { anprService } from '../../services/anpr.service';
import { pantallaService, pantallaToken } from '../../services/pantalla.service';
import { cn } from '../../lib/utils';

/**
 * Monitor de alcabala — la pantalla del TV de la garita.
 *
 * No es una vista de trabajo: nadie la toca. Está pensada para leerse de pie y a
 * varios metros, así que todo va sobredimensionado y en alto contraste sobre fondo
 * oscuro. El guardia sigue resolviendo desde el teléfono; esto solo le da contexto
 * mientras pregunta el destino.
 *
 * Se alimenta del mismo WebSocket que la pantalla de Puerta, así que las dos ven la
 * misma detección al mismo tiempo y no pueden contradecirse.
 */

const VEREDICTOS = {
  socio:         { etiqueta: 'SOCIO VIGENTE',     color: '#38bdf8', Icono: CheckCircle2 },
  pase:          { etiqueta: 'PASE VIGENTE',      color: '#34d399', Icono: CheckCircle2 },
  reingreso:     { etiqueta: 'YA ESTÁ ADENTRO',   color: '#fbbf24', Icono: AlertTriangle },
  socio_vencido: { etiqueta: 'MEMBRESÍA VENCIDA', color: '#f87171', Icono: XCircle },
  pase_invalido: { etiqueta: 'PASE NO VÁLIDO',    color: '#f87171', Icono: XCircle },
  no_registrado: { etiqueta: 'NO REGISTRADO',     color: '#94a3b8', Icono: AlertTriangle },
};

const veredictoDe = (c) => VEREDICTOS[c] || VEREDICTOS.no_registrado;

const hora = (v) =>
  v ? new Date(v).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '—';

const fechaCorta = (v) =>
  v ? new Date(v).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) : '';

/**
 * Foto servida por un endpoint que exige sesión, así que no se puede poner la URL
 * directa en un <img>: hay que descargarla y convertirla en object URL.
 */
const Foto = ({ url, className, alt, token }) => {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!url) return undefined;
    let vigente = true;
    let creada = null;

    // Con token de pantalla el secreto ya viaja en la query de la URL; con sesión de
    // persona hay que mandar el JWT en la cabecera.
    const opciones = token
      ? {}
      : { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

    fetch(url, opciones)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('sin foto'))))
      .then((blob) => {
        creada = URL.createObjectURL(blob);
        if (vigente) setSrc(creada);
        else URL.revokeObjectURL(creada);
      })
      .catch(() => {});

    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [url, token]);

  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-white/5', className)}>
        <Camera className="h-10 w-10 text-white/20" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={cn('object-cover', className)} />;
};

/** La detección actual, ocupando la mayor parte de la pantalla. */
const Principal = ({ ficha, token, urlFoto }) => {
  if (!ficha) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-white/30">
        <Car className="h-24 w-24" />
        <p className="mt-6 text-3xl font-black uppercase tracking-[0.2em]">Esperando vehículos</p>
      </div>
    );
  }

  const { etiqueta, color, Icono } = veredictoDe(ficha.persona?.coincidencia);
  const v = ficha.vehiculo || {};
  const atributos = [v.tipo, v.color, v.marca].filter(Boolean).join(' · ');
  const infracciones = ficha.infracciones || [];
  const destinos = ficha.destinos_recientes || [];

  return (
    <div className="flex flex-1 gap-8 overflow-hidden">
      {/* Columna izquierda: identidad del vehículo */}
      <div className="flex w-[46%] shrink-0 flex-col gap-5">
        <Foto
          url={urlFoto(ficha, v.foto_escena_url ? 'escena' : 'placa')}
          alt="Vehículo"
          token={token}
          className="h-[42%] w-full rounded-2xl"
        />

        <div>
          <p className="font-mono text-[7rem] font-black leading-none tracking-tight text-white">
            {ficha.placa}
          </p>
          {atributos && (
            <p className="mt-2 text-3xl uppercase tracking-wide text-white/50">{atributos}</p>
          )}
        </div>

        <div
          className="inline-flex items-center gap-4 self-start rounded-2xl px-6 py-4"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icono className="h-10 w-10" />
          <span className="text-4xl font-black uppercase tracking-wide">{etiqueta}</span>
        </div>
      </div>

      {/* Columna derecha: quién es y qué historial tiene */}
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-hidden">
        <div>
          <p className="text-xl font-black uppercase tracking-[0.3em] text-white/40">Titular</p>
          <p className="mt-1 truncate text-6xl font-black uppercase leading-tight text-white">
            {ficha.persona?.nombre || 'Sin registrar'}
          </p>
        </div>

        {/* Las infracciones van antes que el historial: si hay una activa, es lo
            primero que el guardia tiene que ver. */}
        {infracciones.length > 0 && (
          <div className="rounded-2xl border-2 border-red-500/60 bg-red-500/10 p-5">
            <div className="flex items-center gap-3 text-red-400">
              <TriangleAlert className="h-8 w-8 shrink-0" />
              <span className="text-2xl font-black uppercase tracking-wide">
                {infracciones.length} infracción{infracciones.length > 1 ? 'es' : ''} activa{infracciones.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {infracciones.slice(0, 3).map((inf, i) => (
                <li key={i} className="truncate text-2xl text-red-200/90">
                  {(inf.tipo || '').replace(/_/g, ' ').toUpperCase()}
                  {inf.gravedad && <span className="text-red-300/60"> · {inf.gravedad}</span>}
                  {inf.bloquea_salida && (
                    <span className="ml-2 rounded bg-red-500/30 px-2 py-0.5 text-lg font-bold">
                      BLOQUEA SALIDA
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <p className="text-xl font-black uppercase tracking-[0.3em] text-white/40">
            Últimos destinos
          </p>
          {destinos.length === 0 ? (
            <p className="mt-2 text-3xl text-white/25">Sin visitas previas registradas</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {destinos.map((d, i) => (
                <li key={i} className="flex items-baseline gap-4">
                  <MapPin className="h-6 w-6 shrink-0 translate-y-1 text-white/30" />
                  <span className="truncate text-4xl font-bold text-white/90">{d.destino}</span>
                  <span className="ml-auto shrink-0 text-2xl text-white/40">
                    {fechaCorta(d.fecha)} {hora(d.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

/** Franja inferior con las detecciones anteriores. */
const Anteriores = ({ fichas, token, urlFoto }) => (
  <div className="grid shrink-0 grid-cols-3 gap-4">
    {fichas.map((f) => {
      const { color } = veredictoDe(f.persona?.coincidencia);
      return (
        <div
          key={f.evento_id}
          className="flex items-center gap-4 rounded-xl bg-white/5 p-3"
          style={{ borderLeft: `5px solid ${color}` }}
        >
          <Foto url={urlFoto(f, 'placa')} alt="" token={token} className="h-14 w-24 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-mono text-3xl font-black text-white/85">{f.placa}</p>
            <p className="truncate text-xl text-white/40">
              {f.persona?.nombre || 'Sin registrar'}
            </p>
          </div>
          <span className="ml-auto shrink-0 text-xl text-white/30">{hora(f.timestamp)}</span>
        </div>
      );
    })}
  </div>
);

const Monitor = () => {
  // El token de pantalla se captura una sola vez: viene en la URL la primera vez y
  // de ahí queda guardado, para que el televisor arranque solo tras un corte de luz.
  const tokenPantalla = useMemo(() => pantallaToken.capturarDeUrl(), []);
  const esPantalla = Boolean(tokenPantalla);

  // Los dos hooks se llaman siempre —no se pueden llamar condicionalmente— pero cada
  // uno se queda inerte si no tiene su credencial.
  const sesion = useNotifications();
  const pantalla = usePantallaSocket(tokenPantalla);

  const [fichas, setFichas] = useState([]);
  const [titulo, setTitulo] = useState('Alcabala');
  const [reloj, setReloj] = useState(new Date());

  const conectado = esPantalla ? pantalla.conectado : sesion.isConnected;
  const aviso = esPantalla ? pantalla.ultimo : sesion.lastNotification;

  /**
   * URL de una foto según el modo.
   *
   * La ficha trae las URL del endpoint con sesión, que el token de pantalla no puede
   * usar: para el televisor hay que armarlas contra su propio endpoint, que además
   * comprueba que la detección sea de SU alcabala.
   */
  const urlFoto = useCallback((ficha, cual) => {
    if (!ficha) return null;
    const tiene = cual === 'escena'
      ? ficha.vehiculo?.foto_escena_url
      : ficha.vehiculo?.foto_placa_url;
    if (!tiene) return null;
    return esPantalla
      ? pantallaService.urlFoto(ficha.evento_id, cual, tokenPantalla)
      : tiene;
  }, [esPantalla, tokenPantalla]);

  const cargar = useCallback(async () => {
    try {
      if (esPantalla) {
        const datos = await pantallaService.getMonitor(tokenPantalla);
        setFichas(datos.detecciones || []);
        if (datos.punto_nombre) setTitulo(datos.punto_nombre);
      } else {
        setFichas(await anprService.getMonitor(4));
      }
    } catch (error) {
      // Se deja constancia en consola en vez de tragarse el fallo: esta pantalla
      // vive sola en una garita y nadie va a estar mirando si algo falló.
      console.warn('[monitor] no se pudo cargar el histórico inicial', error);
    }
  }, [esPantalla, tokenPantalla]);

  // Carga inicial. La regla no distingue una petición al servidor de un setState
  // gratuito, y sin esto la pantalla arrancaría en blanco.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (aviso?.evento !== 'anpr_deteccion') return;

    const ficha = aviso.ficha || {
      // Si el servidor no pudo construir la ficha, se pinta con lo que trae el aviso:
      // más vale un monitor incompleto que uno en blanco delante de la fila.
      evento_id: aviso.evento_id,
      placa: aviso.placa,
      timestamp: aviso.timestamp,
      vehiculo: {
        tipo: aviso.tipo_vehiculo,
        color: aviso.color_vehiculo,
        marca: aviso.marca_vehiculo,
      },
      persona: { nombre: aviso.nombre_portador, coincidencia: aviso.coincidencia },
      destinos_recientes: [],
      infracciones: [],
    };

    // La regla set-state-in-effect no ve la suscripción, porque vive dentro del hook
    // del socket: desde aquí el aviso parece estado normal. Es justo el caso que la
    // propia regla permite —reaccionar a un sistema externo—, así que se silencia en
    // esta línea y no en todo el archivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFichas((previas) =>
      previas.some((f) => f.evento_id === ficha.evento_id)
        ? previas
        : [ficha, ...previas].slice(0, 4)
    );

    if (esPantalla) pantalla.limpiar();
    else sesion.setLastNotification(null);
  }, [aviso, esPantalla, pantalla, sesion]);

  const [actual, ...anteriores] = fichas;

  return (
    <div className="flex h-screen flex-col gap-6 bg-[#0b1220] p-8">
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <p className="font-mono text-lg font-bold uppercase tracking-[0.3em] text-emerald-400">
            Control de acceso // BAGFM
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">{titulo}</h1>
        </div>
        <div className="flex items-center gap-6 text-white/40">
          {conectado
            ? <Wifi className="h-7 w-7 text-emerald-400" />
            : <WifiOff className="h-7 w-7 text-red-400" />}
          <span className="flex items-center gap-2 text-3xl font-bold tabular-nums text-white/70">
            <Clock className="h-6 w-6" />
            {reloj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <Principal ficha={actual} token={tokenPantalla} urlFoto={urlFoto} />

      {anteriores.length > 0 && <Anteriores fichas={anteriores} token={tokenPantalla} urlFoto={urlFoto} />}
    </div>
  );
};

export default Monitor;
