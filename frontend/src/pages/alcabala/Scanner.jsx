import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRScanner } from '../../components/alcabala/QRScanner';
import { alcabalaService } from '../../services/alcabala.service';
import { Boton } from '../../components/ui/Boton';
import { Card } from '../../components/ui/Card';
import {
    CheckCircle2, XCircle, User, Car, Shield,
    RefreshCw, Power, Scan, Phone, Camera,
    UserCheck, UserPlus, ArrowRight, ParkingSquare,
    Building2, AlertTriangle, Hash, Tag, Search,
    Eye, ShieldAlert, AlertOctagon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

// ── Variables Globales Polling ──────────────────────────────────────────────
let pollingInterval = null;

/* ── Input para el formulario manual de registrar datos ── */
const InputManual = ({ label, value, onChange, placeholder, prefix = null, loading = false }) => (
    <div className="flex flex-col gap-1 w-full relative">
        <label className="text-[8px] font-black text-text-muted uppercase tracking-widest">
            {label}
        </label>
        <div className="relative flex items-center">
            {prefix && (
                <span className="absolute left-3 text-xs font-bold text-text-muted pointer-events-none">
                    {prefix}
                </span>
            )}
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    "bg-bg-low border border-bg-high rounded-xl px-3 py-2 text-xs font-bold text-text-main",
                    "focus:border-primary/60 outline-none uppercase placeholder:text-text-muted/40 transition-all w-full",
                    prefix && "pl-10",
                    loading && "animate-pulse border-primary/30"
                )}
            />
        </div>
    </div>
);

/* ── Tarjeta de datos del socio (modo lectura) ── */
const FichaSocio = ({ socio, vehiculo, vehiculos, vehiculoSeleccionadoId, onSeleccionarVehiculo, entidad }) => {
    const tieneVariosVehiculos = vehiculos && vehiculos.length > 1;

    return (
        <div
            className="rounded-2xl overflow-hidden border border-bg-high"
            style={{ background: 'var(--bg-card)' }}
        >
            {/* Cabecera socio */}
            <div
                className="flex items-center gap-3 p-3 border-b border-bg-high"
                style={{ background: 'var(--bg-low)' }}
            >
                <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-bg-high overflow-hidden"
                    style={{ background: 'var(--bg-app)' }}
                >
                    {socio?.foto_url
                        ? <img src={socio.foto_url} className="w-full h-full object-cover" alt="Foto" />
                        : <User size={22} className="text-text-muted" />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-text-main leading-tight truncate">
                        {socio ? `${socio.nombre} ${socio.apellido}` : 'Visitante sin registro'}
                    </p>
                    <p className="text-[10px] font-bold text-text-muted truncate">
                        {socio?.cedula || 'Cédula no registrada'}
                    </p>
                </div>
                {entidad && (
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full shrink-0">
                        <Building2 size={10} className="text-primary" />
                        <span className="text-[8px] font-black text-primary uppercase tracking-wider truncate max-w-[80px]">
                            {entidad}
                        </span>
                    </div>
                )}
            </div>

            {/* Info contacto */}
            {socio?.telefono && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-bg-high">
                    <Phone size={11} className="text-primary/70 shrink-0" />
                    <span className="text-[10px] font-bold text-text-muted">{socio.telefono}</span>
                </div>
            )}

            {/* Vehículo(s) */}
            {tieneVariosVehiculos ? (
                <div className="p-3 space-y-2">
                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                        <Car size={10} />
                        Seleccionar vehículo de acceso
                    </p>
                    <div className="space-y-1.5">
                        {vehiculos.map((v) => (
                            <button
                                key={v.id}
                                onClick={() => onSeleccionarVehiculo(v.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left",
                                    vehiculoSeleccionadoId === v.id
                                        ? "border-primary bg-primary/10"
                                        : "border-bg-high bg-bg-low hover:border-primary/40"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                    vehiculoSeleccionadoId === v.id ? "bg-primary/20" : "bg-bg-app"
                                )}>
                                    <Car size={16} className={vehiculoSeleccionadoId === v.id ? "text-primary" : "text-text-muted"} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-[10px] font-black uppercase truncate",
                                        vehiculoSeleccionadoId === v.id ? "text-primary" : "text-text-main"
                                    )}>
                                        {v.placa}
                                    </p>
                                    <p className="text-[9px] text-text-muted truncate">
                                        {v.color} · {v.marca} {v.modelo}
                                    </p>
                                </div>
                                {vehiculoSeleccionadoId === v.id && (
                                    <CheckCircle2 size={14} className="text-primary shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            ) : vehiculo ? (
                <div className="flex items-center gap-3 p-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-primary/20"
                        style={{ background: 'var(--bg-low)' }}
                    >
                        <Car size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-text-main uppercase">{vehiculo.placa}</p>
                        <p className="text-[9px] text-text-muted">
                            {vehiculo.color} · {vehiculo.marca} {vehiculo.modelo}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3">
                    <Car size={14} className="text-text-muted/50" />
                    <span className="text-[10px] text-text-muted italic">Sin vehículo registrado</span>
                </div>
            )}
        </div>
    );
};

/* ── Badge de pase masivo ── */
const BadgePaseMasivo = ({ nombre_evento, serial_legible, accesos_restantes }) => (
    <div
        className="rounded-xl p-3 border border-warning/20 flex items-start gap-2.5"
        style={{ background: 'color-mix(in srgb, var(--warning) 8%, var(--bg-card))' }}
    >
        <Tag size={14} className="text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-[10px] font-black text-text-main uppercase truncate">{nombre_evento || 'Evento BAGFM'}</p>
            {serial_legible && (
                <p className="text-[9px] text-text-muted flex items-center gap-1">
                    <Hash size={9} />
                    {serial_legible}
                </p>
            )}
            {accesos_restantes !== null && accesos_restantes !== undefined && (
                <p className="text-[9px] text-warning font-bold">
                    Accesos restantes: {accesos_restantes}
                </p>
            )}
        </div>
    </div>
);

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════ */
const ScannerAlcabala = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tipoAcceso = searchParams.get('tipo') || 'entrada';

    const [resultado, setResultado] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [operador, setOperador] = useState(null);

    // Vehículo seleccionado cuando hay múltiples
    const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState(null);

    // Búsqueda por placa
    const [placaBusqueda, setPlacaBusqueda] = useState('');

    // Datos de excepción / Vehículo Fantasma
    const [observaciones, setObservaciones] = useState('');
    const [esExcepcion, setEsExcepcion] = useState(false);

    // Modal de registro manual (SÓLO visible cuando el guardia lo activa)
    const [mostrarFormulario, setMostrarFormulario] = useState(false);

    // Estado del formulario manual
    const [nombreManual, setNombreManual] = useState('');
    const [cedulaManual, setCedulaManual] = useState('');
    const [telefonoManual, setTelefonoManual] = useState('');
    const [placaManual, setPlacaManual] = useState('');
    const [marcaManual, setMarcaManual] = useState('');
    const [modeloManual, setModeloManual] = useState('');
    const [colorManual, setColorManual] = useState('');
    
    // Estado de entidades y situación táctica
    const [entidadesActivas, setEntidadesActivas] = useState([]);
    const [situacionZonas, setSituacionZonas] = useState({});
    const [selectedEntidad, setSelectedEntidad] = useState('');
    const [alertaCupo, setAlertaCupo] = useState(false);

    // Cargar entidades y situación al abrir el formulario
    useEffect(() => {
        if (mostrarFormulario) {
            const fetchData = async () => {
                try {
                    const [entidadesRes, situacionRes] = await Promise.all([
                        api.get('/entidades?activas_solo=true'),
                        api.get('/mapa/situacion')
                    ]);
                    setEntidadesActivas(entidadesRes.data || []);
                    
                    // Mapear situación de zonas
                    const mapaZonas = {};
                    if (situacionRes.data?.zonas) {
                        situacionRes.data.zonas.forEach(z => {
                            // La API devuelve capacidad_total y ocupacion_actual
                            mapaZonas[String(z.id)] = {
                                ocupacion: z.ocupacion_actual || 0,
                                capacidad: z.capacidad_total || 0
                            };
                        });
                    }
                    setSituacionZonas(mapaZonas);
                } catch (error) {
                    console.error("Error cargando entidades/situación:", error);
                }
            };
            fetchData();
        }
    }, [mostrarFormulario]);

    // Verificar cupo cuando se selecciona una entidad
    useEffect(() => {
        if (selectedEntidad && entidadesActivas.length > 0) {
            const entidad = entidadesActivas.find(e => e.id === selectedEntidad);
            if (entidad && entidad.cupo_capacidad > 0) {
                setAlertaCupo(entidad.cupo_ocupacion >= entidad.cupo_capacidad);
            } else {
                setAlertaCupo(false);
            }
        } else {
            setAlertaCupo(false);
        }
    }, [selectedEntidad, entidadesActivas]);

    const [iaLoading, setIaLoading] = useState(null);
    const [modoEscaneoIA, setModoEscaneoIA] = useState(null);

    // ── ESTADOS DE IA (Procesamiento en Background) ──
    const [aiJobs, setAiJobs] = useState([]); // Lista de trabajos IA { jobId, status, error, resultado... }
    const videoRef = useRef(null);

    const scannerRef = useRef(null);
    const resultadoRef = useRef(null);

    // ── Iniciar cámara para escaneo rápido ──
    React.useEffect(() => {
        let stream = null;
        if (modoEscaneoIA === 'placa-ia') {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(s => {
                    stream = s;
                    if (videoRef.current) videoRef.current.srcObject = s;
                })
                .catch(err => {
                    console.error("Cámara error:", err);
                    toast.error("No se pudo acceder a la cámara");
                });
        }
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [modoEscaneoIA]);

    // ── Polling de Jobs IA ──
    React.useEffect(() => {
        const checkJobs = async () => {
            const pendingJobs = aiJobs.filter(j => j.status === 'pendiente' || j.status === 'procesando');
            if (pendingJobs.length === 0) return;

            const updatedJobs = [...aiJobs];
            for (let i = 0; i < updatedJobs.length; i++) {
                const job = updatedJobs[i];
                if (job.status === 'pendiente' || job.status === 'procesando') {
                    try {
                        const res = await alcabalaService.consultarResultadoPlaca(job.jobId);
                        if (res.status === 'completado') {
                            updatedJobs[i] = { ...job, status: 'completado', resultado: res.resultado };
                            toast.success(`Placa analizada: ${res.resultado?.placa || 'Desconocida'}`);
                        } else if (res.status === 'error') {
                            updatedJobs[i] = { ...job, status: 'error', error: res.resultado?.mensaje || 'Error desconocido' };
                            toast.error(`Error analizando foto: ${res.resultado?.mensaje}`);
                        }
                    } catch (e) {
                        console.error("Polling error para job", job.jobId, e);
                    }
                }
            }
            setAiJobs(updatedJobs);
        };

        pollingInterval = setInterval(checkJobs, 2000); // Poll cada 2s
        return () => clearInterval(pollingInterval);
    }, [aiJobs]);

    /* ── Sincronizar situación del guardia ── */
    useEffect(() => {
        const sync = async () => {
            try {
                const data = await alcabalaService.getMiSituacion();
                setOperador(data);
                if (!data.identificado) {
                    toast.error('Sesión operativa no válida o relevo pendiente');
                    navigate('/alcabala/dashboard');
                }
            } catch {
                navigate('/alcabala/dashboard');
            }
        };
        sync();
    }, [navigate]);

    /* ── Al obtener resultado, scroll al tope suavemente ── */
    useEffect(() => {
        if (resultado) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [resultado]);

    /* ── Manejar escaneo de QR ── */
    const handleScanSuccess = async (qrToken) => {
        if (cargando || modoEscaneoIA) return;
        setCargando(true);
        setMostrarFormulario(false);
        setVehiculoSeleccionadoId(null);

        try {
            const res = await alcabalaService.validarQR(qrToken, tipoAcceso);
            setResultado(res);

            // Pre-seleccionar primer vehículo del socio
            if (res.vehiculos && res.vehiculos.length > 0) {
                setVehiculoSeleccionadoId(res.vehiculos[0].id);
            } else if (res.vehiculo) {
                setVehiculoSeleccionadoId(res.vehiculo.id);
            }

        } catch (error) {
            const msg = error.response?.data?.detail || 'Error en protocolo';
            setResultado({ permitido: false, mensaje: msg, tipo_alerta: 'error' });
            toast.error('Fallo en validación', { position: 'bottom-center' });
        } finally {
            setCargando(false);
        }
    };

    /* ── Manejar búsqueda por placa ── */
    const handleBuscarPlaca = async () => {
        const placa = placaBusqueda.trim().toUpperCase();
        if (!placa || cargando) return;

        setCargando(true);
        setMostrarFormulario(false);
        setVehiculoSeleccionadoId(null);

        try {
            const res = await alcabalaService.buscarPorPlaca(placa, tipoAcceso);
            setResultado(res);

            if (res.vehiculos && res.vehiculos.length > 0) {
                setVehiculoSeleccionadoId(res.vehiculos[0].id);
            } else if (res.vehiculo) {
                setVehiculoSeleccionadoId(res.vehiculo.id);
            }
            
            if (res.permitido) {
                toast.success(`Vehículo ${placa} identificado`, { position: 'bottom-center' });
            } else if (res.tipo_alerta === 'error') {
                // Si no se encuentra, activamos modo manual con flag de excepción
                setResultado(res);
                setEsExcepcion(true);
                setPlacaManual(placa);
                setObservaciones('INGRESO POR EXCEPCIÓN / NO REGISTRADO');
                toast.error('VEHÍCULO NO IDENTIFICADO: Proceder con registro táctico');
            }
        } catch (error) {
            const msg = error.response?.data?.detail || 'Sistema no disponible';
            setResultado({ permitido: false, mensaje: msg, tipo_alerta: 'error' });
            toast.error(msg);
        } finally {
            setCargando(false);
        }
    };

    /* ── Abrir formulario de datos opcionales ── */
    const handleAbrirFormulario = () => {
        // Rellenar con datos del socio si ya existen
        if (resultado?.socio) {
            setNombreManual(`${resultado.socio.nombre} ${resultado.socio.apellido}`);
            setCedulaManual(resultado.socio.cedula || '');
            setTelefonoManual(resultado.socio.telefono ? resultado.socio.telefono.replace('+58', '') : '');
        }
        // Rellenar con vehículo seleccionado
        const veh = resultado?.vehiculos?.find(v => v.id === vehiculoSeleccionadoId) || resultado?.vehiculo;
        if (veh) {
            setPlacaManual(veh.placa || '');
            setMarcaManual(veh.marca || '');
            setModeloManual(veh.modelo || '');
            setColorManual(veh.color || '');
        }
        setMostrarFormulario(true);
    };

    /* ── Captura IA ── */
    const handleCapturarIA = async () => {
        if (!modoEscaneoIA || iaLoading) return;

        // Si es el modo background de placa (Aegis 3.0)
        if (modoEscaneoIA === 'placa-ia') {
            const video = videoRef.current;
            if (!video) return;

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Comprimir a 80%

            try {
                // Se envía a procesar inmediatamente, sin bloquear
                const res = await alcabalaService.analizarPlacaAsync(base64, null, 'alcabala');
                
                // Agregamos a la cola visual
                setAiJobs(prev => [{
                    jobId: res.job_id,
                    status: 'pendiente',
                    thumbnail: canvas.toDataURL('image/jpeg', 0.1), // Preview chiquito
                    timestamp: Date.now()
                }, ...prev]);

                toast.success("Foto enviada a IA", { icon: '📸' });

            } catch (e) {
                toast.error("Error al enviar foto a IA");
            }
            return;
        }

        // Si es el modo síncrono antiguo (cédula o título de propiedad en el modal)
        try {
            const video = document.querySelector('#reader-container video');
            if (!video) { toast.error('Sensor no disponible'); return; }
            setIaLoading(modoEscaneoIA);
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
            const response = await alcabalaService.extraerDatosIA(base64, modoEscaneoIA);
            const { data } = response;
            if (modoEscaneoIA === 'cedula') {
                if (data.nombre) setNombreManual(data.nombre + (data.apellido ? ` ${data.apellido}` : ''));
                if (data.cedula) setCedulaManual(data.cedula);
                toast.success('Identidad capturada');
            } else {
                if (data.placa) setPlacaManual(data.placa);
                if (data.marca) setMarcaManual(data.marca);
                if (data.modelo) setModeloManual(data.modelo);
                if (data.color) setColorManual(data.color);
                toast.success('Vehículo capturado');
            }
            setModoEscaneoIA(null);
        } catch { toast.error('Fallo en escaneo IA'); }
        finally { setIaLoading(null); }
    };

    // ── Revisar resultado de IA en background ──────────────────────────────
    const handleAccionResultadoIA = (jobIndex) => {
        const job = aiJobs[jobIndex];
        if (job.status !== 'completado' || !job.resultado) return;

        const res = job.resultado;
        
        // Simular que buscamos la placa en el input
        setModoEscaneoIA(null); // Cerrar la cámara de IA
        setPlacaBusqueda(res.placa || ''); // Poner la placa en el input
        
        // Lo sacamos de la cola
        setAiJobs(prev => prev.filter((_, i) => i !== jobIndex));
        
        // Lanzamos la búsqueda (imitando que el usuario le dio a buscar placa)
        setTimeout(() => {
            const botonBuscar = document.getElementById('btn-buscar-placa');
            if (botonBuscar) botonBuscar.click();
        }, 100);
    };

    const handleRemoverJob = (jobIndex) => {
        setAiJobs(prev => prev.filter((_, i) => i !== jobIndex));
    };

    /* ── Confirmar acceso principal (Persistencia en DB) ── */
    const handleConfirmar = async () => {
        try {
            setCargando(true);
            await alcabalaService.registrarAcceso({
                qr_id: resultado.qr_id,
                usuario_id: resultado.usuario_id,
                vehiculo_id: vehiculoSeleccionadoId || resultado.vehiculo_id,
                tipo: tipoAcceso,
                punto_acceso: operador?.punto?.nombre || 'Alcabala Principal',
                es_manual: !!(nombreManual || cedulaManual || placaManual || observaciones || selectedEntidad),
                nombre_manual: nombreManual || null,
                cedula_manual: cedulaManual || null,
                telefono_manual: telefonoManual ? `+58${telefonoManual}` : null,
                vehiculo_placa: placaManual || null,
                vehiculo_marca: marcaManual || null,
                vehiculo_modelo: modeloManual || null,
                vehiculo_color: colorManual || null,
                observaciones: observaciones || null,
                es_excepcion: esExcepcion,
                entidad_id: selectedEntidad || null
            });
            toast.success(`Acceso ${tipoAcceso} confirmado`, { position: 'bottom-center' });
            reiniciar();
        } catch (error) {
            toast.error('Error al registrar acceso');
        } finally {
            setCargando(false);
        }
    };

    /* ── Guardar datos localmente (Sin enviar a API) ── */
    const handleGuardarDatosLocales = () => {
        setResultado(prev => ({
            ...prev,
            permitido: true, // Forzar a true porque el guardia está autorizando la excepción manualmente
            tipo_alerta: 'warning', // Cambiar el color de fondo a advertencia en vez de error
            entidad_nombre: entidadesActivas.find(e => e.id === selectedEntidad)?.nombre || null,
            socio: prev?.socio ? {
                ...prev.socio,
                nombre: nombreManual || prev.socio.nombre,
                cedula: cedulaManual || prev.socio.cedula,
                telefono: telefonoManual ? `+58${telefonoManual}` : prev.socio.telefono
            } : (nombreManual || cedulaManual ? {
                nombre: nombreManual || "Visitante",
                cedula: cedulaManual,
                telefono: telefonoManual ? `+58${telefonoManual}` : null
            } : null),
            vehiculo: prev?.vehiculo ? {
                ...prev.vehiculo,
                placa: placaManual || prev.vehiculo.placa,
                marca: marcaManual || prev.vehiculo.marca,
                modelo: modeloManual || prev.vehiculo.modelo,
                color: colorManual || prev.vehiculo.color
            } : (placaManual ? {
                placa: placaManual,
                marca: marcaManual,
                modelo: modeloManual,
                color: colorManual
            } : null)
        }));

        setMostrarFormulario(false);
        toast.success("Datos preparados", { 
            icon: '📝',
            position: 'bottom-center' 
        });
    };

    const reiniciar = () => {
        setResultado(null);
        setPlacaBusqueda('');
        setObservaciones('');
        setEsExcepcion(false);
        setMostrarFormulario(false);
        setVehiculoSeleccionadoId(null);
        setNombreManual(''); setCedulaManual(''); setTelefonoManual('');
        setPlacaManual(''); setMarcaManual(''); setModeloManual(''); setColorManual('');
        setSelectedEntidad('');
        setAlertaCupo(false);
    };

    /* ── Colores de fondo según resultado y modo ── */
    const getEstiloFondo = () => {
        if (!resultado) return {};
        if (!resultado.permitido || resultado.tipo_alerta === 'error') {
            return { background: 'color-mix(in srgb, var(--danger) 5%, var(--bg-app))' };
        }
        if (resultado.tipo_alerta === 'warning') {
            return { background: 'color-mix(in srgb, var(--warning) 5%, var(--bg-app))' };
        }
        return { background: 'color-mix(in srgb, var(--success) 4%, var(--bg-app))' };
    };

    /* ══════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════ */
    return (
        <div
            className="min-h-screen flex flex-col transition-colors duration-500 pb-24"
            style={getEstiloFondo()}
        >
            {/* ── Cabecera ── */}
            <header
                className="flex items-center justify-between gap-3 p-3 sticky top-0 z-50 border-b"
                style={{
                    background: 'color-mix(in srgb, var(--bg-card) 90%, transparent)',
                    backdropFilter: 'blur(12px)',
                    borderColor: 'var(--bg-high)',
                }}
            >
                <div className="flex items-center gap-2.5">
                    <div
                        className="p-1.5 rounded-lg shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
                    >
                        <Scan className="text-primary" size={18} />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-text-main uppercase tracking-wide leading-none">
                            Terminal Alcabala
                        </h1>
                        <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                resultado
                                    ? (resultado.permitido ? 'bg-success' : 'bg-danger')
                                    : 'bg-success animate-pulse'
                            )} />
                            Modo: {tipoAcceso.toUpperCase()}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[8px] text-text-muted font-black uppercase tracking-widest opacity-60">
                        Punto de Control
                    </p>
                    <p className="text-[10px] text-text-main font-bold">
                        {operador?.punto?.nombre || 'Sincronizando...'}
                    </p>
                </div>
            </header>

            {/* ── Contenido Principal ── */}
            <main className="flex-1 flex flex-col p-3 gap-3 max-w-lg mx-auto w-full">

                {/* ══ INTERFAZ DE ESCANEO ══ */}
                {!modoEscaneoIA && (
                    <div className="flex flex-col gap-4 items-center justify-center flex-1 w-full max-w-sm mx-auto">
                        
                        {/* BÚSQUEDA MANUAL POR PLACA */}
                        {!resultado && (
                            <div className="w-full space-y-2 animate-in slide-in-from-top duration-500 px-4">
                                <div 
                                    className="flex items-center bg-bg-card border-2 border-bg-high rounded-2xl overflow-hidden focus-within:border-primary/50 transition-all shadow-xl group"
                                    style={{ borderColor: 'var(--bg-high)' }}
                                >
                                    <div className="pl-4 text-text-muted group-focus-within:text-primary transition-colors">
                                        <Search size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={placaBusqueda}
                                        onChange={(e) => setPlacaBusqueda(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBuscarPlaca()}
                                        placeholder="BUSCAR VEHÍCULO O CEDULA..."
                                        className="w-full bg-transparent border-none outline-none font-black text-sm text-text-main uppercase placeholder:text-text-muted/40 h-14 pl-2"
                                        autoComplete="off"
                                    />
                                    <button
                                        id="btn-buscar-placa"
                                        onClick={handleBuscarPlaca}
                                        disabled={cargando || !placaBusqueda.trim()}
                                        className="px-5 py-4 bg-primary text-white hover:bg-primary-dark transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center shrink-0 w-16"
                                    >
                                        {cargando ? <RefreshCw size={22} className="animate-spin" /> : <ArrowRight size={22} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* BOTÓN MODO IA PLACA (Aegis 3.0) */}
                        {!resultado && (
                             <div className="w-full px-4 mb-2 animate-in slide-in-from-top duration-500 delay-100">
                                 <button
                                     onClick={() => setModoEscaneoIA('placa-ia')}
                                     className="w-full h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center gap-2 text-primary active:scale-95 transition-transform"
                                 >
                                     <Camera size={18} />
                                     <span className="text-[10px] font-black uppercase tracking-widest">IA Análisis de Placas en Background</span>
                                 </button>
                             </div>
                        )}

                        {!resultado && (
                            <Card
                                className="w-full aspect-square border-0 rounded-[2rem] overflow-hidden shadow-2xl bg-black"
                            >
                                <QRScanner
                                    ref={scannerRef}
                                    onScanSuccess={handleScanSuccess}
                                    autoStart={true}
                                    status="idle"
                                />
                            </Card>
                        )}

                        {/* Controles Fijos (Solo durante el escaneo) */}
                        {!resultado && (
                            <div className="grid grid-cols-2 gap-2 w-full animate-in fade-in duration-700">
                                <Boton
                                    onClick={() => scannerRef.current?.switchCamera()}
                                    variant="outline"
                                    className="h-14 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95"
                                    style={{ background: 'var(--bg-card)', borderColor: 'var(--bg-high)' }}
                                >
                                    <RefreshCw size={18} className="text-primary" />
                                    <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">
                                        Cambiar Lente
                                    </span>
                                </Boton>
                                <Boton
                                    onClick={() => scannerRef.current?.toggleScanner()}
                                    variant="outline"
                                    className="h-14 rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95"
                                    style={{ background: 'var(--bg-card)', borderColor: 'var(--bg-high)' }}
                                >
                                    <Power size={18} className="text-primary" />
                                    <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">
                                        Energía
                                    </span>
                                </Boton>
                            </div>
                        )}

                        {/* ── MODO IA PLACA (Aegis 3.0) ── */}
                        {modoEscaneoIA === 'placa-ia' && (
                            <div className="w-full space-y-4 animate-in slide-in-from-bottom duration-300 px-4">
                                <div className="aspect-[4/3] w-full bg-black rounded-3xl overflow-hidden relative border-2 border-primary/20 shadow-2xl">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[40%] border-2 border-primary/50 rounded-2xl flex items-center justify-center">
                                            <span className="text-primary/60 text-[10px] font-black tracking-[0.3em] uppercase drop-shadow-md">Encuadre Placa</span>
                                        </div>
                                    </div>
                                    {/* Controles cámara IA */}
                                    <button
                                        onClick={() => setModoEscaneoIA(null)}
                                        className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full text-white flex items-center justify-center border border-white/20 active:scale-95"
                                    >
                                        <XCircle size={20} />
                                    </button>
                                    {/* Botón de captura */}
                                    <button
                                        onClick={handleCapturarIA}
                                        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[4.5rem] h-[4.5rem] bg-primary rounded-full border-[5px] border-black/50 shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)] flex items-center justify-center active:scale-90 transition-transform z-10"
                                    >
                                        <Camera size={28} className="text-white" />
                                    </button>
                                </div>

                                {/* Lista de Jobs IA */}
                                {aiJobs.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest pl-2">
                                            Cola IA
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2 max-h-[30vh] overflow-y-auto pb-4 px-1">
                                            {aiJobs.map((job, idx) => (
                                                <div key={job.jobId} className="bg-bg-card border border-white/5 p-2 rounded-2xl flex items-center gap-3 shadow-lg">
                                                    <img src={job.thumbnail} alt="preview" className="w-12 h-12 object-cover rounded-xl border border-white/10 opacity-80" />
                                                    <div className="flex-1 min-w-0">
                                                        {job.status === 'pendiente' || job.status === 'procesando' ? (
                                                            <p className="text-[11px] font-black text-text-main flex items-center gap-2 uppercase tracking-wide">
                                                                <RefreshCw size={12} className="animate-spin text-primary" /> Analizando...
                                                            </p>
                                                        ) : job.status === 'completado' ? (
                                                            <div>
                                                                <p className="text-sm font-black text-success uppercase">{job.resultado?.placa || '???'}</p>
                                                                <p className="text-[9px] text-text-muted truncate" title={job.resultado?.mensaje}>
                                                                    {job.resultado?.mensaje || (job.resultado?.sin_datos ? 'Vehículo no registrado' : 'Vehículo encontrado')}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] font-bold text-danger truncate">Error: {job.error}</p>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Acciones */}
                                                    {job.status === 'completado' && (
                                                        <button
                                                            onClick={() => handleAccionResultadoIA(idx)}
                                                            className="px-4 py-2 bg-success text-bg-app rounded-xl text-[10px] font-black uppercase tracking-wider"
                                                        >
                                                            Acción
                                                        </button>
                                                    )}
                                                    {(job.status === 'completado' || job.status === 'error') && (
                                                        <button
                                                            onClick={() => handleRemoverJob(idx)}
                                                            className="w-9 h-9 flex items-center justify-center bg-white/5 text-text-muted rounded-xl hover:bg-white/10 transition-colors"
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}

                {/* ══ MODO RESULTADO ══ */}
                {resultado && !modoEscaneoIA && (
                    <div className="flex flex-col gap-3 animate-in zoom-in-95 duration-400" ref={resultadoRef}>

                        {/* Estado principal (AUTORIZADO / DENEGADO) */}
                        <div className={cn(
                            "flex flex-col items-center text-center p-5 rounded-2xl border-2",
                            resultado.permitido
                                ? "border-success/30"
                                : "border-danger/30"
                        )} style={{
                            background: resultado.permitido
                                ? 'color-mix(in srgb, var(--success) 6%, var(--bg-card))'
                                : 'color-mix(in srgb, var(--danger) 6%, var(--bg-card))'
                        }}>
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center mb-2",
                                resultado.permitido
                                    ? "bg-success/20 text-success"
                                    : "bg-danger/20 text-danger"
                            )}>
                                {resultado.permitido
                                    ? <CheckCircle2 size={28} />
                                    : <XCircle size={28} />
                                }
                            </div>
                            <h2 className={cn(
                                "text-2xl font-black uppercase tracking-tight italic",
                                resultado.permitido ? "text-success" : "text-danger"
                            )}>
                                {resultado.permitido ? 'AUTORIZADO' : 'DENEGADO'}
                            </h2>
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-1">
                                {resultado.mensaje || 'Validación de Protocolo'}
                            </p>

                            {/* Zona asignada */}
                            {resultado.permitido && resultado.zona_asignada_id && (
                                <div
                                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
                                >
                                    <ParkingSquare size={12} className="text-primary" />
                                    <span className="text-[9px] font-black text-primary uppercase tracking-wider">
                                        {resultado.puesto_nombre ? `${resultado.zona_nombre || 'ZONA'} — Puesto ${resultado.puesto_nombre}` : resultado.zona_nombre || 'Zona Asignada'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Badge pase masivo */}
                        {resultado.es_pase_masivo && (
                            <BadgePaseMasivo
                                nombre_evento={resultado.nombre_evento}
                                serial_legible={resultado.serial_legible}
                                accesos_restantes={resultado.accesos_restantes}
                            />
                        )}

                        {/* Infracciones activas */}
                        {resultado.infracciones_activas?.length > 0 && (
                            <div
                                className="rounded-xl p-3 border border-warning/20"
                                style={{ background: 'color-mix(in srgb, var(--warning) 8%, var(--bg-card))' }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={12} className="text-warning" />
                                    <span className="text-[9px] font-black text-warning uppercase tracking-widest">
                                        Infracciones Activas
                                    </span>
                                </div>
                                {resultado.infracciones_activas.map((inf, i) => (
                                    <p key={i} className="text-[10px] text-text-muted">{inf.descripcion}</p>
                                ))}
                            </div>
                        )}

                        {/* ── ALERTA TÁCTICA: CUPO AGOTADO ── */}
                        {resultado.alerta_cupo && tipoAcceso === 'entrada' && (
                            <div
                                className="rounded-xl border-2 border-orange-500/50 overflow-hidden"
                                style={{ background: 'color-mix(in srgb, #f97316 10%, var(--bg-card))' }}
                            >
                                <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border-b border-orange-500/30">
                                    <AlertOctagon size={14} className="text-orange-400 shrink-0 animate-pulse" />
                                    <span className="text-[9px] font-black text-orange-300 uppercase tracking-widest">
                                        ⚠ ALERTA TÁCTICA — CUPO AGOTADO
                                    </span>
                                    <span className="ml-auto text-[9px] font-bold text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded">
                                        {resultado.cupo_info?.cupo_usado}/{resultado.cupo_info?.cupo_total} PUESTOS
                                    </span>
                                </div>
                                <div className="p-3 space-y-1.5">
                                    <p className="text-[10px] font-bold text-text-main leading-snug">
                                        Este socio ya tiene <span className="text-orange-400 font-black">{resultado.cupo_info?.cupo_usado} vehículo(s)</span> dentro con cupo asignado de <span className="text-white font-black">{resultado.cupo_info?.cupo_total}</span>.
                                    </p>
                                    <p className="text-[9px] text-text-muted leading-relaxed">
                                        Informe al socio: su puesto puede estar ocupado. Solicite el registro de salida antes de autorizar otro ingreso. <span className="text-orange-300 font-bold">El uso no autorizado de puestos ajenos es objeto de sanción.</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Ficha del socio (LECTURA) - sólo si hay datos */}
                        {resultado.permitido && (resultado.socio || resultado.vehiculo || resultado.vehiculos?.length > 0) && (
                            <FichaSocio
                                socio={resultado.socio}
                                vehiculo={resultado.vehiculo}
                                vehiculos={resultado.vehiculos || []}
                                vehiculoSeleccionadoId={vehiculoSeleccionadoId}
                                onSeleccionarVehiculo={setVehiculoSeleccionadoId}
                                entidad={resultado.entidad_nombre}
                            />
                        )}

                        {/* ── Acciones (QR Permitido) ── */}
                        {resultado.permitido && (
                            <div className="flex flex-col gap-2">
                                {/* Botón principal: Confirmar acceso */}
                                <Boton
                                    onClick={handleConfirmar}
                                    disabled={cargando}
                                    className="h-16 rounded-xl w-full gap-3 text-sm font-black uppercase italic tracking-wide"
                                    style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
                                >
                                    {cargando
                                        ? <RefreshCw className="animate-spin" size={20} />
                                        : <>
                                            <Shield size={20} />
                                            Confirmar {tipoAcceso === 'entrada' ? 'Entrada' : 'Salida'}
                                            <ArrowRight size={18} />
                                        </>
                                    }
                                </Boton>

                                {/* Botón secundario: Registrar Datos (OPCIONAL - abre el formulario) */}
                                {!mostrarFormulario && (
                                    <button
                                        onClick={handleAbrirFormulario}
                                        className="h-12 w-full rounded-xl border transition-all flex items-center justify-center gap-2 active:scale-95"
                                        style={{
                                            borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
                                            background: 'color-mix(in srgb, var(--primary) 5%, var(--bg-card))',
                                            color: 'var(--primary)'
                                        }}
                                    >
                                        <UserPlus size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            Registrar Datos (Opcional)
                                        </span>
                                    </button>
                                )}

                                {/* Botón: Seguir escaneando */}
                                <button
                                    onClick={reiniciar}
                                    className="h-10 w-full rounded-lg border flex items-center justify-center gap-2 active:scale-95 transition-all"
                                    style={{
                                        borderColor: 'var(--bg-high)',
                                        background: 'var(--bg-low)',
                                        color: 'var(--text-muted)'
                                    }}
                                >
                                    <Scan size={12} />
                                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">
                                        Seguir Escaneando
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* ── QR Denegado / No Encontrado (Manejo de Fantasmas) ── */}
                        {!resultado.permitido && (
                            <div className="flex flex-col gap-2">
                                {/* Botón de Alerta: Registro Excepcional */}
                                <Boton
                                    onClick={() => {
                                        setEsExcepcion(true);
                                        handleAbrirFormulario();
                                    }}
                                    className="h-14 rounded-xl w-full gap-2 text-xs font-black uppercase italic tracking-wider shadow-lg animate-pulse"
                                    style={{ 
                                        background: 'linear-gradient(135deg, var(--danger) 0%, #b91c1c 100%)',
                                        color: 'white',
                                        boxShadow: '0 0 20px rgba(220, 38, 38, 0.4)'
                                    }}
                                >
                                    <ShieldAlert size={18} />
                                    AUTORIZAR ACCESO
                                </Boton>

                                <button
                                    onClick={reiniciar}
                                    className="w-full h-11 rounded-xl border flex items-center justify-center gap-2 active:scale-95 transition-all"
                                    style={{
                                        borderColor: 'var(--bg-high)',
                                        background: 'var(--bg-low)',
                                        color: 'var(--text-muted)'
                                    }}
                                >
                                    <Scan size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">
                                        Volver al Escáner
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* ══ FORMULARIO DE DATOS OPCIONALES ══
                            Sólo visible cuando el guardia presiona "Registrar Datos" */}
                        {mostrarFormulario && (
                            <Card
                                className="rounded-2xl p-4 space-y-4 border"
                                style={{ background: 'var(--bg-card)', borderColor: 'var(--bg-high)' }}
                            >
                                {/* Encabezado */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 rounded-full bg-primary" />
                                        <h4 className="text-[10px] font-black text-text-main uppercase tracking-widest">
                                            Registro de Datos
                                        </h4>
                                    </div>
                                    <button
                                        onClick={() => setMostrarFormulario(false)}
                                        className="text-[8px] font-black text-text-muted uppercase tracking-wider hover:text-danger transition-all"
                                    >
                                        Cerrar
                                    </button>
                                </div>

                                {/* Selección de Entidad */}
                                <div className="space-y-2">
                                    <span className="text-[8px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                                        <Building2 size={10} /> Entidad de Destino
                                    </span>
                                    <div className="relative">
                                        <select
                                            value={selectedEntidad}
                                            onChange={(e) => setSelectedEntidad(e.target.value)}
                                            className="w-full bg-bg-low border border-bg-high rounded-xl px-3 py-3 text-xs font-bold text-text-main focus:border-primary/60 outline-none uppercase transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">Seleccione Entidad Autorizada</option>
                                            {entidadesActivas.map((ent) => {
                                                const cupoStr = ent.cupo_capacidad > 0
                                                    ? ` (${ent.cupo_ocupacion}/${ent.cupo_capacidad})`
                                                    : '';
                                                return (
                                                    <option key={ent.id} value={ent.id}>
                                                        {ent.nombre}{cupoStr}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {/* Indicador de cupo de la entidad seleccionada */}
                                    {selectedEntidad && (() => {
                                        const entSel = entidadesActivas.find(e => e.id === selectedEntidad);
                                        if (!entSel || entSel.cupo_capacidad === 0) return null;
                                        const pct = Math.round((entSel.cupo_ocupacion / entSel.cupo_capacidad) * 100);
                                        const lleno = entSel.cupo_ocupacion >= entSel.cupo_capacidad;
                                        return (
                                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mt-1 ${
                                                lleno ? 'bg-danger/10 border-danger/30' : 'bg-success/10 border-success/30'
                                            }`}>
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                                    lleno ? 'bg-danger animate-pulse' : 'bg-success'
                                                }`} />
                                                <div className="flex-1">
                                                    <p className={`text-[9px] font-black uppercase tracking-wide ${
                                                        lleno ? 'text-danger' : 'text-success'
                                                    }`}>
                                                        {lleno ? '⚠ ZONA AL LÍMITE' : '✓ HAY CUPO DISPONIBLE'}
                                                    </p>
                                                    <p className="text-[8px] text-text-muted">
                                                        {entSel.cupo_ocupacion} ocupados / {entSel.cupo_capacidad} cupo total ({pct}%)
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                </div>

                                {/* Datos del ciudadano */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                                            <User size={10} /> Ciudadano
                                        </span>
                                        <button
                                            onClick={() => setModoEscaneoIA('cedula')}
                                            className="h-7 px-3 rounded-lg flex items-center gap-1.5 border transition-all"
                                            style={{
                                                background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                                                borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
                                                color: 'var(--primary)'
                                            }}
                                        >
                                            <Camera size={11} />
                                            <span className="text-[8px] font-black uppercase italic">Escanear Cédula</span>
                                        </button>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border overflow-hidden"
                                            style={{ background: 'var(--bg-low)', borderColor: 'var(--bg-high)' }}
                                        >
                                            {resultado?.socio?.foto_url
                                                ? <img src={resultado.socio.foto_url} className="w-full h-full object-cover rounded-xl" alt="Foto" />
                                                : <User size={22} className="text-text-muted" />
                                            }
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <InputManual label="Nombre y Apellido" value={nombreManual} onChange={setNombreManual} placeholder="NOMBRE COMPLETO" />
                                            <InputManual label="Número de Cédula" value={cedulaManual} onChange={setCedulaManual} placeholder="V-00000000" />
                                        </div>
                                    </div>
                                    <InputManual label="Teléfono de Contacto" value={telefonoManual} onChange={setTelefonoManual} prefix="+58" placeholder="4121234567" />
                                </div>

                                {/* Datos del vehículo */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                                            <Car size={10} /> Vehículo
                                        </span>
                                        <button
                                            onClick={() => setModoEscaneoIA('vehiculo')}
                                            className="h-7 px-3 rounded-lg flex items-center gap-1.5 border transition-all"
                                            style={{
                                                background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                                                borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
                                                color: 'var(--primary)'
                                            }}
                                        >
                                            <Camera size={11} />
                                            <span className="text-[8px] font-black uppercase italic">Escanear Título</span>
                                        </button>
                                    </div>
                                    <div
                                        className="rounded-xl p-3 border grid grid-cols-2 gap-2"
                                        style={{ background: 'var(--bg-low)', borderColor: 'var(--bg-high)' }}
                                    >
                                        <InputManual label="Placa" value={placaManual} onChange={setPlacaManual} placeholder="AB123CD" />
                                        <InputManual label="Color" value={colorManual} onChange={setColorManual} placeholder="BLANCO" />
                                        <InputManual label="Marca" value={marcaManual} onChange={setMarcaManual} placeholder="TOYOTA" />
                                        <InputManual label="Modelo" value={modeloManual} onChange={setModeloManual} placeholder="HILUX" />
                                    </div>
                                </div>

                                {/* Destino y Excepción */}
                                <div className="space-y-3 p-3 rounded-2xl border-2 border-dashed border-bg-high bg-bg-low/50">
                                    <div className="flex items-center gap-2 text-warning">
                                        <Eye size={12} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Inteligencia y Trazabilidad</span>
                                    </div>
                                    
                                    <div className="flex flex-col gap-1 w-full">
                                        <label className="text-[8px] font-black text-text-muted uppercase tracking-widest">
                                            Destino Declarado / Observación Táctica
                                        </label>
                                        <textarea
                                            value={observaciones}
                                            onChange={(e) => setObservaciones(e.target.value.toUpperCase())}
                                            placeholder="EJ: VISITANTE DE CASA 45 - DICE SER FAMILIAR"
                                            rows={2}
                                            className="bg-bg-low border border-bg-high rounded-xl px-3 py-2 text-[10px] font-bold text-text-main focus:border-warning/60 outline-none uppercase placeholder:text-text-muted/40 transition-all w-full resize-none"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setEsExcepcion(!esExcepcion)}
                                            className={cn(
                                                "flex-1 h-9 rounded-xl border flex items-center justify-center gap-2 transition-all font-black text-[9px] uppercase tracking-wider",
                                                esExcepcion 
                                                    ? "bg-danger/20 border-danger text-danger italic" 
                                                    : "bg-bg-low border-bg-high text-text-muted"
                                            )}
                                        >
                                            {esExcepcion ? <AlertOctagon size={14} /> : <Shield size={14} />}
                                            {esExcepcion ? 'Alerta Excepcional Activa' : 'Solicitar Excepción'}
                                        </button>
                                    </div>
                                </div>

                                {/* Botón confirmar con datos */}
                                <div className="pt-1 flex flex-col gap-2">
                                    <Boton
                                        onClick={handleGuardarDatosLocales}
                                        disabled={!selectedEntidad || !nombreManual || !placaManual}
                                        className="h-14 rounded-xl w-full gap-2 disabled:opacity-40 disabled:grayscale"
                                        style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
                                    >
                                        <CheckCircle2 size={18} />
                                        <span className="text-sm font-black uppercase italic">Registrar Datos</span>
                                    </Boton>
                                    <button
                                        onClick={reiniciar}
                                        className="h-10 rounded-lg border text-[9px] font-black uppercase tracking-[0.3em] transition-all"
                                        style={{
                                            borderColor: 'var(--bg-high)',
                                            background: 'var(--bg-low)',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        Abortar Operación
                                    </button>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </main>

            {/* ══ OVERLAY OCR / IA ══ */}
            {modoEscaneoIA && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
                    <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-white z-10">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">
                                Sistema OCR Tactigo
                            </p>
                            <h2 className="text-xl font-black uppercase italic mt-1">
                                Escaneando {modoEscaneoIA === 'cedula' ? 'Identidad' : 'Documento'}
                            </h2>
                        </div>
                        <button
                            onClick={() => setModoEscaneoIA(null)}
                            className="p-3 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 transition-all"
                        >
                            <XCircle size={28} />
                        </button>
                    </div>

                    <div className="flex-1 relative">
                        <QRScanner ref={scannerRef} onScanSuccess={() => {}} autoStart={true} />
                        <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                            <div className="w-full aspect-[1.6/1] border-2 border-primary/40 rounded-[2.5rem] relative">
                                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-8 border-l-8 border-primary rounded-tl-3xl shadow-[0_0_15px_currentColor]" />
                                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-8 border-r-8 border-primary rounded-tr-3xl" />
                                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-8 border-l-8 border-primary rounded-bl-3xl" />
                                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-8 border-r-8 border-primary rounded-br-3xl" />
                                {iaLoading && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-md rounded-[2.5rem]">
                                        <RefreshCw className="text-primary animate-spin mb-4" size={56} />
                                        <span className="text-xs font-black uppercase tracking-[0.5em] text-primary animate-pulse">
                                            Analizando...
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-12 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center gap-6">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] text-center max-w-xs">
                            Estabilice el documento dentro del marco de seguridad
                        </p>
                        <button
                            onClick={handleCapturarIA}
                            disabled={!!iaLoading}
                            className="w-24 h-24 rounded-full bg-white/10 p-2 shadow-2xl active:scale-90 transition-all disabled:opacity-30 border-2 border-white/20"
                        >
                            <div className="w-full h-full rounded-full bg-primary flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full border-4 border-white/30" />
                            </div>
                        </button>
                        <span className="text-[11px] font-black text-primary uppercase tracking-widest italic">
                            Capturar y Procesar
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScannerAlcabala;
