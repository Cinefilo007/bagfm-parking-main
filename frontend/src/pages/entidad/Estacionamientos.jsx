import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ChipFiltro } from '../../components/ui/ChipFiltro';
import { ModalConfirmacion } from '../../components/ui/ModalConfirmacion';
import { CalendarioLotes } from '../../components/ui/CalendarioLotes';
import { useAuthStore } from '../../store/auth.store';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import {
    ParkingSquare, Car, Plus, Trash2, RefreshCw,
    Shield, MapPin, Map, Target, Users, Tag, CheckCircle2, QrCode, Search,
    Circle, Edit3, ToggleLeft, ToggleRight, Zap, AlertTriangle,
    ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Settings, Activity,
    Hash, PackagePlus, Palette, Filter, ZapOff, Calendar, Pencil, User, Eye,
    UserSquare2, CreditCard, Ticket, ShieldCheck, Share2
} from 'lucide-react';
import { zonaService } from '../../services/zona.service';
import { entidadService } from '../../services/entidad.service';
import { mapaService } from '../../services/mapaService';
import MapaTactico from '../../components/MapaTactico';

/** Mapa de etiquetas de tipo de acceso a mostrar como badge */
const TIPO_ACCESO_LABEL = {
    general:    { label: 'PÚBLICO', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    logistica:  { label: 'LOGÍSTICA', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    produccion: { label: 'PRODUCCIÓN', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    staff:      { label: 'STAFF', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    vip:        { label: 'VIP', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    prensa:     { label: 'PRENSA', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    artista:    { label: 'ARTISTA', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
    custom:     { label: 'CUSTOM', color: 'text-text-muted bg-white/5 border-white/10' },
};

const PRESET_COLORS = [
    '#4EDEA3', '#3B82F6', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#10B981', '#6B7280',
    '#00D1FF', '#FF6B00'
];

// ──── Componentes internos ────────────────────────────────────────────────────

const BadgeEstado = ({ estado, tieneTipo = false }) => {
    const cfg = {
        libre: { color: 'bg-success/15 text-success border-success/30', label: 'Libre' },
        ocupado: { color: 'bg-danger/15 text-danger border-danger/30', label: 'Ocupado' },
        reservado: { 
            color: tieneTipo ? 'bg-warning/15 text-warning border-warning/30' : 'bg-primary/15 text-primary border-primary/30', 
            label: tieneTipo ? 'Reservado' : 'Disponible' 
        },
        mantenimiento: { color: 'bg-text-muted/15 text-text-muted border-text-muted/20', label: 'Mant.' },
    };
    const c = cfg[estado] || cfg.libre;
    return (
        <span className={cn('text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border', c.color)}>
            {c.label}
        </span>
    );
};


const TarjetaPuesto = ({ puesto, onAsignar, onLiberar, onReasignar, tipos, puestosPorQR = {} }) => {
    const isOcupado = puesto.estado === 'ocupado';
    const tipo = tipos?.find(t => t.id === puesto.tipo_acceso_id);

    // Pase QR reservado en este puesto para la fecha consultada
    const paseReservado = puestosPorQR?.[puesto.id];
    const esQRReservado = !!paseReservado;

    return (
        <div className={cn(
            "p-2 md:p-3 rounded-2xl border transition-all hover:bg-white/5",
            puesto.estado === 'libre' && !esQRReservado && 'bg-success/5 border-success/20',
            isOcupado && 'bg-danger/5 border-danger/15',
            puesto.estado === 'reservado' && !esQRReservado && 'bg-warning/5 border-warning/20',
            puesto.estado === 'mantenimiento' && 'bg-white/3 border-white/5 opacity-60',
            esQRReservado && !isOcupado && 'bg-sky-500/5 border-sky-500/20',
        )}>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4">
                {/* Lado Izquierdo: Icono + Identificación Principal */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                        "w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        puesto.estado === 'libre' ? 'bg-success/20 text-success' : 
                        isOcupado ? 'bg-danger/15 text-danger/70' :
                        puesto.estado === 'reservado' ? 'bg-warning/20 text-warning' : 'bg-white/5 text-text-muted/50'
                    )}>
                        {isOcupado ? <Car size={16} /> : <ParkingSquare size={16} />}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                            <p className="text-[11px] md:text-xs font-black text-text-main uppercase truncate">
                                {puesto.numero_puesto || puesto.codigo || `Puesto ${puesto.id?.slice(-4)}`}
                            </p>
                            {esQRReservado ? (
                                <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                                    <QrCode size={8} /> QR RESERVADO
                                </span>
                            ) : (
                                <BadgeEstado estado={puesto.estado} tieneTipo={!!puesto.tipo_acceso_id} />
                            )}
                        </div>

                        {/* Info del portador si está reservado por QR */}
                        {esQRReservado && (
                            <div className="flex items-center gap-2 text-[8px]">
                                {paseReservado.tiene_datos ? (
                                    <>
                                        <span className="text-sky-400/80 font-bold uppercase truncate max-w-[120px]">
                                            {paseReservado.nombre_portador || '—'}
                                        </span>
                                        {paseReservado.vehiculo_placa && (
                                            <span className="text-text-muted/70 flex items-center gap-1">
                                                <Car size={8} /> {paseReservado.vehiculo_placa}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-warning/70 flex items-center gap-1">
                                        <AlertTriangle size={8} /> SIN IDENTIFICAR · {paseReservado.serial_legible}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Ubicación y tipo que se ocultan o mueven según pantalla */}
                        <div className="flex items-center gap-3">
                            {puesto.zona_nombre && (
                                <p className="text-[8px] md:text-[9px] text-text-muted font-bold flex items-center gap-1 uppercase truncate">
                                    <MapPin size={10} className="text-text-muted/40" /> 
                                    <span className="max-w-[100px] md:max-w-[150px] truncate">{puesto.zona_nombre}</span>
                                </p>
                            )}
                            {tipo && (
                                <div className="hidden sm:flex px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 items-center gap-1">
                                    <Tag size={8} className="text-primary" />
                                    <span className="text-[8px] font-black text-primary uppercase whitespace-nowrap">
                                        {tipo.nombre}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Lado Derecho: Acciones y Otros Metadatos */}
                <div className="flex items-center justify-between md:justify-end gap-2 md:gap-3 border-t md:border-t-0 pt-2 md:pt-0 border-white/5">
                    {/* Badge de tipo visible solo en móviles si no cabe arriba */}
                    {tipo && (
                        <div className="sm:hidden px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-1">
                            <Tag size={9} className="text-primary" />
                            <span className="text-[8px] font-black text-primary uppercase">
                                {tipo.nombre}
                            </span>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-1 md:gap-2">
                        {puesto.estado === 'libre' || puesto.estado === 'reservado' ? (
                            <button 
                                onClick={() => onAsignar(puesto)}
                                className="h-8 px-4 rounded-lg bg-primary text-on-primary text-[9px] font-black uppercase flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                            >
                                <Users size={12} /> <span>Asignar</span>
                            </button>
                        ) : isOcupado && (
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => onReasignar(puesto)}
                                    className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-warning/20 text-warning border border-warning/30 flex items-center justify-center hover:bg-warning/30 transition-all"
                                    title="Configurar"
                                >
                                    <Settings size={14} />
                                </button>
                                <button 
                                    onClick={() => onLiberar(puesto)}
                                    className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-danger/20 text-danger border border-danger/30 flex items-center justify-center hover:bg-danger/30 transition-all"
                                    title="Liberar"
                                >
                                    <Zap size={14} />
                                </button>
                            </div>
                        )}
                        <button className="h-8 w-8 md:h-9 md:w-9 rounded-lg hover:bg-white/10 text-text-muted/40 hover:text-text-main transition-all flex items-center justify-center">
                            <Edit3 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TarjetaTipoAcceso = ({ tipo, onEditar, onEliminar, onToggle }) => (
    <div className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all",
        tipo.activo !== false ? 'bg-bg-card/40 border-white/5' : 'bg-white/2 border-white/5 opacity-50'
    )}>
        <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0",
            tipo.es_base ? "bg-white/5 border-white/10" : "bg-primary/10 border-primary/20"
        )}>
            {tipo.es_base ? <Shield size={16} className="text-text-muted" /> : <Tag size={16} className="text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <p className="text-xs font-black text-text-main uppercase truncate">{tipo.nombre}</p>
                {tipo.es_base && (
                    <span className="text-[7px] font-black bg-white/5 text-text-muted/40 px-1 py-0.5 rounded uppercase tracking-tighter">Sistema</span>
                )}
            </div>
            {tipo.descripcion && (
                <p className="text-[9px] text-text-muted truncate">{tipo.descripcion}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
                {tipo.requiere_vehiculo && (
                    <span className="text-[7px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                        <Car size={7} /> Req. Vehículo
                    </span>
                )}
                {tipo.color_badge && (
                    <span className="inline-block w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: tipo.color_badge }} />
                )}
            </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
            {onToggle && (
                <button onClick={() => onToggle(tipo)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all">
                    {tipo.activo
                        ? <ToggleRight size={20} className="text-success" />
                        : <ToggleLeft size={20} className="text-text-muted/40" />
                    }
                </button>
            )}
            <button onClick={() => onEditar(tipo)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all text-text-muted hover:text-primary transition-all">
                <Edit3 size={14} />
            </button>
            {onEliminar && (
                <button onClick={() => onEliminar(tipo)} className="p-1.5 rounded-lg hover:bg-danger/10 transition-all text-text-muted/40 hover:text-danger transition-all">
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    </div>
);

// ──── Página Principal ────────────────────────────────────────────────────────

const TABS = { ZONAS: 'zonas', MAPA: 'mapa', TIPOS: 'tipos' };

export default function EstacionamientosEntidad() {
    const { user } = useAuthStore();
    const [tab, setTab] = useState(TABS.ZONAS);

    // Estado asignaciones/zonas
    const [asignaciones, setAsignaciones] = useState([]);
    const [cargandoAsignaciones, setCargandoAsignaciones] = useState(true);
    const [modalDistribucion, setModalDistribucion] = useState(false);
    const [asignacionEdicion, setAsignacionEdicion] = useState(null);
    const [formDistribucion, setFormDistribucion] = useState({});

    // Estado de disponibilidad inteligente
    const [resumenDisponibilidad, setResumenDisponibilidad] = useState([]);
    const [cargandoResumen, setCargandoResumen] = useState(false);
    const [calendarioLotes, setCalendarioLotes] = useState({});
    const [modalCalendario, setModalCalendario] = useState(false);
    const hoyISO = new Date().toISOString().split('T')[0];
    const [fechaConsulta, setFechaConsulta] = useState(hoyISO);

    // Estado del modal de edición de pase
    const [modalEditPase, setModalEditPase] = useState(false);
    const [paseEditando, setPaseEditando] = useState(null);
    const [formEditPase, setFormEditPase] = useState({});
    const [guardandoPase, setGuardandoPase] = useState(false);
    // Estado de paginación expandida del panel de pases
    const [panelPasesExpandido, setPanelPasesExpandido] = useState({});
    const [paginaPases, setPaginaPases] = useState({});

    // Modal de visualización completa de todos los pases de una zona
    const [modalTodosPases, setModalTodosPases] = useState(false);
    const [zonaSeleccionadaParaTodos, setZonaSeleccionadaParaTodos] = useState(null);
    const [pasesZonaCompletos, setPasesZonaCompletos] = useState([]);
    const [cargandoTodosPases, setCargandoTodosPases] = useState(false);
    const [paginacionTodos, setPaginacionTodos] = useState({ total: 0, pagina: 1, paginas: 1 });
    const [busquedaTodos, setBusquedaTodos] = useState('');

    const [modalGenerar, setModalGenerar] = useState(false);
    const [formGenerar, setFormGenerar] = useState({ cantidad: 1, prefijo: 'V' });
    const [generando, setGenerando] = useState(false);

    // Estado de puestos
    const [puestos, setPuestos] = useState([]);
    const [cargandoPuestos, setCargandoPuestos] = useState(true);
    const [puestoSeleccionado, setPuestoSeleccionado] = useState(null);
    const [modalAsignar, setModalAsignar] = useState(false);
    const [asignacion, setAsignacion] = useState({ socio_id: '', notas: '', placa: '', marca: '', modelo: '', color: '' });
    const [asignando, setAsignando] = useState(false);

    // Estado de tipos de acceso
    const [tipos, setTipos] = useState([]);
    const [cargandoTipos, setCargandoTipos] = useState(true);
    const [modalTipo, setModalTipo] = useState(false);
    const [tipoEditar, setTipoEditar] = useState(null);
    const [formTipo, setFormTipo] = useState({
        nombre: '',
        descripcion: '',
        requiere_vehiculo: true,
        max_vehiculos: 1,
        color_hex: '#4EDEA3', 
        plantilla_layout: 'qr',
        color_preset: 'aegis',
        activo: true,
    });
    const [guardandoTipo, setGuardandoTipo] = useState(false);
    
    // Estado de Branding de Entidad
    const [brandingEntidad, setBrandingEntidad] = useState({});
    const [cargandoBranding, setCargandoBranding] = useState(false);
    const [guardandoBranding, setGuardandoBranding] = useState(false);
    
    // Modal Reasignar
    const [modalReasignar, setModalReasignar] = useState(false);
    const [puestoAReasignar, setPuestoAReasignar] = useState(null);
    const [asignandoTipo, setAsignandoTipo] = useState(false);

    // Modal Confirmación Auto-Distribución
    const [modalAutoDistConfirm, setModalAutoDistConfirm] = useState(false);

    // Estado para el mapa táctico de la entidad
    const [situacionFiltrada, setSituacionFiltrada] = useState(null);
    const [cargandoMapa, setCargandoMapa] = useState(false);
    const [mapaReloadKey, setMapaReloadKey] = useState(0);

    // Paginación y Filtro puestos
    const [paginaActual, setPaginaActual] = useState(1);
    const [filtroZona, setFiltroZona] = useState(null);
    const elementsPerPage = 10;

    // ── Carga de datos ────────────────────────────────────────────────────────

    const cargarPuestos = useCallback(async () => {
        setCargandoPuestos(true);
        try {
            const data = await zonaService.getMisPuestos();
            setPuestos(data);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error cargando puestos');
            setPuestos([]);
        } finally {
            setCargandoPuestos(false);
        }
    }, []);

    const cargarTipos = useCallback(async () => {
        if (!user?.entidad_id) return;
        setCargandoTipos(true);
        try {
            const data = await zonaService.listarTiposAcceso(user.entidad_id);
            setTipos(data);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error cargando tipos de acceso');
            setTipos([]);
        } finally {
            setCargandoTipos(false);
        }
    }, [user?.entidad_id]);

    const cargarAsignaciones = useCallback(async () => {
        setCargandoAsignaciones(true);
        try {
            const data = await zonaService.getMisAsignaciones();
            setAsignaciones(data || []);
        } catch (e) {
            toast.error('Error cargando zonas asignadas');
        } finally {
            setCargandoAsignaciones(false);
        }
    }, []);

    const cargarResumenDisponibilidad = useCallback(async (fecha = null) => {
        setCargandoResumen(true);
        try {
            const data = await zonaService.getResumenDisponibilidad(fecha);
            setResumenDisponibilidad(data || []);
        } catch (e) {
            console.warn('Error cargando resumen de disponibilidad:', e);
        } finally {
            setCargandoResumen(false);
        }
    }, []);

    const cargarCalendarioLotes = useCallback(async () => {
        try {
            const data = await zonaService.getCalendarioLotes();
            setCalendarioLotes(data || {});
        } catch (e) {
            console.warn('Error cargando calendario de lotes:', e);
        }
    }, []);

    const handleCambiarFecha = useCallback((nuevaFecha) => {
        setFechaConsulta(nuevaFecha);
        cargarResumenDisponibilidad(nuevaFecha);
    }, [cargarResumenDisponibilidad]);

    /** Avanza o retrocede un día desde la fecha actual de consulta */
    const handleNavFecha = useCallback((dias) => {
        const f = new Date(fechaConsulta + 'T12:00:00');
        f.setDate(f.getDate() + dias);
        const nueva = f.toISOString().split('T')[0];
        setFechaConsulta(nueva);
        cargarResumenDisponibilidad(nueva);
    }, [fechaConsulta, cargarResumenDisponibilidad]);

    /** Abre el modal de edición de un pase */
    const handleAbrirEditPase = useCallback((pase) => {
        setPaseEditando(pase);
        setFormEditPase({
            nombre_portador: pase.nombre_portador || '',
            cedula_portador: pase.cedula_portador || '',
            email_portador: pase.email_portador || '',
            telefono_portador: pase.telefono_portador || '',
            vehiculo_placa: pase.vehiculo_placa || '',
            vehiculo_marca: pase.vehiculo_marca || '',
            vehiculo_modelo: pase.vehiculo_modelo || '',
            vehiculo_color: pase.vehiculo_color || '',
        });
        setModalEditPase(true);
    }, []);

    /** Guarda los datos editados del pase vía PATCH */
    const handleGuardarPase = useCallback(async () => {
        if (!paseEditando?.id) return;
        setGuardandoPase(true);
        try {
            await zonaService.actualizarPaseDatos(paseEditando.id, formEditPase);
            toast.success('¡Pase actualizado correctamente!');
            setModalEditPase(false);
            // Recargar el resumen para reflejar los cambios
            cargarResumenDisponibilidad(fechaConsulta);
        } catch (e) {
            toast.error('Error al guardar los datos del pase');
        } finally {
            setGuardandoPase(false);
        }
    }, [paseEditando, formEditPase, fechaConsulta, cargarResumenDisponibilidad]);

    /** Abre el modal de todos los pases de una zona y carga la primera página */
    const handleAbrirTodosPases = useCallback(async (resumZona) => {
        setZonaSeleccionadaParaTodos(resumZona);
        setModalTodosPases(true);
        setPasesZonaCompletos([]);
        setBusquedaTodos('');
        setCargandoTodosPases(true);
        try {
            const data = await zonaService.getPasesZona(resumZona.zona_id, fechaConsulta, 1, 30);
            setPasesZonaCompletos(data.pases || []);
            setPaginacionTodos({
                total: data.total,
                pagina: data.pagina,
                paginas: data.paginas
            });
        } catch (e) {
            toast.error('Error al cargar la lista de pases');
        } finally {
            setCargandoTodosPases(false);
        }
    }, [fechaConsulta]);

    /** Cambia la página en el modal de todos los pases */
    const handleCambiarPaginaTodos = useCallback(async (nuevaPag, query = busquedaTodos) => {
        if (!zonaSeleccionadaParaTodos) return;
        setCargandoTodosPases(true);
        try {
            const data = await zonaService.getPasesZona(zonaSeleccionadaParaTodos.zona_id, fechaConsulta, nuevaPag, 30, query);
            setPasesZonaCompletos(data.pases || []);
            setPaginacionTodos({
                total: data.total,
                pagina: data.pagina,
                paginas: data.paginas
            });
        } catch (e) {
            toast.error('Error al cambiar de página');
        } finally {
            setCargandoTodosPases(false);
        }
    }, [zonaSeleccionadaParaTodos, fechaConsulta]);

    const handleAbrirDistribucion = (asig) => {
        setAsignacionEdicion(asig);
        setFormDistribucion(asig.distribucion_cupos || {});
        setModalDistribucion(true);
    };

    const handleGuardarDistribucion = async () => {
        try {
            await zonaService.configurarDistribucionCupos(asignacionEdicion.id, formDistribucion);
            toast.success('Distribución de cupos actualizada');
            setModalDistribucion(false);
            await cargarAsignaciones();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al actualizar distribución');
        }
    };

    const handleAbrirGenerar = (asig) => {
        setAsignacionEdicion(asig);
        setFormGenerar({ cantidad: 1, prefijo: 'V' });
        setModalGenerar(true);
    };

    const handleGenerarPuestos = async () => {
        setGenerando(true);
        try {
            await zonaService.generarPuestosEntidad(asignacionEdicion.zona_id, formGenerar);
            toast.success('Puestos generados correctamente');
            setModalGenerar(false);
            await cargarPuestos();
            setTab(TABS.PUESTOS);
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al generar puestos');
        } finally {
            setGenerando(false);
        }
    };

    const cargarBranding = useCallback(async () => {
        if (!user?.entidad_id) return;
        setCargandoBranding(true);
        try {
            const data = await entidadService.obtenerEntidad(user.entidad_id);
            if (data.config_branding) {
                setBrandingEntidad(JSON.parse(data.config_branding));
            }
        } catch (e) {
            console.warn('Error cargando branding:', e);
        } finally {
            setCargandoBranding(false);
        }
    }, [user?.entidad_id]);

    const handleGuardarBranding = async (configActualizada) => {
        setGuardandoBranding(true);
        try {
            await entidadService.actualizarBranding(user.entidad_id, configActualizada);
            toast.success('¡Estilos de pases base actualizados!');
            setBrandingEntidad(configActualizada);
        } catch (e) {
            toast.error('Error al guardar configuración de marca');
        } finally {
            setGuardandoBranding(false);
        }
    };

    useEffect(() => { cargarPuestos(); }, [cargarPuestos]);
    useEffect(() => { cargarTipos(); }, [cargarTipos]);
    useEffect(() => { cargarAsignaciones(); }, [cargarAsignaciones]);
    useEffect(() => { cargarResumenDisponibilidad(fechaConsulta); }, [cargarResumenDisponibilidad]);
    useEffect(() => { cargarCalendarioLotes(); }, [cargarCalendarioLotes]);
    useEffect(() => { cargarBranding(); }, [cargarBranding]);

    // Cargar situación táctica filtrada cuando se entra a la pestaña de mapa
    useEffect(() => {
        const cargarMapaEntidad = async () => {
            if (tab !== TABS.MAPA) return;
            setCargandoMapa(true);
            try {
                const situ = await mapaService.getSituacion();
                // Filtrar solo las zonas que pertenecen a esta entidad
                const idsAsignadas = asignaciones.map(a => a.zona_id);
                setSituacionFiltrada({
                    ...situ,
                    zonas_estacionamiento: situ.zonas_estacionamiento.filter(z => idsAsignadas.includes(z.id))
                });
            } catch (error) {
                console.error("Error cargando mapa de entidad:", error);
                toast.error("Error al establecer link satelital");
            } finally {
                setCargandoMapa(false);
            }
        };
        cargarMapaEntidad();
    }, [tab, asignaciones, mapaReloadKey]);

    // ── Acciones: Puestos ─────────────────────────────────────────────────────

    const handleAbrirAsignar = (puesto) => {
        setPuestoSeleccionado(puesto);
        setAsignacion({ socio_id: '', notas: '', placa: '', marca: '', modelo: '', color: '' });
        setModalAsignar(true);
    };

    const handleAsignar = async () => {
        if (!puestoSeleccionado) return;
        setAsignando(true);
        try {
            await zonaService.asignarPuestoASocio(puestoSeleccionado.id, asignacion);
            toast.success(`Puesto ${puestoSeleccionado.codigo} asignado`);
            setModalAsignar(false);
            await cargarPuestos();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al asignar puesto');
        } finally {
            setAsignando(false);
        }
    };

    const handleLiberar = async (puesto) => {
        try {
            await zonaService.liberarPuesto(puesto.id);
            toast.success(`Puesto ${puesto.numero_puesto || puesto.codigo} liberado`);
            await cargarPuestos();
        } catch (e) {
            toast.error('Error al liberar puesto');
        }
    };

    const handleAbrirReasignar = (puesto) => {
        setPuestoAReasignar(puesto);
        setModalReasignar(true);
    };

    const handleReasignarTipo = async (tipoId) => {
        setAsignandoTipo(true);
        try {
            await zonaService.reasignarTipoPuesto(puestoAReasignar.id, tipoId);
            toast.success('Puesto reasignado');
            setModalReasignar(false);
            await cargarPuestos();
        } catch (e) {
            toast.error('Error al reasignar puesto');
        } finally {
            setAsignandoTipo(false);
        }
    };

    const handleAutoDistribuir = async () => {
        // Encontrar asignaciones con distribución lógica
        const asigConDist = asignaciones.filter(a => a.distribucion_cupos && Object.keys(a.distribucion_cupos).length > 0);
        if (asigConDist.length === 0) {
            toast.error('No tienes configurada ninguna distribución lógica en tus zonas.');
            return;
        }
        setModalAutoDistConfirm(true);
    };

    const confirmAutoDistribuir = async () => {
        setModalAutoDistConfirm(false);
        const asigConDist = asignaciones.filter(a => a.distribucion_cupos && Object.keys(a.distribucion_cupos).length > 0);
        
        toast.promise(
            (async () => {
                for (const asig of asigConDist) {
                    const puestosZona = puestos.filter(p => p.zona_id === asig.zona_id).sort((a,b) => (a.numero_puesto||'').localeCompare(b.numero_puesto||'', undefined, {numeric: true}));
                    let pointer = 0;
                    
                    for (const [tipoNombre, cupo] of Object.entries(asig.distribucion_cupos)) {
                        const tipoObj = tipos.find(t => t.nombre === tipoNombre);
                        if (!tipoObj) continue;
                        
                        for (let i = 0; i < cupo && pointer < puestosZona.length; i++) {
                            const puesto = puestosZona[pointer];
                            await zonaService.reasignarTipoPuesto(puesto.id, tipoObj.id);
                            
                            // Actualización reactiva inmediata en la UI
                            setPuestos(prev => prev.map(p => p.id === puesto.id ? { 
                                ...p, 
                                tipo_acceso_id: tipoObj.id, 
                                tipo_acceso_nombre: tipoObj.nombre 
                            } : p));
                            
                            pointer++;
                        }
                    }
                    // Limpiar el resto
                    while(pointer < puestosZona.length) {
                        const puesto = puestosZona[pointer];
                        await zonaService.reasignarTipoPuesto(puesto.id, null);
                        setPuestos(prev => prev.map(p => p.id === puesto.id ? { 
                            ...p, 
                            tipo_acceso_id: null, 
                            tipo_acceso_nombre: null 
                        } : p));
                        pointer++;
                    }
                }
                // Refresco final de seguridad
                await cargarPuestos();
            })(),
            {
                loading: 'Aplicando distribución inteligente...',
                success: 'Distribución aplicada con éxito',
                error: 'Error durante la distribución',
            }
        );
    };

    // ── Acciones: Tipos de Acceso ─────────────────────────────────────────────

    const abrirModalTipo = (tipo = null) => {
        setTipoEditar(tipo);
        
        // Si es un tipo base (general, vip, etc)
        if (tipo && tipo.es_base) {
            const cfg = brandingEntidad[tipo.id] || { layout: 'qr', color_preset: 'aegis' };
            setFormTipo({
                nombre: tipo.nombre,
                descripcion: 'Tipo de acceso base del sistema (No eliminable)',
                requiere_vehiculo: true,
                max_vehiculos: 1,
                color_hex: tipo.color_badge || '#4EDEA3',
                plantilla_layout: cfg.layout || 'qr',
                color_preset: cfg.color_preset || 'aegis',
                activo: true,
                es_base: true
            });
        } else {
            setFormTipo(tipo ? { ...tipo } : {
                nombre: '', descripcion: '', requiere_vehiculo: true,
                max_vehiculos: 1, color_hex: '#4EDEA3', 
                plantilla_layout: 'qr', color_preset: 'aegis',
                activo: true,
            });
        }
        setModalTipo(true);
    };

    const handleGuardarTipo = async () => {
        if (!formTipo.nombre.trim()) {
            toast.error('El nombre es requerido');
            return;
        }
        setGuardandoTipo(true);
        try {
            if (tipoEditar && tipoEditar.es_base) {
                // Es un tipo base, guardamos en config_branding de la entidad
                const nuevaConfig = {
                    ...brandingEntidad,
                    [tipoEditar.id]: {
                        layout: formTipo.plantilla_layout,
                        color_preset: formTipo.color_preset,
                        color_hex: formTipo.color_hex
                    }
                };
                await entidadService.actualizarBranding(user.entidad_id, nuevaConfig);
                setBrandingEntidad(nuevaConfig);
                toast.success(`Marca para ${tipoEditar.nombre} actualizada`);
                setModalTipo(false);
            } else if (tipoEditar) {
                await zonaService.actualizarTipoAcceso(tipoEditar.id, formTipo);
                toast.success('Tipo de acceso actualizado');
                setModalTipo(false);
                await cargarTipos();
            } else {
                await zonaService.crearTipoAcceso({ ...formTipo, entidad_id: user.entidad_id });
                toast.success('Tipo de acceso creado');
                setModalTipo(false);
                await cargarTipos();
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al guardar');
        } finally {
            setGuardandoTipo(false);
        }
    };

    const handleToggleTipo = async (tipo) => {
        try {
            await zonaService.actualizarTipoAcceso(tipo.id, { activo: !tipo.activo });
            toast.success(tipo.activo ? 'Tipo desactivado' : 'Tipo activado');
            await cargarTipos();
        } catch (e) {
            toast.error('Error al cambiar estado');
        }
    };

    const handleEliminarTipo = async (tipo) => {
        if (!window.confirm(`¿Eliminar el tipo "${tipo.nombre}"?`)) return;
        try {
            await zonaService.eliminarTipoAcceso(tipo.id);
            toast.success('Tipo eliminado');
            await cargarTipos();
        } catch (e) {
            toast.error('Error al eliminar');
        }
    };

    // ── Estadísticas rápidas ──────────────────────────────────────────────────

    // Mapa puesto_id → pase para la vista de TarjetaPuesto
    const puestosPorQR = resumenDisponibilidad.reduce((acc, zona) => {
        (zona.pases_muestra || []).forEach(p => {
            if (p.puesto_asignado_id) acc[p.puesto_asignado_id] = p;
        });
        return acc;
    }, {});

    const stats = {
        total: resumenDisponibilidad.length > 0
            ? resumenDisponibilidad.reduce((acc, z) => acc + z.cupo_asignado, 0)
            : asignaciones.reduce((acc, a) => acc + a.cupo_asignado, 0),
        reservados: resumenDisponibilidad.length > 0
            ? resumenDisponibilidad.reduce((acc, z) => acc + z.pases_vigentes, 0)
            : asignaciones.reduce((acc, asig) =>
                acc + Object.values(asig.distribucion_cupos || {}).reduce((sum, val) => sum + val, 0), 0),
        ocupados: resumenDisponibilidad.length > 0
            ? resumenDisponibilidad.reduce((acc, z) => acc + (z.pases_ingresados || 0), 0)
            : puestos.filter(p => p.estado === 'ocupado').length,
    };
    stats.libres = Math.max(0, stats.total - stats.reservados);

    // Formateador de fecha para mostrar al usuario
    const fechaLegible = (() => {
        const f = new Date(fechaConsulta + 'T12:00:00');
        return f.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    })();
    const esFechaHoy = fechaConsulta === hoyISO;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="p-4 space-y-6 pb-32 max-w-[1400px] mx-auto animate-in fade-in duration-500">

            {/* Header Táctico Sincronizado */}
            <header className="relative overflow-hidden bg-bg-card/30 rounded-2xl border border-white/5 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Decoración de fondo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32" />
                
                {/* Bloque Izquierdo: Identidad */}
                <div className="relative flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-lg shadow-primary/5">
                        <ParkingSquare className="text-primary" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-text-main uppercase tracking-tighter leading-none">
                            Estacionamientos
                        </h1>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2 px-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                            {user?.entidad_nombre} — Puestos Asignados
                        </p>
                    </div>
                </div>
            </header>

            {/* KPIs mini */}
            {/* Panel de Indicadores KPI Sincronizados */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total', valor: stats.total, color: 'text-primary', icon: ParkingSquare, sub: 'Capacidad asignada' },
                    { label: 'Libres', valor: stats.libres, color: 'text-success', icon: CheckCircle2, sub: 'Disponibilidad real' },
                    { label: 'Ocupados', valor: stats.ocupados, color: 'text-danger', icon: Car, sub: 'Activos en zona' },
                    { label: 'Reservados', valor: stats.reservados, color: 'text-warning', icon: Shield, sub: 'Pases no ingresados' },
                ].map((s, i) => (
                    <div key={i} className="p-4 bg-bg-card/40 border border-white/5 rounded-2xl flex items-center gap-4 group hover:bg-bg-high/80 transition-all border-b-2 border-b-transparent hover:border-b-primary/50">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-black/40 border border-white/5 shrink-0", s.color)}>
                            <s.icon size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className={cn("text-2xl font-black leading-tight truncate", s.color)}>{s.valor}</div>
                            <div className="text-[10px] font-black uppercase text-text-muted tracking-widest truncate">{s.label}</div>
                            <div className="text-[8px] text-text-muted opacity-40 uppercase font-bold mt-0.5 whitespace-nowrap">{s.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex bg-bg-card/40 rounded-xl p-1 border border-white/5 gap-1">
                {[
                    { id: TABS.ZONAS, label: 'Zonas Asignadas', icon: MapPin },
                    { id: TABS.MAPA, label: 'Vista Mapa', icon: Map },
                    { id: TABS.TIPOS, label: 'Tipos Custom', icon: Tag },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                            tab === t.id
                                ? 'bg-primary text-bg-app shadow-md'
                                : 'text-text-muted hover:text-text-main hover:bg-white/5'
                        )}
                    >
                        <t.icon size={13} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── TAB: ZONAS ASIGNADAS ── */}
            {tab === TABS.ZONAS && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                            <MapPin size={11} className="text-primary" />
                            {asignaciones.length} Zonas asignadas por el Comandante
                        </p>
                        <div className="flex items-center gap-2">
                            {/* Flecha izquierda: día anterior */}
                            <button
                                onClick={() => handleNavFecha(-1)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                                title="Día anterior"
                            >
                                <ChevronLeft size={13} className="text-text-muted" />
                            </button>

                            {/* Chip selector de fecha (abre el calendario modal) */}
                            <button
                                onClick={() => { cargarCalendarioLotes(); setModalCalendario(true); }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all",
                                    esFechaHoy
                                        ? 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'
                                        : 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/20'
                                )}
                            >
                                <Calendar size={11} />
                                {esFechaHoy ? 'HOY' : fechaLegible}
                                {!esFechaHoy && <span className="ml-1 text-[7px] bg-warning/20 px-1 rounded">FUTURA</span>}
                            </button>

                            {/* Flecha derecha: día siguiente */}
                            <button
                                onClick={() => handleNavFecha(1)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                                title="Día siguiente"
                            >
                                <ChevronRight size={13} className="text-text-muted" />
                            </button>

                            {!esFechaHoy && (
                                <button
                                    onClick={() => handleCambiarFecha(hoyISO)}
                                    className="text-[8px] text-text-muted/60 hover:text-text-main transition-all px-2 py-1.5 rounded-lg hover:bg-white/5"
                                    title="Volver a hoy"
                                >
                                    ↩ Hoy
                                </button>
                            )}
                            <button onClick={cargarAsignaciones} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                                <RefreshCw size={14} className={cn("text-text-muted", (cargandoAsignaciones || cargandoResumen) && 'animate-spin')} />
                            </button>
                        </div>
                    </div>

                    {cargandoAsignaciones ? (
                        <div className="space-y-2">
                            {Array(2).fill(0).map((_, i) => (
                                <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                            ))}
                        </div>
                    ) : asignaciones.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                            <MapPin size={40} className="mx-auto text-white/10 mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">
                                Tu entidad no tiene zonas de estacionamiento asignadas
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {asignaciones.map(asig => {
                                // Buscar datos del resumen dinámico (si ya cargó)
                                const resumZona = resumenDisponibilidad.find(r => r.zona_id === asig.zona_id);
                                const pasesVigentes = resumZona?.pases_vigentes ?? 0;
                                const cupoLibre = resumZona?.cupo_libre ?? asig.cupo_asignado;
                                const pasesMuestra = resumZona?.pases_muestra ?? [];
                                const utilizable = cupoLibre;
                                const porcentajeOcupado = asig.cupo_asignado > 0
                                    ? Math.min(100, (pasesVigentes / asig.cupo_asignado) * 100)
                                    : 0;
                                const isExpanded = !!asignacionEdicion && asignacionEdicion.id === asig.id;

                                return (
                                    <div key={asig.id} className="bg-bg-card/40 border border-white/5 rounded-2xl overflow-hidden transition-all">
                                        <div>
                                            <div 
                                                className="flex items-center gap-3 p-4 pb-2 cursor-pointer hover:bg-white/5 transition-all"
                                                onClick={() => isExpanded ? setAsignacionEdicion(null) : setAsignacionEdicion(asig)}
                                            >
                                                <button className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 hover:bg-white/10 transition-all pointer-events-none">
                                                    <ChevronDown size={16} className={cn("text-text-muted transition-transform", isExpanded && "rotate-180")} />
                                                </button>
                                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                                                    <ParkingSquare size={18} className="text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-black text-text-main uppercase tracking-tight truncate">
                                                            {asig.zona_nombre || `Zona ${asig.zona_id?.slice(-4)}`}
                                                        </h3>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                                        <span className="text-[9px] text-text-muted flex items-center gap-1">
                                                            <Hash size={9} /> Cupo: {asig.cupo_asignado}
                                                        </span>
                                                        <span className="text-[9px] text-text-muted flex items-center gap-1">
                                                            <Shield size={9} /> Base: {asig.cupo_reservado_base}
                                                        </span>
                                                        {asig.parqueros && asig.parqueros.length > 0 && (
                                                            <span className="text-[9px] text-emerald-400/80 font-black flex items-center gap-1 uppercase tracking-tight">
                                                                <User size={9} className="text-emerald-500" /> 
                                                                Parquero: <span className="text-text-main">{asig.parqueros.map(p => p.nombre).join(', ')}</span>
                                                            </span>
                                                        )}
                                                        <span className="sm:hidden text-[9px] text-primary/70 font-bold uppercase">
                                                            {utilizable} Util.
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="hidden sm:flex items-center gap-4 px-4 border-l border-white/5">
                                                    <div className="text-center group">
                                                        <div className="text-xl text-primary font-black tracking-tighter transition-transform group-hover:scale-110">{utilizable}</div>
                                                        <div className="text-[7px] font-black uppercase tracking-widest text-text-muted/50">Utilizables</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                                    {/* Botón de creación de puestos oculto temporalmente */}
                                                    {/* 
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleAbrirGenerar(asig); }}
                                                        className="h-9 w-9 sm:w-auto sm:px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center justify-center sm:justify-start gap-2 transition-all group"
                                                        title="Crear Puestos"
                                                    >
                                                        <PackagePlus size={16} className="group-hover:scale-110 transition-transform" />
                                                        <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">Crear Puestos</span>
                                                    </button>
                                                    */}
                                                </div>
                                            </div>
                                            <div className="px-14 pb-3 pr-4 pointer-events-none">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {(pasesVigentes > 0 || (resumZona?.pases_ingresados > 0)) && (
                                                        <p className="text-[9px] text-text-main font-black dark:text-text-muted/60 dark:font-bold">
                                                            {pasesVigentes} RESERVADOS · {resumZona?.pases_ingresados || 0} OCUPADOS · {cupoLibre} LIBRES
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden flex border border-white/5 shadow-inner">
                                                    {asig.cupo_reservado_base > 0 && <div style={{ width: `${(asig.cupo_reservado_base / (asig.cupo_asignado + asig.cupo_reservado_base)) * 100}%` }} className="bg-danger/80 border-r border-black/50" title={`Reserva Base (${asig.cupo_reservado_base})`} />}
                                                    {resumZona?.pases_ingresados > 0 && <div style={{ width: `${((resumZona.pases_ingresados) / asig.cupo_asignado) * 100}%` }} className="bg-danger/70" title={`Ocupados (${resumZona.pases_ingresados})`} />}
                                                    {(pasesVigentes - (resumZona?.pases_ingresados || 0)) > 0 && <div style={{ width: `${((pasesVigentes - (resumZona?.pases_ingresados || 0)) / asig.cupo_asignado) * 100}%` }} className="bg-warning/70" title={`Pendientes (${pasesVigentes - (resumZona?.pases_ingresados || 0)})`} />}
                                                    {utilizable > 0 && <div style={{ width: `${(cupoLibre / asig.cupo_asignado) * 100}%` }} className="bg-primary/80" title={`Libres (${cupoLibre})`} />}
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 animate-in slide-in-from-top-2 duration-200 bg-black/5 dark:bg-black/20">
                                                {/* Distribución Lógica */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-text-main dark:text-text-muted/50 flex items-center gap-1.5">
                                                            <LayoutGrid size={10} className="text-primary-dark dark:text-primary" /> Distribución Lógica
                                                        </p>
                                                        <button onClick={(e) => { e.stopPropagation(); handleAbrirDistribucion(asig); }} className="text-[9px] text-sky-400 font-bold hover:underline flex items-center gap-1">
                                                            <Settings size={10} /> Configurar
                                                        </button>
                                                    </div>
                                                    {asig.distribucion_cupos && Object.keys(asig.distribucion_cupos).length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(asig.distribucion_cupos).map(([k, v]) => (
                                                                <span key={k} className="text-[11px] font-black bg-slate-200 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/5 text-slate-800 dark:text-text-main flex items-center gap-2 shadow-sm">
                                                                    {k.toUpperCase()}: <span className="text-emerald-700 dark:text-primary font-black border-l border-slate-300 dark:border-white/10 pl-2">{v}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[9px] text-text-muted/60 italic">Sin distribución configurada</p>
                                                    )}
                                                </div>

                                                {/* Panel de Pases Registrados */}
                                                {pasesMuestra.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/5 dark:border-white/5">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-main dark:text-text-muted/50 flex items-center gap-1.5">
                                                                <QrCode size={10} className="text-sky-700 dark:text-sky-400" />
                                                                Pases registrados · {fechaLegible}
                                                                <span className="ml-1 text-sky-700 dark:text-sky-400 px-2 py-0.5 bg-sky-100 dark:bg-sky-400/10 rounded-full border border-sky-200 dark:border-sky-400/20">({resumZona?.total_pases_zona ?? pasesVigentes})</span>
                                                            </p>
                                                        </div>
                                                        {/* Grid adaptativo: 1 col móvil · 2 col tablet · 3 col PC */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                                            {pasesMuestra.map((p, pi) => {
                                                                const tipoInfo = TIPO_ACCESO_LABEL[p.tipo_acceso] || TIPO_ACCESO_LABEL.custom;
                                                                return (
                                                                    <div
                                                                        key={p.id || pi}
                                                                        className={cn(
                                                                            "flex items-center gap-2 px-2 py-1.5 rounded-xl border group relative shadow-sm",
                                                                            p.tiene_datos
                                                                                ? 'bg-white border-slate-200 dark:bg-white/3 dark:border-white/5 hover:border-slate-400 dark:hover:border-white/10'
                                                                                : 'bg-amber-50 border-amber-200 dark:bg-warning/5 dark:border-warning/20 hover:border-amber-400 dark:hover:border-warning/30'
                                                                        )}
                                                                    >
                                                                        {/* Icono QR */}
                                                                        <div className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/5">
                                                                            <QrCode size={10} className={p.tiene_datos ? 'text-slate-600 dark:text-text-muted/60' : 'text-amber-600 dark:text-warning/60'} />
                                                                        </div>

                                                                        {/* Contenido central */}
                                                                        <div className="flex-1 min-w-0">
                                                                            {p.tiene_datos ? (
                                                                                <>
                                                                                    <p className="text-[8px] font-black text-slate-900 dark:text-text-main uppercase truncate">
                                                                                        {p.nombre_portador || p.serial_legible}
                                                                                    </p>
                                                                                    <p className="text-[7px] text-slate-600 dark:text-text-muted/60 font-black font-mono truncate">
                                                                                        {p.cedula_portador ? `CI: ${p.cedula_portador} · ` : ''}{p.vehiculo_placa ? `🚗 ${p.vehiculo_placa}` : p.serial_legible}
                                                                                    </p>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <p className="text-[7px] text-amber-700 dark:text-warning/80 font-black flex items-center gap-1 uppercase">
                                                                                        <AlertTriangle size={7} /> Sin identificar
                                                                                    </p>
                                                                                    <p className="text-[7px] font-black font-mono text-slate-500 dark:text-text-muted/50 truncate uppercase">{p.serial_legible}</p>
                                                                                </>
                                                                            )}
                                                                        </div>

                                                                        {/* Badge tipo acceso */}
                                                                        <span className={cn(
                                                                            "text-[6px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0",
                                                                            tipoInfo.color
                                                                        )}>
                                                                            {tipoInfo.label}
                                                                        </span>

                                                                        {/* Botón copiar enlace */}
                                                                        <button
                                                                            onClick={() => {
                                                                                const url = `${window.location.origin}/portal/pase/${p.token}`;
                                                                                navigator.clipboard.writeText(url);
                                                                                toast.success('¡Enlace de portal copiado!');
                                                                            }}
                                                                            className="p-1 rounded-lg bg-white/40 dark:bg-white/5 hover:bg-sky-500/20 shrink-0 transition-colors border border-white/20 dark:border-transparent"
                                                                            title="Copiar enlace del portal"
                                                                        >
                                                                            <Share2 size={10} className="text-sky-500" />
                                                                        </button>

                                                                        {/* Botón editar */}
                                                                        <button
                                                                            onClick={() => handleAbrirEditPase(p)}
                                                                            className="p-1 rounded-lg bg-white/40 dark:bg-white/5 hover:bg-primary/20 shrink-0 transition-colors border border-white/20 dark:border-transparent"
                                                                            title="Editar datos del pase"
                                                                        >
                                                                            <Pencil size={9} className="text-text-sec dark:text-text-muted/60 group-hover:text-primary transition-colors" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {pasesVigentes > pasesMuestra.length && (
                                                            <button 
                                                                onClick={() => handleAbrirTodosPases(resumZona)}
                                                                className="w-full text-[8px] font-black uppercase tracking-widest text-sky-400/80 hover:text-sky-300 mt-2 text-center transition-all flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sky-400/5 hover:bg-sky-400/10 border border-sky-400/10"
                                                            >
                                                                <Eye size={10} /> + {pasesVigentes - pasesMuestra.length} pases más · Ver todos
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB: MAPA TÁCTICO ── */}
            {tab === TABS.MAPA && (
                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between bg-bg-card/40 border border-white/5 p-4 rounded-2xl">
                        <div>
                            <p className="text-[10px] font-black text-text-main font-display uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                Link Satelital Activo
                            </p>
                            <p className="text-[8px] text-text-muted font-bold uppercase tracking-[0.1em] mt-1">
                                Visualizando {asignaciones.length} zonas georreferenciadas
                            </p>
                        </div>
                        <button 
                             onClick={() => setMapaReloadKey(k => k + 1)}
                             className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted transition-all"
                             title="Refrescar Link Satelital"
                        >
                            <RefreshCw size={14} className={cargandoMapa ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="h-[500px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
                        <MapaTactico 
                            pollingEnabled={true} 
                            situacionPreload={situacionFiltrada} 
                            idsZonasPermitidas={asignaciones.map(a => a.zona_id)}
                            idEntidadFiltro={user?.entidad_id}
                            allowGeoreference={false}
                        />
                        
                        {/* Overlay de carga */}
                        {cargandoMapa && !situacionFiltrada && (
                            <div className="absolute inset-0 z-[2000] bg-bg-app/60 backdrop-blur-sm flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-[10px] text-primary font-black uppercase tracking-widest">Sincronizando Radar...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                         <Target size={16} className="text-primary shrink-0 mt-0.5" />
                         <p className="text-[9px] text-text-muted leading-relaxed uppercase font-bold">
                             <strong className="text-primary">Modo de Visualización Táctica:</strong> Solo se muestran los activos (Zonas de Parqueo) asignados directamente a {user?.entidad_nombre}. Haz clic en los pines para ver detalles de ocupación en tiempo real.
                         </p>
                    </div>
                </div>
            )}

            {/* ── TAB: PUESTOS (DESHABILITADO TEMPORALMENTE) ── */}
            {/*
            {tab === TABS.PUESTOS && (
                <div className="space-y-3">
                    ... (contenido omitido en el comentario)
                </div>
            )}
            */}

            {/* ── TAB: TIPOS DE ACCESO ── */}
            {tab === TABS.TIPOS && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between bg-bg-card/40 border border-white/5 p-4 rounded-2xl">
                        <div>
                            <p className="text-[10px] font-black text-text-main uppercase tracking-widest flex items-center gap-2">
                                <Tag size={12} className="text-primary" />
                                Gestión de Accesos
                            </p>
                            <p className="text-[8px] text-text-muted font-bold uppercase tracking-widest mt-1">
                                {tipos.length} tipos configurados
                            </p>
                        </div>
                        <button
                            onClick={() => abrirModalTipo()}
                            className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 h-10 px-4 rounded-xl flex items-center gap-2 transition-all group"
                        >
                            <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Nuevo Tipo</span>
                        </button>
                    </div>

                    {/* Info box */}
                    <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                        <Zap size={16} className="text-primary shrink-0 mt-0.5" />
                        <p className="text-[9px] text-text-muted leading-relaxed">
                            Los <strong className="text-text-main">tipos de acceso custom</strong> te permiten definir categorías propias (Staff, VIP, Logístico) que se asignan al crear pases para tus socios. Puedes configurar si requieren vehículo, cuántos pueden registrar y un color identificador.
                        </p>
                    </div>

                    {cargandoTipos ? (
                        <div className="space-y-2">
                            {Array(3).fill(0).map((_, i) => (
                                <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Tipos Base Inyectados (Configurables) */}
                            {[
                                { id: 'general', nombre: 'Público General', es_base: true, color_badge: '#3B82F6' },
                            ].map(tipoBase => {
                                // Aplicar override de branding si existe
                                const cfg = brandingEntidad[tipoBase.id] || {};
                                const tFinal = {
                                    ...tipoBase,
                                    color_badge: cfg.color_hex || tipoBase.color_badge,
                                    layout: cfg.layout || 'qr'
                                };
                                return (
                                    <TarjetaTipoAcceso
                                        key={tFinal.id}
                                        tipo={tFinal}
                                        onEditar={abrirModalTipo}
                                        onEliminar={null} // No se pueden eliminar los base
                                        onToggle={null}   // Siempre activos
                                    />
                                );
                            })}

                            {/* Tipos Custom del usuario */}
                            {tipos.map(tipo => (
                                <TarjetaTipoAcceso
                                    key={tipo.id}
                                    tipo={tipo}
                                    onEditar={abrirModalTipo}
                                    onEliminar={handleEliminarTipo}
                                    onToggle={handleToggleTipo}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── MODAL: Asignar Puesto ── */}
            <Modal
                isOpen={modalAsignar}
                onClose={() => setModalAsignar(false)}
                title={`ASIGNAR PUESTO ${puestoSeleccionado?.numero_puesto || puestoSeleccionado?.codigo || ''}`}
            >
                <div className="space-y-5">
                    <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                        <ParkingSquare size={20} className="text-primary shrink-0" />
                        <div>
                            <p className="text-[9px] font-black text-primary uppercase tracking-wider">Puesto seleccionado</p>
                            <p className="text-sm font-black text-text-main">{puestoSeleccionado?.numero_puesto || puestoSeleccionado?.codigo} — {puestoSeleccionado?.zona_nombre}</p>
                        </div>
                    </div>

                    <Input
                        label="ID o Cédula del Socio"
                        placeholder="V-00000000 o UUID del socio"
                        value={asignacion.socio_id}
                        onChange={e => setAsignacion({ ...asignacion, socio_id: e.target.value })}
                    />
                    
                    <div className="pt-2">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Car size={12} className="text-primary" /> Datos del Vehículo
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Placa"
                                placeholder="PLACA"
                                value={asignacion.placa}
                                onChange={e => setAsignacion({ ...asignacion, placa: e.target.value.toUpperCase() })}
                            />
                            <Input
                                label="Color"
                                placeholder="COLOR"
                                value={asignacion.color}
                                onChange={e => setAsignacion({ ...asignacion, color: e.target.value.toUpperCase() })}
                            />
                            <Input
                                label="Marca"
                                placeholder="MARCA"
                                value={asignacion.marca}
                                onChange={e => setAsignacion({ ...asignacion, marca: e.target.value.toUpperCase() })}
                            />
                            <Input
                                label="Modelo"
                                placeholder="MODELO"
                                value={asignacion.modelo}
                                onChange={e => setAsignacion({ ...asignacion, modelo: e.target.value.toUpperCase() })}
                            />
                        </div>
                    </div>

                    <Input
                        label="Notas (Opcional)"
                        placeholder="Observaciones de la asignación..."
                        value={asignacion.notas}
                        onChange={e => setAsignacion({ ...asignacion, notas: e.target.value })}
                    />

                    <div className="flex gap-3 pt-2">
                        <Boton variant="ghost" className="flex-1" onClick={() => setModalAsignar(false)}>Cancelar</Boton>
                        <Boton
                            onClick={handleAsignar}
                            disabled={asignando || !asignacion.socio_id}
                            className="flex-[2] bg-primary text-bg-app h-12 font-black uppercase tracking-wider"
                        >
                            {asignando ? <RefreshCw size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar Asignación</>}
                        </Boton>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Crear/Editar Tipo de Acceso ── */}
            <Modal
                isOpen={modalTipo}
                onClose={() => setModalTipo(false)}
                title={tipoEditar ? 'EDITAR TIPO DE ACCESO' : 'NUEVO TIPO DE ACCESO'}
            >
                <div className="space-y-5">
                    <Input
                        label="Nombre del Tipo *"
                        placeholder="Ej: STAFF TÉCNICO, PRODUCTOR VIP..."
                        value={formTipo.nombre}
                        onChange={e => setFormTipo({ ...formTipo, nombre: e.target.value.toUpperCase() })}
                    />
                    <Input
                        label="Descripción (Opcional)"
                        placeholder="Breve descripción de este tipo de acceso"
                        value={formTipo.descripcion}
                        onChange={e => setFormTipo({ ...formTipo, descripcion: e.target.value })}
                    />

                    {/* Selector de color circular */}
                    {/* Info de requerimiento implicito */}
                    <div className="flex items-start gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                        <Car size={14} className="text-primary shrink-0 mt-0.5" />
                        <p className="text-[9px] text-text-muted leading-tight uppercase font-bold">
                            Nota: Todo acceso de tipo estacionamiento requiere vinculación de vehículo obligatoria.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Selector de color circular */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                <Palette size={11} className="text-primary" /> Color del Badge
                            </label>
                            <div className="flex flex-wrap gap-1.5 p-2 bg-white/5 rounded-xl border border-white/5 h-[84px] overflow-y-auto">
                                {[
                                    '#4EDEA3', '#3B82F6', '#F2C94C', '#EB5757', 
                                    '#A855F7', '#EC4899', '#06B6D4', '#64748B',
                                    '#2D3A2D', '#F97316', '#8B5CF6', '#10B981'
                                ].map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setFormTipo({ ...formTipo, color_hex: color })}
                                        className={cn(
                                            "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                                            formTipo.color_hex === color ? "border-primary scale-110 shadow-lg" : "border-transparent"
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Máximo de vehículos */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block">
                                Máx. Vehículos
                            </label>
                            <div className="grid grid-cols-2 gap-2 h-[84px]">
                                {[1, 2, 3, 4].map(n => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setFormTipo({ ...formTipo, max_vehiculos: n })}
                                        className={cn(
                                            "rounded-xl border-2 text-xs font-black transition-all flex items-center justify-center",
                                            formTipo.max_vehiculos === n
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20'
                                        )}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Selección de Plantilla (v2.4) */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                <LayoutGrid size={11} className="text-primary" /> Plantilla de Carnet
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'qr', label: 'QR Simple', icon: QrCode },
                                    { id: 'colgante', label: 'Colgante', icon: UserSquare2 },
                                    { id: 'cartera', label: 'Cartera', icon: CreditCard },
                                    { id: 'ticket', label: 'Ticket', icon: Ticket },
                                    { id: 'credencial', label: 'Credencial', icon: ShieldCheck },
                                    { id: 'parabrisas', label: 'Parabrisas', icon: Car },
                                ].map(lay => (
                                    <button
                                        key={lay.id}
                                        type="button"
                                        onClick={() => setFormTipo({ ...formTipo, plantilla_layout: lay.id })}
                                        className={cn(
                                            "p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                                            formTipo.plantilla_layout === lay.id
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20'
                                        )}
                                    >
                                        <lay.icon size={16} />
                                        <span className="text-[7.5px] font-black uppercase text-center leading-tight">{lay.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Selección de Estilo de Colores (v2.4) */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                <Palette size={11} className="text-primary" /> Estilo de Colores
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'aegis', label: 'Aegis Dynamic', color: 'bg-[#4EDEA3]' },
                                    { id: 'militar', label: 'Táctico Militar', color: 'bg-[#2D3A2D]' },
                                    { id: 'vip', label: 'VIP Gold', color: 'bg-[#F2C94C]' },
                                    { id: 'alfa', label: 'Alfa Red', color: 'bg-[#EB5757]' },
                                ].map(preset => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setFormTipo({ ...formTipo, color_preset: preset.id })}
                                        className={cn(
                                            "p-2 rounded-xl border-2 transition-all flex items-center gap-2 relative overflow-hidden",
                                            formTipo.color_preset === preset.id
                                                ? 'bg-primary/10 border-primary text-primary'
                                                : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20'
                                        )}
                                    >
                                        <div className={cn("w-3 h-3 rounded-full shrink-0 shadow-sm", preset.color)} />
                                        <span className="text-[9px] font-black uppercase tracking-tight">{preset.label}</span>
                                        {formTipo.color_preset === preset.id && <CheckCircle2 size={10} className="absolute top-1 right-1" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-white/5">
                        <Boton variant="ghost" className="flex-1" onClick={() => setModalTipo(false)}>Cancelar</Boton>
                        <Boton
                            onClick={handleGuardarTipo}
                            disabled={guardandoTipo}
                            className="flex-[2] bg-primary text-bg-app h-12 font-black uppercase tracking-wider"
                        >
                            {guardandoTipo ? <RefreshCw size={16} className="animate-spin" /> : tipoEditar ? 'Guardar Cambios' : 'Crear Tipo'}
                        </Boton>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Configurar Distribución ── */}
            <Modal isOpen={modalDistribucion} onClose={() => setModalDistribucion(false)} title="CONFIGURAR DISTRIBUCIÓN">
                <div className="space-y-4">
                    <p className="text-[10px] text-text-muted leading-relaxed">
                        Define los cupos reservados para cada Tipo de Acceso. El remanente quedará disponible de forma general/pública.
                    </p>
                    
                    {tipos.map(tipo => (
                        <div key={tipo.nombre} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                            <span className="text-xs font-bold uppercase">{tipo.nombre}</span>
                            <input 
                                type="number" 
                                min="0" 
                                value={formDistribucion[tipo.nombre] || 0}
                                onChange={(e) => setFormDistribucion({...formDistribucion, [tipo.nombre]: parseInt(e.target.value) || 0})}
                                className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1 text-right text-sm font-bold"
                            />
                        </div>
                    ))}

                    <div className="flex gap-3 pt-2 mt-4 border-t border-white/5 pt-4">
                        <Boton variant="ghost" className="flex-1" onClick={() => setModalDistribucion(false)}>Cancelar</Boton>
                        <Boton
                            onClick={handleGuardarDistribucion}
                            className="flex-[2] bg-primary text-bg-app h-12 font-black uppercase tracking-wider"
                        >
                            Guardar Distribución
                        </Boton>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Generar Puestos ── */}
            <Modal isOpen={modalGenerar} onClose={() => setModalGenerar(false)} title="GENERAR PUESTOS FÍSICOS">
                <div className="space-y-4">
                    <p className="text-[10px] text-text-muted leading-relaxed">
                        Genera registros de puestos individuales atados a tu entidad. Esto te permitirá asignarlos uno a uno a placas especificas.
                    </p>

                    <Input
                        label="Prefijo"
                        placeholder="Ej: VIP, STAFF..."
                        value={formGenerar.prefijo}
                        onChange={e => setFormGenerar({ ...formGenerar, prefijo: e.target.value.toUpperCase() })}
                    />
                    
                    <Input
                        label="Cantidad de puestos a generar"
                        type="number"
                        min="1"
                        value={formGenerar.cantidad}
                        onChange={e => setFormGenerar({ ...formGenerar, cantidad: parseInt(e.target.value) || 1 })}
                    />

                    <div className="flex gap-3 pt-2 mt-4 border-t border-white/5 pt-4">
                        <Boton variant="ghost" className="flex-1" onClick={() => setModalGenerar(false)}>Cancelar</Boton>
                        <Boton
                            onClick={handleGenerarPuestos}
                            disabled={generando || formGenerar.cantidad < 1}
                            className="flex-[2] bg-primary text-bg-app h-12 font-black uppercase tracking-wider"
                        >
                            {generando ? <RefreshCw size={16} className="animate-spin" /> : 'Generar Puestos'}
                        </Boton>
                    </div>
                </div>
            </Modal>
            {/* ── MODAL: Reasignar Distribución Lógica ── */}
            <Modal
                isOpen={modalReasignar}
                onClose={() => setModalReasignar(false)}
                title={`DISTRIBUCIÓN LÓGICA: ${puestoAReasignar?.numero_puesto || ''}`}
            >
                <div className="space-y-4">
                    <p className="text-[10px] text-text-muted leading-relaxed">
                        Selecciona el grupo al que pertenece este puesto para restringir su asignación en la generación de pases.
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                        <button
                            onClick={() => handleReasignarTipo(null)}
                            className={cn(
                                "flex items-center justify-between p-4 rounded-xl border transition-all",
                                !puestoAReasignar?.tipo_acceso_id 
                                    ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Shield size={16} className={!puestoAReasignar?.tipo_acceso_id ? 'text-primary' : 'text-text-muted'} />
                                <span className="text-[11px] font-black uppercase tracking-wider">Ninguno / Disponible</span>
                            </div>
                            {!puestoAReasignar?.tipo_acceso_id && <CheckCircle2 size={16} className="text-primary" />}
                        </button>

                        {tipos.map(tipo => (
                            <button
                                key={tipo.id}
                                onClick={() => handleReasignarTipo(tipo.id)}
                                className={cn(
                                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                                    puestoAReasignar?.tipo_acceso_id === tipo.id 
                                        ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5' 
                                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Tag size={16} style={{ color: tipo.color_badge || '#fff' }} />
                                    <span className="text-[11px] font-black uppercase tracking-wider">{tipo.nombre}</span>
                                </div>
                                {puestoAReasignar?.tipo_acceso_id === tipo.id && <CheckCircle2 size={16} className="text-primary" />}
                            </button>
                        ))}
                    </div>

                    <div className="pt-2 border-t border-white/5">
                        <Boton variant="ghost" className="w-full" onClick={() => setModalReasignar(false)}>Cerrar</Boton>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Confirmar Auto-Distribución ── */}
            <ModalConfirmacion
                isOpen={modalAutoDistConfirm}
                onClose={() => setModalAutoDistConfirm(false)}
                onConfirm={confirmAutoDistribuir}
                type="warning"
                title="DISTRIBUCIÓN INTELIGENTE"
                message="¿Deseas aplicar la distribución inteligente a todos los puestos físicos vacíos? Esto sobrescribirá las asignaciones lógicas manuales actuales."
                confirmText="APLICAR DISTRIBUCIÓN"
            />

            {/* ── MODAL: Calendario de Lotes ── */}
            <CalendarioLotes
                abierto={modalCalendario}
                onCerrar={() => setModalCalendario(false)}
                fechaSeleccionada={fechaConsulta}
                onSeleccionarFecha={handleCambiarFecha}
                calendarioLotes={calendarioLotes}
                cargando={cargandoResumen}
            />

            {/* ── MODAL: Editar Datos del Pase ── */}
            <Modal
                isOpen={modalEditPase}
                onClose={() => setModalEditPase(false)}
                title="Editar Datos del Pase"
            >
                {paseEditando && (
                    <div className="space-y-4 min-w-[280px]">
                        {/* Info del serial */}
                        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/5">
                            <QrCode size={14} className="text-sky-400 shrink-0" />
                            <div>
                                <p className="text-[8px] font-black text-text-muted uppercase tracking-wider">Serial</p>
                                <p className="text-[11px] font-mono text-text-main">{paseEditando.serial_legible}</p>
                            </div>
                            {paseEditando.tipo_acceso && (
                                <span className={cn(
                                    "ml-auto text-[7px] font-black uppercase px-2 py-0.5 rounded border",
                                    (TIPO_ACCESO_LABEL[paseEditando.tipo_acceso] || TIPO_ACCESO_LABEL.custom).color
                                )}>
                                    {(TIPO_ACCESO_LABEL[paseEditando.tipo_acceso] || TIPO_ACCESO_LABEL.custom).label}
                                </span>
                            )}
                        </div>

                        {/* Datos del portador */}
                        <div>
                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <User size={9} /> Datos del Portador
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="col-span-2">
                                    <Input
                                        label="Nombre completo"
                                        value={formEditPase.nombre_portador || ''}
                                        onChange={e => setFormEditPase(p => ({ ...p, nombre_portador: e.target.value }))}
                                        placeholder="Nombre y apellido"
                                    />
                                </div>
                                <Input
                                    label="Cédula / ID"
                                    value={formEditPase.cedula_portador || ''}
                                    onChange={e => setFormEditPase(p => ({ ...p, cedula_portador: e.target.value }))}
                                    placeholder="Ej: V-12345678"
                                />
                                <Input
                                    label="Teléfono"
                                    value={formEditPase.telefono_portador || ''}
                                    onChange={e => setFormEditPase(p => ({ ...p, telefono_portador: e.target.value }))}
                                    placeholder="Ej: 0412..."
                                />
                                <div className="col-span-2">
                                    <Input
                                        label="Correo electrónico"
                                        value={formEditPase.email_portador || ''}
                                        onChange={e => setFormEditPase(p => ({ ...p, email_portador: e.target.value }))}
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Datos del vehículo */}
                        <div>
                            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Car size={9} /> Datos del Vehículo
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    label="Placa del vehículo"
                                    value={formEditPase.vehiculo_placa || ''}
                                    onChange={e => setFormEditPase(p => ({ ...p, vehiculo_placa: e.target.value.toUpperCase() }))}
                                    placeholder="Ej: ABC123"
                                />
                                <Input
                                    label="Marca"
                                    value={formEditPase.vehiculo_marca || ''}
                                    onChange={e => setFormEditPase(p => ({ ...p, vehiculo_marca: e.target.value }))}
                                    placeholder="Toyota, Ford..."
                                />
                                <Input
                                    label="Modelo"
                                    value={formEditPase.vehiculo_modelo || ''}
                                    onChange={e => setFormEditPase(p => ({ ...p, vehiculo_modelo: e.target.value }))}
                                    placeholder="Hilux, Corolla..."
                                />
                                <Input
                                    label="Color"
                                    value={formEditPase.vehiculo_color || ''}
                                    onChange={e => setFormEditPase(p => ({ ...p, vehiculo_color: e.target.value }))}
                                    placeholder="Negro, Blanco..."
                                />
                            </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-4 pt-6 mt-4 border-t border-slate-100 dark:border-white/5">
                            <Boton
                                variant="outline"
                                className="flex-1 h-12 border-slate-200 dark:border-white/10 text-slate-600 dark:text-text-muted hover:bg-slate-50 dark:hover:bg-white/5 font-black uppercase tracking-widest text-[10px]"
                                onClick={() => setModalEditPase(false)}
                                disabled={guardandoPase}
                            >
                                CANCELAR
                            </Boton>
                            <Boton
                                variant="primario"
                                className="flex-[1.5] h-12 bg-primary text-white dark:text-on-primary font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                                onClick={handleGuardarPase}
                                disabled={guardandoPase}
                            >
                                {guardandoPase ? 'Procesando...' : 'GUARDAR CAMBIOS'}
                            </Boton>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── MODAL: Listado Completo de Pases ── */}
            <Modal
                isOpen={modalTodosPases}
                onClose={() => setModalTodosPases(false)}
                title="Pases Registrados"
                subtitle={zonaSeleccionadaParaTodos?.zona_nombre || ''}
                className="max-w-4xl"
            >
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                        <div className="flex flex-col">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-main flex items-center gap-2">
                                <QrCode size={12} className="text-sky-400" />
                                {zonaSeleccionadaParaTodos?.zona_nombre}
                            </p>
                            <p className="text-[8px] text-text-muted/60 font-medium">
                                Total: {paginacionTodos.total} pases detectados
                            </p>
                        </div>
                        
                        {/* Buscador Táctico */}
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40" />
                            <input 
                                type="text"
                                value={busquedaTodos}
                                onChange={(e) => {
                                    setBusquedaTodos(e.target.value);
                                    handleCambiarPaginaTodos(1, e.target.value);
                                }}
                                placeholder="Buscar por QR, Cédula, Nombre o Placa..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[10px] text-text-main placeholder:text-text-muted/20 focus:outline-none focus:border-primary/50 transition-all"
                            />
                        </div>

                        {/* Paginación minimalista inferior o lateral */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-[10px] font-mono text-primary font-bold">{paginacionTodos.pagina}</span>
                                <span className="text-[10px] font-mono text-text-muted/40">/</span>
                                <span className="text-[10px] font-mono text-text-muted">{paginacionTodos.paginas}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handleCambiarPaginaTodos(paginacionTodos.pagina - 1)}
                                    disabled={paginacionTodos.pagina === 1 || cargandoTodosPases}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all border border-white/5"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button 
                                    onClick={() => handleCambiarPaginaTodos(paginacionTodos.pagina + 1)}
                                    disabled={paginacionTodos.pagina === paginacionTodos.paginas || cargandoTodosPases}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all border border-white/5"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {cargandoTodosPases ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 py-4">
                            {Array(9).fill(0).map((_, i) => (
                                <div key={i} className="h-14 bg-white/5 rounded-xl border border-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar min-h-[200px]">
                            {pasesZonaCompletos.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-12 text-text-muted/30">
                                    <QrCode size={40} className="mb-2 opacity-10" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No hay pases adicionales</p>
                                </div>
                            ) : pasesZonaCompletos.map((p, pi) => {
                                const tipoInfo = TIPO_ACCESO_LABEL[p.tipo_acceso] || TIPO_ACCESO_LABEL.custom;
                                return (
                                    <div
                                        key={p.id || pi}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-xl border group transition-all",
                                            p.tiene_datos
                                                ? 'bg-white/3 border-white/5 hover:border-white/10'
                                                : 'bg-warning/5 border-warning/20 hover:border-warning/30'
                                        )}
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                            <QrCode size={13} className={p.tiene_datos ? 'text-text-muted/40' : 'text-warning/50'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {p.tiene_datos ? (
                                                <>
                                                    <p className="text-[9px] font-black text-text-main uppercase truncate leading-tight">
                                                        {p.nombre_portador || p.serial_legible}
                                                    </p>
                                                    <p className="text-[8px] text-text-muted/60 font-mono truncate">
                                                        {p.cedula_portador ? `CI: ${p.cedula_portador} · ` : ''}{p.vehiculo_placa ? `🚗 ${p.vehiculo_placa}` : p.serial_legible}
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-[8px] text-warning/80 font-bold flex items-center gap-1 leading-tight">
                                                        <AlertTriangle size={8} /> Sin identificar
                                                    </p>
                                                    <p className="text-[8px] font-mono text-text-muted/50 truncate">{p.serial_legible}</p>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={cn(
                                                "text-[6px] font-black uppercase px-2 py-0.5 rounded border leading-none shrink-0",
                                                tipoInfo.color
                                            )}>
                                                {tipoInfo.label}
                                            </span>
                                            <button
                                                onClick={() => handleAbrirEditPase(p)}
                                                className="p-1 rounded-lg bg-white/5 hover:bg-primary/20 shrink-0 transition-colors"
                                                title="Editar pase"
                                            >
                                                <Pencil size={10} className="text-text-muted/40 group-hover:text-primary" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
