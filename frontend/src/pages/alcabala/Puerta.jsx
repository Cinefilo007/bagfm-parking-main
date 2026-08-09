import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Car, Camera, CheckCircle2, XCircle, AlertTriangle,
  Pencil, Trash2, Loader2, WifiOff, Wifi, Sun, Moon, GraduationCap, IdCard, ScanLine,
  LogIn, LogOut,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useNotifications } from '../../hooks/useNotifications';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Header } from '../../components/layout/Header';
import { BotonAyuda } from '../../components/ui/BotonAyuda';
import { anprService } from '../../services/anpr.service';
import { TourGuiado } from '../../components/ui/TourGuiado';
import { useTour } from '../../hooks/useTour';
import { PASOS_PUERTA } from '../../components/alcabala/pasosTour';
import { IdentificarConductor } from '../../components/alcabala/IdentificarConductor';
import { SelectorDestino, ConmutadorModoDestinos } from '../../components/alcabala/SelectorDestino';
import { leerModoDestinos, guardarModoDestinos } from '../../components/alcabala/modoDestinos';
import { cn } from '../../lib/utils';

/**
 * Pantalla de Puerta — Fase 1 del control de acceso por ANPR.
 *
 * La cámara lee la placa sola y la detección llega por WebSocket. El guardia no
 * teclea nada: ve la tarjeta y toca el destino. Todo el diseño está subordinado a
 * eso, porque en hora pico hay fila y cada segundo de más en la garita se acumula.
 *
 * En Fase 1 esta pantalla NO decide si el vehículo pasa. El brazo abre siempre y el
 * veredicto que se muestra es informativo: el objetivo es acumular datos, no filtrar.
 */

// El color lo decide el backend (`semaforo`) para que este teléfono y el monitor de
// la garita no puedan contradecirse nunca sobre si un vehículo pasa o no.
const SEMAFORO = {
  verde:    { color: '#16a34a', Icono: CheckCircle2,   rotulo: 'PUEDE PASAR' },
  amarillo: { color: '#d97706', Icono: AlertTriangle,  rotulo: 'REVISAR' },
  rojo:     { color: '#dc2626', Icono: XCircle,        rotulo: 'NO DEBE PASAR' },
};

const ETIQUETAS = {
  socio:         'SOCIO VIGENTE',
  pase:          'PASE VIGENTE',
  reingreso:     'YA ESTÁ ADENTRO',
  socio_vencido: 'MEMBRESÍA VENCIDA',
  pase_invalido: 'PASE NO VÁLIDO',
  no_registrado: 'NO REGISTRADO',
};

const veredictoDe = (f) => {
  const s = SEMAFORO[f?.semaforo] || SEMAFORO.amarillo;
  return { ...s, etiqueta: ETIQUETAS[f?.persona?.coincidencia] || 'NO REGISTRADO' };
};

/** Muestra la foto de la placa. Se descarga con sesión, no por URL pública. */
const FotoPlaca = ({ eventoId }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let vigente = true;
    let creada = null;

    anprService
      .getFotoUrl(eventoId, 'placa')
      .then((objectUrl) => {
        creada = objectUrl;
        if (vigente) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {/* sin foto: la tarjeta funciona igual */});

    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [eventoId]);

  if (!url) {
    return (
      <div className="flex h-20 w-full items-center justify-center rounded-lg bg-bg-low">
        <Camera className="h-6 w-6 text-text-sec/40" />
      </div>
    );
  }
  return <img src={url} alt="Placa detectada" className="h-20 w-full rounded-lg object-cover" />;
};

const TarjetaDeteccion = ({
  evento,
  destinos,
  modoDestinos,
  onResuelto,
  onDescartado,
  onActualizado,
  colapsadaInicial = false,
}) => {
  const [colapsada, setColapsada] = useState(colapsadaInicial);
  const [identificando, setIdentificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [destinoLibre, setDestinoLibre] = useState(null);
  const [texto, setTexto] = useState('');
  const [editandoPlaca, setEditandoPlaca] = useState(false);
  const [placa, setPlaca] = useState(evento.placa);
  // El sentido que se va a registrar. Sale de lo que dijo el backend y el guardia lo
  // puede cambiar: en la alcabala de carril compartido el sistema propone, no decide.
  // `desconocida` se muestra como entrada, que es el caso mayoritario, pero marcada
  // como suposición para que se vea que hay que mirarla.
  const [sentido, setSentido] = useState(
    evento.direccion === 'salida' ? 'salida' : 'entrada'
  );
  const eventoId = evento.evento_id || evento.id;

  const { etiqueta, color, Icono, rotulo } = veredictoDe(evento);
  const saliendo = sentido === 'salida';

  // Cuando el sentido lo fija la puerta donde está la cámara es un hecho; en cualquier
  // otro caso es una suposición y se marca, para que el guardia sepa cuál de las dos
  // cosas está viendo antes de cerrar el registro.
  const sentidoSeguro = evento.sentido_origen === 'camara';

  const resolver = async (destino, observaciones = null) => {
    setEnviando(true);
    try {
      await anprService.resolver(eventoId, {
        destinoId: destino?.id || null,
        observaciones,
        placaCorregida: placa !== evento.placa ? placa : null,
        sentidoCorregido: sentido !== evento.direccion ? sentido : null,
      });
      toast.success(
        saliendo ? `${placa} → salida registrada` : `${placa} → ${destino?.nombre || observaciones}`
      );
      onResuelto(eventoId);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo registrar');
      setEnviando(false);
    }
  };

  const tocarDestino = (destino) => {
    // `destino` en nulo es el botón "Otro": pide el texto a mano.
    if (!destino) {
      setDestinoLibre({ nombre: 'Otro' });
      return;
    }
    resolver(destino);
  };

  const descartar = async () => {
    setEnviando(true);
    try {
      await anprService.descartar(eventoId);
      onDescartado(eventoId);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo descartar');
      setEnviando(false);
    }
  };

  const v = evento.vehiculo || {};
  const atributos = [v.tipo, v.color, v.marca].filter(Boolean).join(' · ');

  // Qué vieron las dos cámaras del par (delantera y trasera del mismo paso). Las
  // detecciones anteriores a que existieran los roles no lo traen.
  const lectura = evento.lectura || {};

  // Un vehículo puede estar perfectamente registrado y aun así no saberse quién lo
  // conduce: eso es lo normal en el parque interno y en las placas que se dieron de
  // alta solo con la lectura de la cámara. Es justo el caso que el guardia debe poder
  // ver de un vistazo para decidir si, con la fila tranquila, pide la cédula.
  const conductorIdentificado = Boolean(evento.persona?.nombre);

  // Solo se ofrece pedir identificación en particulares y en los desconocidos. Los
  // de servicio y protocolares los conduce gente distinta cada día: atarles una
  // persona seria inventar un dato.
  //
  // Y nunca al salir: parar a alguien que ya se va para pedirle la cédula es la peor
  // versión de esto — molesta al visitante y tapona la puerta por un dato que se pudo
  // tomar a la entrada.
  const puedeIdentificar =
    (!v.uso || v.uso === 'particular') && !conductorIdentificado && !saliendo;

  return (
    <Card
      elevation={2}
      data-tour="tarjeta"
      className="relative overflow-hidden border-bg-high/10"
      style={{ borderLeft: `6px solid ${color}` }}
    >
      {enviando && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-card/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <div className="flex gap-4">
        <div className="w-32 shrink-0">
          <FotoPlaca eventoId={eventoId} />
        </div>

        <div className="min-w-0 flex-1">
          {editandoPlaca ? (
            <div className="flex items-center gap-2">
              <Input
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                className="font-mono text-2xl tracking-widest"
                autoFocus
              />
              <Boton size="sm" onClick={() => setEditandoPlaca(false)}>OK</Boton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditandoPlaca(true)}
              className="group flex items-center gap-2 text-left"
              title="Corregir placa"
            >
              <span className="font-mono text-3xl font-bold tracking-widest text-text-main">
                {placa}
              </span>
              <Pencil className="h-4 w-4 text-text-sec opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ color, backgroundColor: `${color}1a` }}
            >
              <Icono className="h-3.5 w-3.5" />
              {rotulo} · {etiqueta}
            </span>

            {/* Entrando o saliendo. Donde la puerta es de un solo sentido el backend
                lo da por hecho; en el carril compartido esto es una propuesta y el
                guardia la cambia con un toque, viendo el vehículo. */}
            <button
              type="button"
              onClick={() => setSentido(saliendo ? 'entrada' : 'salida')}
              title="Cambiar entre entrada y salida"
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black uppercase tracking-wide',
                saliendo
                  ? 'bg-warning/15 text-warning'
                  : 'bg-primary/15 text-primary'
              )}
            >
              {saliendo ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              {saliendo ? 'Saliendo' : 'Entrando'}{sentidoSeguro ? '' : '?'}
            </button>
          </div>

          {/* Las dos cámaras del par leyeron distinto. Se muestra la de más confianza
              y la otra queda a un toque: es más rápido y menos propenso a error que
              teclear la placa entera con un conductor esperando. */}
          {lectura.dudosa && lectura.alterna && placa !== lectura.alterna && (
            <button
              type="button"
              onClick={() => setPlaca(lectura.alterna)}
              className="mt-1 flex w-full items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-warning"
            >
              <ScanLine className="h-3.5 w-3.5 shrink-0" />
              La otra cámara leyó {lectura.alterna} — tocar para usarla
            </button>
          )}

          {conductorIdentificado ? (
            <p className="mt-1 truncate text-xs font-bold uppercase text-text-main">
              {evento.persona.nombre}
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-warning">
              <IdCard className="h-3.5 w-3.5 shrink-0" />
              {v.registrado ? 'Vehículo registrado · sin conductor' : 'Conductor sin identificar'}
            </p>
          )}
          {atributos && (
            <p className="mt-0.5 truncate text-xs uppercase text-text-sec">{atributos}</p>
          )}

          {/* Solo una de las dos cámaras vio este vehículo. En una moto es lo normal
              —lleva una sola placa— pero en un carro significa que la otra cámara no
              leyó: placa tapada, sucia, o el equipo empezando a fallar. */}
          {lectura.una_sola_camara && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-sec">
              <Camera className="h-3 w-3 shrink-0 opacity-60" />
              Leída por una sola cámara{lectura.rol ? ` (${lectura.rol})` : ''}
            </p>
          )}
        </div>
      </div>

      {destinoLibre ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-bold uppercase text-text-sec">
            ¿A dónde va? — {destinoLibre.nombre}
          </p>
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escriba el destino"
            autoFocus
          />
          <div className="flex gap-2">
            <Boton
              className="flex-1"
              disabled={!texto.trim()}
              onClick={() => resolver(null, texto.trim())}
            >
              Registrar
            </Boton>
            <Boton variant="ghost" onClick={() => setDestinoLibre(null)}>Volver</Boton>
          </div>
        </div>
      ) : colapsada ? (
        // Con cola, las tarjetas de atrás se muestran plegadas: la botonera entera
        // por cada vehiculo obligaba a un scroll larguísimo para llegar al siguiente.
        <button
          type="button"
          onClick={() => setColapsada(false)}
          className="mt-3 w-full rounded-xl border border-primary/20 bg-bg-low py-3 text-xs font-bold uppercase tracking-wide text-primary"
        >
          {saliendo ? 'Registrar salida' : 'Marcar destino'}
        </button>
      ) : identificando ? (
        <IdentificarConductor
          eventoId={eventoId}
          onListo={(ficha) => {
            setIdentificando(false);
            if (ficha) onActualizado(eventoId, ficha);
          }}
          onCancelar={() => setIdentificando(false)}
        />
      ) : (
        <>
          {/* Pedir la cédula va ARRIBA de los destinos, no debajo. Colgado al final de
              una botonera de treinta entidades no lo veía nadie, y lo que no se ve no
              se usa: el registro se quedaba lleno de placas sin dueño. */}
          {puedeIdentificar && (
            <button
              type="button"
              data-tour="identificar"
              onClick={() => setIdentificando(true)}
              className={cn(
                'mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl',
                'border-2 border-dashed border-primary/50 bg-primary/10 px-3',
                'text-xs font-black uppercase tracking-widest text-primary',
                'transition-colors hover:bg-primary/20 active:bg-primary/30'
              )}
            >
              <IdCard className="h-4 w-4" /> Identificar al conductor
            </button>
          )}

          {/* En una salida no hay destino que preguntar: el vehículo se va. Pedirlo
              obligaba al guardia a inventarse uno para poder cerrar la tarjeta. */}
          {saliendo ? (
            <button
              type="button"
              data-tour="destinos"
              onClick={() => resolver(null, null)}
              className={cn(
                'mt-4 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl',
                'border border-warning/30 bg-warning/10 px-3',
                'text-sm font-black uppercase tracking-widest text-warning',
                'transition-colors hover:bg-warning/20 active:bg-warning/30'
              )}
            >
              <LogOut className="h-5 w-5" /> Registrar salida
            </button>
          ) : (
            /* Un toque cierra el registro. Botones grandes o búsqueda escrita, según
               cómo prefiera trabajar el guardia de este teléfono. */
            <SelectorDestino
              destinos={destinos}
              modo={modoDestinos}
              onElegir={tocarDestino}
            />
          )}

          <div data-tour="secundarias" className="mt-3 flex flex-wrap justify-end gap-2 border-t border-text-main/10 pt-3">
            <Boton variant="ghost" size="sm" onClick={descartar}>
              <Trash2 className="h-3.5 w-3.5" /> Descartar
            </Boton>
          </div>
        </>
      )}
    </Card>
  );
};

const Puerta = () => {
  const { lastNotification, isConnected, setLastNotification } = useNotifications();
  const [destinos, setDestinos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  // Preferencia del teléfono, no de la cuenta: la misma cuenta de alcabala la usan
  // guardias distintos en cada relevo, pero el aparato suele ser el mismo.
  const [modoDestinos, setModoDestinos] = useState(leerModoDestinos);
  const tour = useTour('alcabala-puerta');
  const audioRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const [dst, pendientes] = await Promise.all([
        anprService.getDestinos(),
        anprService.getPendientes(),
      ]);
      setDestinos(dst);
      setEventos(pendientes);
    } catch {
      toast.error('No se pudo cargar la pantalla de puerta');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // La segunda cámara del par no abre tarjeta nueva: refresca la que ya está en
  // pantalla. Puede haber cambiado la placa —si esa cámara leyó con más confianza— o
  // haber aparecido el aviso de que las dos lecturas no coinciden.
  useEffect(() => {
    if (lastNotification?.evento !== 'anpr_actualizado') return;

    const { evento_id: id, ficha } = lastNotification;
    setEventos((previos) =>
      previos.map((e) => ((e.evento_id || e.id) === id ? { ...e, ...(ficha || {}) } : e))
    );
    setLastNotification(null);
  }, [lastNotification, setLastNotification]);

  // Cada detección que llega por WebSocket se antepone a la lista. El backend ya
  // deduplicó los disparos repetidos del mismo vehículo, así que aquí no hace falta.
  useEffect(() => {
    if (lastNotification?.evento !== 'anpr_deteccion') return;

    // El aviso trae la ficha ya armada por el servidor; si faltara, se pinta con
    // los campos sueltos para no perder la detección.
    const nuevo = lastNotification.ficha || {
      evento_id: lastNotification.evento_id,
      placa: lastNotification.placa,
      semaforo: lastNotification.semaforo,
      vehiculo: {
        tipo: lastNotification.tipo_vehiculo,
        color: lastNotification.color_vehiculo,
        marca: lastNotification.marca_vehiculo,
      },
      persona: {
        nombre: lastNotification.nombre_portador,
        coincidencia: lastNotification.coincidencia,
      },
    };

    setEventos((previos) =>
      previos.some((e) => (e.evento_id || e.id) === nuevo.evento_id) ? previos : [nuevo, ...previos]
    );
    audioRef.current?.play?.().catch(() => {});
    setLastNotification(null);
  }, [lastNotification, setLastNotification]);

  const cambiarTema = useCallback(async (tema) => {
    try {
      await anprService.cambiarTemaPantalla(tema);
      toast.success(`Monitor en modo ${tema}`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo cambiar el monitor');
    }
  }, []);

  const quitar = useCallback((id) => {
    setEventos((previos) => previos.filter((e) => (e.evento_id || e.id) !== id));
  }, []);

  // Tras identificar al conductor, el backend devuelve la ficha recalculada: la misma
  // placa que estaba en ámbar como desconocida pasa a verde y con nombre. Se sustituye
  // en el sitio para que el guardia vea el resultado de lo que acaba de hacer.
  const actualizar = useCallback((id, ficha) => {
    setEventos((previos) =>
      previos.map((e) => ((e.evento_id || e.id) === id ? { ...e, ...ficha } : e))
    );
  }, []);

  const cambiarModoDestinos = useCallback((modo) => {
    setModoDestinos(modo);
    guardarModoDestinos(modo);
  }, []);

  return (
    <div className="min-h-screen bg-bg-app">
      {/* En móvil la ayuda flota a la izquierda, en espejo del conmutador de tema que
          flota a la derecha. En escritorio no cabe ahí —está la barra lateral— y sigue
          siendo el botón con texto de la cabecera. */}
      <BotonAyuda onClick={tour.abrir} />

      <Header
        titulo="Puerta"
        subtitle="Registro automático por placa"
        sitioAyuda
        actionElement={
          <Boton
            size="sm"
            variant="outline"
            className="hidden border-primary/40 text-primary lg:inline-flex"
            onClick={tour.abrir}
          >
            <GraduationCap className="h-4 w-4" /> Cómo funciona
          </Boton>
        }
      />

      <main className="mt-[-1rem] space-y-4 px-4 pb-24 lg:px-8">
      <div data-tour="estado-camara" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">
        {isConnected ? (
          <><Wifi className="h-3.5 w-3.5 text-success" /> En línea con la cámara</>
        ) : (
          <><WifiOff className="h-3.5 w-3.5 text-error" /> Sin conexión — reintentando</>
        )}

        <ConmutadorModoDestinos modo={modoDestinos} onCambiar={cambiarModoDestinos} />

        {/* El TV puede estar colgado sin mando a mano; a pleno sol el fondo oscuro
            no se lee. Desde aquí siempre se puede cambiar. */}
        <span data-tour="tema-monitor" className="ml-auto flex items-center gap-1">
          <span className="text-text-sec">Monitor:</span>
          <button
            type="button"
            onClick={() => cambiarTema('claro')}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-text-sec transition-colors hover:bg-bg-high"
          >
            <Sun className="h-3.5 w-3.5" /> Claro
          </button>
          <button
            type="button"
            onClick={() => cambiarTema('oscuro')}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-text-sec transition-colors hover:bg-bg-high"
          >
            <Moon className="h-3.5 w-3.5" /> Oscuro
          </button>
        </span>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : eventos.length === 0 ? (
        <Card elevation={2} className="border-bg-high/10 py-16 text-center">
          <Car className="mx-auto h-10 w-10 text-text-sec/30" />
          <p className="mt-3 text-sm font-bold uppercase tracking-wide text-text-sec">
            Esperando vehículos
          </p>
          <p className="mt-1 text-xs text-text-sec/70">
            La cámara registra la placa sola. Solo marque el destino.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {eventos.map((evento, i) => (
            <TarjetaDeteccion
              key={evento.evento_id || evento.id}
              colapsadaInicial={eventos.length > 1 && i > 0}
              evento={evento}
              destinos={destinos}
              modoDestinos={modoDestinos}
              onResuelto={quitar}
              onDescartado={quitar}
              onActualizado={actualizar}
            />
          ))}
        </div>
      )}
        <TourGuiado
          pasos={PASOS_PUERTA}
          clave="alcabala-puerta"
          abierto={tour.abierto}
          onCerrar={tour.cerrar}
        />
      </main>
    </div>
  );
};

export default Puerta;
