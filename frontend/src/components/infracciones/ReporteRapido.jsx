import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Boton } from '../ui/Boton';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import {
    AlertTriangle, MapPin, Camera, RefreshCw,
    CheckCircle2, XCircle, User, Phone, Info, Car, Search
} from 'lucide-react';
import api from '../../services/api';

const TIPOS = [
    { value: 'mal_estacionado', label: 'Mal estacionado' },
    { value: 'exceso_velocidad', label: 'Exceso velocidad' },
    { value: 'zona_prohibida', label: 'Zona prohibida' },
    { value: 'colision', label: 'Colisión' },
    { value: 'acceso_no_autorizado', label: 'Acceso no autoriz.' },
    { value: 'conducta_indebida', label: 'Conducta indebida' },
    { value: 'daño_propiedad', label: 'Daño a propiedad' },
    { value: 'otro', label: 'Otro' },
];

const GRAVEDADES = [
    { value: 'leve', label: 'LEVE', color: 'border-yellow-400/50 bg-yellow-400/10 text-yellow-400' },
    { value: 'moderada', label: 'MODERADA', color: 'border-orange-400/50 bg-orange-400/10 text-orange-400' },
    { value: 'grave', label: 'GRAVE', color: 'border-red-400/50 bg-red-400/10 text-red-400' },
    { value: 'critica', label: 'CRÍTICA', color: 'border-red-700/60 bg-red-900/20 text-red-300' },
];

export default function ReporteInfraccionRapido({ placa = '', vehiculoId = null, zonaId = null }) {
    const [abierto, setAbierto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [form, setForm] = useState({
        tipo: 'mal_estacionado',
        gravedad: 'leve',
        descripcion: '',
        placa_manual: placa,
        marca_manual: '',
        modelo_manual: '',
        latitud: null,
        longitud: null,
    });
    
    // Archivos y GPS
    const [archivos, setArchivos] = useState([]);
    const [obteniendoGPS, setObteniendoGPS] = useState(false);
    
    // IA States
    const [iaTrabajando, setIaTrabajando] = useState(false);
    const [iaMensaje, setIaMensaje] = useState(null);
    
    // Búsqueda States
    const [buscandoVehiculo, setBuscandoVehiculo] = useState(false);
    const [vehiculoInfo, setVehiculoInfo] = useState(null);

    const resetForm = () => {
        setForm({ tipo: 'mal_estacionado', gravedad: 'leve', descripcion: '', placa_manual: placa, marca_manual: '', modelo_manual: '', latitud: null, longitud: null });
        setArchivos([]);
        setIaMensaje(null);
        setVehiculoInfo(null);
    };

    const handleObtenerUbicacion = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocalización no disponible en este dispositivo');
            return;
        }
        setObteniendoGPS(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm(prev => ({
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
    
    const handleArchivosChange = async (e) => {
        const files = Array.from(e.target.files).slice(0, 3); // Max 3 fotos
        setArchivos(files);
        
        if (files.length > 0) {
            await analizarEvidencias(files);
        }
    };
    
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
                setForm(prev => ({
                    ...prev,
                    placa_manual: data.placa || prev.placa_manual,
                    marca_manual: data.marca || prev.marca_manual,
                    modelo_manual: data.modelo || prev.modelo_manual
                }));
                setIaMensaje({ type: 'success', text: 'Datos extraídos por IA' });
                
                // Si encontramos placa, buscarla de inmediato
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
            if (form.placa_manual && !iaTrabajando) {
                buscarVehiculo(form.placa_manual);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [form.placa_manual, iaTrabajando]);

    const handleEnviar = async () => {
        if (!form.descripcion.trim() && form.gravedad !== 'leve') {
            toast.error('La descripción es requerida para infracciones moderadas o superiores');
            return;
        }
        setEnviando(true);
        try {
            const formData = new FormData();
            formData.append('tipo', form.tipo);
            formData.append('gravedad', form.gravedad);
            formData.append('descripcion', form.descripcion || 'Sin descripción');
            if (form.placa_manual) formData.append('vehiculo_placa', form.placa_manual);
            if (form.marca_manual) formData.append('vehiculo_marca', form.marca_manual);
            if (form.modelo_manual) formData.append('vehiculo_modelo', form.modelo_manual);
            if (zonaId) formData.append('zona_id', zonaId);
            formData.append('bloquea_salida', 'true');
            if (form.latitud) {
                formData.append('latitud', form.latitud);
                formData.append('longitud', form.longitud);
            }
            
            archivos.forEach(f => formData.append('archivos', f));

            await api.post('/infracciones', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            toast.success('Infracción reportada', { icon: '⚠️' });
            setAbierto(false);
            resetForm();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al reportar infracción');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <>
            {/* Botón flotante */}
            <button
                onClick={() => setAbierto(true)}
                className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-warning text-bg-app rounded-full shadow-2xl shadow-warning/30 flex items-center justify-center active:scale-90 transition-all border-2 border-warning/50 hover:bg-warning/90"
                title="Reportar infracción"
            >
                <AlertTriangle size={24} strokeWidth={3} />
            </button>

            <Modal isOpen={abierto} onClose={() => { setAbierto(false); resetForm(); }} title="⚠️ REPORTE DE INFRACCIÓN">
                <div className="space-y-4 max-h-[80vh] overflow-y-auto pb-4 pr-1 scrollbar-hide">

                    {/* Evidencia y IA */}
                    <div>
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-2">
                            Evidencia Fotográfica (Hasta 3 fotos)
                        </label>
                        <div className="relative">
                            <input 
                                type="file" 
                                multiple 
                                accept="image/*" 
                                onChange={handleArchivosChange}
                                disabled={iaTrabajando}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                            />
                            <div className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-all",
                                iaTrabajando ? "border-primary/50 bg-primary/5" : "border-white/10 bg-white/5 hover:border-white/30"
                            )}>
                                {iaTrabajando ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw size={24} className="animate-spin text-primary" />
                                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                                            Analizando imágenes con IA...
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Camera size={24} className="text-text-muted" />
                                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                            {archivos.length > 0 ? `${archivos.length} archivo(s) seleccionado(s)` : 'Toca para capturar o subir fotos'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {iaMensaje && (
                            <p className={cn("text-[10px] mt-2 flex items-center gap-1", 
                                iaMensaje.type === 'success' ? 'text-success' : 
                                iaMensaje.type === 'warning' ? 'text-warning' : 'text-primary'
                            )}>
                                {iaMensaje.type === 'success' ? <CheckCircle2 size={12} /> : iaMensaje.type === 'warning' ? <AlertTriangle size={12} /> : <Info size={12} />}
                                {iaMensaje.text}
                            </p>
                        )}
                    </div>

                    {/* Placa y Búsqueda */}
                    <div>
                        <div className="flex justify-between items-end mb-1.5">
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block">
                                Placa del vehículo
                            </label>
                            {buscandoVehiculo && <RefreshCw size={12} className="animate-spin text-text-muted" />}
                        </div>
                        <input
                            value={form.placa_manual}
                            onChange={e => setForm({ ...form, placa_manual: e.target.value.toUpperCase() })}
                            disabled={iaTrabajando}
                            placeholder="Ej: ABC123D"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-black text-text-main focus:border-primary/50 outline-none uppercase placeholder:text-white/20 disabled:opacity-50"
                        />
                    </div>
                    
                    {/* Resultados de búsqueda (Responsable o Huérfano) */}
                    {vehiculoInfo && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            {vehiculoInfo.encontrado ? (
                                <div className="p-3 pr-20 bg-primary/10 border border-primary/20 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-primary/20 px-2 py-1 rounded-bl-lg">
                                        <span className="text-[8px] font-black text-primary tracking-widest uppercase">
                                            {vehiculoInfo.tipo}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                            <User size={20} className="text-primary" />
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
                                        <span className="text-[10px] font-black text-warning uppercase tracking-widest">
                                            Vehículo Desconocido
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-text-muted mb-3">
                                        Será registrado como vehículo huérfano. Las restricciones se aplicarán a la placa.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[8px] font-bold text-white/40 uppercase mb-1 block">Marca (Sugerida IA)</label>
                                            <input 
                                                value={form.marca_manual}
                                                onChange={e => setForm({...form, marca_manual: e.target.value.toUpperCase()})}
                                                disabled={iaTrabajando}
                                                placeholder="Ej: TOYOTA"
                                                className="w-full bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-text-main focus:border-warning/50 outline-none uppercase disabled:opacity-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-bold text-white/40 uppercase mb-1 block">Modelo (Sugerido IA)</label>
                                            <input 
                                                value={form.modelo_manual}
                                                onChange={e => setForm({...form, modelo_manual: e.target.value.toUpperCase()})}
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

                    {/* Tipo de infracción */}
                    <div>
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-2">
                            Tipo de infracción
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {TIPOS.map(t => (
                                <button key={t.value} onClick={() => setForm({ ...form, tipo: t.value })}
                                    className={cn(
                                        "h-9 px-3 rounded-xl border-2 text-[10px] font-black uppercase text-left transition-all",
                                        form.tipo === t.value
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20 hover:text-text-main'
                                    )}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Gravedad */}
                    <div>
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-2">
                            Gravedad
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {GRAVEDADES.map(g => (
                                <button key={g.value} onClick={() => setForm({ ...form, gravedad: g.value })}
                                    className={cn(
                                        "h-10 rounded-xl border-2 text-[9px] font-black uppercase transition-all",
                                        form.gravedad === g.value
                                            ? g.color
                                            : 'bg-white/5 border-white/10 text-text-muted/50 hover:border-white/20'
                                    )}>
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1.5">
                            Descripción {form.gravedad !== 'leve' && <span className="text-danger">*</span>}
                        </label>
                        <textarea
                            value={form.descripcion}
                            onChange={e => setForm({ ...form, descripcion: e.target.value })}
                            placeholder="Descripción del incidente..."
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:border-primary/50 outline-none resize-none placeholder:text-white/20"
                        />
                    </div>

                    {/* Geolocalización */}
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className={form.latitud ? 'text-success' : 'text-text-muted/60'} />
                                <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">
                                    Registrar Ubicación <span className="text-text-muted/40">(Recomendado)</span>
                                </span>
                            </div>
                            <button
                                onClick={handleObtenerUbicacion}
                                disabled={obteniendoGPS}
                                className={cn(
                                    "h-7 px-3 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all border",
                                    form.latitud
                                        ? 'bg-success/15 text-success border-success/30'
                                        : 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                                )}
                            >
                                {obteniendoGPS ? <RefreshCw size={11} className="animate-spin" /> :
                                    form.latitud ? <><CheckCircle2 size={11} /> GPS OK</> : <><MapPin size={11} /> Capturar</>
                                }
                            </button>
                        </div>
                        {form.latitud && (
                            <p className="text-[8px] text-success/70 mt-2 font-mono">
                                Lat: {form.latitud} · Lon: {form.longitud}
                            </p>
                        )}
                    </div>

                    {/* Aviso de consecuencias */}
                    {form.gravedad !== 'leve' && (
                        <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-xl">
                            <AlertTriangle size={13} className="text-danger shrink-0 mt-0.5" />
                            <p className="text-[9px] text-text-muted">
                                {form.gravedad === 'moderada' && 'Infracción MODERADA: bloqueará la salida del vehículo hasta resolución.'}
                                {form.gravedad === 'grave' && 'Infracción GRAVE: bloqueará salida + suspensión temporal de acceso.'}
                                {form.gravedad === 'critica' && '⚫ Infracción CRÍTICA: lista negra permanente + reporte a autoridades.'}
                            </p>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-3 pt-2 border-t border-white/5">
                        <Boton variant="ghost" className="flex-1" onClick={() => { setAbierto(false); resetForm(); }}>
                            Cancelar
                        </Boton>
                        <Boton onClick={handleEnviar} disabled={enviando || iaTrabajando}
                            className="flex-[2] bg-warning text-bg-app h-12 font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">
                            {enviando ? <RefreshCw size={16} className="animate-spin" /> : <><AlertTriangle size={16} /> Reportar Infracción</>}
                        </Boton>
                    </div>
                </div>
            </Modal>
        </>
    );
}
