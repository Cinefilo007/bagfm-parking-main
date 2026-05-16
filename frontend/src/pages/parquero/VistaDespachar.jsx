import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft, Scan, Keyboard, LogOut, CheckCircle2,
    RefreshCw, Car, Clock, ParkingSquare, AlertTriangle, X, Power,
    Camera, XCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { QRScanner } from '../../components/alcabala/QRScanner';
import { parqueroService } from '../../services/parquero.service';

// ── Variables Globales Polling ──────────────────────────────────────────────
let pollingInterval = null;

// ── Ficha de vehículo a despachar ─────────────────────────────────────────
const FichaDespacho = ({ datos, onConfirmar, cargando, onReset }) => {
    const tiempoDisplay = () => {
        if (!datos.tiempo_en_zona_min) return null;
        const h = Math.floor(datos.tiempo_en_zona_min / 60);
        const m = datos.tiempo_en_zona_min % 60;
        return h > 0 ? `${h}h ${m}min en zona` : `${m} min en zona`;
    };

    return (
        <div className="space-y-3 animate-in fade-in duration-300">
            {/* Datos del vehículo */}
            <div className="bg-bg-card rounded-2xl border border-white/5 overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-white/5">
                    <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center border border-warning/20 shrink-0">
                        <Car size={22} className="text-warning" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xl font-black text-text-main tracking-wider">{datos.placa}</p>
                        {(datos.marca || datos.modelo) && (
                            <p className="text-[10px] text-text-muted">
                                {[datos.color, datos.marca, datos.modelo].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                </div>

                {/* Info adicional */}
                <div className="px-4 py-3 flex flex-wrap gap-3">
                    {datos.puesto_codigo && (
                        <div className="flex items-center gap-1.5 bg-warning/5 px-3 py-1.5 rounded-full border border-warning/20">
                            <ParkingSquare size={11} className="text-warning" />
                            <span className="text-[10px] font-black text-warning uppercase">{datos.puesto_codigo}</span>
                        </div>
                    )}
                    {datos.tiempo_en_zona_min != null && (
                        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                            <Clock size={11} className="text-text-muted" />
                            <span className="text-[10px] font-bold text-text-muted">{tiempoDisplay()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Botón confirmar */}
            <button
                onClick={onConfirmar}
                disabled={cargando}
                className="w-full h-14 rounded-xl bg-warning text-bg-app text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
            >
                {cargando ? <RefreshCw size={18} className="animate-spin" /> : <LogOut size={18} />}
                Confirmar Salida
            </button>

            <button
                onClick={onReset}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-text-muted text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
                Cancelar
            </button>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// VISTA PRINCIPAL: DESPACHAR
// ══════════════════════════════════════════════════════════════════════════════
const VistaDespachar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const zonaData = location.state?.zonaData || null;
    const zonaId = zonaData?.id;
    const zonaNombre = zonaData?.nombre || 'Mi Zona';

    const scannerRef = useRef(null);
    const [tab, setTab] = useState('placa'); // 'qr' | 'placa'
    const [placaInput, setPlacaInput] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [escaneando, setEscaneando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [confirmando, setConfirmando] = useState(false);

    // ── ESTADOS DE IA (Procesamiento en Background) ──
    const [aiJobs, setAiJobs] = useState([]);
    const videoRef = useRef(null);

    const resetear = () => {
        setResultado(null);
        setPlacaInput('');
    };

    // ── Buscar por placa ────────────────────────────────────────────────────
    const handleBuscarPlaca = async () => {
        const placa = placaInput.trim().toUpperCase();
        if (!placa || !zonaId) {
            toast.error('Ingrese una placa válida');
            return;
        }
        setBuscando(true);
        try {
            // Buscar el vehículo en los activos de la zona
            const activos = await parqueroService.getVehiculosEnZona(zonaId);
            const encontrado = activos.find(v => v.placa.toUpperCase() === placa);
            if (!encontrado) {
                toast.error(`No se encontró el vehículo ${placa} en la zona`);
            } else {
                setResultado(encontrado);
            }
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al buscar vehículo');
        } finally {
            setBuscando(false);
        }
    };

    // ── Escaneo QR para salida ──────────────────────────────────────────────
    const handleScanQR = async (qrToken) => {
        if (escaneando) return;
        setEscaneando(true);
        try {
            const res = await parqueroService.registrarSalidaQR(qrToken);
            toast.success(`✅ ${res.placa || 'Vehículo'} despachado de zona`);
            setResultado({ ...res, confirmado: true });
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al procesar QR de salida');
        } finally {
            setEscaneando(false);
        }
    };

    // ── Confirmar salida por placa ──────────────────────────────────────────
    const handleConfirmarSalida = async () => {
        if (!resultado?.placa || !zonaId) return;
        setConfirmando(true);
        try {
            await parqueroService.registrarSalidaPlaca(resultado.placa, zonaId);
            toast.success(`${resultado.placa} despachado de zona`);
            resetear();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No se pudo registrar la salida');
        } finally {
            setConfirmando(false);
        }
    };

    // ── Iniciar cámara para escaneo rápido IA ──
    React.useEffect(() => {
        let stream = null;
        if (tab === 'ia-placa') {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(s => {
                    stream = s;
                    if (videoRef.current) {
                        videoRef.current.srcObject = s;
                    }
                }).catch(err => toast.error('No se pudo acceder a la cámara'));
        }
        return () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        };
    }, [tab]);

    // ── Polling Jobs IA ──
    React.useEffect(() => {
        const checkJobs = async () => {
            const pendingJobs = aiJobs.filter(j => j.status === 'pendiente' || j.status === 'procesando');
            if (pendingJobs.length === 0) return;

            const updatedJobs = [...aiJobs];
            let activos = null;

            for (let i = 0; i < updatedJobs.length; i++) {
                const job = updatedJobs[i];
                if (job.status === 'pendiente' || job.status === 'procesando') {
                    try {
                        const res = await parqueroService.consultarResultadoPlaca(job.jobId);
                        if (res.status === 'completado') {
                            if (!activos) {
                                activos = await parqueroService.getVehiculosEnZona(zonaId);
                            }
                            const placa = res.resultado?.placa?.toUpperCase();
                            const vehiculoEnZona = activos.find(v => v.placa.toUpperCase() === placa);
                            
                            updatedJobs[i] = { 
                                ...job, 
                                status: res.status, 
                                resultado: res.resultado, 
                                error: res.error,
                                vehiculoEnZona: vehiculoEnZona 
                            };
                        } else if (res.status === 'error') {
                            updatedJobs[i] = { ...job, status: res.status, error: res.error };
                        }
                    } catch (e) { }
                }
            }
            setAiJobs(updatedJobs);
        };

        pollingInterval = setInterval(checkJobs, 2000); // Poll cada 2s
        return () => clearInterval(pollingInterval);
    }, [aiJobs]);

    // ── Disparar IA de Placa en Background ──
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

    // ── Salida directa desde IA ──
    const handleMarcarSalidaDirecta = async (placa, jobIndex) => {
        if (!zonaId) return;
        
        // Quitar de la lista para que la UI sea rápida
        setAiJobs(prev => prev.filter((_, i) => i !== jobIndex));

        try {
            await parqueroService.registrarSalidaPlaca(placa, zonaId);
            toast.success(`✅ ${placa} DESPACHADO`, {
                style: { background: '#10b981', color: '#fff', fontWeight: 'bold' }
            });
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No se pudo registrar la salida');
        }
    };

    const handleRemoverJob = (idx) => {
        setAiJobs(prev => prev.filter((_, i) => i !== idx));
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
                        <h1 className="text-sm font-black uppercase tracking-wide text-warning leading-none">Despachar Vehículo</h1>
                        <p className="text-[9px] text-text-muted font-bold mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
                            {zonaNombre}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <div className="w-9 h-9 bg-warning/10 rounded-xl flex items-center justify-center border border-warning/20">
                            <LogOut size={18} className="text-warning" />
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
                                ? 'bg-bg-card text-warning border border-warning/20 shadow-sm'
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
                                ? 'bg-bg-card text-warning border border-warning/20 shadow-sm'
                                : 'text-text-muted hover:text-text-main'
                        )}
                    >
                        <Scan size={14} /> Escanear QR
                    </button>
                    <button
                        onClick={() => { setTab('ia-placa'); resetear(); }}
                        className={cn(
                            'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all',
                            tab === 'ia-placa'
                                ? 'bg-bg-card text-warning border border-warning/20 shadow-sm'
                                : 'text-text-muted hover:text-text-main'
                        )}
                    >
                        <Camera size={14} /> IA Placa
                    </button>
                </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">

                {/* ── TAB PLACA ── */}
                {tab === 'placa' && !resultado && (
                    <div className="bg-bg-card rounded-2xl border border-white/5 p-4 space-y-3">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                            Ingrese la placa del vehículo que sale
                        </p>
                        <input
                            type="text"
                            value={placaInput}
                            onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleBuscarPlaca()}
                            placeholder="AB123CD"
                            maxLength={8}
                            className="w-full bg-bg-low border border-white/10 rounded-xl px-4 py-3 text-2xl font-black text-text-main uppercase tracking-widest focus:border-warning/50 outline-none transition-all text-center placeholder:text-text-muted/30"
                            autoFocus
                        />
                        <button
                            onClick={handleBuscarPlaca}
                            disabled={buscando || !placaInput.trim()}
                            className="w-full h-12 rounded-xl bg-warning/10 border border-warning/30 text-warning text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-warning/20 transition-all disabled:opacity-50"
                        >
                            {buscando ? <RefreshCw size={15} className="animate-spin" /> : <Car size={15} />}
                            Buscar en Zona
                        </button>
                    </div>
                )}

                {/* Resultado encontrado → confirmar salida */}
                {tab === 'placa' && resultado && !resultado.confirmado && (
                    <FichaDespacho
                        datos={resultado}
                        cargando={confirmando}
                        onConfirmar={handleConfirmarSalida}
                        onReset={resetear}
                    />
                )}

                {/* ── TAB QR ── */}
                {tab === 'qr' && !resultado && (
                    <div className="space-y-3">
                        <div className="aspect-square w-full max-w-[320px] mx-auto bg-black rounded-2xl overflow-hidden relative border border-white/5 shadow-2xl">
                            <QRScanner
                                ref={scannerRef}
                                onScanSuccess={handleScanQR}
                                autoStart={true}
                            />
                            {escaneando && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                                    <RefreshCw className="text-warning animate-spin mb-3" size={40} />
                                    <p className="text-[10px] font-black text-warning uppercase tracking-widest">Procesando...</p>
                                </div>
                            )}
                        </div>

                        {/* Controles de cámara (Solo durante el escaneo) */}
                        <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-700">
                            <button
                                onClick={() => scannerRef.current?.switchCamera()}
                                className="h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/10 transition-all active:scale-95"
                            >
                                <RefreshCw size={14} className="text-warning" /> Lente
                            </button>
                            <button
                                onClick={() => scannerRef.current?.toggleScanner()}
                                className="h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/10 transition-all active:scale-95"
                            >
                                <Power size={14} className="text-warning" /> Energía
                            </button>
                        </div>

                        <p className="text-center text-[9px] text-text-muted/50 font-black uppercase tracking-widest">
                            Apunte la cámara al QR del pase del vehículo
                        </p>
                    </div>
                )}

                {/* ── TAB IA PLACA ── */}
                {tab === 'ia-placa' && !resultado && (
                    <div className="space-y-4">
                        <div className="aspect-[4/3] w-full max-w-[400px] mx-auto bg-black rounded-2xl overflow-hidden relative border border-warning/20 shadow-xl">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay de la cámara */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/3 border-2 border-warning/50 rounded-xl flex items-center justify-center">
                                     <span className="text-warning/50 text-xs font-black tracking-[0.2em] uppercase">Enfoque la placa</span>
                                </div>
                            </div>
                            
                            {/* Botón de captura flotante */}
                            <button
                                onClick={handleCapturarPlacaIA}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-warning rounded-full border-4 border-bg-app shadow-xl flex items-center justify-center active:scale-95 transition-transform"
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
                                                        <RefreshCw size={12} className="animate-spin text-warning" /> Analizando...
                                                    </p>
                                                ) : job.status === 'completado' ? (
                                                    <div>
                                                        <p className="text-sm font-black text-warning uppercase">{job.resultado?.placa || '???'}</p>
                                                        <p className="text-[9px] text-text-muted truncate" title={job.resultado?.mensaje}>
                                                            {job.resultado?.mensaje || (job.resultado?.sin_datos ? 'Vehículo no registrado' : 'Vehículo encontrado')}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-bold text-danger truncate">Error: {job.error}</p>
                                                )}
                                            </div>
                                            
                                            {/* Acciones */}
                                            {job.status === 'completado' && job.vehiculoEnZona && (
                                                <button
                                                    onClick={() => handleMarcarSalidaDirecta(job.vehiculoEnZona.placa, idx)}
                                                    className="px-3 py-2 bg-warning text-bg-app rounded-lg text-[9px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
                                                >
                                                    Marcar Salida
                                                </button>
                                            )}
                                            {job.status === 'completado' && !job.vehiculoEnZona && (
                                                <div className="px-2 py-1 bg-white/5 border border-white/10 text-text-muted rounded-lg text-[9px] font-black uppercase tracking-wider text-center">
                                                    No en<br/>Zona
                                                </div>
                                            )}
                                            {(job.status === 'completado' || job.status === 'error') && (
                                                <button
                                                    onClick={() => handleRemoverJob(idx)}
                                                    className="p-2 bg-white/5 text-text-muted rounded-lg hover:bg-white/10 shrink-0"
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

                {/* QR procesado */}
                {resultado?.confirmado && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        <div className="flex flex-col items-center gap-3 p-6 bg-warning/5 rounded-2xl border border-warning/20">
                            <CheckCircle2 size={40} className="text-warning" />
                            <p className="text-lg font-black text-text-main">{resultado.placa}</p>
                            <p className="text-[10px] text-warning font-black uppercase tracking-widest">Despachado correctamente</p>
                        </div>
                        <button
                            onClick={resetear}
                            className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-text-muted text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                            <LogOut size={13} className="inline mr-2" /> Despachar Siguiente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VistaDespachar;
