import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft, Scan, Keyboard, LogOut, CheckCircle2,
    RefreshCw, Car, Clock, ParkingSquare, AlertTriangle, X, Power
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { QRScanner } from '../../components/alcabala/QRScanner';
import { parqueroService } from '../../services/parquero.service';

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
