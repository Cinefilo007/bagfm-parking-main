import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft, Bell, Car, ParkingSquare, LogOut, LogIn,
    RefreshCw, ChevronDown, ChevronUp, Clock, Shield,
    AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { parqueroService } from '../../services/parquero.service';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Boton } from '../../components/ui/Boton';

// ── Helpers de formato ────────────────────────────────────────────────────
const formatearHora = (isoString) => {
    if (!isoString) return '—';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
};

const formatearFechaDisplay = (isoString) => {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        const hoy = new Date();
        const ayer = new Date();
        ayer.setDate(hoy.getDate() - 1);

        if (d.toDateString() === hoy.toDateString()) return 'HOY';
        if (d.toDateString() === ayer.toDateString()) return 'AYER';

        return d.toLocaleDateString('es-VE', {
            day: '2-digit', month: 'short', year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined
        }).toUpperCase();
    } catch { return 'FECHA DESCONOCIDA'; }
};

const tiempoRelativo = (isoString) => {
    if (!isoString) return null;
    try {
        const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
        if (diff < 60) return 'Hace un momento';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
        return formatearHora(isoString);
    } catch { return null; }
};

// ── Icono y color por tipo de evento ─────────────────────────────────────
const CONFIG_TIPO = {
    alcabala: {
        Icon: Shield,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/20',
        dot: 'bg-indigo-400',
        label: 'ENTRADA POR ALCABALA',
    },
    ingreso_zona: {
        Icon: LogIn,
        color: 'text-success',
        bg: 'bg-success/10',
        border: 'border-success/20',
        dot: 'bg-success',
        label: 'INGRESÓ A ZONA',
    },
    salida_zona: {
        Icon: LogOut,
        color: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/20',
        dot: 'bg-warning',
        label: 'SALIÓ DE ZONA',
    },
};

// ── Tarjeta de evento individual (Timeline) ───────────────────────────────
const TarjetaEvento = ({ evento, onEntrada, onCompletar }) => {
    const navigate = useNavigate();
    const [cargando, setCargando] = useState(false);
    const cfg = CONFIG_TIPO[evento.tipo] || CONFIG_TIPO.alcabala;
    const { Icon } = cfg;

    const handleEntrada = async (e) => {
        e.stopPropagation();
        if (!evento.placa) return;
        setCargando(true);
        try {
            await onEntrada(evento.placa);
        } catch (err) {
            // Error manejado en el parent
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className={cn(
            'group relative flex flex-col p-4 rounded-2xl border bg-bg-card/40 border-white/5 hover:border-white/10 transition-all hover:bg-bg-card/60 shadow-sm overflow-hidden'
        )}>
            {/* Decoración lateral según tipo */}
            <div className={cn('absolute left-0 top-0 bottom-0 w-1', cfg.dot)} />

            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', cfg.bg, cfg.color)}>
                        <Icon size={16} />
                    </div>
                    <div>
                        <span className={cn('text-[9px] font-black uppercase tracking-widest leading-none', cfg.color)}>
                            {cfg.label}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock size={10} className="text-text-muted/40" />
                            <span className="text-[10px] font-bold text-text-muted/60 shrink-0">
                                {formatearHora(evento.timestamp)}
                            </span>
                        </div>
                    </div>
                </div>

                {evento.tipo === 'alcabala' && (
                    evento.falta_datos ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onCompletar) onCompletar(evento);
                                else navigate('/parquero/recibir', { state: { placaPrevia: evento.placa || '' } });
                            }}
                            className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-warning text-white text-[9px] font-black uppercase tracking-widest hover:bg-warning/90 transition-all active:scale-95"
                        >
                            <AlertCircle size={12} />
                            COMPLETAR DATOS
                        </button>
                    ) : (evento.placa && (
                        <button
                            onClick={handleEntrada}
                            disabled={cargando}
                            className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-success text-white text-[9px] font-black uppercase tracking-widest hover:bg-success/90 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {cargando ? <RefreshCw size={10} className="animate-spin" /> : <LogIn size={12} />}
                            RECIBIR
                        </button>
                    ))
                )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-text-main tracking-widest uppercase">
                        {evento.placa || <span className="text-text-muted/40 italic">SIN PLACA</span>}
                    </h3>
                    
                    {/* Detalles del vehículo y portador */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                        {evento.nombre_portador && (
                            <span className="text-[10px] font-black text-primary uppercase tracking-tighter bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                                {evento.nombre_portador}
                            </span>
                        )}
                        {evento.tipo_pase && (
                            <span 
                                className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md border"
                                style={{ 
                                    color: evento.tipo_pase_color, 
                                    backgroundColor: `${evento.tipo_pase_color}10`, // 10% opacity
                                    borderColor: `${evento.tipo_pase_color}30` // 30% opacity
                                }}
                            >
                                {evento.tipo_pase}
                            </span>
                        )}
                        <span className="text-[10px] text-text-muted font-medium uppercase tracking-tight">
                            {[evento.color, evento.marca, evento.modelo].filter(Boolean).join(' · ') || 'Sin detalles adicionales'}
                        </span>
                        {(evento.cedula_portador || evento.telefono_portador) && (
                            <div className="flex gap-2 items-center">
                                {evento.cedula_portador && (
                                    <span className="text-[8px] font-bold text-text-muted/60 uppercase tracking-tighter">
                                        CI: {evento.cedula_portador}
                                    </span>
                                )}
                                {evento.telefono_portador && (
                                    <span className="text-[8px] font-bold text-text-muted/60 uppercase tracking-tighter">
                                        TLF: {evento.telefono_portador}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {evento.descripcion && (
                        <p className="text-[9px] text-text-muted/60 mt-1 font-bold uppercase tracking-tighter italic">
                            {evento.descripcion}
                        </p>
                    )}
                </div>
                
                {evento.tipo === 'ingreso_zona' && (
                    <div className="shrink-0">
                        {evento.puesto_asignado_id ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 text-success border border-success/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                                <ParkingSquare size={12} className="animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">PUESTO OK</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                                <Car size={12} className="animate-bounce" />
                                <span className="text-[10px] font-black uppercase tracking-widest">APARCADO</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Grupo de vehículo con trazabilidad expandible ─────────────────────────
const GrupoVehiculo = ({ placa, eventos, onEntrada, onCompletar }) => {
    const [expandido, setExpandido] = useState(false);
    const ultimoEvento = eventos[0];
    const cfg = CONFIG_TIPO[ultimoEvento?.tipo] || CONFIG_TIPO.alcabala;

    return (
        <div className="bg-bg-card/40 rounded-2xl border border-white/5 overflow-hidden transition-all hover:bg-bg-card/60">
            <button
                onClick={() => setExpandido(p => !p)}
                className="w-full flex items-center gap-3 p-4 hover:bg-white/3 transition-colors text-left"
            >
                <div className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border',
                    cfg.bg, cfg.border
                )}>
                    <Car size={20} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-text-main tracking-widest uppercase">{placa || 'Sin placa'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('text-[9px] font-black uppercase tracking-widest', cfg.color)}>
                            {cfg.label}
                        </span>
                        <span className="text-[9px] text-text-muted/40 font-bold flex items-center gap-1">
                            <Clock size={8} /> {tiempoRelativo(ultimoEvento?.timestamp)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-text-muted bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 uppercase tracking-tighter">
                        {eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}
                    </span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-text-muted group-hover:bg-white/10 transition-all">
                        {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>
            </button>

            {expandido && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-4 bg-black/10">
                    {eventos.map((evento, i) => (
                        <TarjetaEvento key={i} evento={evento} onEntrada={onEntrada} onCompletar={onCompletar} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// VISTA PRINCIPAL: NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════════════════
const VistaNotificaciones = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [zonaDataInternal, setZonaDataInternal] = useState(location.state?.zonaData || null);
    const zonaId = zonaDataInternal?.id;
    const zonaNombre = zonaDataInternal?.nombre || 'Cargando...';

    const [eventos, setEventos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [vistaMode, setVistaMode] = useState('timeline'); // 'vehiculos' | 'timeline'

    // Estado Modal Completar Datos
    const [modalAbierto, setModalAbierto] = useState(false);
    const [eventoACompletar, setEventoACompletar] = useState(null);
    const [guardandoDatos, setGuardandoDatos] = useState(false);
    const [formData, setFormData] = useState({
        placa: '',
        nombre: '',
        cedula: '',
        telefono: '',
        marca: '',
        modelo: '',
        color: ''
    });
    
    // Paginación Backend
    const [skip, setSkip] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMITE = 20;

    const cargarHistorial = useCallback(async (isLoadMore = false, isSilent = false) => {
        let targetId = zonaId;
        
        if (!isSilent) {
            if (isLoadMore) setCargandoMas(true);
            else setCargando(true);
        }

        try {
            // Si no tenemos zonaId (ej: refresh), intentamos recuperarla
            if (!targetId) {
                const z = await parqueroService.getMiZona();
                if (z && z.id) {
                    setZonaDataInternal(z);
                    targetId = z.id;
                } else {
                    // Si aún no hay zona, no podemos cargar historial
                    if (!isSilent) setCargando(false);
                    return;
                }
            }

            const currentSkip = isLoadMore ? skip + LIMITE : 0;
            const data = await parqueroService.getTrazabilidadZona(targetId, LIMITE, currentSkip);
            
            if (isLoadMore) {
                setEventos(prev => [...prev, ...(data || [])]);
                setSkip(currentSkip);
            } else {
                setEventos(data || []);
                setSkip(0);
            }

            if (!data || data.length < LIMITE) setHasMore(false);
            else setHasMore(true);

        } catch (err) {
            console.error("Error cargando trazabilidad:", err);
            if (!isSilent) toast.error("Error al cargar historial");
        } finally {
            if (!isSilent) {
                setCargando(false);
                setCargandoMas(false);
            }
        }
    }, [zonaId, skip]);

    // Carga inicial y auto-refresh solo para la primera página
    useEffect(() => {
        cargarHistorial();
        const interval = setInterval(() => {
            if (skip === 0) cargarHistorial(false, true); // Silent update
        }, 30000);
        return () => clearInterval(interval);
    }, [zonaId]); // Solo re-cargar si cambia la zona

    const handleEntradaRapida = async (placa) => {
        try {
            await parqueroService.registrarLlegadaPlaca(placa, zonaId);
            toast.success(`Entrada rápida registrada: ${placa}`);
            cargarHistorial(false); // Recargar desde el inicio
        } catch (err) {
            toast.error(err.response?.data?.detail || "No se pudo registrar la entrada");
            throw err;
        }
    };

    const abrirModalCompleter = (evento) => {
        setEventoACompletar(evento);
        setFormData({
            placa: evento.placa || '',
            nombre: (evento.nombre_portador && !evento.nombre_portador.includes('DESCONOCIDO')) ? evento.nombre_portador : '',
            cedula: evento.cedula_portador || '',
            telefono: evento.telefono_portador || '',
            marca: evento.marca || '',
            modelo: evento.modelo || '',
            color: evento.color || ''
        });
        setModalAbierto(true);
    };

    const handleConfirmarConDatos = async () => {
        if (!formData.placa) return toast.error("La placa es obligatoria");
        
        setGuardandoDatos(true);
        try {
            // Usamos registrarLlegadaPlaca que crea el VehiculoPase y marca el ingreso
            await parqueroService.registrarLlegadaPlaca(formData.placa, zonaId, {
                nombre: formData.nombre,
                cedula: formData.cedula,
                telefono: formData.telefono,
                marca: formData.marca,
                modelo: formData.modelo,
                color: formData.color,
                acceso_id: eventoACompletar?.id, 
                qr_id: eventoACompletar?.qr_id 
            });
            
            toast.success("Ingreso registrado con éxito");
            setModalAbierto(false);
            cargarHistorial(false);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Error al registrar ingreso");
        } finally {
            setGuardandoDatos(false);
        }
    };

    // Agrupar eventos por placa para vista "vehiculos"
    const eventosPorPlaca = useMemo(() => eventoAgrupadoPorPlaca(eventos), [eventos]);

    // Agrupar eventos por fecha para vista "timeline"
    const eventosAgrupadosPorFecha = useMemo(() => {
        const groups = {};
        eventos.forEach(ev => {
            const dateStr = formatearFechaDisplay(ev.timestamp);
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(ev);
        });
        return groups;
    }, [eventos]);

    return (
        <div className="min-h-screen bg-bg-app flex flex-col">

            {/* Header */}
            <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-4 max-w-2xl mx-auto w-full">
                    <button
                        onClick={() => navigate('/parquero/')}
                        className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"
                    >
                        <ArrowLeft size={20} className="text-text-muted" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm font-black uppercase tracking-widest text-text-main leading-none flex items-center gap-2">
                            <Bell size={14} className="text-primary" /> Historial / Notif.
                        </h1>
                        <p className="text-[9px] text-text-muted font-bold mt-1 truncate uppercase tracking-tighter opacity-60">
                            {zonaNombre}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-flex text-[10px] font-black text-text-muted bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                            {eventos.length} EVENTOS
                        </span>
                        <button
                            onClick={() => cargarHistorial(false)}
                            className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all active:rotate-180 duration-500"
                        >
                            <RefreshCw size={18} className={cn('text-primary', (cargando && !cargandoMas) && 'animate-spin')} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs vista con diseño Táctico */}
            <div className="max-w-2xl mx-auto w-full px-4 pt-6">
                <div className="flex gap-1.5 bg-bg-card/30 rounded-2xl p-1.5 border border-white/5 shadow-inner">
                    <button
                        onClick={() => setVistaMode('timeline')}
                        className={cn(
                            'flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                            vistaMode === 'timeline'
                                ? 'bg-primary text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                                : 'text-text-muted hover:text-text-main hover:bg-white/5'
                        )}
                    >
                        <Clock size={14} /> Línea de Tiempo
                    </button>
                    <button
                        onClick={() => setVistaMode('vehiculos')}
                        className={cn(
                            'flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                            vistaMode === 'vehiculos'
                                ? 'bg-primary text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                                : 'text-text-muted hover:text-text-main hover:bg-white/5'
                        )}
                    >
                        <Car size={14} /> Por Vehículo
                    </button>
                </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6 pb-24">

                {(cargando && !cargandoMas) && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                            <Shield size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/40" />
                        </div>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] animate-pulse">Sincronizando Trazabilidad...</p>
                    </div>
                )}

                {(!cargando || cargandoMas) && eventos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-bg-card/20 rounded-3xl border border-dashed border-white/5">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                            <Bell size={40} className="text-text-muted/20" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-black text-text-muted uppercase tracking-widest">Sin registros activos</p>
                            <p className="text-[10px] text-text-muted/40 mt-1 uppercase">Los eventos de alcabala y zona aparecerán aquí</p>
                        </div>
                    </div>
                )}

                {/* Vista: Línea de tiempo Crónica Agrupada */}
                {(!cargando || cargandoMas) && vistaMode === 'timeline' && (
                    <div className="space-y-8">
                        {Object.entries(eventosAgrupadosPorFecha).map(([fecha, evs]) => (
                            <div key={fecha} className="space-y-3">
                                <div className="flex items-center gap-3 px-1">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 tracking-widest">
                                        {fecha}
                                    </span>
                                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                                </div>
                                <div className="space-y-3 pl-2">
                                    {evs.map((evento, i) => (
                                        <TarjetaEvento key={i} evento={evento} onEntrada={handleEntradaRapida} onCompletar={abrirModalCompleter} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Vista: Agrupado por vehículo */}
                {(!cargando || cargandoMas) && vistaMode === 'vehiculos' && (
                    <div className="space-y-3">
                        {Object.entries(eventosPorPlaca).map(([placa, evts]) => (
                            <GrupoVehiculo key={placa} placa={placa} eventos={evts} onEntrada={handleEntradaRapida} onCompletar={abrirModalCompleter} />
                        ))}
                    </div>
                )}

                {/* Paginación: Cargar Más */}
                {hasMore && (
                    <div className="pt-4 flex justify-center">
                        <button
                            onClick={() => cargarHistorial(true)}
                            disabled={cargandoMas}
                            className="group flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                                {cargandoMas ? (
                                    <RefreshCw size={20} className="text-primary animate-spin" />
                                ) : (
                                    <ChevronDown size={24} className="text-text-muted group-hover:text-primary transition-colors" />
                                )}
                            </div>
                            <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] group-hover:text-text-main">
                                {cargandoMas ? 'Cargando...' : 'Cargar más eventos'}
                            </span>
                        </button>
                    </div>
                )}
                
                {!hasMore && eventos.length > 0 && (
                    <div className="pt-8 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                            <CheckCircle2 size={12} className="text-success" />
                            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Fin del historial táctico</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Completar Datos (Táctico) */}
            <Modal
                isOpen={modalAbierto}
                onClose={() => setModalAbierto(false)}
                title="Completar Registro"
                className="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-4 border-l-2 border-warning pl-3">
                        El vehículo ha pasado por Alcabala pero requiere datos adicionales para el censo de la zona.
                    </p>

                    <div className="grid grid-cols-1 gap-4">
                        <Input
                            label="N° Placa / Identificación"
                            value={formData.placa}
                            onChange={e => setFormData({...formData, placa: e.target.value.toUpperCase()})}
                            placeholder="EJ: AH317CD"
                            className="font-black tracking-widest"
                            icon={<Shield size={16} />}
                        />

                        <Input
                            label="Nombre del Portador / Socio"
                            value={formData.nombre}
                            onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})}
                            placeholder="NOMBRE COMPLETO"
                            icon={<Bell size={16} />}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Cédula"
                                value={formData.cedula}
                                onChange={e => setFormData({...formData, cedula: e.target.value.toUpperCase()})}
                                placeholder="V-00000000"
                            />
                            <Input
                                label="Teléfono"
                                value={formData.telefono}
                                onChange={e => setFormData({...formData, telefono: e.target.value})}
                                placeholder="0412-0000000"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Marca"
                                value={formData.marca}
                                onChange={e => setFormData({...formData, marca: e.target.value.toUpperCase()})}
                                placeholder="TOYOTA"
                            />
                            <Input
                                label="Modelo"
                                value={formData.modelo}
                                onChange={e => setFormData({...formData, modelo: e.target.value.toUpperCase()})}
                                placeholder="COROLLA"
                            />
                        </div>

                        <Input
                            label="Color"
                            value={formData.color}
                            onChange={e => setFormData({...formData, color: e.target.value.toUpperCase()})}
                            placeholder="BLANCO / GRIS / NEGRO"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Boton
                            variant="outline"
                            className="flex-1"
                            onClick={() => setModalAbierto(false)}
                        >
                            Cancelar
                        </Boton>
                        <Boton
                            variant="primario"
                            className="flex-[2] bg-success hover:bg-success/90"
                            onClick={handleConfirmarConDatos}
                            isLoading={guardandoDatos}
                        >
                            Confirmar Ingreso
                        </Boton>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// ── Helper: agrupar eventos por placa ────────────────────────────────────
function eventoAgrupadoPorPlaca(eventos) {
    const acc = {};
    eventos.forEach(evento => {
        const key = evento.placa || 'SIN_PLACA';
        if (!acc[key]) acc[key] = [];
        acc[key].push(evento);
    });
    return acc;
}

export default VistaNotificaciones;
