import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pasesService } from '../services/pasesService';
import { 
  QrCode, 
  User, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Car, 
  ArrowRight,
  Loader2,
  AlertTriangle,
  Download,
  Info,
  QrCode as QrIcon,
  Plus,
  Share2
} from 'lucide-react';
import { QRCode } from 'react-qr-code';
import { toPng } from 'html-to-image';
import { useRef } from 'react';

const PortalPase = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [pase, setPase] = useState(null);
    const [lote, setLote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const qrRef = useRef(null);
    const [form, setForm] = useState({
        nombre: '',
        cedula: '',
        email: '',
        telefono: '',
        placa: '',
        marca: '',
        modelo: '',
        color: '',
        vehiculos_adicionales: []
    });

    useEffect(() => {
        cargarDatos();
    }, [token]);

    const cargarDatos = async () => {
        try {
            const data = await pasesService.obtenerPasePublico(token);
            setPase(data.pase);
            setLote(data.lote);
            
            // Si el pase tiene datos, poblar el formulario por si acaso
            if (data.pase) {
                setForm({
                    nombre: data.pase.nombre || '',
                    cedula: data.pase.cedula || '',
                    email: data.pase.email || '',
                    telefono: data.pase.telefono || '',
                    placa: data.pase.vehiculo?.placa || '',
                    marca: data.pase.vehiculo?.marca || '',
                    modelo: data.pase.vehiculo?.modelo || '',
                    color: data.pase.vehiculo?.color || '',
                    vehiculos_adicionales: data.pase.vehiculos_adicionales || []
                });
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar el pase táctico');
        } finally {
            setLoading(false);
        }
    };

    const updateVehiculoExtra = (index, field, value) => {
        const updated = [...form.vehiculos_adicionales];
        updated[index] = { ...updated[index], [field]: value.toUpperCase() };
        setForm({ ...form, vehiculos_adicionales: updated });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await pasesService.completarPasePublico(token, form);
            await cargarDatos(); // Recargar para mostrar el QR
        } catch (err) {
            alert(err.response?.data?.detail || 'Fallo en la sincronización de datos');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadImage = async () => {
        if (!qrRef.current) return;
        
        try {
            const dataUrl = await toPng(qrRef.current, {
                backgroundColor: '#ffffff',
                cacheBust: true,
                pixelRatio: 4, // Garantiza resoluciones superiores a 800x800
                style: {
                    borderRadius: '0px'
                }
            });
            const link = document.createElement('a');
            link.download = `PASE_BAGFM_${pase.serial}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Error al generar la imagen:', err);
            alert('No se pudo generar la imagen del QR');
        }
    };

    const handleDownloadPdf = async () => {
        if (!qrRef.current) return;
        
        try {
            const dataUrl = await toPng(qrRef.current, {
                backgroundColor: '#ffffff',
                cacheBust: true,
                pixelRatio: 4,
                style: {
                    borderRadius: '0px'
                }
            });
            
            // Creamos archivo PDF pasándole dinámicamente jsPDF importado localmente
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [120, 120] // Cuadrado para el QR
            });
            
            pdf.addImage(dataUrl, 'PNG', 10, 10, 100, 100);
            pdf.save(`PASE_BAGFM_${pase.serial}.pdf`);
        } catch (err) {
            console.error('Error al generar el PDF:', err);
            alert('No se pudo generar el PDF');
        }
    };

    const handleShare = async () => {
        if (!qrRef.current) return;
        try {
            // Generar la imagen como Blob para compartir
            const dataUrl = await toPng(qrRef.current, {
                backgroundColor: '#ffffff',
                cacheBust: true,
                pixelRatio: 4,
                style: { borderRadius: '0px' }
            });
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `PASE_BAGFM_${pase?.serial}.png`, { type: 'image/png' });

            const locationLink = (lote?.latitud && lote?.longitud) 
                ? `https://www.google.com/maps/search/?api=1&query=${lote.latitud},${lote.longitud}`
                : '';

            const shareText = `🎫 PASE OFICIAL BAGFM\n\n` +
                              `👤 Titular: ${pase?.nombre || 'INVITADO'}\n` +
                              `📋 Serial: ${pase?.serial}\n` +
                              `${lote?.zona_nombre ? `🅿️ Zona: ${lote.zona_nombre}\n` : ''}` +
                              `${locationLink ? `📍 Ubicación: ${locationLink}\n` : ''}` +
                              `\nPresente el código QR adjunto en la alcabala.`;

            if (navigator.share) {
                // Si el navegador soporta compartir archivos
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Pase Oficial BAGFM',
                        text: shareText,
                        files: [file]
                    });
                } else {
                    // Fallback para navegadores que solo soportan texto/links
                    await navigator.share({
                        title: 'Pase Oficial BAGFM',
                        text: shareText
                    });
                }
            } else {
                alert("Tu dispositivo o navegador no soporta la función de compartir nativa.");
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Error al compartir:", err);
                alert("Hubo un error al intentar compartir el pase.");
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">Acceso Denegado</h1>
                <p className="text-gray-400 max-w-sm mb-6">{error}</p>
                <button 
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all uppercase text-sm font-bold tracking-widest"
                >
                    Volver al Inicio
                </button>
            </div>
        );
    }

    // Lógica de visualización:
    // Si el pase no tiene datos completos (marcado por el backend), mostramos el formulario
    const mostrarForm = !pase.datos_completos;

    // Configuración de visualización dinámica (v2.4.1)
    const visual = pase?.visual || { layout: 'qr', color_preset: 'aegis' };
    
    const PRESETS = {
        aegis:   { primary: '#4EDEA3', accent: 'text-[#4EDEA3]', bg: 'bg-[#4EDEA3]', shadow: 'shadow-[#4EDEA3]/20' },
        militar: { primary: '#2D3A2D', accent: 'text-gray-400',   bg: 'bg-gray-800',   shadow: 'shadow-gray-800/20' },
        civil:   { primary: '#3B82F6', accent: 'text-blue-400',   bg: 'bg-blue-500',   shadow: 'shadow-blue-500/20' },
        vip:     { primary: '#F2C94C', accent: 'text-yellow-500', bg: 'bg-yellow-500', shadow: 'shadow-yellow-500/20' },
        alfa:    { primary: '#EB5757', accent: 'text-red-500',    bg: 'bg-red-500',    shadow: 'shadow-red-500/20' },
    };
    
    // Obtener estilo base y sobreescribir con color_hex si existe
    const baseStyle = PRESETS[visual.color_preset] || PRESETS.aegis;
    const accentColor = visual.color_hex || baseStyle.primary;

    const style = {
        ...baseStyle,
        primary: accentColor,
        dynamicAccent: { color: accentColor },
        dynamicBg: { backgroundColor: accentColor },
        dynamicBorder: { borderColor: accentColor },
        dynamicShadow: { boxShadow: `0 10px 25px -5px ${accentColor}44` }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-blue-500/30 font-sans">
            {/* Header Táctico */}
            <div className="max-w-md mx-auto pt-10 px-6 pb-6 border-b border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={style.dynamicBg} />
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={style.dynamicBg} />
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase opacity-40">Identidad Digital Verificada</span>
                </div>
                <h2 className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-70" style={style.dynamicAccent}>
                    EMITIDO POR: {pase?.entidad_nombre || 'BAGFM ACCESS'}
                </h2>
                <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-2 break-words">
                    {lote?.nombre_evento || 'PASE DE COMANDO'}
                </h1>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <Calendar className="w-3 h-3" style={style.dynamicAccent} />
                    <span>
                        {lote?.fecha_inicio ? new Date(lote.fecha_inicio).toLocaleDateString() : '—'}
                        {' — '}
                        {lote?.fecha_fin ? new Date(lote.fecha_fin).toLocaleDateString() : '—'}
                    </span>
                </div>
            </div>

            <main className="max-w-md mx-auto p-6 pb-12">
                {mostrarForm ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-all" style={{ ...style.dynamicBorder, backgroundColor: `${accentColor}15` }}>
                                        <User className="w-6 h-6" style={style.dynamicAccent} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight">Completar Registro</h2>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Credencial para el evento</p>
                                    </div>
                                </div>

                                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] leading-relaxed text-yellow-200/80 font-medium">
                                        <strong className="text-yellow-500">¡AVISO IMPORTANTE!</strong><br />
                                        De no completar todos sus datos (personales y del vehículo) le tocará perder tiempo valioso registrándose manualmente con el personal de seguridad en la base. Evite demoras y complete su ficha ahora.
                                    </p>
                                </div>

                                <form onSubmit={handleSave} className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Nombre Completo</label>
                                            <input 
                                                required
                                                value={form.nombre}
                                                onChange={(e) => setForm({...form, nombre: e.target.value.toUpperCase()})}
                                                className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-4 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                placeholder="EJ. JUAN PÉREZ"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Cédula / ID</label>
                                                <input 
                                                    required
                                                    value={form.cedula}
                                                    onChange={(e) => setForm({...form, cedula: e.target.value.toUpperCase()})}
                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-4 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                    placeholder="V-000..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Teléfono</label>
                                                <input 
                                                    required
                                                    value={form.telefono}
                                                    onChange={(e) => setForm({...form, telefono: e.target.value})}
                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-4 text-sm font-bold focus:border-white/20 outline-none transition-all"
                                                    placeholder="0414..."
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Correo de Contacto</label>
                                            <input 
                                                required
                                                type="email"
                                                value={form.email}
                                                onChange={(e) => setForm({...form, email: e.target.value})}
                                                className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-4 text-sm font-bold focus:border-white/20 outline-none transition-all"
                                                placeholder="correo@ejemplo.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-6 pb-2 border-t border-white/5 mt-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Car className="w-4 h-4" style={style.dynamicAccent} />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Registro de Vehículo Principal</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Placa</label>
                                                <input 
                                                    value={form.placa}
                                                    onChange={(e) => setForm({...form, placa: e.target.value.toUpperCase()})}
                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                    placeholder="PLACA"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Color</label>
                                                <input 
                                                    value={form.color}
                                                    onChange={(e) => setForm({...form, color: e.target.value.toUpperCase()})}
                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                    placeholder="COLOR"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Marca</label>
                                                <input 
                                                    value={form.marca}
                                                    onChange={(e) => setForm({...form, marca: e.target.value.toUpperCase()})}
                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                    placeholder="TOYOTA"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Modelo</label>
                                                <input 
                                                    value={form.modelo}
                                                    onChange={(e) => setForm({...form, modelo: e.target.value.toUpperCase()})}
                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                    placeholder="YARIS"
                                                />
                                            </div>
                                        </div>

                                        {/* Vehículos Adicionales */}
                                        {form.vehiculos_adicionales.length > 0 && (
                                            <div className="space-y-6 mt-6 pt-6 border-t border-white/5">
                                                {form.vehiculos_adicionales.map((v, idx) => (
                                                    <div key={v.id || idx} className="space-y-4 animate-in slide-in-from-bottom-2">
                                                        <div className="flex items-center gap-2">
                                                            <Plus size={14} style={style.dynamicAccent} />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Vehículo Adicional {idx + 2}</span>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Placa</label>
                                                                <input 
                                                                    value={v.placa}
                                                                    onChange={(e) => updateVehiculoExtra(idx, 'placa', e.target.value)}
                                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                                    placeholder="PLACA"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Color</label>
                                                                <input 
                                                                    value={v.color}
                                                                    onChange={(e) => updateVehiculoExtra(idx, 'color', e.target.value)}
                                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                                    placeholder="COLOR"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Marca</label>
                                                                <input 
                                                                    value={v.marca}
                                                                    onChange={(e) => updateVehiculoExtra(idx, 'marca', e.target.value)}
                                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                                    placeholder="MARCA"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-[0.15em]">Modelo</label>
                                                                <input 
                                                                    value={v.modelo}
                                                                    onChange={(e) => updateVehiculoExtra(idx, 'modelo', e.target.value)}
                                                                    className="w-full bg-[#121214] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:border-white/20 outline-none transition-all uppercase"
                                                                    placeholder="MODELO"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        type="submit"
                                        disabled={saving}
                                        className="w-full mt-6 py-4 hover:brightness-110 disabled:opacity-50 text-bg-app rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-lg"
                                        style={{ ...style.dynamicBg, ...style.dynamicShadow }}
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Obtener Pase Digital <ArrowRight className="w-4 h-4" /></>}
                                    </button>
                                </form>
                            </div>
                    </div>
                ) : (
                    <div className="animate-in zoom-in-95 duration-500 space-y-6">
                            {/* Card de Pase Digital Dinámico */}
                            {/* Card de Pase Digital Dinámico */}
                            <div 
                                id="carnet-digital"
                                className={cn(
                                    "bg-white p-8 text-[#0a0a0b] shadow-2xl relative overflow-hidden transition-all",
                                    "rounded-[2.5rem]"
                                )}
                            >
                                {/* Decoración Táctica de Fondo */}
                                <div className="absolute top-0 right-0 w-40 h-40 blur-[80px] opacity-10 pointer-events-none" style={style.dynamicBg} />
                                
                                <div className="flex justify-between items-center mb-8">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-500 ml-0.5">Credencial de Acceso</span>
                                        <h3 className="text-2xl font-black leading-none tracking-tighter">{pase.serial}</h3>
                                    </div>
                                    <div className="p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    </div>
                                </div>

                                <div className="flex flex-col items-center mb-6">
                                    <div ref={qrRef} className="p-4 bg-white border-2 border-slate-100 rounded-[2rem] mb-4 shadow-sm w-full max-w-[280px]">
                                        <QRCode 
                                            value={token} 
                                            size={256} 
                                            style={{ height: "auto", maxWidth: "100%", width: "100%", background: "white" }}
                                            viewBox={`0 0 256 256`}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-200">
                                        <QrIcon size={12} className="text-slate-500" />
                                        <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-[0.15em]">Token JWT Verificado</p>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t-2 border-dashed border-slate-200 pt-6 mt-2">
                                    <div className="flex justify-between items-center text-center">
                                        <div className="w-full">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Titular Autorizado</span>
                                            <p className="text-lg font-black">{pase.nombre || 'INVITADO'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={handleDownloadImage}
                                    className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/20 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex flex-col items-center justify-center gap-2 shadow-tactica"
                                >
                                    <Download className="w-5 h-5" /> 
                                    <span className="text-[9px]">Imagen</span>
                                </button>
                                <button 
                                    onClick={handleDownloadPdf}
                                    className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex flex-col items-center justify-center gap-2 opacity-60"
                                >
                                    <CheckCircle2 className="w-5 h-5" /> 
                                    <span className="text-[9px]">PDF</span>
                                </button>
                                <button 
                                    onClick={handleShare}
                                    className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/20 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex flex-col items-center justify-center gap-2 shadow-tactica"
                                >
                                    <Share2 className="w-5 h-5" /> 
                                    <span className="text-[9px]">Compartir</span>
                                </button>
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4">
                                {lote?.zona_nombre && (
                                    <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                                        <div className="p-2 bg-blue-500/10 rounded-lg">
                                            <MapPin className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Estacionamiento Asignado</p>
                                            <p className="text-xs font-bold text-white uppercase">{lote.zona_nombre}</p>
                                        </div>
                                    </div>
                                )}

                                {lote?.latitud && lote?.longitud && (
                                    <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${lote.latitud},${lote.longitud}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        <MapPin className="w-3.5 h-3.5" /> Cómo llegar con Google Maps
                                    </a>
                                )}

                                <div className="flex items-center gap-4">
                                    <div className={`p-2 ${style.bg}/10 rounded-lg`}>
                                        <Info className={`w-4 h-4 ${style.accent}`} />
                                    </div>
                                    <p className="text-[10px] leading-relaxed text-gray-400 uppercase font-medium">
                                        Presente este código en la alcabala de acceso. Se recomienda descargar la imagen para acceso sin conexión.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
            </main>

            <footer className="max-w-md mx-auto px-6 py-12 text-center border-t border-white/5 opacity-40">
                <div className="flex flex-col items-center gap-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.4em]">
                        Powered by <span style={style.dynamicAccent}>BAGFM</span>
                    </p>
                    <p className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-30 mt-1">
                        Electronic Access Management System · © 2024
                    </p>
                </div>
            </footer>
        </div>
    );
};

// Helper for classNames
function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}

export default PortalPase;
