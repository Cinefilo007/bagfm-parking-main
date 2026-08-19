import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DoorClosed, Plus, Loader2, ArrowLeft, QrCode, Users, Search,
  UserPlus, Trash2, Download, X, Car, ShieldAlert, Phone, Pencil,
  ChevronDown, ChevronLeft, ChevronRight, RefreshCw, UserCheck,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
// Import con nombre y no por defecto: `react-qr-code` es CommonJS y su export por
// defecto no sobrevive al interop del bundler (error #130 de React).
import { QRCode } from 'react-qr-code';
import { toPng } from 'html-to-image';

import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ModalConfirmacion } from '../../components/ui/ModalConfirmacion';
import { Header } from '../../components/layout/Header';
import CampoConSugerencias from '../../components/comando/CampoConSugerencias';
import { dormitoriosService } from '../../services/dormitorios.service';
import { cn } from '../../lib/utils';

/**
 * Detalle de un dormitorio: sus habitaciones y quién ocupa cada cama.
 *
 * Las habitaciones van plegadas y paginadas. Un dormitorio de tres plantas no cabe en
 * una pantalla, y desplegarlas todas obligaba a hacer scroll hasta la 40 para ver quién
 * duerme ahí. El buscador filtra por PERSONA y abre sola la habitación donde está: la
 * pregunta real es "¿dónde duerme Rojas?", no "¿existe la 104?".
 *
 * Dos QR distintos conviven aquí y conviene no confundirlos:
 *
 *   - El de la PUERTA identifica a la habitación. Se imprime, se pega y abre la ficha
 *     pública de sus ocupantes.
 *   - El PEATONAL identifica a una persona en la alcabala. Es para quien no tiene
 *     vehículo, porque la cámara solo sabe leer placas.
 *
 * Los dos son PERSISTENTES: abrirlos devuelve el mismo código, porque están impresos y
 * pegados o en un bolsillo. Regenerarlos es un botón aparte que anula el anterior.
 */

const IconoPuerta = DoorClosed;
const IconoGente = Users;
const IconoCarro = Car;
const IconoTelefono = Phone;
const IconoAlerta = ShieldAlert;
const IconoLupa = Search;
const IconoFlechaAbajo = ChevronDown;
const IconoAnterior = ChevronLeft;
const IconoSiguiente = ChevronRight;
const IconoRegenerar = RefreshCw;
const IconoPersonaHallada = UserCheck;

const POR_PAGINA = 8;

/**
 * Cómo se nombra cada rol delante de quien administra la base.
 *
 * El valor crudo de `rol_tipo` no vale para enseñarlo: "SOCIO" es el vocabulario de
 * cuando el sistema servía solo a los clubes, y decirle "socio" a un sargento en un
 * censo militar suena a otra cosa. La columna no se toca —es un ENUM nativo de
 * Postgres y alterarlo ya costó caro—, se traduce al mostrarla.
 */
const NOMBRE_DEL_ROL = {
  COMANDANTE: 'comandante',
  ADMIN_BASE: 'administración de la base',
  SUPERVISOR: 'supervisor de base',
  ALCABALA: 'guardia de alcabala',
  ADMIN_ENTIDAD: 'administración de entidad',
  SUPERVISOR_PARQUEROS: 'supervisor de parqueros',
  PARQUERO: 'parquero',
  SOCIO: 'personal registrado',
  BOMBERO: 'bombero',
  SUPERVISOR_BOMBEROS: 'supervisor de bomberos',
};

const nombrarRol = (rol) => NOMBRE_DEL_ROL[rol] || (rol || '').replace(/_/g, ' ').toLowerCase();

const FORM_HABITACION = { numero: '', piso: '', camas: 1, notas: '' };
const FORM_INTEGRANTE = {
  cedula: '', nombre: '', apellido: '', telefono: '', email: '',
  grado: '', unidad: '', jefe_nombre: '', jefe_telefono: '', tiene_vehiculo: false,
};
const FORM_VEHICULO = { vehiculo_id: null, placa: '', marca: '', modelo: '', color: '' };

/**
 * Ficha de un ocupante.
 *
 * Muestra a la vez lo que la persona DECLARÓ sobre tener vehículo y las placas que
 * constan realmente a su nombre. Cuando no coinciden lo dice en voz alta: ese cruce es
 * la razón de ser del módulo, y esconderlo detrás de un solo indicador lo perdería.
 */
const FichaIntegrante = ({ integrante, onQrPeatonal, onDesasignar }) => {
  const declaroSinVehiculo = !integrante.tiene_vehiculo;
  const tienePlacas = integrante.vehiculos.length > 0;
  const discrepa = declaroSinVehiculo && tienePlacas;

  return (
    <div className="p-4 rounded-xl bg-bg-high/20 border border-text-main/5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {integrante.grado && (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                {integrante.grado}
              </span>
            )}
            <span className="text-sm font-black uppercase tracking-tight text-text-main truncate">
              {integrante.nombre} {integrante.apellido}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            <span className="font-mono">{integrante.cedula}</span>
            {integrante.unidad && <span className="truncate">{integrante.unidad}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onQrPeatonal(integrante)}
            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
            title="Ver carnet QR peatonal"
          >
            <QrCode size={15} />
          </button>
          <button
            onClick={() => onDesasignar(integrante)}
            className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
            title="Liberar la cama"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {(integrante.telefono || integrante.jefe_nombre) && (
        <div className="flex flex-col gap-1 text-[10px] text-text-sec">
          {integrante.telefono && (
            <span className="flex items-center gap-1.5">
              <IconoTelefono size={11} className="text-text-muted" /> {integrante.telefono}
            </span>
          )}
          {integrante.jefe_nombre && (
            <span className="text-text-muted">
              Jefe directo: <strong className="text-text-sec">{integrante.jefe_nombre}</strong>
              {integrante.jefe_telefono && ` · ${integrante.jefe_telefono}`}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-text-main/5">
        {tienePlacas ? (
          integrante.vehiculos.map((v) => (
            <span
              key={v.id}
              className="flex items-center gap-1.5 text-[9px] font-mono font-black uppercase px-2 py-1 rounded bg-bg-app text-text-sec border border-text-main/10"
            >
              <IconoCarro size={11} /> {v.placa}
            </span>
          ))
        ) : (
          <span className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-60">
            Sin vehículo registrado
          </span>
        )}

        {discrepa && (
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-warning">
            <IconoAlerta size={11} /> Declaró no tener vehículo
          </span>
        )}

        {integrante.tiene_qr_peatonal && (
          <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">
            Carnet emitido
          </span>
        )}
      </div>
    </div>
  );
};

const DormitorioDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dormitorio, setDormitorio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Paginación y filtro de habitaciones.
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [desplegadas, setDesplegadas] = useState(() => new Set());

  const [modalHabitacion, setModalHabitacion] = useState(false);
  const [habitacionEditando, setHabitacionEditando] = useState(null);
  const [formHabitacion, setFormHabitacion] = useState(FORM_HABITACION);

  const [modalIntegrante, setModalIntegrante] = useState(null); // habitación destino
  const [formIntegrante, setFormIntegrante] = useState(FORM_INTEGRANTE);
  const [personaExistente, setPersonaExistente] = useState(null);
  const [formVehiculo, setFormVehiculo] = useState(FORM_VEHICULO);
  const [unidades, setUnidades] = useState([]);

  // { titulo, subtitulo, valor, archivo, nota, onRegenerar } — vale para los dos QR.
  const [qrMostrado, setQrMostrado] = useState(null);
  const [regenerando, setRegenerando] = useState(false);
  const refQr = useRef(null);

  // { mensaje, titulo, accion } — sustituye a los confirm del navegador.
  const [confirmacion, setConfirmacion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await dormitoriosService.detalle(id, {
        pagina,
        porPagina: POR_PAGINA,
        buscar: busquedaAplicada,
      });
      setDormitorio(datos);

      // Buscando una persona, no tiene sentido dejar las habitaciones plegadas: lo que
      // se quiere ver es precisamente quién está dentro.
      if (busquedaAplicada) {
        setDesplegadas(new Set(datos.habitaciones.map((h) => h.id)));
      }
    } catch {
      toast.error('No se pudo cargar el dormitorio');
      navigate('/comando/dormitorios');
    } finally {
      setCargando(false);
    }
  }, [id, navigate, pagina, busquedaAplicada]);

  useEffect(() => { cargar(); }, [cargar]);

  // Las unidades se piden una vez: es una lista corta y estable.
  useEffect(() => {
    dormitoriosService.listarUnidades().then(setUnidades).catch(() => setUnidades([]));
  }, []);

  // El buscador espera a que se deje de teclear antes de ir al servidor.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  const alternarDespliegue = (habitacionId) => {
    setDesplegadas((previas) => {
      const copia = new Set(previas);
      if (copia.has(habitacionId)) copia.delete(habitacionId);
      else copia.add(habitacionId);
      return copia;
    });
  };

  // ─── Habitaciones ──────────────────────────────────────────────────────────

  const abrirNuevaHabitacion = () => {
    setHabitacionEditando(null);
    setFormHabitacion(FORM_HABITACION);
    setModalHabitacion(true);
  };

  const abrirEdicionHabitacion = (habitacion) => {
    setHabitacionEditando(habitacion);
    setFormHabitacion({
      numero: habitacion.numero,
      piso: habitacion.piso || '',
      camas: habitacion.camas,
      notas: habitacion.notas || '',
    });
    setModalHabitacion(true);
  };

  const guardarHabitacion = async (evento) => {
    evento.preventDefault();
    const camas = Number(formHabitacion.camas);

    if (!formHabitacion.numero.trim()) {
      toast.error('La habitación necesita un número');
      return;
    }
    if (!Number.isInteger(camas) || camas < 1) {
      toast.error('El número de camas tiene que ser al menos 1');
      return;
    }

    setGuardando(true);
    try {
      const datos = {
        numero: formHabitacion.numero.trim(),
        piso: formHabitacion.piso.trim() || null,
        camas,
        notas: formHabitacion.notas.trim() || null,
      };

      if (habitacionEditando) {
        await dormitoriosService.editarHabitacion(habitacionEditando.id, datos);
        toast.success('Habitación actualizada');
      } else {
        await dormitoriosService.crearHabitacion(id, datos);
        toast.success('Habitación registrada');
      }

      setModalHabitacion(false);
      await cargar();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo guardar la habitación');
    } finally {
      setGuardando(false);
    }
  };

  const pedirBajaHabitacion = (habitacion) => {
    setConfirmacion({
      titulo: 'Dar de baja la habitación',
      mensaje: `Se dará de baja la habitación ${habitacion.numero} y su QR de puerta dejará de funcionar. El adhesivo seguirá pegado, pero no abrirá nada.`,
      textoConfirmar: 'Dar de baja',
      accion: async () => {
        await dormitoriosService.desactivarHabitacion(habitacion.id);
        toast.success('Habitación dada de baja');
      },
    });
  };

  // ─── QR (persistentes) ─────────────────────────────────────────────────────

  const verQrPuerta = async (habitacion) => {
    try {
      const res = await dormitoriosService.qrHabitacion(habitacion.id);
      setQrMostrado({
        titulo: `Habitación ${habitacion.numero}`,
        subtitulo: 'Pegar en la puerta',
        valor: res.url_publica,
        archivo: `PUERTA_${dormitorio.nombre}_${habitacion.numero}`.replace(/\s+/g, '_'),
        nota: 'Este QR es el mismo cada vez que lo abras: el adhesivo pegado en la puerta sigue valiendo. Regenerarlo lo anula y obliga a imprimir y cambiar el impreso.',
        onRegenerar: async () => {
          const nuevo = await dormitoriosService.regenerarQrHabitacion(habitacion.id);
          return nuevo.url_publica;
        },
      });
      if (!habitacion.tiene_token) await cargar();
    } catch {
      toast.error('No se pudo obtener el QR de la puerta');
    }
  };

  const pedirRevocarQrPuerta = (habitacion) => {
    setConfirmacion({
      titulo: 'Revocar el QR de la puerta',
      mensaje: `El adhesivo pegado en la habitación ${habitacion.numero} dejará de abrir la ficha y no se sustituye por otro. Para volver a tener uno habrá que generarlo e imprimirlo de nuevo.`,
      textoConfirmar: 'Revocar',
      accion: async () => {
        await dormitoriosService.revocarQrHabitacion(habitacion.id);
        toast.success('QR revocado');
      },
    });
  };

  const verQrPeatonal = async (integrante) => {
    try {
      const res = await dormitoriosService.qrPeatonal(integrante.usuario_id);
      setQrMostrado({
        titulo: res.nombre_completo,
        subtitulo: `${res.grado || 'Personal alojado'} · ${res.cedula}`,
        valor: res.token,
        archivo: `CARNET_${res.cedula}`,
        nota: 'El guardia lo escanea con el lector de siempre. Es siempre el mismo carnet, así que se puede reimprimir sin invalidar el que la persona lleva encima. Regenerarlo solo hace falta si lo perdió.',
        onRegenerar: async () => {
          const nuevo = await dormitoriosService.regenerarQrPeatonal(integrante.usuario_id);
          return nuevo.token;
        },
      });
      if (!integrante.tiene_qr_peatonal) await cargar();
    } catch {
      toast.error('No se pudo obtener el carnet');
    }
  };

  const regenerarQr = async () => {
    setRegenerando(true);
    try {
      const nuevoValor = await qrMostrado.onRegenerar();
      setQrMostrado({ ...qrMostrado, valor: nuevoValor });
      toast.success('QR regenerado. El anterior ya no sirve.');
      await cargar();
    } catch {
      toast.error('No se pudo regenerar');
    } finally {
      setRegenerando(false);
    }
  };

  const descargarQr = async () => {
    if (!refQr.current) return;
    try {
      const dataUrl = await toPng(refQr.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 4,
      });
      const enlace = document.createElement('a');
      enlace.download = `${qrMostrado.archivo}.png`;
      enlace.href = dataUrl;
      enlace.click();
    } catch {
      toast.error('No se pudo generar la imagen');
    }
  };

  // ─── Integrantes ───────────────────────────────────────────────────────────

  const abrirNuevoIntegrante = (habitacion) => {
    setFormIntegrante(FORM_INTEGRANTE);
    setFormVehiculo(FORM_VEHICULO);
    setPersonaExistente(null);
    setModalIntegrante(habitacion);
  };

  /**
   * Rellena el formulario con lo que ya sabemos de esa persona.
   *
   * Incluido su vehículo: si ya tiene una placa a su nombre, la casilla se marca sola y
   * la placa viene puesta. Preguntar por algo que el sistema ya sabe era justo lo que
   * llevaba a guardar "no tiene vehículo" junto a una placa suya.
   */
  const elegirPersona = (persona) => {
    setPersonaExistente(persona);

    const suyos = persona.vehiculos || [];
    const primero = suyos[0];

    setFormIntegrante((previo) => ({
      ...previo,
      cedula: persona.cedula,
      nombre: persona.nombre || '',
      apellido: persona.apellido || '',
      telefono: persona.telefono || '',
      email: persona.email || '',
      grado: persona.grado || previo.grado,
      unidad: persona.unidad || previo.unidad,
      jefe_nombre: persona.jefe_nombre || previo.jefe_nombre,
      jefe_telefono: persona.jefe_telefono || previo.jefe_telefono,
      tiene_vehiculo: suyos.length > 0 ? true : previo.tiene_vehiculo,
    }));

    if (primero) {
      setFormVehiculo({
        vehiculo_id: primero.id,
        placa: primero.placa,
        marca: primero.marca || '',
        modelo: primero.modelo || '',
        color: primero.color || '',
      });
    }
  };

  const guardarIntegrante = async (evento) => {
    evento.preventDefault();
    if (!formIntegrante.cedula.trim() || !formIntegrante.nombre.trim() || !formIntegrante.apellido.trim()) {
      toast.error('Cédula, nombre y apellido son obligatorios');
      return;
    }
    if (formIntegrante.tiene_vehiculo && !formVehiculo.vehiculo_id && !formVehiculo.placa.trim()) {
      toast.error('Declaraste que tiene vehículo: indica la placa o desmarca la casilla');
      return;
    }

    setGuardando(true);
    try {
      const creado = await dormitoriosService.crearIntegrante({
        ...formIntegrante,
        cedula: formIntegrante.cedula.trim(),
        nombre: formIntegrante.nombre.trim(),
        apellido: formIntegrante.apellido.trim(),
        telefono: formIntegrante.telefono.trim() || null,
        email: formIntegrante.email.trim() || null,
        grado: formIntegrante.grado.trim() || null,
        unidad: formIntegrante.unidad.trim() || null,
        jefe_nombre: formIntegrante.jefe_nombre.trim() || null,
        jefe_telefono: formIntegrante.jefe_telefono.trim() || null,
        habitacion_id: modalIntegrante.id,
      });

      // El vehículo va en una segunda llamada a propósito: si falla (placa ya con
      // dueño), el integrante ya quedó registrado y solo hay que reintentar la placa.
      if (formIntegrante.tiene_vehiculo) {
        try {
          await dormitoriosService.vincularVehiculo(creado.usuario_id, {
            vehiculo_id: formVehiculo.vehiculo_id,
            placa: formVehiculo.vehiculo_id ? null : formVehiculo.placa.trim().toUpperCase(),
            marca: formVehiculo.marca.trim() || null,
            modelo: formVehiculo.modelo.trim() || null,
            color: formVehiculo.color.trim() || null,
          });
        } catch (error) {
          toast.error(
            error?.response?.data?.detail
            || 'El integrante quedó registrado, pero no se pudo vincular el vehículo.',
            { duration: 6000 },
          );
        }
      }

      toast.success('Integrante registrado');
      setModalIntegrante(null);
      await cargar();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo registrar');
    } finally {
      setGuardando(false);
    }
  };

  const pedirDesasignar = (integrante) => {
    setConfirmacion({
      titulo: 'Liberar la cama',
      // Sin concordancia de género: la frase nombra a una persona concreta y "Sigue
      // registrado" chirría cuando esa persona es una mujer.
      mensaje: `${integrante.nombre} ${integrante.apellido} dejará de ocupar esta habitación. La ficha, con sus datos y sus vehículos, permanece en el sistema: solo se libera la plaza.`,
      textoConfirmar: 'Liberar la cama',
      tipo: 'warning',
      accion: async () => {
        await dormitoriosService.desasignarHabitacion(integrante.usuario_id);
        toast.success('Cama liberada');
      },
    });
  };

  const ejecutarConfirmacion = async () => {
    setGuardando(true);
    try {
      await confirmacion.accion();
      setConfirmacion(null);
      await cargar();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo completar la acción');
    } finally {
      setGuardando(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (cargando && !dormitorio) {
    return (
      <div className="min-h-screen bg-bg-app flex items-center justify-center gap-3 text-text-muted">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-xs font-black uppercase tracking-widest">Cargando dormitorio…</span>
      </div>
    );
  }

  if (!dormitorio) return null;

  const sinResultados = dormitorio.habitaciones.length === 0;

  return (
    <div className="min-h-screen bg-bg-app pb-24">
      <Header
        titulo={dormitorio.nombre}
        subtitle={`${dormitorio.ocupacion} de ${dormitorio.camas_totales} camas ocupadas · ${dormitorio.total_habitaciones} habitaciones`}
        actionElement={
          <Boton onClick={abrirNuevaHabitacion}>
            <Plus size={16} /> Habitación
          </Boton>
        }
      />

      <div className="container mx-auto px-4 md:px-8 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <button
            onClick={() => navigate('/comando/dormitorios')}
            className="self-start flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} /> Todos los dormitorios
          </button>

          <div className="relative w-full sm:w-80">
            <IconoLupa size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar persona por nombre, cédula o grado"
              className="input-field pl-10"
            />
          </div>
        </div>

        {busquedaAplicada && (
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
            {dormitorio.total_habitaciones_filtradas} habitación(es) con alguien que coincide con “{busquedaAplicada}”
          </p>
        )}

        {sinResultados ? (
          <Card className="py-16 flex flex-col items-center gap-4 text-center">
            <IconoPuerta size={40} className="text-text-muted opacity-40" />
            <p className="text-sm font-black uppercase tracking-widest text-text-main">
              {busquedaAplicada ? 'Nadie coincide en este dormitorio' : 'Sin habitaciones'}
            </p>
            {busquedaAplicada ? (
              <Boton variant="ghost" onClick={() => setBusqueda('')}>Limpiar búsqueda</Boton>
            ) : (
              <Boton onClick={abrirNuevaHabitacion}><Plus size={16} /> Registrar la primera</Boton>
            )}
          </Card>
        ) : (
          dormitorio.habitaciones.map((h) => {
            const abierta = desplegadas.has(h.id);

            return (
              <Card key={h.id} className="flex flex-col gap-0 p-0 overflow-hidden">
                {/* Cabecera: siempre visible, es lo que se recorre de un vistazo */}
                <div className="flex items-center justify-between gap-3 flex-wrap p-4">
                  <button
                    onClick={() => alternarDespliegue(h.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left group"
                  >
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
                      <IconoPuerta size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black uppercase tracking-tight text-text-main group-hover:text-primary transition-colors">
                        Habitación {h.numero}
                        {h.piso && <span className="text-text-muted font-bold text-xs ml-2">Piso {h.piso}</span>}
                      </h3>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] font-black uppercase tracking-widest">
                        <span className={cn(h.camas_libres === 0 ? 'text-warning' : 'text-primary')}>
                          {h.ocupacion} / {h.camas} camas
                        </span>
                        {h.camas_libres > 0 && (
                          <span className="text-text-muted">{h.camas_libres} libre(s)</span>
                        )}
                        {h.tiene_token && (
                          <span className="text-primary/60">QR activo</span>
                        )}
                      </div>
                    </div>
                    <IconoFlechaAbajo
                      size={18}
                      className={cn(
                        'text-text-muted shrink-0 transition-transform duration-200',
                        abierta && 'rotate-180',
                      )}
                    />
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Boton size="sm" variant="secundario" onClick={() => abrirNuevoIntegrante(h)}>
                      <UserPlus size={13} /> Integrante
                    </Boton>
                    <Boton size="sm" variant="outline" onClick={() => verQrPuerta(h)}>
                      <QrCode size={13} /> QR puerta
                    </Boton>
                    {h.tiene_token && (
                      <button
                        onClick={() => pedirRevocarQrPuerta(h)}
                        className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                        title="Revocar el QR de la puerta"
                      >
                        <X size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => abrirEdicionHabitacion(h)}
                      className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
                      title="Editar habitación"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => pedirBajaHabitacion(h)}
                      className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                      title="Dar de baja"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {abierta && (
                  <div className="px-4 pb-4 flex flex-col gap-3 border-t border-text-main/5 pt-4">
                    {h.notas && (
                      <p className="text-[11px] text-text-muted italic">{h.notas}</p>
                    )}

                    {h.integrantes.length === 0 ? (
                      <div className="py-6 flex flex-col items-center gap-2 text-text-muted">
                        <IconoGente size={22} className="opacity-30" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                          Habitación vacía
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {h.integrantes.map((integrante) => (
                          <FichaIntegrante
                            key={integrante.usuario_id}
                            integrante={integrante}
                            onQrPeatonal={verQrPeatonal}
                            onDesasignar={pedirDesasignar}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}

        {dormitorio.total_paginas > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Boton
              size="sm"
              variant="outline"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              <IconoAnterior size={14} /> Anterior
            </Boton>
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
              Página {dormitorio.pagina} de {dormitorio.total_paginas}
            </span>
            <Boton
              size="sm"
              variant="outline"
              disabled={pagina >= dormitorio.total_paginas}
              onClick={() => setPagina((p) => Math.min(dormitorio.total_paginas, p + 1))}
            >
              Siguiente <IconoSiguiente size={14} />
            </Boton>
          </div>
        )}
      </div>

      {/* ─── Modal: habitación ─────────────────────────────────────────────── */}
      <Modal
        isOpen={modalHabitacion}
        onClose={() => setModalHabitacion(false)}
        title={habitacionEditando ? `Editar habitación ${habitacionEditando.numero}` : 'Nueva habitación'}
      >
        <form onSubmit={guardarHabitacion}>
          <Input
            label="Número"
            value={formHabitacion.numero}
            onChange={(e) => setFormHabitacion((h) => ({ ...h, numero: e.target.value }))}
            placeholder="104"
            autoFocus
          />
          <Input
            label="Piso (opcional)"
            value={formHabitacion.piso}
            onChange={(e) => setFormHabitacion((h) => ({ ...h, piso: e.target.value }))}
            placeholder="1"
          />
          <Input
            label="Camas"
            type="number"
            min="1"
            value={formHabitacion.camas}
            onChange={(e) => setFormHabitacion((h) => ({ ...h, camas: e.target.value }))}
          />
          <Input
            label="Notas (opcional)"
            value={formHabitacion.notas}
            onChange={(e) => setFormHabitacion((h) => ({ ...h, notas: e.target.value }))}
            placeholder="Baño compartido con la 105"
          />

          <div className="flex gap-3 justify-end">
            <Boton type="button" variant="ghost" onClick={() => setModalHabitacion(false)}>Cancelar</Boton>
            <Boton type="submit" isLoading={guardando}>Guardar</Boton>
          </div>
        </form>
      </Modal>

      {/* ─── Modal: integrante ─────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(modalIntegrante)}
        onClose={() => setModalIntegrante(null)}
        title={modalIntegrante ? `Integrante — habitación ${modalIntegrante.numero}` : ''}
        className="max-w-xl"
      >
        <form onSubmit={guardarIntegrante}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <CampoConSugerencias
              etiqueta="Cédula"
              valor={formIntegrante.cedula}
              onChange={(v) => { setFormIntegrante((f) => ({ ...f, cedula: v })); setPersonaExistente(null); }}
              onElegir={elegirPersona}
              buscar={dormitoriosService.buscarPersonas}
              claveDe={(p) => p.usuario_id}
              placeholder="V12345678 o 12345678"
              autoFocus
              elegido={Boolean(personaExistente)}
              ayuda="Busca sin importar la V ni los puntos. Si ya está, se completa su ficha en vez de duplicarla."
              render={(p) => (
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase text-text-main">
                    {p.nombre} {p.apellido}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {p.cedula}
                    {p.grado && ` · ${p.grado}`}
                    {p.ya_es_integrante && ' · YA ALOJADO'}
                  </span>
                </div>
              )}
            />

            <Input
              label="Grado"
              value={formIntegrante.grado}
              onChange={(e) => setFormIntegrante((f) => ({ ...f, grado: e.target.value }))}
              placeholder="Sargento Primero"
            />
            <Input
              label="Nombre"
              value={formIntegrante.nombre}
              onChange={(e) => setFormIntegrante((f) => ({ ...f, nombre: e.target.value }))}
            />
            <Input
              label="Apellido"
              value={formIntegrante.apellido}
              onChange={(e) => setFormIntegrante((f) => ({ ...f, apellido: e.target.value }))}
            />
            <Input
              label="Teléfono"
              value={formIntegrante.telefono}
              onChange={(e) => setFormIntegrante((f) => ({ ...f, telefono: e.target.value }))}
              placeholder="04141234567"
            />

            <CampoConSugerencias
              etiqueta="Unidad"
              valor={formIntegrante.unidad}
              onChange={(v) => setFormIntegrante((f) => ({ ...f, unidad: v }))}
              onElegir={(u) => setFormIntegrante((f) => ({ ...f, unidad: u.nombre }))}
              buscar={async (t) => unidades.filter((u) => u.nombre.toLowerCase().includes(t.toLowerCase()))}
              claveDe={(u) => u.id}
              placeholder="Grupo Aéreo N.º 4"
              minimoCaracteres={0}
              sugerenciasIniciales={unidades}
              ayuda="Elige una entidad registrada o escribe la unidad si no está."
              render={(u) => (
                <span className="text-xs font-bold uppercase text-text-main">{u.nombre}</span>
              )}
            />

            <CampoConSugerencias
              etiqueta="Jefe directo"
              valor={formIntegrante.jefe_nombre}
              onChange={(v) => setFormIntegrante((f) => ({ ...f, jefe_nombre: v }))}
              onElegir={(j) => setFormIntegrante({
                ...formIntegrante,
                jefe_nombre: j.grado ? `${j.grado} ${j.nombre_completo}` : j.nombre_completo,
                jefe_telefono: j.telefono || formIntegrante.jefe_telefono,
              })}
              buscar={dormitoriosService.buscarJefes}
              claveDe={(j) => j.usuario_id}
              placeholder="Escribe para buscar"
              ayuda="Si está registrado, elegirlo trae su teléfono."
              render={(j) => (
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase text-text-main">
                    {j.grado ? `${j.grado} ` : ''}{j.nombre_completo}
                  </span>
                  {j.telefono && (
                    <span className="text-[10px] font-mono text-text-muted">{j.telefono}</span>
                  )}
                </div>
              )}
            />

            <Input
              label="Teléfono del jefe"
              value={formIntegrante.jefe_telefono}
              onChange={(e) => setFormIntegrante((f) => ({ ...f, jefe_telefono: e.target.value }))}
            />
            <Input
              label="Correo (opcional)"
              type="email"
              value={formIntegrante.email}
              onChange={(e) => setFormIntegrante((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          {personaExistente && (
            <div className="flex items-start gap-2.5 mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <IconoPersonaHallada size={15} className="text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-text-sec leading-relaxed">
                <strong className="text-text-main">Ya está en el sistema</strong>
                {personaExistente.rol && ` como ${nombrarRol(personaExistente.rol)}`}.
                No se creará otra ficha: se completa la suya.
                {personaExistente.vehiculos?.length > 0 && (
                  <>
                    {' '}Tiene{' '}
                    <strong className="text-text-main font-mono">
                      {personaExistente.vehiculos.map((v) => v.placa).join(', ')}
                    </strong>
                    {' '}a su nombre, así que el vehículo ya viene marcado abajo.
                  </>
                )}
                {personaExistente.ya_es_integrante && ' Ojo: ya está alojado en otra habitación, así que esto es un traslado.'}
              </p>
            </div>
          )}

          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formIntegrante.tiene_vehiculo}
              onChange={(e) => setFormIntegrante((f) => ({ ...f, tiene_vehiculo: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs font-bold text-text-sec">Declara tener vehículo</span>
          </label>

          {formIntegrante.tiene_vehiculo && (
            <div className="mb-5 p-4 rounded-xl bg-bg-high/20 border border-text-main/5">
              <CampoConSugerencias
                etiqueta="Placa"
                valor={formVehiculo.placa}
                onChange={(v) => setFormVehiculo({ ...FORM_VEHICULO, placa: v.toUpperCase() })}
                onElegir={(v) => {
                  // Solo se rechaza la placa de OTRA persona. La suya propia es
                  // precisamente la que hay que poder elegir.
                  if (!v.libre && !v.es_suyo) {
                    toast.error(`${v.placa} ya está a nombre de ${v.dueno}. El cambio de titular se hace desde Parque Automotor.`);
                    return;
                  }
                  setFormVehiculo({
                    vehiculo_id: v.id,
                    placa: v.placa,
                    marca: v.marca || '',
                    modelo: v.modelo || '',
                    color: v.color || '',
                  });
                }}
                buscar={(t) => dormitoriosService.buscarVehiculos(t, personaExistente?.usuario_id)}
                claveDe={(v) => v.id}
                placeholder="AB123CD"
                elegido={Boolean(formVehiculo.vehiculo_id)}
                ayuda="Si la placa ya existe y no tiene dueño, se le asigna. Si no existe, se registra en el parque automotor y la cámara de la alcabala la reconocerá desde la siguiente lectura."
                render={(v) => (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-black uppercase text-text-main">{v.placa}</span>
                      <span className="text-[10px] text-text-muted">
                        {[v.marca, v.modelo, v.color].filter(Boolean).join(' · ') || 'Sin datos'}
                      </span>
                    </div>
                    {v.es_suyo ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary shrink-0">Ya es suyo</span>
                    ) : v.libre ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary shrink-0">Libre</span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-warning shrink-0 text-right">
                        De {v.dueno}
                      </span>
                    )}
                  </div>
                )}
              />

              {/* Solo para una placa nueva: la que se elige de la lista ya tiene ficha */}
              {!formVehiculo.vehiculo_id && formVehiculo.placa.trim() && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3">
                  <Input
                    label="Marca"
                    value={formVehiculo.marca}
                    onChange={(e) => setFormVehiculo((v) => ({ ...v, marca: e.target.value }))}
                    placeholder="Toyota"
                  />
                  <Input
                    label="Modelo"
                    value={formVehiculo.modelo}
                    onChange={(e) => setFormVehiculo((v) => ({ ...v, modelo: e.target.value }))}
                    placeholder="Corolla"
                  />
                  <Input
                    label="Color"
                    value={formVehiculo.color}
                    onChange={(e) => setFormVehiculo((v) => ({ ...v, color: e.target.value }))}
                    placeholder="Gris"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Boton type="button" variant="ghost" onClick={() => setModalIntegrante(null)}>Cancelar</Boton>
            <Boton type="submit" isLoading={guardando}>Registrar</Boton>
          </div>
        </form>
      </Modal>

      {/* ─── Modal: QR ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(qrMostrado)}
        onClose={() => setQrMostrado(null)}
        title={qrMostrado?.titulo || ''}
      >
        {qrMostrado && (
          <div className="flex flex-col items-center gap-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted text-center">
              {qrMostrado.subtitulo}
            </p>

            <div ref={refQr} className="bg-white p-5 rounded-2xl">
              <QRCode
                value={String(qrMostrado.valor)}
                level="H"
                style={{ height: 'auto', maxWidth: '100%', width: '220px' }}
              />
            </div>

            <p className="text-[10px] text-text-muted text-center leading-relaxed">
              {qrMostrado.nota}
            </p>

            <div className="flex gap-3 flex-wrap justify-center">
              <Boton variant="ghost" onClick={() => setQrMostrado(null)}>Cerrar</Boton>
              <Boton variant="outline" onClick={regenerarQr} isLoading={regenerando}>
                <IconoRegenerar size={15} /> Regenerar
              </Boton>
              <Boton onClick={descargarQr}><Download size={15} /> Descargar</Boton>
            </div>
          </div>
        )}
      </Modal>

      <ModalConfirmacion
        isOpen={Boolean(confirmacion)}
        onClose={() => setConfirmacion(null)}
        onConfirm={ejecutarConfirmacion}
        loading={guardando}
        title={confirmacion?.titulo || ''}
        message={confirmacion?.mensaje || ''}
        confirmText={confirmacion?.textoConfirmar || 'Confirmar'}
        type={confirmacion?.tipo || 'danger'}
      />
    </div>
  );
};

export default DormitorioDetalle;
