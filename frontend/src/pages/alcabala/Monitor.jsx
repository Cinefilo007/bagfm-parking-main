import React, { useState, useEffect, useCallback } from 'react';
import {
  Car, CheckCircle2, XCircle, AlertTriangle, TriangleAlert,
  MapPin, Clock, Wifi, WifiOff, Camera, Sun, Moon,
} from 'lucide-react';

import { useNotifications } from '../../hooks/useNotifications';
import { usePantallaSocket } from '../../hooks/usePantallaSocket';
import { anprService } from '../../services/anpr.service';
import { pantallaService, pantallaToken } from '../../services/pantalla.service';
import { EmparejarPantalla } from '../../components/alcabala/EmparejarPantalla';
import { useAuthStore } from '../../store/auth.store';
import { cn } from '../../lib/utils';

/**
 * Monitor de alcabala — la pantalla del TV de la garita.
 *
 * No es una vista de trabajo: nadie la toca. Está pensada para leerse de pie y a
 * varios metros, así que todo va sobredimensionado y en alto contraste.
 *
 * Dos temas, porque una garita tiene luz de mediodía y luz de madrugada: el oscuro
 * cansa menos de noche, pero a pleno sol un fondo negro no se lee. Se puede cambiar
 * desde la propia pantalla o desde el teléfono del guardia, que es lo que sirve
 * cuando el televisor está colgado sin mando a mano.
 */

const CLAVE_TEMA = 'monitor_tema';

/**
 * Cuánto se queda una detección en pantalla antes de volver a "esperando".
 *
 * Dejarla hasta que llegue el siguiente vehículo hacía imposible distinguir un dato
 * fresco de uno de hace media hora, y el cambio de una detección a otra pasaba
 * desapercibido. Volver al estado de espera hace que cada llegada se note.
 */
const SEGUNDOS_EN_PANTALLA = 25;

/**
 * El color lo decide el backend. Aquí solo se pinta.
 *
 * Tres estados y no más: a diez metros y con una fila detrás, nadie distingue seis
 * matices. Verde pasa, amarillo el guardia decide, rojo no debe entrar.
 */
const SEMAFORO = {
  verde:    { rotulo: 'PUEDE PASAR',   Icono: CheckCircle2,  oscuro: '#22c55e', claro: '#15803d' },
  amarillo: { rotulo: 'REVISAR',       Icono: AlertTriangle, oscuro: '#facc15', claro: '#a16207' },
  rojo:     { rotulo: 'NO DEBE PASAR', Icono: XCircle,       oscuro: '#f87171', claro: '#b91c1c' },
};

const ETIQUETAS = {
  socio:               'SOCIO VIGENTE',
  vehiculo_registrado: 'VEHÍCULO REGISTRADO',
  pase:                'PASE VIGENTE',
  reingreso:           'YA ESTÁ ADENTRO',
  socio_vencido:       'MEMBRESÍA VENCIDA',
  pase_invalido:       'PASE NO VÁLIDO',
  no_registrado:       'NO REGISTRADO',
};

const TEMAS = {
  oscuro: {
    fondo: '#0b1220',
    texto: 'text-white',
    textoSuave: 'text-white/50',
    textoTenue: 'text-white/30',
    tarjeta: 'bg-white/5',
    panel: 'border-white/10 bg-white/[0.03]',
    marcaAgua: 'text-emerald-400',
  },
  claro: {
    fondo: '#f5f7fa',
    texto: 'text-slate-900',
    textoSuave: 'text-slate-600',
    textoTenue: 'text-slate-400',
    tarjeta: 'bg-slate-900/5',
    panel: 'border-slate-300 bg-white',
    marcaAgua: 'text-emerald-700',
  },
};

/**
 * Caja con borde y titulillo.
 *
 * Sin un contorno explícito, en una pantalla grande todo flota junto y no se sabe
 * qué dato pertenece a qué: el titular parecía referirse a la lista de abajo. Cada
 * bloque encerrado se lee como una unidad.
 */
const Panel = ({ titulo, tema, className, children }) => (
  <section
    className={cn('flex min-h-0 flex-col rounded-2xl border p-[1.4vh]', tema.panel, className)}
  >
    {titulo && (
      <h2 className={cn('mb-3 shrink-0 text-[clamp(0.6rem,0.95vw,1.125rem)] font-black uppercase tracking-[0.25em]', tema.textoTenue)}>
        {titulo}
      </h2>
    )}
    {children}
  </section>
);

const semaforoDe = (ficha, tema) => {
  const s = SEMAFORO[ficha?.semaforo] || SEMAFORO.amarillo;
  return { ...s, color: tema === 'claro' ? s.claro : s.oscuro };
};

const hora = (v) =>
  v ? new Date(v).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '—';

const fechaCorta = (v) =>
  v ? new Date(v).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) : '';

/**
 * Foto de la detección. Se descarga con credencial y se convierte en object URL: el
 * endpoint no es público porque son imágenes de civiles.
 */
const Foto = ({ url, className, alt, token, tema }) => {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!url) return undefined;
    let vigente = true;
    let creada = null;

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
      <div className={cn('flex items-center justify-center', tema.tarjeta, className)}>
        <Camera className={cn('h-[8%] min-h-6 w-auto', tema.textoTenue)} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      // El servidor puede devolver 200 con algo que no sea una imagen decodificable
      // (una subida truncada, por ejemplo). Sin esto el navegador pinta el icono de
      // imagen rota con el texto alternativo encima, que en un televisor se ve peor
      // que no mostrar nada.
      onError={() => setSrc(null)}
      className={cn('object-cover', className)}
    />
  );
};

/** La detección actual, ocupando la mayor parte de la pantalla. */
const Principal = ({ ficha, token, urlFoto, tema, nombreTema }) => {
  if (!ficha) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center', tema.textoTenue)}>
        <Car className="h-24 w-24" />
        <p className="mt-6 text-[clamp(1rem,2vw,1.875rem)] font-black uppercase tracking-[0.2em]">Esperando vehículos</p>
      </div>
    );
  }

  const { rotulo, color, Icono } = semaforoDe(ficha, nombreTema);
  const v = ficha.vehiculo || {};
  const atributos = [v.tipo, v.color, v.marca].filter(Boolean).join(' · ');
  const infracciones = ficha.infracciones || [];
  const destinos = ficha.destinos_recientes || [];

  return (
    <div className="flex min-h-0 flex-1 gap-[1.5vw]">
      {/* IZQUIERDA — el vehículo: qué entra y si puede pasar */}
      <div className="flex w-[46%] shrink-0 flex-col gap-[1.2vh]">
        <Panel titulo="Vehículo" tema={tema} className="min-h-0 flex-1">
          <Foto
            url={urlFoto(ficha, v.foto_escena_url ? 'escena' : 'placa')}
            alt="Vehículo"
            token={token}
            tema={tema}
            className="min-h-0 w-full flex-1 rounded-xl"
          />
          <p className={cn('mt-4 shrink-0 font-mono text-[clamp(2rem,5.5vw,6rem)] font-black leading-none tracking-tight', tema.texto)}>
            {ficha.placa}
          </p>
          <p className={cn('mt-1 shrink-0 text-[clamp(0.9rem,1.6vw,1.875rem)] uppercase tracking-wide', tema.textoSuave)}>
            {atributos || 'Sin atributos'}
          </p>
        </Panel>

        {/* El semáforo va suelto y sin panel: es el único elemento que debe
            competir por la atención desde el otro lado de la garita. */}
        <div
          className="flex shrink-0 items-center justify-center gap-5 rounded-2xl px-[2vw] py-[1.8vh]"
          style={{ backgroundColor: `${color}22`, color, border: `4px solid ${color}` }}
        >
          <Icono className="h-[clamp(2rem,4vw,4rem)] w-[clamp(2rem,4vw,4rem)] shrink-0" />
          <div className="min-w-0">
            <p className="text-[clamp(1.5rem,3.6vw,3.75rem)] font-black uppercase leading-none tracking-wide">{rotulo}</p>
            <p className="mt-1 text-[clamp(0.75rem,1.35vw,1.5rem)] font-bold uppercase tracking-widest opacity-80">
              {ETIQUETAS[ficha.persona?.coincidencia] || 'NO REGISTRADO'}
              {' · '}
              {/* Las infracciones se dicen SIEMPRE, también cuando no hay. Un hueco
                  vacío se lee como "no se comprobó"; "sin infracciones" se lee como
                  una respuesta, que es lo que el guardia necesita. */}
              <span style={infracciones.length > 0 ? { color: SEMAFORO.rojo[nombreTema] } : undefined}>
                {infracciones.length === 0
                  ? 'Sin infracciones'
                  : `${infracciones.length} infracci${infracciones.length > 1 ? 'ones' : 'ón'}`}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* DERECHA — la persona y su historial */}
      <div className="flex min-w-0 flex-1 flex-col gap-[1.2vh]">
        <Panel titulo="Titular" tema={tema} className="shrink-0">
          {/* Hasta tres líneas y con la fuente más contenida: los nombres de las
              unidades son largos ("Comando Aéreo del Ejército de Venezuela") y
              cortados a la mitad no identifican a nadie, que es justo para lo que
              está este panel. */}
          <p
            className={cn(
              'text-[clamp(0.95rem,2vw,2.25rem)] font-black uppercase leading-[1.1]',
              tema.texto
            )}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ficha.persona?.nombre || 'Sin registrar'}
          </p>
        </Panel>

        {infracciones.length > 0 && (
          <section
            className="shrink-0 rounded-2xl border-4 p-5"
            style={{ borderColor: SEMAFORO.rojo[nombreTema], backgroundColor: `${SEMAFORO.rojo[nombreTema]}1a` }}
          >
            <div className="flex items-center gap-3" style={{ color: SEMAFORO.rojo[nombreTema] }}>
              <TriangleAlert className="h-9 w-9 shrink-0" />
              <span className="text-[clamp(0.95rem,1.8vw,1.875rem)] font-black uppercase tracking-wide">
                {infracciones.length} infracción{infracciones.length > 1 ? 'es' : ''} activa{infracciones.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {infracciones.slice(0, 3).map((inf, i) => (
                <li key={i} className={cn('truncate text-[clamp(0.8rem,1.4vw,1.5rem)]', tema.textoSuave)}>
                  {(inf.tipo || '').replace(/_/g, ' ').toUpperCase()}
                  {inf.gravedad && <span className={tema.textoTenue}> · {inf.gravedad}</span>}
                  {inf.bloquea_salida && (
                    <span className="ml-2 rounded px-2 py-0.5 text-lg font-bold text-white"
                          style={{ backgroundColor: SEMAFORO.rojo[nombreTema] }}>
                      BLOQUEA SALIDA
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <Panel titulo="Últimos destinos" tema={tema} className="min-h-0 flex-1">
          {destinos.length === 0 ? (
            <p className={cn('text-[clamp(0.95rem,1.8vw,1.875rem)]', tema.textoTenue)}>Sin visitas previas registradas</p>
          ) : (
            <ul className="space-y-3 overflow-hidden">
              {destinos.map((d, i) => (
                <li key={i} className="flex items-baseline gap-4">
                  <MapPin className={cn('h-6 w-6 shrink-0 translate-y-1', tema.textoTenue)} />
                  <span className={cn('truncate text-[clamp(1rem,2.1vw,2.25rem)] font-bold', tema.texto)}>{d.destino}</span>
                  <span className={cn('ml-auto shrink-0 text-[clamp(0.8rem,1.3vw,1.5rem)]', tema.textoTenue)}>
                    {fechaCorta(d.fecha)} {hora(d.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
};

const Anteriores = ({ fichas, token, urlFoto, tema, nombreTema }) => (
  <Panel titulo="Anteriores" tema={tema} className="shrink-0">
   <div className="grid grid-cols-3 gap-4">
    {fichas.map((f) => {
      const { color } = semaforoDe(f, nombreTema);
      return (
        <div
          key={f.evento_id}
          className={cn('flex items-center gap-4 rounded-xl p-3', tema.tarjeta)}
          style={{ borderLeft: `5px solid ${color}` }}
        >
          <Foto url={urlFoto(f, 'placa')} alt="" token={token} tema={tema} className="h-14 w-24 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className={cn('truncate font-mono text-[clamp(0.9rem,1.7vw,1.875rem)] font-black', tema.texto)}>{f.placa}</p>
            <p className={cn('truncate text-[clamp(0.7rem,1.1vw,1.25rem)]', tema.textoSuave)}>
              {f.persona?.nombre || 'Sin registrar'}
            </p>
          </div>
          <span className={cn('ml-auto shrink-0 text-[clamp(0.7rem,1.1vw,1.25rem)]', tema.textoTenue)}>{hora(f.timestamp)}</span>
        </div>
      );
    })}
   </div>
  </Panel>
);

/**
 * Confirmación de que el guardia registró el acceso.
 *
 * Se pone encima de todo y en verde inequívoco. Sin esto no hay forma de saber
 * desde la garita si el toque llegó al servidor o se perdió, que es exactamente la
 * duda que deja el sistema cuando algo falla en silencio.
 */
const Confirmacion = ({ dato }) => (
  <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70">
    <div className="flex flex-col items-center gap-6 rounded-3xl border-4 border-emerald-400 bg-emerald-500/15 px-20 py-14">
      <CheckCircle2 className="h-[clamp(4rem,9vw,8rem)] w-[clamp(4rem,9vw,8rem)] text-emerald-400" />
      <p className="font-mono text-[clamp(2rem,5vw,4.5rem)] font-black tracking-widest text-white">
        {dato.placa}
      </p>
      <p className="text-[clamp(1.5rem,3.6vw,3rem)] font-black uppercase tracking-wide text-emerald-300">
        Acceso concedido
      </p>
      <p className="text-4xl text-white/70">{dato.destino}</p>
    </div>
  </div>
);

const Monitor = () => {
  const [tokenPantalla, setTokenPantalla] = useState(() => pantallaToken.capturarDeUrl());
  const esPantalla = Boolean(tokenPantalla);

  const { isAuthenticated } = useAuthStore();
  const necesitaEmparejar = !tokenPantalla && !isAuthenticated;

  const guardarToken = useCallback((token) => {
    pantallaToken.guardar(token);
    setTokenPantalla(token);
  }, []);

  const sesion = useNotifications();
  const pantalla = usePantallaSocket(tokenPantalla);

  // La detección que se muestra en grande va aparte de las anteriores: la primera
  // caduca sola y las otras se acumulan en la franja de abajo.
  const [actual, setActual] = useState(null);
  const [anteriores, setAnteriores] = useState([]);
  const [titulo, setTitulo] = useState('Alcabala');
  const [reloj, setReloj] = useState(new Date());
  const [confirmacion, setConfirmacion] = useState(null);
  const [nombreTema, setNombreTema] = useState(
    () => localStorage.getItem(CLAVE_TEMA) || 'oscuro'
  );

  const tema = TEMAS[nombreTema] || TEMAS.oscuro;
  const conectado = esPantalla ? pantalla.conectado : sesion.isConnected;
  const aviso = esPantalla ? pantalla.ultimo : sesion.lastNotification;

  const cambiarTema = useCallback((valor) => {
    setNombreTema(valor);
    localStorage.setItem(CLAVE_TEMA, valor);
  }, []);

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
    if (necesitaEmparejar) return;

    try {
      let lista;
      if (esPantalla) {
        const datos = await pantallaService.getMonitor(tokenPantalla);
        lista = datos.detecciones || [];
        if (datos.punto_nombre) setTitulo(datos.punto_nombre);
      } else {
        lista = await anprService.getMonitor(4);
      }

      // Al encender la pantalla, lo recuperado va al historial y NO al panel grande:
      // mostrar como "actual" una detección de hace media hora sería mentir. Solo si
      // la última es tan reciente que aún estaría en pantalla, se pone de actual.
      const [primera, ...resto] = lista;
      const frescura = primera
        ? (Date.now() - new Date(primera.timestamp).getTime()) / 1000
        : Infinity;

      if (primera && frescura < SEGUNDOS_EN_PANTALLA) {
        setActual(primera);
        setAnteriores(resto.slice(0, 3));
      } else {
        setActual(null);
        setAnteriores(lista.slice(0, 3));
      }
    } catch (error) {
      if (esPantalla && error?.response?.status === 401) {
        pantallaToken.borrar();
        setTokenPantalla(null);
        return;
      }
      console.warn('[monitor] no se pudo cargar el histórico inicial', error);
    }
  }, [esPantalla, tokenPantalla, necesitaEmparejar]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    // Cada segundo, y con los segundos a la vista: es la prueba de un vistazo de
    // que la pantalla sigue viva y no se quedó congelada.
    const t = setInterval(() => setReloj(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!aviso) return undefined;

    const limpiarAviso = () => {
      if (esPantalla) pantalla.limpiar();
      else sesion.setLastNotification(null);
    };

    // El guardia registró el acceso: se confirma en grande y el vehículo pasa al
    // historial, porque ya está resuelto y no hay nada que decidir sobre él.
    if (aviso.evento === 'anpr_resuelto') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmacion({ placa: aviso.placa, destino: aviso.destino });
       
      setActual((previa) => {
        if (previa && previa.evento_id === aviso.evento_id) {
          setAnteriores((prev) => [previa, ...prev].slice(0, 3));
          return null;
        }
        return previa;
      });
      limpiarAviso();
      const t = setTimeout(() => setConfirmacion(null), 4000);
      return () => clearTimeout(t);
    }

    // El guardia cambió el tema desde su teléfono.
    if (aviso.evento === 'pantalla_tema') {
      cambiarTema(aviso.tema === 'claro' ? 'claro' : 'oscuro');
      limpiarAviso();
      return undefined;
    }

    if (aviso.evento !== 'anpr_deteccion') return undefined;

    const ficha = aviso.ficha || {
      evento_id: aviso.evento_id,
      placa: aviso.placa,
      timestamp: aviso.timestamp,
      semaforo: aviso.semaforo,
      vehiculo: {
        tipo: aviso.tipo_vehiculo,
        color: aviso.color_vehiculo,
        marca: aviso.marca_vehiculo,
      },
      persona: { nombre: aviso.nombre_portador, coincidencia: aviso.coincidencia },
      destinos_recientes: [],
      infracciones: [],
    };

     
    setActual((previa) => {
      if (previa?.evento_id === ficha.evento_id) return previa;
      // La que estaba en grande baja al historial en vez de desaparecer.
      if (previa) setAnteriores((prev) => [previa, ...prev].slice(0, 3));
      return ficha;
    });
    limpiarAviso();
    return undefined;
  }, [aviso, esPantalla, pantalla, sesion, cambiarTema]);

  // Caducidad de la detección en pantalla. El temporizador se rearma con cada
  // vehículo nuevo, así que la cuenta siempre corre desde la última llegada.
  useEffect(() => {
    if (!actual) return undefined;

    const t = setTimeout(() => {
      setActual(null);
      setAnteriores((prev) => [actual, ...prev].slice(0, 3));
    }, SEGUNDOS_EN_PANTALLA * 1000);

    return () => clearTimeout(t);
  }, [actual]);

  if (necesitaEmparejar) {
    return <EmparejarPantalla onEmparejada={guardarToken} />;
  }

  return (
    <div className="flex h-screen flex-col gap-[1.5vh] p-[1.8vh]" style={{ backgroundColor: tema.fondo }}>
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <p className={cn('font-mono text-[clamp(0.6rem,0.95vw,1.125rem)] font-bold uppercase tracking-[0.3em]', tema.marcaAgua)}>
            Control de acceso // BAGFM
          </p>
          <h1 className={cn('text-[clamp(1.1rem,2.2vw,2.25rem)] font-black uppercase tracking-tight', tema.texto)}>{titulo}</h1>
        </div>

        <div className="flex items-center gap-6">
          {/* Botón grande: si el televisor tiene mando con puntero, hay que poder
              acertarle desde el otro lado de la garita. */}
          <button
            type="button"
            onClick={() => cambiarTema(nombreTema === 'oscuro' ? 'claro' : 'oscuro')}
            title="Cambiar entre modo claro y oscuro"
            className={cn('rounded-2xl p-4 transition-colors', tema.tarjeta, tema.textoSuave)}
          >
            {nombreTema === 'oscuro'
              ? <Sun className="h-8 w-8" />
              : <Moon className="h-8 w-8" />}
          </button>

          {conectado
            ? <Wifi className="h-7 w-7 text-emerald-500" />
            : <WifiOff className="h-7 w-7 text-red-500" />}

          <span className={cn('flex items-center gap-2 text-[clamp(1rem,1.9vw,1.875rem)] font-bold tabular-nums', tema.textoSuave)}>
            <Clock className="h-6 w-6" />
            {reloj.toLocaleTimeString('es-VE', {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </span>
        </div>
      </header>

      <Principal
        ficha={actual}
        token={tokenPantalla}
        urlFoto={urlFoto}
        tema={tema}
        nombreTema={nombreTema}
      />

      {anteriores.length > 0 && (
        <Anteriores
          fichas={anteriores}
          token={tokenPantalla}
          urlFoto={urlFoto}
          tema={tema}
          nombreTema={nombreTema}
        />
      )}

      {confirmacion && <Confirmacion dato={confirmacion} />}
    </div>
  );
};

export default Monitor;
