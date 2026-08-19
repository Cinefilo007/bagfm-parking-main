import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScanLine, RefreshCw, Loader2, X, Camera, Clock, ArrowRight, ArrowLeft,
  HelpCircle, ImageOff, User, UserCheck, Building2,
} from 'lucide-react';

import { anprService } from '../../services/anpr.service';
import { cn } from '../../lib/utils';

/**
 * Monitor de capturas ANPR — Comandante.
 *
 * Sustituye a la gráfica de flujo vehicular. El motivo del cambio no es estético: una
 * línea de totales por día dice que hubo tráfico, pero no deja ver una placa mal leída
 * ni una cámara que dejó de aportar. Aquí cada captura se ve con su foto, y de un
 * vistazo se nota si una de las dos cámaras del paso ha dejado de confirmar.
 *
 * Se piden solo capturas reales (`sinDuplicados`): la segunda lectura de un vehículo no
 * guarda fotos —son del mismo carro de hace segundos— así que en una pantalla hecha de
 * fotos saldría como una tarjeta vacía.
 */

const CUANTAS = 12;

const SEMAFOROS = {
  verde: { borde: 'border-l-success', texto: 'text-success', fondo: 'bg-success/10' },
  amarillo: { borde: 'border-l-warning', texto: 'text-warning', fondo: 'bg-warning/10' },
  rojo: { borde: 'border-l-danger', texto: 'text-danger', fondo: 'bg-danger/10' },
};

// Mismo mapa que `_SEMAFORO_POR_COINCIDENCIA` en services/placa_lookup.py. Se duplica
// aquí a sabiendas: el histórico devuelve `coincidencia` cruda, sin el semáforo ya
// resuelto que sí trae la ficha del guardia. Lo que NO se duplica es la decisión de
// dejar pasar o no — eso sigue viviendo solo en el backend; esto es color de pantalla.
const SEMAFORO_DE = {
  socio: 'verde',
  vehiculo_registrado: 'verde',
  pase: 'verde',
  reingreso: 'amarillo',
  no_registrado: 'amarillo',
  socio_vencido: 'rojo',
  pase_invalido: 'rojo',
};

const ETIQUETA_COINCIDENCIA = {
  socio: 'Identificado',
  vehiculo_registrado: 'Registrado',
  pase: 'Pase vigente',
  reingreso: 'Reingreso',
  no_registrado: 'Sin registrar',
  socio_vencido: 'Vencido',
  pase_invalido: 'Pase inválido',
};

const semaforoDe = (coincidencia) => SEMAFOROS[SEMAFORO_DE[coincidencia] || 'amarillo'];

/**
 * Qué foto va en grande y cuál en la miniatura.
 *
 * En el hueco principal va SIEMPRE la panorámica del vehículo, nunca un recorte: es la
 * única que identifica el carro, y en 28 píxeles de miniatura no sirve de nada.
 *
 * El respaldo a la foto de placa no es teórico. Cuando la cámara no consigue leer la
 * matrícula no manda recorte, solo la panorámica, y el backend la guardaba en el hueco
 * del recorte (ya corregido en `_clasificar_fotos`). Las capturas grabadas antes de esa
 * corrección siguen así en la base, y sin este respaldo se verían para siempre con la
 * foto del vehículo encogida en la esquina y un "sin foto" en el centro.
 */
/**
 * El nombre de la PERSONA de una captura, si la hay.
 *
 * Manda el conductor que identificó el guardia sobre el titular de la placa: son cosas
 * distintas y, cuando consta, el conductor es quien de verdad iba en el carro ese día.
 *
 * Devuelve nulo cuando el titular es una entidad, aunque haya nombre. En ese caso el
 * nombre es el de una organización y ya se muestra en su propia línea: repetirlo aquí lo
 * pintaría además con icono de persona, dando a entender que alguien se llama "Club de
 * Pádel La Carlota".
 */
const personaDe = (evento) => {
  if (evento.conductor_nombre) return evento.conductor_nombre;
  if (evento.titular_tipo === 'socio') return evento.titular_nombre;
  return null;
};

const repartirFotos = (evento) => {
  if (evento.foto_escena_url) {
    return { principal: 'escena', miniatura: evento.foto_placa_url ? 'placa' : null };
  }
  // Sin escena: lo que haya se muestra en grande, y la miniatura sobra porque sería
  // exactamente la misma imagen repetida.
  return { principal: evento.foto_placa_url ? 'placa' : null, miniatura: null };
};

const soloHora = (valor) =>
  valor ? new Date(valor).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '—';

const fechaCompleta = (valor) =>
  valor ? new Date(valor).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'medium' }) : '—';

/**
 * Una foto de la detección.
 *
 * No se puede poner la URL directa en un <img>: el endpoint exige el JWT en la cabecera
 * porque son fotos de civiles. Hay que traerla como blob y soltar el object URL al
 * desmontar, o cada refresco del monitor deja memoria colgando en el navegador.
 */
const FotoEvento = ({ eventoId, cual, className, alt }) => {
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    let creada = null;

    anprService.getFotoUrl(eventoId, cual)
      .then((u) => {
        creada = u;
        if (vivo) setUrl(u);
        else URL.revokeObjectURL(u);   // se desmontó mientras descargaba
      })
      .catch(() => { if (vivo) setFallo(true); });

    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [eventoId, cual]);

  if (fallo) {
    return (
      <div className={cn('flex items-center justify-center bg-bg-low', className)}>
        <ImageOff className="h-4 w-4 text-text-muted" />
      </div>
    );
  }

  if (!url) return <div className={cn('animate-pulse bg-bg-low', className)} />;

  return <img src={url} alt={alt} className={className} loading="lazy" />;
};

/** Flecha del sentido. El `?` marca lo que es una suposición, no un dato. */
const Sentido = ({ direccion, origen, className }) => {
  const dudoso = origen === 'firmware' || origen === 'sin_dato' || !direccion || direccion === 'desconocida';
  const Icono = direccion === 'entrada' ? ArrowRight : direccion === 'salida' ? ArrowLeft : HelpCircle;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Icono className="h-3 w-3" />
      {direccion === 'entrada' ? 'Entrada' : direccion === 'salida' ? 'Salida' : 'Sin sentido'}
      {dudoso && direccion && direccion !== 'desconocida' && <span title="Sentido supuesto">?</span>}
    </span>
  );
};

/** Un par etiqueta/valor de la ficha. Fuera del modal: declararlo dentro lo recrearía
 *  en cada render y le reiniciaría el estado. */
const Dato = ({ etiqueta, valor, resalte }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">{etiqueta}</p>
    <p className={cn('mt-0.5 text-xs text-text-main', resalte && 'font-bold')}>{valor || '—'}</p>
  </div>
);

/** Detalle de una captura, con la escena en grande. */
const ModalCaptura = ({ evento, onCerrar }) => {
  const s = semaforoDe(evento.coincidencia);
  const { principal, miniatura } = repartirFotos(evento);

  // Escape para cerrar: el ratón tiene que viajar hasta la X, y esto se mira de pie.
  useEffect(() => {
    const alPulsar = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  return (
    <div
      // z-[6000] y no z-50: el sidebar es z-[1000] y con un valor menor el modal salía
      // por debajo, con la placa cortada por el menú. Es el mismo escalón que usa el
      // modal del mapa táctico, que es el otro que tiene que tapar la navegación.
      className="fixed inset-0 z-[6000] flex items-center justify-center overflow-y-auto bg-black/80 p-4"
      onClick={onCerrar}
    >
      <div
        className="my-auto w-full max-w-4xl rounded-2xl border border-bg-high/20 bg-bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn('flex items-center justify-between gap-4 border-b border-bg-high/10 p-4', s.fondo)}>
          <div className="min-w-0">
            <p className="font-mono text-2xl font-black tracking-wider text-text-main">{evento.placa}</p>
            <p className={cn('text-[10px] font-black uppercase tracking-widest', s.texto)}>
              {ETIQUETA_COINCIDENCIA[evento.coincidencia] || 'Sin veredicto'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-2 text-text-sec transition-colors hover:bg-bg-high/20 hover:text-text-main"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {principal ? (
            <FotoEvento
              eventoId={evento.id}
              cual={principal}
              alt={`Vehículo ${evento.placa}`}
              className="max-h-[55vh] w-full rounded-xl bg-bg-low object-contain"
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl bg-bg-low text-xs text-text-muted">
              Esta captura no guardó ninguna foto
            </div>
          )}

          {miniatura && (
            <div className="mt-3">
              <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-text-muted">
                Recorte de la placa
              </p>
              <FotoEvento
                eventoId={evento.id}
                cual={miniatura}
                alt={`Placa ${evento.placa}`}
                className="h-16 rounded-lg bg-bg-low object-contain"
              />
            </div>
          )}

          {/* Quién va en el carro, aparte de la rejilla de datos técnicos: cuando se
              abre una captura es lo primero que se busca. */}
          {(evento.conductor_nombre || evento.titular_nombre || evento.entidad_nombre) && (
            <div className="mt-4 grid gap-3 rounded-xl bg-bg-low p-3 sm:grid-cols-3">
              {/* Solo cuando el titular es una persona. Si es una entidad, su nombre ya
                  sale en "Entidad" y ponerlo dos veces no añade nada. */}
              {evento.titular_tipo === 'socio' && (
                <Dato etiqueta="Titular de la placa" valor={evento.titular_nombre} resalte />
              )}
              {evento.entidad_nombre && (
                <Dato etiqueta="Entidad" valor={evento.entidad_nombre} resalte />
              )}
              {/* Solo aparece si el guardia llegó a identificarlo. Que falte no es un
                  fallo: identificar al conductor es opcional y no se le pide en salidas. */}
              <Dato
                etiqueta="Conductor identificado"
                valor={evento.conductor_nombre || 'No se identificó'}
                resalte={!!evento.conductor_nombre}
              />
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            <Dato etiqueta="Hora de captura" valor={fechaCompleta(evento.timestamp_recibido)} resalte />
            <Dato etiqueta="Alcabala" valor={evento.punto_nombre} />
            <Dato etiqueta="Cámara" valor={evento.camara_nombre} />
            <Dato etiqueta="Extremo que leyó" valor={evento.camara_rol} />
            <Dato
              etiqueta="Sentido"
              valor={<Sentido direccion={evento.direccion} origen={evento.sentido_origen} />}
            />
            <Dato etiqueta="Confianza" valor={evento.placa_confianza != null ? `${evento.placa_confianza}%` : null} />
            <Dato etiqueta="Tipo" valor={evento.tipo_vehiculo} />
            <Dato etiqueta="Color" valor={evento.color_vehiculo} />
            <Dato etiqueta="Marca" valor={evento.marca_vehiculo} />
            <Dato etiqueta="Estado" valor={evento.estado} />
            {/* Contrastar los dos relojes es justo para lo que existe timestamp_camara:
                si se separan, la cámara tiene la hora corrida. */}
            <Dato etiqueta="Hora según la cámara" valor={fechaCompleta(evento.timestamp_camara)} />
            <Dato
              etiqueta="Confirmada por"
              valor={
                evento.confirmada_por_rol
                  ? `Cámara ${evento.confirmada_por_rol}`
                  : 'Solo una cámara la leyó'
              }
            />
            {evento.placa_alterna && (
              <Dato etiqueta="La otra cámara leyó" valor={evento.placa_alterna} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Una captura en la tira. */
const TarjetaCaptura = ({ evento, onAbrir }) => {
  const s = semaforoDe(evento.coincidencia);
  const { principal, miniatura } = repartirFotos(evento);
  const persona = personaDe(evento);

  return (
    <button
      type="button"
      onClick={() => onAbrir(evento)}
      className={cn(
        // `flex-col` con la foto en `flex-1`: la tira se estira a lo alto del panel y sin
        // esto la tarjeta dejaba un hueco muerto debajo del texto en vez de dárselo a la
        // foto, que es lo único que gana algo al crecer.
        'group flex w-52 shrink-0 flex-col overflow-hidden rounded-xl border border-bg-high/10 border-l-4 bg-bg-low text-left',
        'transition-transform hover:-translate-y-0.5 hover:border-primary/30',
        s.borde,
      )}
    >
      <div className="relative min-h-[6rem] w-full flex-1 overflow-hidden bg-black/40">
        {principal ? (
          <FotoEvento
            eventoId={evento.id}
            cual={principal}
            alt={`Vehículo ${evento.placa}`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-text-muted">Sin foto</div>
        )}

        {/* El recorte de la placa encima de la escena: es lo que confirma de un vistazo
            que la lectura corresponde al vehículo de la foto y no a otro. Se omite
            cuando la principal ya ES esa misma foto, para no repetirla en miniatura. */}
        {miniatura && (
          <FotoEvento
            eventoId={evento.id}
            cual={miniatura}
            alt={`Placa ${evento.placa}`}
            className="absolute bottom-1 right-1 h-7 rounded border border-white/20 bg-black/60 object-contain shadow-lg"
          />
        )}
      </div>

      <div className="p-2">
        {/* Placa + identidad en la misma línea para no empujar la foto hacia arriba. */}
        <div className="flex items-baseline justify-between gap-1">
          <p className="shrink-0 font-mono text-sm font-black tracking-wider text-text-main">{evento.placa}</p>
          {persona ? (
            <p className="flex items-center gap-1 truncate text-[10px] text-text-main" title={persona}>
              {evento.conductor_nombre
                ? <UserCheck className="h-2.5 w-2.5 shrink-0 text-success" />
                : <User className="h-2.5 w-2.5 shrink-0 text-text-muted" />}
              <span className="truncate">{persona}</span>
            </p>
          ) : (
            <span className={cn('shrink-0 text-[9px] font-black uppercase tracking-wider', s.texto)}>
              {ETIQUETA_COINCIDENCIA[evento.coincidencia] || 'Sin veredicto'}
            </span>
          )}
        </div>

        {evento.entidad_nombre && (
          <p className="flex items-center gap-1 truncate text-[9px] text-text-sec" title={evento.entidad_nombre}>
            <Building2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{evento.entidad_nombre}</span>
          </p>
        )}

        <div className="mt-1 flex items-center justify-between text-[9px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />{soloHora(evento.timestamp_recibido)}
          </span>
          <Sentido direccion={evento.direccion} origen={evento.sentido_origen} />
        </div>

        <p className="mt-0.5 truncate text-[9px] text-text-muted" title={evento.camara_nombre || ''}>
          <Camera className="mr-1 inline h-2.5 w-2.5" />
          {evento.camara_rol || 'sin rol'}
          {!evento.confirmada_por_rol && <span className="ml-1 text-warning">· sin pareja</span>}
        </p>
      </div>
    </button>
  );
};

const MonitorCapturasAnpr = () => {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const montado = useRef(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await anprService.getHistorial({ size: CUANTAS, sinDuplicados: true });
      if (!montado.current) return;
      setEventos(data?.items || []);
      setError(false);
    } catch {
      if (montado.current) setError(true);
    } finally {
      if (montado.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    cargar();
    // Se refresca solo, pero sin prisa: esto es una vista de mando, no la pantalla del
    // guardia —esa va por WebSocket— y aquí cada tarjeta arrastra dos descargas de foto.
    const t = setInterval(cargar, 60000);
    return () => { montado.current = false; clearInterval(t); };
  }, [cargar]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-bg-high/10 bg-bg-card p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ScanLine size={16} className="text-primary" />
          </div>
          <div>
            <h4 className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-text-main">
              Capturas ANPR
            </h4>
            <p className="mt-0.5 text-[9px] uppercase tracking-widest text-text-muted">
              Últimas {CUANTAS} lecturas · todas las alcabalas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="rounded-lg p-2 text-text-sec transition-colors hover:bg-bg-high/20 hover:text-primary disabled:opacity-40"
          aria-label="Actualizar capturas"
        >
          {cargando
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center text-[10px] uppercase tracking-widest text-danger">
          No se pudieron cargar las capturas
        </div>
      ) : cargando && eventos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">
            Sincronizando capturas...
          </span>
        </div>
      ) : eventos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
            Ninguna captura todavía
          </p>
          <p className="text-[9px] text-text-muted">
            Si las cámaras están instaladas, revise Cámaras ANPR → Diagnóstico.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {eventos.map((e) => (
            <TarjetaCaptura key={e.id} evento={e} onAbrir={setAbierto} />
          ))}
        </div>
      )}

      {abierto && <ModalCaptura evento={abierto} onCerrar={() => setAbierto(null)} />}
    </div>
  );
};

export default MonitorCapturasAnpr;
