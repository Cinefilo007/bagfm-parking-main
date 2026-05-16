import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Modal } from '../../components/ui/Modal';
import SelectTactivo from '../../components/ui/SelectTactivo';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/auth.store';
import {
    AlertTriangle, Shield, RefreshCw, MapPin,
    CheckCircle2, XCircle, Filter, Search,
    Car as CarIcon, ChevronUp, Clock, Users, Hash, User as UserIcon, Phone,
    Ban, Scale, ChevronRight, Flame, Eye,
    TrendingUp, Map as MapIcon, Plus, Upload, Trash2, Camera, Info
} from 'lucide-react';
import api from '../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

// ──── Constantes ──────────────────────────────────────────────────────────────

const GRAVEDAD_CONFIG = {
    leve:     { color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/30',  dot: 'bg-yellow-400',  label: 'LEVE' },
    moderada: { color: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/30',  dot: 'bg-orange-400',  label: 'MODERADA' },
    grave:    { color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/30',     dot: 'bg-red-400',     label: 'GRAVE' },
    critica:  { color: 'text-gray-200',    bg: 'bg-gray-900/80',    border: 'border-gray-400/30',    dot: 'bg-gray-300',    label: 'CRÍTICA' },
};

const ESTADO_CONFIG = {
    activa:      { color: 'text-danger',     label: 'Activa' },
    resuelta:    { color: 'text-success',    label: 'Resuelta' },
    perdonada:   { color: 'text-sky-400',    label: 'Perdonada' },
    en_revision: { color: 'text-warning',    label: 'En revisión' },
    apelada:     { color: 'text-purple-400', label: 'Apelada' },
};

// ── Permisos de resolución por gravedad ──
const puedeResolver = (rol, gravedad) => {
    if (rol === 'COMANDANTE') return true;
    if (rol === 'ADMIN_BASE') return ['leve', 'moderada', 'grave'].includes(gravedad);
    if (rol === 'SUPERVISOR') return ['leve', 'moderada'].includes(gravedad);
    if (rol === 'SUPERVISOR_PARQUEROS' || rol === 'ADMIN_ENTIDAD') return gravedad === 'leve';
    return false;
};

// ──── Sub-componentes ─────────────────────────────────────────────────────────

const KpiInfraccion = ({ label, valor, color, icon: Icon }) => (
    <Card className="flex flex-col p-4 rounded-2xl border-white/5">
        <div className="flex justify-between mb-2">
            <Icon size={18} className={color} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
        </div>
        <div className={cn("text-2xl font-black tracking-tighter", color)}>{valor}</div>
        <div className="text-[8px] font-black uppercase tracking-widest text-text-muted/50 mt-0.5">{label}</div>
    </Card>
);

const InfraccionCard = ({ infraccion, userRol, onResolver, onEscalar, onDetalle }) => {
    const gcfg = GRAVEDAD_CONFIG[infraccion.gravedad] || GRAVEDAD_CONFIG.leve;
    const ecfg = ESTADO_CONFIG[infraccion.estado] || ESTADO_CONFIG.activa;
    const canResolve = puedeResolver(userRol, infraccion.gravedad) && infraccion.estado === 'activa';

    return (
        <div className={cn("p-4 rounded-xl border transition-all space-y-3", gcfg.bg, gcfg.border)}>
            <div className="flex items-start gap-3">
                <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", gcfg.dot)} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border", gcfg.color, gcfg.bg, gcfg.border)}>
                            {gcfg.label}
                        </span>
                        <span className="text-xs font-black text-text-main uppercase">
                            {infraccion.tipo?.replace(/_/g, ' ')}
                        </span>
                        <span className={cn("text-[8px] font-bold ml-auto", ecfg.color)}>{ecfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {(infraccion.vehiculo?.placa || infraccion.vehiculo_placa) && (
                            <span className="text-[9px] text-text-muted flex items-center gap-1">
                                <CarIcon size={9} /> {infraccion.vehiculo?.placa || infraccion.vehiculo_placa}
                                {infraccion.vehiculo?.marca && infraccion.vehiculo.marca !== 'DESCONOCIDA' && ` · ${infraccion.vehiculo.marca} ${infraccion.vehiculo.modelo}`}
                            </span>
                        )}
                        {infraccion.zona_nombre && (
                            <span className="text-[9px] text-text-muted flex items-center gap-1">
                                <MapPin size={9} /> {infraccion.zona_nombre}
                            </span>
                        )}
                        {(infraccion.latitud_infraccion || infraccion.latitud) && (
                            <span className="text-[9px] text-success flex items-center gap-1">
                                <MapPin size={9} /> GPS
                            </span>
                        )}
                        <span className="text-[9px] text-text-muted flex items-center gap-1">
                            <Clock size={9} /> {new Date(infraccion.created_at || Date.now()).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                    </div>
                    {infraccion.descripcion && (
                        <p className="text-[9px] text-text-muted/70 mt-1 line-clamp-1">{infraccion.descripcion}</p>
                    )}
                    {infraccion.infractor && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                            <UserIcon size={10} className="text-primary" />
                            <span className="text-[9px] font-bold text-text-main uppercase">
                                {infraccion.infractor.nombre} {infraccion.infractor.apellido}
                            </span>
                            <span className="text-[8px] text-text-muted px-1.5 border-l border-white/10 uppercase">
                                {infraccion.infractor.rol.replace(/_/g, ' ')}
                            </span>
                            {infraccion.infractor.telefono && (
                                <a href={`tel:${infraccion.infractor.telefono}`} className="ml-auto inline-flex items-center gap-1 bg-success/15 hover:bg-success/25 text-success px-2 py-0.5 rounded-md transition-colors">
                                    <Phone size={9} />
                                    <span className="text-[8px] font-black uppercase tracking-wider">Llamar</span>
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Consecuencias activas */}
            {infraccion.bloquea_acceso_futuro && (
                <div className="flex items-center gap-2 p-2 bg-danger/10 border border-danger/20 rounded-lg">
                    <Ban size={11} className="text-danger shrink-0" />
                    <span className="text-[8px] font-black text-danger uppercase">Acceso bloqueado</span>
                </div>
            )}

            {/* Acciones */}
            {infraccion.estado === 'activa' && (
                <div className="flex gap-2 flex-wrap">
                    {canResolve && (
                        <button onClick={() => onResolver(infraccion, 'resolver')}
                            className="h-7 px-3 rounded-lg bg-success/15 text-success border border-success/25 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-success/25 transition-all">
                            <CheckCircle2 size={11} /> Resolver
                        </button>
                    )}
                    {canResolve && (
                        <button onClick={() => onResolver(infraccion, 'perdonar')}
                            className="h-7 px-3 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/20 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-sky-500/25 transition-all">
                            <Scale size={11} /> Perdonar
                        </button>
                    )}
                    {!canResolve && (
                        <button onClick={() => onEscalar(infraccion)}
                            className="h-7 px-3 rounded-lg bg-orange-400/15 text-orange-400 border border-orange-400/20 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-orange-400/25 transition-all">
                            <ChevronUp size={11} /> Escalar
                        </button>
                    )}
                    {(infraccion.latitud_infraccion || infraccion.latitud) && (
                        <button onClick={() => {
                            const lat = infraccion.latitud_infraccion || infraccion.latitud;
                            const lon = infraccion.longitud_infraccion || infraccion.longitud;
                            window.open(`https://maps.google.com/?q=${lat},${lon}`, '_blank');
                        }}
                            className="h-7 px-3 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-green-500/25 transition-all">
                            <MapIcon size={11} /> Ver en Mapa
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ──── Página Principal ────────────────────────────────────────────────────────

const FILTROS_GRAVEDAD = ['todas', 'leve', 'moderada', 'grave', 'critica'];
const FILTROS_ESTADO = ['todas', 'activa', 'resuelta', 'apelada'];

export default function DashboardInfracciones() {
    const { user } = useAuthStore();
    const { lastNotification, setLastNotification } = useNotifications();
    const [infracciones, setInfracciones] = useState([]);
    const [listaNegra, setListaNegra] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [tab, setTab] = useState('activas');
    const [filtroGravedad, setFiltroGravedad] = useState('todas');
    const [filtroBusqueda, setFiltroBusqueda] = useState('');

    // Modal resolve
    const [modalResolver, setModalResolver] = useState(false);
    const [infSeleccionada, setInfSeleccionada] = useState(null);
    const [accionResolver, setAccionResolver] = useState('resolver');
    const [notasResolucion, setNotasResolucion] = useState('');
    const [resolviendo, setResolviendo] = useState(false);
    const [zonas, setZonas] = useState([]);

    // Modal Reporte (Nuevo)
    const [modalReporte, setModalReporte] = useState(false);
    const [enviandoReporte, setEnviandoReporte] = useState(false);
    const [archivosEvidencia, setArchivosEvidencia] = useState([]);
    const [previews, setPreviews] = useState([]);
    
    // IA & Search States
    const [iaTrabajando, setIaTrabajando] = useState(false);
    const [iaMensaje, setIaMensaje] = useState(null);
    const [buscandoVehiculo, setBuscandoVehiculo] = useState(false);
    const [vehiculoInfo, setVehiculoInfo] = useState(null);
    const [obteniendoGPS, setObteniendoGPS] = useState(false);

    const [formReporte, setFormReporte] = useState({
        tipo: 'mal_estacionado',
        gravedad: 'leve',
        descripcion: '',
        vehiculo_placa: '',
        vehiculo_marca: '',
        vehiculo_modelo: '',
        zona_id: '',
        latitud: null,
        longitud: null,
        bloquea_salida: true,
        bloquea_acceso_futuro: false
    });

    const analizarEvidencias = async (files) => {
        setIaTrabajando(true);
        setIaMensaje({ type: 'info', text: '✨ IA analizando imágenes...' });
        
        try {
            const formData = new FormData();
            files.forEach(f => formData.append('archivos', f));
            
            const { data } = await api.post('/infracciones/analizar-evidencias', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (data.placa || data.marca || data.modelo) {
                setFormReporte(prev => ({
                    ...prev,
                    vehiculo_placa: data.placa || prev.vehiculo_placa,
                    vehiculo_marca: data.marca || prev.vehiculo_marca,
                    vehiculo_modelo: data.modelo || prev.vehiculo_modelo
                }));
                setIaMensaje({ type: 'success', text: 'Datos extraídos por IA' });
                
                if (data.placa) {
                    buscarVehiculo(data.placa);
                }
            } else {
                setIaMensaje({ type: 'warning', text: 'No se pudo leer la placa, ingrésela manualmente' });
            }
        } catch (error) {
            console.error(error);
            setIaMensaje({ type: 'warning', text: 'No se pudo leer la placa, ingrésela manualmente' });
        } finally {
            setIaTrabajando(false);
        }
    };

    const buscarVehiculo = async (placaBuscada) => {
        if (!placaBuscada || placaBuscada.length < 3) return;
        
        setBuscandoVehiculo(true);
        try {
            const { data } = await api.get(`/infracciones/buscar-vehiculo/${placaBuscada}`);
            setVehiculoInfo(data);
        } catch (error) {
            console.error("Error buscando vehiculo", error);
            setVehiculoInfo({ encontrado: false });
        } finally {
            setBuscandoVehiculo(false);
        }
    };

    // Efecto para buscar cuando el usuario escribe (debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (formReporte.vehiculo_placa && !iaTrabajando) {
                buscarVehiculo(formReporte.vehiculo_placa);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [formReporte.vehiculo_placa, iaTrabajando]);

    const handleObtenerUbicacion = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocalización no disponible en este dispositivo');
            return;
        }
        setObteniendoGPS(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormReporte(prev => ({
                    ...prev,
                    latitud: parseFloat(pos.coords.latitude.toFixed(8)),
                    longitud: parseFloat(pos.coords.longitude.toFixed(8)),
                }));
                setObteniendoGPS(false);
                toast.success('Ubicación capturada');
            },
            () => {
                setObteniendoGPS(false);
                toast.error('No se pudo obtener la ubicación');
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    const cargarDatos = useCallback(async (isBackground = false) => {
        if (!isBackground) setCargando(true);
        try {
            const [infData, lnData, zonasData] = await Promise.allSettled([
                api.get('/infracciones/').then(r => r.data),
                api.get('/infracciones/lista-negra').then(r => r.data),
                api.get('/zonas/').then(r => r.data),
            ]);
            if (infData.status === 'fulfilled') setInfracciones(infData.value);
            if (lnData.status === 'fulfilled') setListaNegra(lnData.value);
            if (zonasData.status === 'fulfilled') setZonas(zonasData.value);
        } catch (_) {
            // Demo
            setInfracciones([
                { id: 'i1', tipo: 'mal_estacionado', gravedad: 'leve', estado: 'activa', vehiculo_placa: 'ABC-123', zona_nombre: 'Zona VIP', created_at: new Date().toISOString(), descripcion: 'Vehículo ocupando dos puestos' },
                { id: 'i2', tipo: 'colision', gravedad: 'grave', estado: 'activa', vehiculo_placa: 'XYZ-789', zona_nombre: 'Parqueo Logístico', latitud: '10.1234', longitud: '-66.987', bloquea_acceso_futuro: true, created_at: new Date(Date.now() - 3600000).toISOString(), descripcion: 'Colisión con poste de señalización' },
                { id: 'i3', tipo: 'exceso_velocidad', gravedad: 'moderada', estado: 'resuelta', vehiculo_placa: 'LMN-456', zona_nombre: 'Entrada Principal', created_at: new Date(Date.now() - 7200000).toISOString() },
                { id: 'i4', tipo: 'acceso_no_autorizado', gravedad: 'critica', estado: 'activa', vehiculo_placa: 'RST-111', bloquea_acceso_futuro: true, created_at: new Date(Date.now() - 900000).toISOString(), descripcion: 'Intento de acceso con QR falsificado' },
                { id: 'i5', tipo: 'zona_prohibida', gravedad: 'moderada', estado: 'en_revision', vehiculo_placa: 'QRS-321', zona_nombre: 'Zona Staff', latitud_infraccion: '10.1235', longitud_infraccion: '-66.9871', created_at: new Date(Date.now() - 1800000).toISOString() },
            ]);
            setListaNegra([
                { id: 'ln1', nombre: 'CARLOS DÍAZ', cedula: 'V-14567890', placa: 'RST-111', motivo: 'Acceso no autorizado reiterado', bloqueado_at: new Date().toISOString() },
            ]);
        } finally {
            if (!isBackground) setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarDatos();
        // El polling de 30s queda como respaldo, pero el WS es prioridad
        const iv = setInterval(() => cargarDatos(true), 30000);
        return () => clearInterval(iv);
    }, [cargarDatos]);

    // Escucha de WebSocket para actualizaciones en tiempo real
    useEffect(() => {
        if (lastNotification?.evento === 'INFRACCION_REGISTRADA' || 
            lastNotification?.evento === 'INFRACCION_RESUELTA' ||
            lastNotification?.evento === 'INFRACCION_ESCALADA') {
            cargarDatos(true);
            setLastNotification(null); // Limpiar para no disparar de nuevo
        }
    }, [lastNotification, cargarDatos, setLastNotification]);

    const handleAbrirResolver = (inf, accion) => {
        setInfSeleccionada(inf);
        setAccionResolver(accion);
        setNotasResolucion('');
        setModalResolver(true);
    };

    const handleEscalar = async (inf) => {
        try {
            await api.put(`/infracciones/${inf.id}/escalar`, { notas: 'Escalado desde dashboard de comando' });
            toast.success('Infracción escalada');
            cargarDatos();
        } catch (e) {
            toast.error('Error al escalar');
        }
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (archivosEvidencia.length + selectedFiles.length > 3) {
            toast.error("Máximo 3 fotos de evidencia permitidas");
            return;
        }

        const newFiles = [...archivosEvidencia, ...selectedFiles].slice(0, 3);
        setArchivosEvidencia(newFiles);

        // Generar previews
        const newPreviews = newFiles.map(file => URL.createObjectURL(file));
        setPreviews(newPreviews);
        
        if (selectedFiles.length > 0) {
            analizarEvidencias(selectedFiles);
        }
    };

    const removeFile = (index) => {
        const newFiles = archivosEvidencia.filter((_, i) => i !== index);
        setArchivosEvidencia(newFiles);
        const newPreviews = previews.filter((_, i) => i !== index);
        setPreviews(newPreviews);
    };

    const handleEnviarReporte = async () => {
        if (!formReporte.descripcion) return toast.error("La descripción es obligatoria");
        
        setEnviandoReporte(true);
        const formData = new FormData();
        formData.append('tipo', formReporte.tipo);
        formData.append('gravedad', formReporte.gravedad);
        formData.append('descripcion', formReporte.descripcion);
        if (formReporte.vehiculo_placa) formData.append('vehiculo_placa', formReporte.vehiculo_placa);
        if (formReporte.vehiculo_marca) formData.append('vehiculo_marca', formReporte.vehiculo_marca);
        if (formReporte.vehiculo_modelo) formData.append('vehiculo_modelo', formReporte.vehiculo_modelo);
        if (formReporte.zona_id) formData.append('zona_id', formReporte.zona_id);
        if (formReporte.latitud) {
            formData.append('latitud', formReporte.latitud);
            formData.append('longitud', formReporte.longitud);
        }
        formData.append('bloquea_salida', formReporte.bloquea_salida);
        formData.append('bloquea_acceso_futuro', formReporte.bloquea_acceso_futuro);
        
        archivosEvidencia.forEach(file => {
            formData.append('archivos', file);
        });

        try {
            await api.post('/infracciones/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("Infracción reportada exitosamente");
            setModalReporte(false);
            setFormReporte({
                tipo: 'mal_estacionado',
                gravedad: 'leve',
                descripcion: '',
                vehiculo_placa: '',
                vehiculo_marca: '',
                vehiculo_modelo: '',
                zona_id: '',
                latitud: null,
                longitud: null,
                bloquea_salida: true,
                bloquea_acceso_futuro: false
            });
            setArchivosEvidencia([]);
            setPreviews([]);
            setIaMensaje(null);
            setVehiculoInfo(null);
            cargarDatos();
        } catch (error) {
            toast.error("Error al enviar el reporte");
        } finally {
            setEnviandoReporte(false);
        }
    };

    const handleResolver = async () => {
        setResolviendo(true);
        try {
            await api.put(`/infracciones/${infSeleccionada.id}/resolver`, {
                accion: accionResolver,
                notas_resolucion: notasResolucion,
            });
            toast.success(accionResolver === 'resolver' ? 'Infracción resuelta' : 'Infracción perdonada');
            setModalResolver(false);
            cargarDatos();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No tienes permiso para esta acción');
        } finally {
            setResolviendo(false);
        }
    };

    const handleRetirarListaNegra = async (persona) => {
        if (!window.confirm(`¿Retirar a ${persona.nombre} de la lista negra?`)) return;
        if (user?.rol !== 'COMANDANTE') { toast.error('Solo el Comandante puede retirar de lista negra'); return; }
        try {
            await api.delete(`/infracciones/lista-negra/${persona.id}`);
            toast.success('Retirado de lista negra');
            cargarDatos();
        } catch (e) {
            toast.error('Error');
        }
    };

    // Filtrado
    const infFiltradas = infracciones.filter(i => {
        const enTab = tab === 'activas' ? i.estado === 'activa' || i.estado === 'en_revision' || i.estado === 'apelada' : i.estado === 'resuelta' || i.estado === 'perdonada';
        const enGravedad = filtroGravedad === 'todas' || i.gravedad === filtroGravedad;
        const enBusqueda = !filtroBusqueda || i.vehiculo_placa?.includes(filtroBusqueda.toUpperCase()) || i.tipo?.includes(filtroBusqueda.toLowerCase());
        return enTab && enGravedad && enBusqueda;
    });

    // Stats
    const stats = {
        activas: infracciones.filter(i => i.estado === 'activa').length,
        criticas: infracciones.filter(i => i.gravedad === 'critica' && i.estado === 'activa').length,
        bloqueados: infracciones.filter(i => i.bloquea_acceso_futuro && i.estado === 'activa').length,
        listaNegra: listaNegra.length,
    };

    return (
        <div className="p-4 md:p-6 space-y-6 pb-24 max-w-[1400px] mx-auto animate-in fade-in duration-500">

            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 
                               bg-bg-card/30 p-4 md:p-5 rounded-2xl border border-white/5 w-full">
                <div className="min-w-0">
                    <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-danger/10 rounded-xl shrink-0">
                            <AlertTriangle className="text-danger" size={24} />
                        </div>
                        <span className="uppercase">Gestión de Infracciones</span>
                    </h1>
                    <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse shrink-0" />
                        Centro de Control de Sanciones y Vigilancia de Base
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto self-end">
                    <Boton onClick={() => setModalReporte(true)} className="gap-2 h-11 px-6 w-full sm:w-auto shrink-0 
                                                        bg-primary text-bg-app font-black uppercase tracking-widest text-[11px]
                                                        rounded-xl shadow-tactica hover:scale-[1.02] active:scale-[0.98] transition-all">
                        <Plus size={16} />
                        <span>Reportar Infracción</span>
                    </Boton>
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-2">
                <KpiInfraccion label="Activas" valor={stats.activas} color="text-danger" icon={AlertTriangle} />
                <KpiInfraccion label="Críticas" valor={stats.criticas} color="text-gray-300" icon={Flame} />
                <KpiInfraccion label="Bloqueados" valor={stats.bloqueados} color="text-orange-400" icon={Ban} />
                <KpiInfraccion label="Lista Negra" valor={stats.listaNegra} color="text-red-400" icon={Shield} />
            </div>

            {/* Tabs */}
            <div className="flex bg-bg-card/40 rounded-xl p-1 border border-white/5 gap-1">
                {[
                    { id: 'activas', label: 'Activas', badge: stats.activas },
                    { id: 'historial', label: 'Historial', badge: null },
                    { id: 'lista_negra', label: 'Lista Negra', badge: stats.listaNegra },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                            tab === t.id ? 'bg-danger text-white shadow-md' : 'text-text-muted hover:text-text-main hover:bg-white/5'
                        )}>
                        {t.label}
                        {t.badge > 0 && (
                            <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center",
                                tab === t.id ? 'bg-white/20' : 'bg-danger text-white')}>
                                {t.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Filtros */}
            {tab !== 'lista_negra' && (
                <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 h-9">
                            <Search size={13} className="text-text-muted/60" />
                            <input
                                value={filtroBusqueda}
                                onChange={e => setFiltroBusqueda(e.target.value)}
                                placeholder="Buscar placa o tipo..."
                                className="flex-1 bg-transparent text-xs font-bold text-text-main outline-none placeholder:text-white/20 uppercase"
                            />
                        </div>
                    </div>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        {FILTROS_GRAVEDAD.map(g => (
                            <button key={g} onClick={() => setFiltroGravedad(g)}
                                className={cn(
                                    "h-9 px-3 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all",
                                    filtroGravedad === g
                                        ? g === 'todas' ? 'bg-primary/20 text-primary border border-primary/30' : `${GRAVEDAD_CONFIG[g]?.bg} ${GRAVEDAD_CONFIG[g]?.color} border ${GRAVEDAD_CONFIG[g]?.border}`
                                        : 'bg-white/5 border border-white/10 text-text-muted hover:border-white/20'
                                )}>
                                {g === 'todas' ? 'Todas' : GRAVEDAD_CONFIG[g]?.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Contenido por Tab ── */}

            {/* ACTIVAS / HISTORIAL */}
            {tab !== 'lista_negra' && (
                <div className="space-y-3">
                    {cargando ? (
                        Array(3).fill(0).map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse border border-white/5" />)
                    ) : infFiltradas.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                            <CheckCircle2 size={36} className="mx-auto text-success/40 mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">
                                {tab === 'activas' ? 'Sin infracciones activas' : 'Sin historial'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {infFiltradas.map(inf => (
                                <InfraccionCard
                                    key={inf.id}
                                    infraccion={inf}
                                    userRol={user?.rol}
                                    onResolver={handleAbrirResolver}
                                    onEscalar={handleEscalar}
                                    onDetalle={() => {}}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* LISTA NEGRA */}
            {tab === 'lista_negra' && (
                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-danger/5 border border-danger/20 rounded-xl">
                        <Ban size={15} className="text-danger shrink-0 mt-0.5" />
                        <p className="text-[9px] text-text-muted">
                            Personas en lista negra son <strong className="text-danger">rechazadas automáticamente</strong> al intentar acceder. Solo el <strong className="text-text-main">Comandante</strong> puede retirarlas.
                        </p>
                    </div>
                    {listaNegra.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                            <Shield size={36} className="mx-auto text-success/40 mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">Lista negra vacía</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {listaNegra.map(persona => (
                                <div key={persona.id} className="flex items-center gap-3 p-4 bg-danger/5 border border-danger/15 rounded-xl">
                                    <div className="w-9 h-9 bg-danger/15 rounded-xl flex items-center justify-center">
                                        <Ban size={18} className="text-danger" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-text-main uppercase">{persona.nombre}</p>
                                        <p className="text-[9px] text-text-muted">{persona.cedula} · {persona.placa}</p>
                                        <p className="text-[8px] text-danger/70 mt-0.5">{persona.motivo}</p>
                                    </div>
                                    {user?.rol === 'COMANDANTE' && (
                                        <button onClick={() => handleRetirarListaNegra(persona)}
                                            className="shrink-0 h-8 px-3 rounded-lg bg-success/15 text-success border border-success/25 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-success/25 transition-all">
                                            <XCircle size={11} /> Retirar
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── MODAL: Resolver / Perdonar ── */}
            <Modal isOpen={modalResolver} onClose={() => setModalResolver(false)}
                title={accionResolver === 'resolver' ? 'RESOLVER INFRACCIÓN' : 'PERDONAR INFRACCIÓN'}>
                {infSeleccionada && (
                    <div className="space-y-4">
                        <div className={cn("p-3 rounded-xl border", GRAVEDAD_CONFIG[infSeleccionada.gravedad]?.bg, GRAVEDAD_CONFIG[infSeleccionada.gravedad]?.border)}>
                            <p className={cn("text-[9px] font-black uppercase tracking-widest", GRAVEDAD_CONFIG[infSeleccionada.gravedad]?.color)}>
                                {GRAVEDAD_CONFIG[infSeleccionada.gravedad]?.label}
                            </p>
                            <p className="text-sm font-black text-text-main uppercase mt-1">{infSeleccionada.tipo?.replace(/_/g, ' ')}</p>
                            {infSeleccionada.vehiculo_placa && <p className="text-[9px] text-text-muted mt-0.5">🚗 {infSeleccionada.vehiculo_placa}</p>}
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1.5">
                                Notas de Resolución
                            </label>
                            <textarea value={notasResolucion} onChange={e => setNotasResolucion(e.target.value)}
                                rows={3} placeholder="Observaciones de la resolución..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:border-primary/50 outline-none resize-none placeholder:text-white/20" />
                        </div>
                        <div className="flex gap-3 pt-2 border-t border-white/5">
                            <Boton variant="ghost" className="flex-1" onClick={() => setModalResolver(false)}>Cancelar</Boton>
                            <Boton onClick={handleResolver} disabled={resolviendo}
                                className={cn("flex-[2] h-12 font-black uppercase tracking-wider",
                                    accionResolver === 'resolver' ? 'bg-success text-bg-app' : 'bg-sky-600 text-white')}>
                                {resolviendo ? <RefreshCw size={16} className="animate-spin" /> :
                                    accionResolver === 'resolver' ? <><CheckCircle2 size={15} /> Confirmar Resolución</> : <><Scale size={15} /> Confirmar Perdón</>
                                }
                            </Boton>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── MODAL: Reportar Nueva Infracción ── */}
            <Modal isOpen={modalReporte} onClose={() => setModalReporte(false)} title="REPORTAR NUEVA INFRACCIÓN" className="max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Columna Izquierda: Datos */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block">Vehículo y Ubicación</label>
                                {buscandoVehiculo && <RefreshCw size={12} className="animate-spin text-text-muted" />}
                            </div>
                            <div className="space-y-3">
                                <div className="relative">
                                    <CarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="PLACA DEL VEHÍCULO"
                                        disabled={iaTrabajando}
                                        value={formReporte.vehiculo_placa}
                                        onChange={e => setFormReporte({...formReporte, vehiculo_placa: e.target.value.toUpperCase()})}
                                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 text-sm font-bold text-text-main focus:border-primary/50 outline-none transition-all uppercase disabled:opacity-50"
                                    />
                                </div>
                                
                                {/* Resultados de búsqueda (Responsable o Huérfano) */}
                                {vehiculoInfo && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        {vehiculoInfo.encontrado ? (
                                            <div className="p-3 pr-20 bg-primary/10 border border-primary/20 rounded-xl relative overflow-hidden">
                                                <div className="absolute top-0 right-0 bg-primary/20 px-2 py-1 rounded-bl-lg">
                                                    <span className="text-[8px] font-black text-primary tracking-widest uppercase">{vehiculoInfo.tipo}</span>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                                        <UserIcon size={20} className="text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-text-main uppercase tracking-wider">
                                                            {vehiculoInfo.responsable.nombre} {vehiculoInfo.responsable.apellido}
                                                        </p>
                                                        <p className="text-[10px] text-primary/80 font-bold uppercase mb-2">
                                                            Rol: {vehiculoInfo.responsable.rol}
                                                        </p>
                                                        {vehiculoInfo.responsable.telefono && (
                                                            <a href={`tel:${vehiculoInfo.responsable.telefono}`} className="inline-flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success px-2.5 py-1 rounded-md transition-colors">
                                                                <Phone size={12} />
                                                                <span className="text-[10px] font-black uppercase">Llamar Rápido</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertTriangle size={14} className="text-warning" />
                                                    <span className="text-[10px] font-black text-warning uppercase tracking-widest">Vehículo Desconocido</span>
                                                </div>
                                                <p className="text-[10px] text-text-muted mb-3">
                                                    Será registrado como vehículo huérfano.
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[8px] font-bold text-white/40 uppercase mb-1 block">Marca (IA)</label>
                                                        <input 
                                                            value={formReporte.vehiculo_marca}
                                                            onChange={e => setFormReporte({...formReporte, vehiculo_marca: e.target.value.toUpperCase()})}
                                                            disabled={iaTrabajando}
                                                            placeholder="Ej: TOYOTA"
                                                            className="w-full bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-text-main focus:border-warning/50 outline-none uppercase disabled:opacity-50"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-bold text-white/40 uppercase mb-1 block">Modelo (IA)</label>
                                                        <input 
                                                            value={formReporte.vehiculo_modelo}
                                                            onChange={e => setFormReporte({...formReporte, vehiculo_modelo: e.target.value.toUpperCase()})}
                                                            disabled={iaTrabajando}
                                                            placeholder="Ej: COROLLA"
                                                            className="w-full bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-text-main focus:border-warning/50 outline-none uppercase disabled:opacity-50"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <SelectTactivo
                                    options={zonas.map(z => ({ value: z.id, label: z.nombre }))}
                                    value={formReporte.zona_id ? { value: formReporte.zona_id, label: zonas.find(z => z.id === formReporte.zona_id)?.nombre || formReporte.zona_id } : null}
                                    onChange={opt => setFormReporte({...formReporte, zona_id: opt ? opt.value : ''})}
                                    placeholder="Seleccionar Zona (Opcional)"
                                    isClearable
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Clasificación de Falta</label>
                            <div className="grid grid-cols-1 gap-3">
                                <SelectTactivo
                                    options={[
                                        { value: "mal_estacionado", label: "Mal Estacionado" },
                                        { value: "exceso_velocidad", label: "Exceso de Velocidad" },
                                        { value: "conducta_indebida", label: "Conducta Indebida" },
                                        { value: "colision", label: "Colisión" },
                                        { value: "zona_prohibida", label: "Zona Prohibida" },
                                        { value: "acceso_no_autorizado", label: "Acceso No Autorizado" },
                                        { value: "otro", label: "Otro Motivo" }
                                    ]}
                                    value={{ value: formReporte.tipo, label: formReporte.tipo.replace(/_/g, ' ').toUpperCase() }}
                                    onChange={opt => setFormReporte({...formReporte, tipo: opt.value})}
                                    placeholder="Seleccione la falta"
                                />
                                <div className="flex gap-2">
                                    {['leve', 'moderada', 'grave', 'critica'].map(g => (
                                        <button 
                                            key={g}
                                            onClick={() => setFormReporte({...formReporte, gravedad: g})}
                                            className={cn(
                                                "flex-1 h-9 rounded-lg text-[9px] font-black uppercase transition-all border",
                                                formReporte.gravedad === g 
                                                    ? `${GRAVEDAD_CONFIG[g].bg} ${GRAVEDAD_CONFIG[g].color} ${GRAVEDAD_CONFIG[g].border}` 
                                                    : "bg-white/5 border-white/5 text-text-muted"
                                            )}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Descripción del Evento</label>
                            <textarea 
                                rows={3}
                                value={formReporte.descripcion}
                                onChange={e => setFormReporte({...formReporte, descripcion: e.target.value})}
                                placeholder="Describa brevemente lo ocurrido..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-text-main focus:border-primary/50 outline-none resize-none"
                            />
                        </div>
                    </div>

                    {/* Columna Derecha: Multimedia y Acciones */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Evidencia Fotográfica (Max 3)</label>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {previews.map((src, i) => (
                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                        <img src={src} alt="Evidencia" className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => removeFile(i)}
                                            className="absolute top-1 right-1 p-1.5 bg-danger text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                                {previews.length < 3 && (
                                    <label className={cn(
                                        "aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all cursor-pointer",
                                        iaTrabajando ? "border-primary/50 bg-primary/5" : "border-white/10 hover:bg-white/5 hover:border-primary/50"
                                    )}>
                                        {iaTrabajando ? (
                                            <RefreshCw size={18} className="text-primary animate-spin" />
                                        ) : (
                                            <Upload size={18} className="text-text-muted" />
                                        )}
                                        <span className="text-[8px] font-black text-text-muted uppercase text-center leading-tight px-1">
                                            {iaTrabajando ? 'Analizando IA...' : 'Subir'}
                                        </span>
                                        <input type="file" multiple accept="image/*" onChange={handleFileChange} disabled={iaTrabajando} className="hidden" />
                                    </label>
                                )}
                            </div>
                            
                            {iaMensaje && (
                                <p className={cn("text-[9px] mb-3 flex items-center gap-1", 
                                    iaMensaje.type === 'success' ? 'text-success' : 
                                    iaMensaje.type === 'warning' ? 'text-warning' : 'text-primary'
                                )}>
                                    {iaMensaje.type === 'success' ? <CheckCircle2 size={11} /> : iaMensaje.type === 'warning' ? <AlertTriangle size={11} /> : <Info size={11} />}
                                    {iaMensaje.text}
                                </p>
                            )}

                            <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin size={12} className={formReporte.latitud ? 'text-success' : 'text-text-muted/60'} />
                                        <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">GPS</span>
                                    </div>
                                    <button
                                        onClick={handleObtenerUbicacion}
                                        disabled={obteniendoGPS}
                                        className={cn(
                                            "h-6 px-2 rounded flex items-center gap-1 text-[8px] font-black uppercase transition-all",
                                            formReporte.latitud ? "bg-success/20 text-success" : "bg-primary/20 text-primary hover:bg-primary/30"
                                        )}
                                    >
                                        {obteniendoGPS ? <RefreshCw size={10} className="animate-spin" /> :
                                            formReporte.latitud ? <><CheckCircle2 size={10} /> OK</> : <><MapPin size={10} /> Capturar</>
                                        }
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex gap-2">
                                <Info size={14} className="text-primary shrink-0" />
                                <p className="text-[9px] text-text-muted leading-tight">Las fotos serán analizadas por IA para extraer datos automáticamente.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-1">Medidas Inmediatas</label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                                    <span className="text-xs font-bold text-text-main">Bloquear Salida Automática</span>
                                    <input 
                                        type="checkbox" 
                                        checked={formReporte.bloquea_salida} 
                                        onChange={e => setFormReporte({...formReporte, bloquea_salida: e.target.checked})}
                                        className="w-4 h-4 accent-primary"
                                    />
                                </label>
                                <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                                    <span className="text-xs font-bold text-text-main">Añadir a Lista Negra (Futuro)</span>
                                    <input 
                                        type="checkbox" 
                                        checked={formReporte.bloquea_acceso_futuro} 
                                        onChange={e => setFormReporte({...formReporte, bloquea_acceso_futuro: e.target.checked})}
                                        className="w-4 h-4 accent-danger"
                                    />
                                </label>
                            </div>
                        </div>

                        <Boton 
                            onClick={handleEnviarReporte}
                            disabled={enviandoReporte || iaTrabajando}
                            className="w-full h-12 bg-primary text-bg-app font-black uppercase tracking-widest shadow-tactica disabled:opacity-50"
                        >
                            {enviandoReporte ? <RefreshCw size={20} className="animate-spin" /> : <><Shield size={18} /> Registrar Infracción</>}
                        </Boton>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
