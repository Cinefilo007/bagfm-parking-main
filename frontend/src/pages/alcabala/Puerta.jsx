import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Car, Camera, CheckCircle2, XCircle, AlertTriangle,
  Pencil, Trash2, Loader2, WifiOff, Wifi, Sun, Moon, GraduationCap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useNotifications } from '../../hooks/useNotifications';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Header } from '../../components/layout/Header';
import { anprService } from '../../services/anpr.service';
import { TourGuiado } from '../../components/ui/TourGuiado';
import { useTour } from '../../hooks/useTour';
import { PASOS_PUERTA } from '../../components/alcabala/pasosTour';
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

const veredictoDe = (evento) => {
  const s = SEMAFORO[evento?.semaforo] || SEMAFORO.amarillo;
  return { ...s, etiqueta: ETIQUETAS[evento?.coincidencia] || 'NO REGISTRADO' };
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

const TarjetaDeteccion = ({ evento, destinos, onResuelto, onDescartado }) => {
  const [enviando, setEnviando] = useState(false);
  const [destinoLibre, setDestinoLibre] = useState(null);
  const [texto, setTexto] = useState('');
  const [editandoPlaca, setEditandoPlaca] = useState(false);
  const [placa, setPlaca] = useState(evento.placa);

  const { etiqueta, color, Icono, rotulo } = veredictoDe(evento);

  const resolver = async (destino, observaciones = null) => {
    setEnviando(true);
    try {
      await anprService.resolver(evento.id, {
        destinoId: destino?.id || null,
        observaciones,
        placaCorregida: placa !== evento.placa ? placa : null,
      });
      toast.success(`${placa} → ${destino?.nombre || observaciones}`);
      onResuelto(evento.id);
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
      await anprService.descartar(evento.id);
      onDescartado(evento.id);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo descartar');
      setEnviando(false);
    }
  };

  const atributos = [evento.tipo_vehiculo, evento.color_vehiculo, evento.marca_vehiculo]
    .filter(Boolean)
    .join(' · ');

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
          <FotoPlaca eventoId={evento.id} />
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

          <div
            className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ color, backgroundColor: `${color}1a` }}
          >
            <Icono className="h-3.5 w-3.5" />
            {rotulo} · {etiqueta}
          </div>

          {atributos && (
            <p className="mt-1 truncate text-xs uppercase text-text-sec">{atributos}</p>
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
      ) : (
        <>
          {/* Un toque cierra el registro. Botones grandes: se opera de pie y con prisa. */}
          <div data-tour="destinos" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {destinos.map((destino) => (
              <button
                key={destino.id}
                type="button"
                onClick={() => tocarDestino(destino)}
                className={cn(
                  'min-h-[56px] rounded-xl border border-primary/20 bg-bg-low px-3',
                  'text-xs font-bold uppercase tracking-wide text-text-main',
                  'transition-colors hover:bg-primary/10 active:bg-primary/20'
                )}
              >
                {destino.nombre}
              </button>
            ))}
            <button
              type="button"
              onClick={() => tocarDestino(null)}
              className={cn(
                'min-h-[56px] rounded-xl border border-text-sec/20 bg-bg-low px-3',
                'text-xs font-bold uppercase tracking-wide text-text-sec',
                'transition-colors hover:bg-primary/10 active:bg-primary/20'
              )}
            >
              Otro
            </button>
          </div>

          <div data-tour="secundarias" className="mt-3 flex justify-end gap-2 border-t border-text-main/10 pt-3">
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

  // Cada detección que llega por WebSocket se antepone a la lista. El backend ya
  // deduplicó los disparos repetidos del mismo vehículo, así que aquí no hace falta.
  useEffect(() => {
    if (lastNotification?.evento !== 'anpr_deteccion') return;

    const nuevo = {
      id: lastNotification.evento_id,
      placa: lastNotification.placa,
      coincidencia: lastNotification.coincidencia,
      tipo_vehiculo: lastNotification.tipo_vehiculo,
      color_vehiculo: lastNotification.color_vehiculo,
      marca_vehiculo: lastNotification.marca_vehiculo,
      timestamp_recibido: lastNotification.timestamp,
    };

    setEventos((previos) =>
      previos.some((e) => e.id === nuevo.id) ? previos : [nuevo, ...previos]
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
    setEventos((previos) => previos.filter((e) => e.id !== id));
  }, []);

  return (
    <div className="min-h-screen bg-bg-app">
      <Header
        titulo="Puerta"
        subtitle="Registro automático por placa"
        actionElement={
          <Boton size="sm" variant="secundario" onClick={tour.abrir}>
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

        {/* El TV puede estar colgado sin mando a mano; a pleno sol el fondo oscuro
            no se lee. Desde aquí siempre se puede cambiar. */}
        <span className="ml-auto flex items-center gap-1">
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
          {eventos.map((evento) => (
            <TarjetaDeteccion
              key={evento.id}
              evento={evento}
              destinos={destinos}
              onResuelto={quitar}
              onDescartado={quitar}
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
