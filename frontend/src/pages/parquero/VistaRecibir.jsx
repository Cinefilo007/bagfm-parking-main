import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft, Scan, Keyboard, LogIn, CheckCircle2,
    RefreshCw, Car, XCircle, Camera, User, UserCheck,
    ParkingSquare, AlertTriangle, Power, PlusCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { QRScanner } from '../../components/alcabala/QRScanner';
import { parqueroService } from '../../services/parquero.service';

// ── Variables Globales Polling ──────────────────────────────────────────────
let pollingInterval = null;
const InputField = ({ label, value, onChange, placeholder, prefix }) => (
    <div className="space-y-1">
        <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">{label}</label>
        <div className="flex items-center bg-bg-low border border-white/10 rounded-lg overflow-hidden focus-within:border-primary/50 transition-all">
            {prefix && <span className="px-2 text-[10px] text-text-muted border-r border-white/10 py-2 bg-white/5">{prefix}</span>}
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value.toUpperCase())}
                placeholder={placeholder}
                className="flex-1 bg-transparent px-3 py-2 text-xs font-black text-text-main uppercase outline-none placeholder:text-text-muted/30 placeholder:font-normal placeholder:normal-case"
            />
        </div>
    </div>
);

// ── Ficha de vehículo encontrado (flujo exitoso sin modal) ───────────────
const FichaVehiculo = ({ datos, onConfirmar, cargando, onReset }) => (
    <div className="space-y-3 animate-in fade-in duration-300">
        <div className="bg-bg-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-white/5">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center border border-success/20 shrink-0">
                    <Car size={22} className="text-success" />
                </div>
                <div className="flex-1">
                    <p className="text-xl font-black text-text-main tracking-wider">{datos.placa}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {datos.tipo_pase && (
                            <span 
                                className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border"
                                style={{
                                    color: datos.tipo_pase_color,
                                    backgroundColor: `${datos.tipo_pase_color}10`,
                                    borderColor: `${datos.tipo_pase_color}30`
                                }}
                            >
                                {datos.tipo_pase}
                            </span>
                        )}
                        {(datos.marca || datos.modelo) && (
                            <p className="text-[10px] text-text-muted">
                                {[datos.color, datos.marca, datos.modelo].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                    {datos.nombre_portador && (
                        <p className="text-[9px] font-bold text-success/80 mt-1 uppercase tracking-tighter">{datos.nombre_portador}</p>
                    )}
                </div>
            </div>
        </div>

        <button
            onClick={onConfirmar}
            disabled={cargando}
            className="w-full h-14 rounded-xl bg-success text-bg-app text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
        >
            {cargando ? <RefreshCw size={18} className="animate-spin" /> : <LogIn size={18} />}
            Confirmar Ingreso
        </button>
        <button
            onClick={onReset}
            className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-text-muted text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
        >
            Cancelar
        </button>
    </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// MODAL DE REGISTRO DE DATOS — ADAPTATIVO
//
//  · solo_persona=false  → Falta TODO: datos del ciudadano + datos del vehículo
//  · solo_persona=true   → Vehículo ya identificado (QR), solo falta el portador
//
// El guardado siempre va a `codigos_qr` si hay qrId (NO a `usuarios`).
// Si no hay qrId (sin QR), el VehiculoPase ya fue creado; solo se confirma.
// ══════════════════════════════════════════════════════════════════════════════
const ModalRegistroDatos = ({ resultadoSinDatos, zonaId, zonaData, onRegistrado, onCerrar }) => {
    const scannerIARef = useRef(null);

    const soloPersona    = resultadoSinDatos?.solo_persona === true;
    const qrId           = resultadoSinDatos?.qr_id || null;
    const vehiculoPaseId = resultadoSinDatos?.vehiculo_pase_id || null;

    // Pre-rellenar desde el backend
    const [nombre,   setNombre]   = useState(resultadoSinDatos?.nombre_portador || '');
    const [cedula,   setCedula]   = useState(resultadoSinDatos?.cedula_portador  || '');
    const [telefono, setTelefono] = useState(resultadoSinDatos?.telefono_portador || '');
    const [placa,    setPlaca]    = useState(resultadoSinDatos?.placa  || '');
    const [marca,    setMarca]    = useState(resultadoSinDatos?.marca  || '');
    const [modelo,   setModelo]   = useState(resultadoSinDatos?.modelo || '');
    const [color,    setColor]    = useState(resultadoSinDatos?.color  || '');

    const [modoIA,   setModoIA]   = useState(null); // 'cedula' | 'vehiculo'
    const [iaLoad,   setIaLoad]   = useState(false);
    const [cargando, setCargando] = useState(false);
    
    // Configuración para Creación de Pase (Visitantes)
    const [crearPase, setCrearPase] = useState(false);
    const [fechaExp,  setFechaExp]  = useState(''); // Formato YYYY-MM-DD

    // ── Captura IA ──────────────────────────────────────────────────────────
    const handleCapturarIA = async () => {
        if (!modoIA || iaLoad) return;
        setIaLoad(true);
        try {
            const video = document.querySelector('#ia-parquero video');
            if (!video) { toast.error('Cámara no disponible'); return; }
            const canvas = document.createElement('canvas');
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const base64   = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
            // Reutilizamos el servicio de alcabala para la extracción IA
            const { default: alcabalaService } = await import('../../services/alcabala.service');
            const { data }  = await alcabalaService.extraerDatosIA(base64, modoIA);
            if (modoIA === 'cedula') {
                if (data.nombre)  setNombre(data.nombre + (data.apellido ? ` ${data.apellido}` : ''));
                if (data.cedula)  setCedula(data.cedula);
                toast.success('Identidad capturada con IA');
            } else {
                if (data.placa)   setPlaca(data.placa);
                if (data.marca)   setMarca(data.marca);
                if (data.modelo)  setModelo(data.modelo);
                if (data.color)   setColor(data.color);
                toast.success('Datos del vehículo capturados');
            }
            setModoIA(null);
        } catch {
            toast.error('Error en escaneo IA');
        } finally {
            setIaLoad(false);
        }
    };

    // ── Confirmar ───────────────────────────────────────────────────────────
    const handleConfirmar = async () => {
        if (!placa.trim()) { toast.error('La placa es obligatoria'); return; }
        if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }

        setCargando(true);
        try {
            if (crearPase) {
                // FLUJO NUEVO: Creación de pase temporal con validación de capacidad
                const res = await parqueroService.crearPaseVisitante({
                    placa: placa.trim().toUpperCase(),
                    nombre: nombre.trim().toUpperCase(),
                    cedula: cedula.trim().toUpperCase() || null,
                    telefono: telefono ? (telefono.startsWith('+58') ? telefono : `+58${telefono}`) : null,
                    marca: marca.trim().toUpperCase() || null,
                    modelo: modelo.trim().toUpperCase() || null,
                    color: color.trim().toUpperCase() || null,
                    fecha_expiracion: fechaExp ? `${fechaExp}T23:59:59` : null,
                    confirmar_ingreso: true,
                    zona_id: zonaId
                });
                toast.success(res.mensaje);
                onRegistrado?.(res);
                return;
            }

            if (qrId && vehiculoPaseId) {
                // CASO 1: Vehículo ya identificado por QR — guardar datos (portador y/o vehículo) en codigos_qr e ingresar
                if (!soloPersona && !placa.trim()) { toast.error('La placa es obligatoria'); return; }
                await parqueroService.completarDatosPortador(qrId, vehiculoPaseId, {
                    nombre:   nombre   || null,
                    cedula:   cedula   || null,
                    telefono: telefono ? (telefono.startsWith('+58') ? telefono : `+58${telefono}`) : null,
                    zona_id:  zonaId,  // Envía la zona para activar ocupación
                    placa:    placa.trim().toUpperCase(),
                    marca:    marca || null,
                    modelo:   modelo || null,
                    color:    color || null
                });
                toast.success(`Datos registrados ✔ ${placa}`);
                onRegistrado?.({ placa, vehiculoPaseId });
            } else {
                // CASO 2: Sin QR — vehículo completamente desconocido (Ingreso Directo sin pase formal)
                const res = await parqueroService.registrarLlegadaPlaca(placa.trim().toUpperCase(), zonaId, {
                    nombre: nombre || null,
                    cedula: cedula || null,
                    telefono: telefono ? (telefono.startsWith('+58') ? telefono : `+58${telefono}`) : null,
                    marca: marca || null,
                    modelo: modelo || null,
                    color: color || null
                });
                toast.success(`${placa} registrado en zona`);
                onRegistrado?.(res);
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No se pudo registrar');
        } finally {
            setCargando(false);
        }
    };

    // ── Pantalla de escáner IA ───────────────────────────────────────────────
    if (modoIA) return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-200">
            <div className="absolute top-6 left-4 right-4 flex items-center justify-between text-white z-10">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Sistema OCR · IA</p>
                    <h2 className="text-lg font-black uppercase italic mt-1">
                        {modoIA === 'cedula' ? 'Escaneando Cédula' : 'Escaneando Vehículo'}
                    </h2>
                </div>
                <button onClick={() => setModoIA(null)} className="p-3 bg-white/10 rounded-full border border-white/20">
                    <XCircle size={24} />
                </button>
            </div>

            <div className="flex-1 relative" id="ia-parquero">
                <QRScanner ref={scannerIARef} onScanSuccess={() => {}} autoStart />
                <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                    <div className="w-full aspect-[1.6/1] border-2 border-primary/50 rounded-3xl relative">
                        {['tl','tr','bl','br'].map(c => (
                            <div key={c} className={cn(
                                'absolute w-10 h-10 border-4 border-primary',
                                c === 'tl' && '-top-1 -left-1 border-r-0 border-b-0 rounded-tl-2xl',
                                c === 'tr' && '-top-1 -right-1 border-l-0 border-b-0 rounded-tr-2xl',
                                c === 'bl' && '-bottom-1 -left-1 border-r-0 border-t-0 rounded-bl-2xl',
                                c === 'br' && '-bottom-1 -right-1 border-l-0 border-t-0 rounded-br-2xl',
                            )} />
                        ))}
                    </div>
                </div>
                {iaLoad && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                        <RefreshCw className="text-primary animate-spin mb-3" size={48} />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Analizando...</p>
                    </div>
                )}
            </div>

            <div className="p-6 pb-10">
                <button
                    onClick={handleCapturarIA}
                    disabled={iaLoad}
                    className="w-full h-16 rounded-2xl bg-primary text-bg-app font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    {iaLoad ? <RefreshCw size={20} className="animate-spin" /> : <Camera size={20} />}
                    Capturar y Analizar
                </button>
            </div>
        </div>
    );

    // ── Formulario ───────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:ml-64 bg-black/60 backdrop-blur-sm p-4"
            onClick={e => e.target === e.currentTarget && onCerrar()}
        >
            <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-bg-low/50">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-4 rounded-full bg-warning" />
                        <p className="text-[11px] font-black uppercase tracking-wider text-text-main">
                            {soloPersona ? 'Registrar Portador' : 'Registro de Datos'}
                        </p>
                    </div>
                    <button onClick={onCerrar} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <XCircle size={15} className="text-text-muted" />
                    </button>
                </div>

                {/* Badge vehículo ya identificado */}
                {soloPersona && (
                    <div className="px-4 pt-3">
                        <div className="flex items-center gap-3 p-3 bg-success/5 rounded-xl border border-success/20">
                            <CheckCircle2 size={16} className="text-success shrink-0" />
                            <div>
                                <p className="text-[10px] font-black text-success uppercase tracking-widest">Vehículo Identificado</p>
                                <p className="text-sm font-black text-text-main">{placa}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    {resultadoSinDatos?.tipo_pase && (
                                        <span 
                                            className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border"
                                            style={{
                                                color: resultadoSinDatos.tipo_pase_color,
                                                backgroundColor: `${resultadoSinDatos.tipo_pase_color}10`,
                                                borderColor: `${resultadoSinDatos.tipo_pase_color}30`
                                            }}
                                        >
                                            {resultadoSinDatos.tipo_pase}
                                        </span>
                                    )}
                                    {(marca || modelo) && (
                                        <p className="text-[9px] text-text-muted">{[color, marca, modelo].filter(Boolean).join(' · ')}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="overflow-y-auto flex-1 p-4 space-y-4">

                    {/* Datos del ciudadano (siempre visible) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                                <User size={10} /> Ciudadano
                            </span>
                            <button
                                onClick={() => setModoIA('cedula')}
                                className="h-7 px-3 rounded-lg flex items-center gap-1.5 text-primary border border-primary/30 bg-primary/10 text-[8px] font-black uppercase"
                            >
                                <Camera size={11} /> Escanear Cédula
                            </button>
                        </div>
                        <InputField label="Nombre y Apellido" value={nombre} onChange={setNombre} placeholder="NOMBRE COMPLETO" />
                        <InputField label="Número de Cédula" value={cedula} onChange={setCedula} placeholder="V-00000000" />
                        <InputField label="Teléfono" value={telefono} onChange={setTelefono} prefix="+58" placeholder="4121234567" />
                    </div>

                    {/* Datos del vehículo — SOLO si falta todo (no solo_persona) */}
                    {!soloPersona && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                                    <Car size={10} /> Vehículo
                                </span>
                                <button
                                    onClick={() => setModoIA('vehiculo')}
                                    className="h-7 px-3 rounded-lg flex items-center gap-1.5 text-primary border border-primary/30 bg-primary/10 text-[8px] font-black uppercase"
                                >
                                    <Camera size={11} /> Escanear Título
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 bg-bg-low rounded-xl p-3 border border-white/5">
                                <InputField label="Placa *" value={placa} onChange={setPlaca} placeholder="AB123CD" />
                                <InputField label="Color"   value={color}  onChange={setColor}  placeholder="BLANCO"  />
                                <InputField label="Marca"   value={marca}  onChange={setMarca}  placeholder="TOYOTA"  />
                                <InputField label="Modelo"  value={modelo} onChange={setModelo} placeholder="HILUX"   />
                            </div>
                        </div>
                    )}

                </div>
                
                <div className="p-4 border-t border-white/5 space-y-4">
                    {/* ── SECCIÓN PASE TEMPORAL (Solo si tiene permiso) ── */}
                    {zonaData?.puede_crear_pases && !qrId && (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ParkingSquare size={14} className="text-primary" />
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">Crear Pase Visitante</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-primary cursor-pointer" 
                                    checked={crearPase} 
                                    onChange={e => setCrearPase(e.target.checked)} 
                                />
                            </div>
                            
                            {crearPase && (
                                <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                                    <p className="text-[8px] text-text-muted uppercase font-bold italic">Se validará el cupo en {zonaData?.nombre || 'la zona'} antes de proceder.</p>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-text-muted uppercase tracking-widest px-1">Fecha de Expiración</label>
                                        <input 
                                            type="date" 
                                            className="w-full h-10 bg-bg-low border border-white/10 rounded-lg px-3 text-xs font-black text-text-main outline-none focus:border-primary/50"
                                            value={fechaExp}
                                            onChange={e => setFechaExp(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                        <p className="text-[7px] text-text-muted/60 mt-1 uppercase font-bold px-1">Dejar vacío para "Sin límites"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <button
                            onClick={handleConfirmar}
                            disabled={cargando}
                            className={cn(
                                "w-full h-12 rounded-xl text-bg-app text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50",
                                crearPase ? "bg-primary shadow-lg shadow-primary/20" : "bg-success"
                            )}
                        >
                            {cargando ? <RefreshCw size={16} className="animate-spin" /> : (crearPase ? <PlusCircle size={16} /> : <LogIn size={16} />)}
                            {crearPase ? 'Crear Pase e Ingresar' : (soloPersona ? 'Confirmar Portador e Ingresar' : 'Registrar e Ingresar')}
                        </button>
                        <button
                            onClick={onCerrar}
                            className="w-full h-9 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-text-muted"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// VISTA PRINCIPAL: RECIBIR
// ══════════════════════════════════════════════════════════════════════════════
const VistaRecibir = () => {
    const navigate  = useNavigate();
    const location  = useLocation();
    const zonaData  = location.state?.zonaData || null;
    const zonaId    = zonaData?.id;
    const zonaNombre = zonaData?.nombre || 'Mi Zona';

    const scannerRef = useRef(null);
    const [tab,     setTab]     = useState('placa'); // 'qr' | 'placa'
    const [placaInput, setPlacaInput] = useState(location.state?.placaPrevia || '');
    const [buscando,   setBuscando]   = useState(false);
    const [escaneando, setEscaneando] = useState(false);
    const [resultado,  setResultado]  = useState(null);       // VehiculoPase con sin_datos=false
    const [sinDatos,   setSinDatos]   = useState(null);       // objeto sin_datos=true del backend
    const [confirmando, setConfirmando] = useState(false);

    // ── ESTADOS DE IA (Procesamiento en Background) ──
    const [aiJobs, setAiJobs] = useState([]); // Lista de trabajos IA { jobId, status, error, resultado... }
    const videoRef = useRef(null);

    // ── Iniciar cámara para escaneo rápido ──
    React.useEffect(() => {
        let stream = null;
        if (tab === 'placa-ia') {
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
    }, [tab]);

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
                        const res = await parqueroService.consultarResultadoPlaca(job.jobId);
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

    // Auto-buscar si llegamos con una placaPrevia
    React.useEffect(() => {
        if (location.state?.placaPrevia && zonaId) {
            // Un pequeño timeout para asegurar que el componente está listo
            setTimeout(() => {
                buscarPlaca(location.state.placaPrevia);
            }, 100);
        }
    }, [location.state?.placaPrevia, zonaId]);

    const resetear = () => {
        setResultado(null);
        setSinDatos(null);
        setPlacaInput('');
    };

    // ── Buscar por placa ────────────────────────────────────────────────────
    const buscarPlaca = async (placaABuscar) => {
        const placa = (placaABuscar || placaInput).trim().toUpperCase();
        if (!placa || !zonaId) { toast.error('Ingrese una placa válida'); return; }
        setBuscando(true);
        try {
            const res = await parqueroService.registrarLlegadaPlaca(placa, zonaId, {}, false);
            if (res.sin_datos) {
                // La placa no existe en ninguna fuente
                if (zonaData?.puede_crear_pases) {
                    setSinDatos(res);
                } else {
                    toast.error(`Vehículo ${placa} no registrado en el sistema`, { 
                        icon: '⚠️',
                        duration: 4000 
                    });
                }
            } else {
                // Vehículo encontrado: mostrar ficha para confirmar
                setResultado(res);
            }
        } catch (e) {
            const mensaje = e.response?.data?.detail || 'Error al buscar vehículo';
            // Alerta diferenciada para pase de zona incorrecta
            const esZonaIncorrecta = mensaje.toLowerCase().includes('pase inválido') || 
                                     mensaje.toLowerCase().includes('zona');
            if (esZonaIncorrecta) {
                toast.error(mensaje, {
                    duration: 6000,
                    icon: '⛔',
                    style: {
                        background: '#1e0a0a',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        fontWeight: '800',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }
                });
            } else {
                toast.error(mensaje);
            }
        } finally {
            setBuscando(false);
        }
    };

    const handleBuscarPlaca = () => buscarPlaca();

    // ── Disparar IA de Placa en Background ──────────────────────────────────
    const handleCapturarPlacaIA = async () => {
        if (!zonaId) { toast.error('Falta ID de zona'); return; }
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Comprimir a 80%

        try {
            // Se envía a procesar inmediatamente, sin bloquear
            const res = await parqueroService.analizarPlacaAsync(base64, zonaId);
            
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
    };

    // ── Revisar resultado de IA ─────────────────────────────────────────────
    const handleAccionResultadoIA = (jobIndex) => {
        const job = aiJobs[jobIndex];
        if (job.status !== 'completado' || !job.resultado) return;

        const res = job.resultado;
        if (res.sin_datos) {
            // Placa leída pero no existe
            setPlacaInput(res.placa || '');
            setTab('placa'); // Volver a la pestaña de placa normal
            
            if (zonaData?.puede_crear_pases) {
                setSinDatos(res); // Abrir modal
            } else {
                toast.error(`Vehículo ${res.placa} no registrado`, { icon: '⚠️' });
            }
        } else {
            // Encontrado: confirmar de una vez (fast-track)
            // Se asume que el backend IA ya nos trajo la estructura de FichaVehiculo
            setResultado(res);
            setTab('placa'); // Para mostrar la ficha
        }

        // Lo sacamos de la cola
        setAiJobs(prev => prev.filter((_, i) => i !== jobIndex));
    };

    const handleRemoverJob = (jobIndex) => {
        setAiJobs(prev => prev.filter((_, i) => i !== jobIndex));
    };

    // ── QR scan ────────────────────────────────────────────────────────────
    const handleScanQR = useCallback(async (qrToken) => {
        if (escaneando || !zonaId) return;
        setEscaneando(true);
        try {
            const res = await parqueroService.registrarLlegadaQR(qrToken, zonaId, false);
            if (res.sin_datos) {
                setSinDatos(res);
            } else {
                setResultado(res);
                toast.success(`${res.placa || 'Vehículo'} registrado en zona`);
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || 'QR no válido o ya usado');
        } finally {
            setEscaneando(false);
        }
    }, [zonaId, escaneando]);

    // ── Confirmar ingreso (solo cuando hubo sin_datos=false y se mostró ficha) ──
    const handleConfirmarIngreso = async () => {
        if (!resultado?.vehiculo_pase_id) return;
        setConfirmando(true);
        try {
            await parqueroService.confirmarIngreso(resultado.vehiculo_pase_id, zonaId);
            toast.success(`${resultado.placa} ingresó a la zona`);
            resetear();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al confirmar ingreso');
        } finally {
            setConfirmando(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-app flex flex-col">

            {/* Header */}
            <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3 max-w-lg mx-auto">
                    <button
                        onClick={() => navigate('/parquero/')}
                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                    >
                        <ArrowLeft size={18} className="text-text-muted" />
                    </button>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-wide text-success leading-none">Recibir Vehículo</h1>
                        <p className="text-[9px] text-text-muted font-bold mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                            {zonaNombre}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <div className="w-9 h-9 bg-success/10 rounded-xl flex items-center justify-center border border-success/20">
                            <LogIn size={18} className="text-success" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="max-w-lg mx-auto w-full px-4 pt-4">
                <div className="flex gap-1 bg-bg-low rounded-2xl p-1 border border-white/5">
                    <button
                        onClick={() => { setTab('placa'); resetear(); }}
                        className={cn(
                            'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                            tab === 'placa'
                                ? 'bg-bg-card text-success border border-success/20 shadow-sm'
                                : 'text-text-muted hover:text-text-main'
                        )}
                    >
                        <Keyboard size={14} /> Ingresar Placa
                    </button>
                    <button
                        onClick={() => { setTab('qr'); resetear(); }}
                        className={cn(
                            'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                            tab === 'qr'
                                ? 'bg-bg-card text-success border border-success/20 shadow-sm'
                                : 'text-text-muted hover:text-text-main'
                        )}
                    >
                        <Scan size={14} /> Escanear QR
                    </button>
                    <button
                        onClick={() => { setTab('placa-ia'); resetear(); }}
                        className={cn(
                            'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                            tab === 'placa-ia'
                                ? 'bg-bg-card text-primary border border-primary/20 shadow-sm'
                                : 'text-text-muted hover:text-text-main'
                        )}
                    >
                        <Camera size={14} /> IA Placa
                    </button>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">

                {/* ── TAB PLACA ── */}
                {tab === 'placa' && !resultado && !sinDatos && (
                    <div className="bg-bg-card rounded-2xl border border-white/5 p-4 space-y-3">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                            Ingrese la placa del vehículo que llega
                        </p>
                        <input
                            type="text"
                            value={placaInput}
                            onChange={e => setPlacaInput(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && handleBuscarPlaca()}
                            placeholder="AB123CD"
                            maxLength={8}
                            className="w-full bg-bg-low border border-white/10 rounded-xl px-4 py-3 text-2xl font-black text-text-main uppercase tracking-widest focus:border-success/50 outline-none transition-all text-center placeholder:text-text-muted/30"
                            autoFocus
                        />
                        <button
                            onClick={handleBuscarPlaca}
                            disabled={buscando || !placaInput.trim()}
                            className="w-full h-12 rounded-xl bg-success/10 border border-success/30 text-success text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-success/20 transition-all disabled:opacity-50"
                        >
                            {buscando ? <RefreshCw size={15} className="animate-spin" /> : <Car size={15} />}
                            Buscar Vehículo
                        </button>
                    </div>
                )}

                {/* Vehículo encontrado → mostrar ficha */}
                {resultado && (
                    <FichaVehiculo
                        datos={resultado}
                        cargando={confirmando}
                        onConfirmar={handleConfirmarIngreso}
                        onReset={resetear}
                    />
                )}

                {/* ── TAB QR ── */}
                {tab === 'qr' && !resultado && !sinDatos && (
                    <div className="space-y-3">
                        <div className="aspect-square w-full max-w-[320px] mx-auto bg-black rounded-2xl overflow-hidden relative border border-white/5 shadow-2xl">
                            <QRScanner
                                ref={scannerRef}
                                onScanSuccess={handleScanQR}
                                autoStart
                            />
                            {escaneando && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                                    <RefreshCw className="text-success animate-spin mb-3" size={40} />
                                    <p className="text-[10px] font-black text-success uppercase tracking-widest">Procesando...</p>
                                </div>
                            )}
                        </div>

                        {/* Controles de cámara (Solo durante el escaneo) */}
                        <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-700">
                            <button
                                onClick={() => scannerRef.current?.switchCamera()}
                                className="h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/10 transition-all active:scale-95"
                            >
                                <RefreshCw size={14} className="text-success" /> Lente
                            </button>
                            <button
                                onClick={() => scannerRef.current?.toggleScanner()}
                                className="h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/10 transition-all active:scale-95"
                            >
                                <Power size={14} className="text-success" /> Energía
                            </button>
                        </div>

                        <p className="text-center text-[9px] text-text-muted/50 font-black uppercase tracking-widest">
                            Apunte la cámara al QR del pase del vehículo
                        </p>
                    </div>
                )}

                {/* ── TAB IA PLACA ── */}
                {tab === 'placa-ia' && (
                    <div className="space-y-4">
                        <div className="aspect-[4/3] w-full max-w-[400px] mx-auto bg-black rounded-2xl overflow-hidden relative border border-primary/20 shadow-xl">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay de la cámara */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/3 border-2 border-primary/50 rounded-xl flex items-center justify-center">
                                     <span className="text-primary/50 text-xs font-black tracking-[0.2em] uppercase">Enfoque la placa</span>
                                </div>
                            </div>
                            
                            {/* Botón de captura flotante */}
                            <button
                                onClick={handleCapturarPlacaIA}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-primary rounded-full border-4 border-bg-app shadow-xl flex items-center justify-center active:scale-95 transition-transform"
                            >
                                <Camera size={24} className="text-bg-app" />
                            </button>
                        </div>

                        {/* Lista de Jobs IA */}
                        {aiJobs.length > 0 && (
                            <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-bottom-4">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2">
                                    Cola de Procesamiento IA
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {aiJobs.map((job, idx) => (
                                        <div key={job.jobId} className="bg-bg-card border border-white/5 p-2 rounded-xl flex items-center gap-3">
                                            <img src={job.thumbnail} alt="preview" className="w-12 h-12 object-cover rounded-lg border border-white/10 opacity-70" />
                                            <div className="flex-1 min-w-0">
                                                {job.status === 'pendiente' || job.status === 'procesando' ? (
                                                    <p className="text-xs font-bold text-text-main flex items-center gap-2">
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
                                                    <p className="text-xs font-bold text-danger truncate">Error: {job.error}</p>
                                                )}
                                            </div>
                                            
                                            {/* Acciones */}
                                            {job.status === 'completado' && (
                                                <button
                                                    onClick={() => handleAccionResultadoIA(idx)}
                                                    className="px-3 py-2 bg-success text-bg-app rounded-lg text-[9px] font-black uppercase tracking-wider"
                                                >
                                                    Ver
                                                </button>
                                            )}
                                            {(job.status === 'completado' || job.status === 'error') && (
                                                <button
                                                    onClick={() => handleRemoverJob(idx)}
                                                    className="p-2 bg-white/5 text-text-muted rounded-lg"
                                                >
                                                    <XCircle size={14} />
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

            {/* Modal de registro — solo se abre cuando sin_datos=true */}
            {sinDatos && (
                <ModalRegistroDatos
                    resultadoSinDatos={sinDatos}
                    zonaId={zonaId}
                    zonaData={zonaData}
                    onRegistrado={() => { toast.success('Vehículo registrado correctamente'); resetear(); }}
                    onCerrar={resetear}
                />
            )}
        </div>
    );
};

export default VistaRecibir;
