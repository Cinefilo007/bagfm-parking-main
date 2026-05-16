import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/auth.store';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import SelectTactivo from '../../components/ui/SelectTactivo';
import { QRCode } from 'react-qr-code';
import {
    Calendar, Plus, Download, Clock, PackageOpen,
    LayoutGrid, Ticket, UserCheck, ExternalLink,
    Users, QrCode, ChevronRight, Share2, Mail,
    ParkingSquare, Car, Tag, Edit3, RefreshCw,
    Upload, CheckCircle2, MapPin, MoreVertical, Copy,
    Shield, Camera, Star, AlertTriangle, FileSpreadsheet, PlusCircle, Trash2,
    ShieldAlert, XCircle, Zap, ArrowRight, Info, Loader2,
    MessageCircle, Eye, X, Globe, AlertCircle
} from 'lucide-react';
import { eventosService } from '../../services/eventos.service';
import { pasesService } from '../../services/pasesService';
import zonaService from '../../services/zona.service';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import ModalExportarLote from '../../components/eventos/ModalExportarLote';
import { toPng } from 'html-to-image';
import PlantillaPreview from '../../components/carnets/PlantillaPreview';

// ──── Helpers ─────────────────────────────────────────────────────────────────

const TIPO_INFO = {
    general: { label: 'Público General', icon: Users, color: 'text-text-muted', bg: 'bg-bg-app/50' },
    invitado: { label: 'Invitado Especial', icon: Star, color: 'text-warning', bg: 'bg-warning/10' },
    identificado: { label: 'Participante Identificado', icon: UserCheck, color: 'text-primary', bg: 'bg-primary/10' },
    portal: { label: 'Auto-Registro (Portal)', icon: Globe, color: 'text-sky-400', bg: 'bg-sky-400/10' },
    custom: { label: 'Personalizado', icon: Tag, color: 'text-text-main', bg: 'bg-bg-high/40' },
    staff: { label: 'Staff', icon: Shield, color: 'text-sky-400', bg: 'bg-sky-400/10' },
    produccion: { label: 'Producción', icon: LayoutGrid, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    logistica: { label: 'Logística', icon: Car, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    prensa: { label: 'Prensa', icon: Camera, color: 'text-pink-400', bg: 'bg-pink-400/10' },
    artista: { label: 'Artista', icon: Star, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
};

const badgeTipo = (tipo, labelCustom) => {
    const info = TIPO_INFO[tipo] || TIPO_INFO.general;
    const Icon = info.icon;
    return (
        <span className={cn('px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border border-text-main/5 flex items-center gap-1', info.color, info.bg)}>
            <Icon size={9} /> {labelCustom || info.label}
        </span>
    );
};

// ──── ModalVerQR: Visualización grande del código QR individual ───────────────

// Helper de fuentes en base64 para evitar errores CORS en html-to-image
const preloadBase64Fonts = async () => {
    try {
        const cssUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Space+Grotesk:wght@400;500;600;700;900&display=swap';
        const cssText = await fetch(cssUrl).then(r => r.text());
        const urlRegex = /url\((.*?)\)/g;
        const fontPromises = [];
        
        while (true) {
            const currentMatch = urlRegex.exec(cssText);
            if (!currentMatch) break;
            const originalString = currentMatch[0];
            const fontUrl = currentMatch[1].replace(/['"]/g, '');
            
            fontPromises.push(
                fetch(fontUrl)
                    .then(r => r.blob())
                    .then(blob => new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve({ original: originalString, data: reader.result });
                        reader.readAsDataURL(blob);
                    }))
                    .catch(e => {
                        return { original: originalString, data: fontUrl };
                    })
            );
        }
        
        const results = await Promise.all(fontPromises);
        let finalCss = cssText;
        for (const res of results) {
            finalCss = finalCss.replace(res.original, `url("${res.data}")`);
        }
        return finalCss;
    } catch (e) {
        return '';
    }
};

const PRESETS_COLOR = [
    { id: 'aegis', nombre: 'Aegis', primario: '#4ade80', fondo: '#09090b', textoHeader: '#000000', textoNombre: '#ffffff' },
    { id: 'militar', nombre: 'Militar', primario: '#84cc16', fondo: '#1f2937', textoHeader: '#ffffff', textoNombre: '#f1f5f9' },
    { id: 'civil', nombre: 'Civil', primario: '#38bdf8', fondo: '#0f172a', textoHeader: '#ffffff', textoNombre: '#f8fafc' },
    { id: 'vip', nombre: 'VIP', primario: '#facc15', fondo: '#18181b', textoHeader: '#000000', textoNombre: '#ffeeaa' },
    { id: 'alfa', nombre: 'Alfa', primario: '#ef4444', fondo: '#450a0a', textoHeader: '#ffffff', textoNombre: '#fecaca' }
];

const ModalVerQR = ({ pase, lote, isOpen, onClose }) => {
    const svgRef = useRef(null);
    const carnetRef = useRef(null);
    const { user } = useAuthStore();
    const [modoExport, setModoExport] = useState('qr');
    const [presetId, setPresetId] = useState('aegis');
    const [capturando, setCapturando] = useState(false);

    const qrValue = pase?.token || pase?.serial_legible || '';
    const serialDisplay = pase?.serial_legible || '';

    // Extracción de datos lista para inyectar en la Plantilla
    const datosDinamicosActuales = useMemo(() => ({
        nombre: pase?.nombre_portador || 'SIN REGISTRO',
        cedula: pase?.cedula_portador || null,
        entidad: lote?.entidad?.nombre || user?.entidad_nombre || 'SIN ENTIDAD',
        evento: lote?.nombre_evento,
        vehiculo_placa: pase?.vehiculo_placa || null,
        zona_nombre: lote?.zona_asignada?.nombre || null,
        tipo_acceso: lote?.tipo_acceso_custom ? lote.tipo_acceso_custom.nombre : lote?.tipo_pase,
        fecha_inicio: lote?.fecha_inicio ? new Date(lote.fecha_inicio).toLocaleDateString() : '--',
        fecha_fin: lote?.fecha_fin ? new Date(lote.fecha_fin).toLocaleDateString() : '--',
        qr: qrValue,
        serial: serialDisplay
    }), [pase, lote, user, qrValue, serialDisplay]);
    
    if (!pase || !isOpen) return null;

    const tituloPortador = pase.nombre_portador || 'SIN ASIGNAR';

    const presetObj = PRESETS_COLOR.find(p => p.id === presetId) || PRESETS_COLOR[0];
    const confGenerica = {
        titulo: 'BAGFM ACCESS',
        subtitulo: 'BASE AÉREA GRAL. FRANCISCO DE MIRANDA',
        colores: presetObj
    };

    // Dimesiones dinámicas para el contenedor según formato elegido
    const getLayoutDims = () => {
        switch(modoExport) {
            case 'qr': return { h: 220, s: 1 };
            case 'colgante': return { h: 340, s: 0.75 };
            case 'credencial': return { h: 300, s: 0.75 };
            case 'ticket': return { h: 210, s: 0.75 };
            case 'cartera': return { h: 160, s: 0.65 };
            default: return { h: 300, s: 0.75 };
        }
    };
    const layout = getLayoutDims();

    // Función unificada que devuelve el Blob de imagen (SVG rasterizado o componente React rasterizado)
    const generarImagen = async () => {
        setCapturando(true);
        try {
            if (modoExport === 'qr') {
                const svgEl = svgRef.current?.querySelector('svg');
                if (!svgEl) throw new Error('SVG no encontrado');
                const svgData = new XMLSerializer().serializeToString(svgEl);
                const canvas = document.createElement('canvas');
                const size = 400;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
                
                const img = new Image();
                const blob = await new Promise((resolve, reject) => {
                    img.onload = () => {
                        ctx.drawImage(img, 20, 20, size - 40, size - 40);
                        canvas.toBlob(blob => resolve(blob), 'image/png', 1.0);
                    };
                    img.onerror = reject;
                    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
                });
                return blob;
            } else {
                if (!carnetRef.current) throw new Error('DOM Node no encontrado');
                const fontCSSData = await preloadBase64Fonts();
                const dataUrl = await toPng(carnetRef.current, {
                    pixelRatio: 3,
                    width: carnetRef.current.offsetWidth,
                    height: carnetRef.current.offsetHeight,
                    fontEmbedCSS: fontCSSData,
                    style: { transform: 'none', margin: '0' }
                });
                const res = await fetch(dataUrl);
                return await res.blob();
            }
        } finally {
            setCapturando(false);
        }
    };

    const handleDescargar = async () => {
        try {
            const blob = await generarImagen();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${modoExport === 'qr' ? 'QR' : 'CARNET'}_${serialDisplay}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Imagen descargada exitosamente');
        } catch (err) {
            console.error(err);
            toast.error('Error al generar la imagen. Intente de nuevo.');
        }
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}/portal/pase/${pase.token}`;
        navigator.clipboard.writeText(url);
        toast.success('Enlace copiado al portapapeles', { icon: '🔗' });
    };

    const handleWhatsApp = async () => {
        try {
            toast.loading('Preparando imagen...', { id: 'wa-share' });
            const eventoNombre = lote?.nombre_evento || 'Evento';
            const urlPortal = `${window.location.origin}/portal/pase/${pase.token}`;
            
            const zona = lote?.zona_asignada;
            const nombreEstacionamiento = zona?.nombre || lote?.zona_nombre;
            const lat = zona?.latitud;
            const lon = zona?.longitud;
            
            const mapsUrl = (lat && lon) 
                ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
                : null;

            const mensaje = [
                `🎫 *PASE DE ACCESO — ${eventoNombre.toUpperCase()}*`,
                `📋 Serial: \`${serialDisplay}\``,
                pase.nombre_portador ? `👤 Portador: ${pase.nombre_portador}` : '',
                pase.vehiculo_placa ? `🚗 Vehículo: ${pase.vehiculo_placa}` : '',
                nombreEstacionamiento ? `📍 Estacionamiento: *${nombreEstacionamiento}*` : '',
                mapsUrl ? `🗺️ Ubicación: ${mapsUrl}` : '',
                ``,
                `🔗 Accede a tu pase aquí: ${urlPortal}`,
                ``,
                `_Sistema BAGFM Access_`
            ].filter(Boolean).join('\n');

            const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);
            
            if (isMobile && navigator.share && navigator.canShare) {
                try {
                    const blob = await generarImagen();
                    const file = new File([blob], `${serialDisplay}.png`, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: `Pase BAGFM`, text: mensaje });
                        toast.dismiss('wa-share');
                        return;
                    }
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') {
                        toast.dismiss('wa-share');
                        return; 
                    }
                }
            }

            const urlWhatsApp = pase.telefono_portador
                ? `https://wa.me/${pase.telefono_portador.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(mensaje)}`
                : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
            
            window.open(urlWhatsApp, '_blank');
            toast.dismiss('wa-share');
            
            if (!isMobile) {
                toast("En PC debes descargar el archivo y adjuntarlo", { icon: '💡' });
            }
        } catch (err) {
            console.error(err);
            toast.error('Error enviando a WhatsApp', { id: 'wa-share' });
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div className="relative w-full max-w-sm bg-bg-card border border-text-main/10 rounded-[2rem] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-bg-app/80 text-text-muted hover:text-text-main transition-all z-10">
                    <X size={18} />
                </button>

                <div className="text-center w-full mt-2">
                    <h3 className="text-sm font-black text-text-main uppercase">{tituloPortador}</h3>
                    <span className="text-[9px] font-mono text-primary/70">{serialDisplay}</span>
                </div>

                <div 
                    className="w-full relative rounded-2xl bg-black/20 border border-text-main/5 overflow-hidden transition-all duration-300 ease-in-out mt-4" 
                    style={{ height: layout.h }}
                >
                    {capturando && (
                         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                             <Loader2 size={32} className="text-primary animate-spin" />
                         </div>
                    )}
                    
                    {modoExport === 'qr' ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div ref={svgRef} className="bg-white rounded-2xl p-4 shadow-xl shadow-black/40" style={{ width: 188, height: 188, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <QRCode value={qrValue || ' '} size={168} bgColor="#ffffff" fgColor="#0d1117" level="M" />
                            </div>
                        </div>
                    ) : (
                        <div 
                            className="absolute left-1/2 top-1/2 origin-center flex justify-center items-center transition-transform duration-300 ease-in-out"
                            style={{ transform: `translate(-50%, -50%) scale(${layout.s})` }}
                        >
                            <div ref={carnetRef} className="shrink-0 w-max h-max bg-transparent inline-block p-1">
                                <PlantillaPreview 
                                    plantilla={modoExport} 
                                    config={confGenerica} 
                                    datos={datosDinamicosActuales} 
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-full flex gap-3 mt-5">
                    <div className={modoExport === 'qr' ? 'w-full' : 'w-1/2'}>
                        <label className="block text-[9px] font-black tracking-widest text-text-muted uppercase px-1 mb-1">Formato</label>
                        <SelectTactivo 
                            menuPlacement="top"
                            value={[
                                { value: 'qr', label: 'Solo QR' },
                                { value: 'colgante', label: 'Colgante' },
                                { value: 'credencial', label: 'Credencial' },
                                { value: 'ticket', label: 'Ticket' },
                                { value: 'cartera', label: 'Cartera' }
                            ].find(o => o.value === modoExport)} 
                            onChange={option => setModoExport(option?.value || 'qr')}
                            options={[
                                { value: 'qr', label: 'Solo QR' },
                                { value: 'colgante', label: 'Colgante' },
                                { value: 'credencial', label: 'Credencial' },
                                { value: 'ticket', label: 'Ticket' },
                                { value: 'cartera', label: 'Cartera' }
                            ]}
                        />
                    </div>
                    {modoExport !== 'qr' && (
                        <div className="w-1/2">
                            <label className="block text-[9px] font-black tracking-widest text-text-muted uppercase px-1 mb-1">Estilo</label>
                            <SelectTactivo 
                                menuPlacement="top"
                                value={PRESETS_COLOR.map(p => ({ value: p.id, label: p.nombre })).find(o => o.value === presetId)} 
                                onChange={option => setPresetId(option?.value || 'aegis')}
                                options={PRESETS_COLOR.map(p => ({ value: p.id, label: p.nombre }))}
                            />
                        </div>
                    )}
                </div>

                <div className="w-full grid grid-cols-2 gap-3 mt-4">
                    <button onClick={handleDescargar} disabled={capturando} className="flex items-center justify-center gap-2 h-10 bg-bg-app/50 hover:bg-bg-app/80 border border-text-main/10 rounded-xl text-[10px] font-black text-text-muted hover:text-text-main transition-all disabled:opacity-50">
                        <Download size={14} /> DESCARGAR
                    </button>
                    <button onClick={handleCopyLink} className="flex items-center justify-center gap-2 h-10 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-[10px] font-black text-primary transition-all">
                        <Copy size={14} /> COPIAR LINK
                    </button>
                    <button onClick={handleWhatsApp} disabled={capturando} className="col-span-2 flex items-center justify-center gap-2 h-10 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/25 rounded-xl text-[10px] font-black text-[#25D366] transition-all disabled:opacity-50">
                        <MessageCircle size={14} /> ENVIAR POR WHATSAPP
                    </button>
                </div>
            </div>
        </div>
    );
};

// ──── PaseRow: fila individual de un pase dentro del drill-down ───────────────

const PaseRow = ({ pase, zonas, onCompartir, onEmail, onEditar, onVerQR }) => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-bg-app/50 rounded-xl border border-text-main/10 hover:bg-bg-app/80 transition-all group overflow-hidden">
            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                <button
                    onClick={() => onVerQR(pase)}
                    className="w-8 h-8 mt-1 sm:mt-0 bg-primary/10 hover:bg-primary/25 rounded-lg flex items-center justify-center border border-primary/15 hover:border-primary/40 shrink-0 transition-all"
                    title="Ver código QR"
                >
                    <QrCode size={15} className="text-primary" />
                </button>
                
                <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                    <div className="flex flex-wrap items-center gap-2 min-w-0 shrink-0">
                        <span className="text-[10px] font-mono text-text-muted tracking-tight bg-bg-low px-1.5 py-0.5 rounded border border-text-main/10 shrink-0">
                            {pase.serial_legible}
                        </span>
                        {pase.nombre_portador ? (
                            <p className="text-[10px] font-black text-text-main uppercase truncate max-w-[200px]">{pase.nombre_portador}</p>
                        ) : (
                            <p className="text-[9px] text-text-muted/70 italic shrink-0">Sin asignar</p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {pase.vehiculo_placa && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/5 rounded-lg border border-primary/10 text-[8px] font-black text-primary shrink-0">
                                <Car size={9} /> {pase.vehiculo_placa}
                            </div>
                        )}
                        
                        {(pase.puesto_asignado_codigo || pase.zona_asignada_nombre) && (
                            <span className="text-[8px] font-bold text-success flex items-center gap-1 bg-success/15 px-2 py-0.5 rounded-lg border border-success/20 shrink-0">
                                <ParkingSquare size={9} /> 
                                {pase.puesto_asignado_codigo ? `PUESTO ${pase.puesto_asignado_codigo}` : (pase.zona_asignada_nombre || 'ZONA')}
                            </span>
                        )}

                        <span className={cn(
                            "text-[7px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ml-auto md:ml-0",
                            pase.activo ? 'bg-success/15 text-success' : 'bg-text-muted/15 text-text-muted/70'
                        )}>
                            {pase.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>

                        {pase.email_enviado && (
                            <span className="text-[7px] font-black text-sky-400 flex items-center gap-1 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20 shrink-0 animate-in fade-in zoom-in-95 duration-500" title={`Enviado el ${new Date(pase.fecha_envio_email).toLocaleString()}`}>
                                <CheckCircle2 size={9} /> ENVIADO
                            </span>
                        )}
                        {pase.email_ultimo_error && (
                            <span className="text-[7px] font-black text-danger flex items-center gap-1 bg-danger/10 px-2 py-0.5 rounded-lg border border-danger/20 shrink-0" title={pase.email_ultimo_error}>
                                <AlertTriangle size={9} /> ERROR
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-1 shrink-0 opacity-100 sm:opacity-40 group-hover:opacity-100 transition-opacity border-t sm:border-t-0 border-text-main/10 pt-2 sm:pt-0 mt-1 sm:mt-0 w-full sm:w-auto">
                <button onClick={() => onEditar(pase)} className="p-2 rounded-lg hover:bg-bg-app/80 text-text-muted hover:text-text-main transition-all" title="Editar Pase">
                    <Edit3 size={13} />
                </button>
                <button 
                    onClick={() => {
                        const url = `${window.location.origin}/portal/pase/${pase.token}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Link copiado');
                    }}
                    className="p-2 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-all" title="Copiar Link de Acceso">
                    <Copy size={13} />
                </button>
                <button onClick={() => onCompartir(pase)} className="p-2 rounded-lg hover:bg-[#25D366]/10 text-text-muted hover:text-[#25D366] transition-all" title="Compartir por WhatsApp">
                    <MessageCircle size={13} />
                </button>
                <button onClick={() => onEmail(pase)} className="p-2 rounded-lg hover:bg-sky-500/10 text-text-muted hover:text-sky-400 transition-all" title="Enviar Email">
                    <Mail size={13} />
                </button>
            </div>
        </div>
    );
};

const ModalEditarPase = ({ pase, isOpen, onClose, onRefresh }) => {
    const [form, setForm] = useState({
        nombre_portador: '', cedula_portador: '', email_portador: '', telefono_portador: '',
        vehiculo_placa: '', vehiculo_marca: '', vehiculo_modelo: '', vehiculo_color: '',
        vehiculos_adicionales: []
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (pase) {
            setForm({
                nombre_portador: pase.nombre_portador || '',
                cedula_portador: pase.cedula_portador || '',
                email_portador: pase.email_portador || '',
                telefono_portador: pase.telefono_portador || '',
                vehiculo_placa: pase.vehiculo_placa || '',
                vehiculo_marca: pase.vehiculo_marca || '',
                vehiculo_modelo: pase.vehiculo_modelo || '',
                vehiculo_color: pase.vehiculo_color || '',
                vehiculos_adicionales: pase.vehiculos_adicionales || []
            });
        }
    }, [pase]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.patch(`/pases/${pase.id}`, form);
            toast.success('Pase actualizado con éxito');
            onRefresh();
            onClose();
        } catch (e) {
            toast.error('Fallo al actualizar pase');
        } finally {
            setLoading(false);
        }
    };

    const addVehiculo = () => {
        setForm({
            ...form,
            vehiculos_adicionales: [...form.vehiculos_adicionales, { placa: '', marca: '', modelo: '', color: '' }]
        });
    };

    const removeVehiculo = (index) => {
        const updated = [...form.vehiculos_adicionales];
        updated.splice(index, 1);
        setForm({ ...form, vehiculos_adicionales: updated });
    };

    const updateVehiculo = (index, field, value) => {
        const updated = [...form.vehiculos_adicionales];
        updated[index] = { ...updated[index], [field]: value.toUpperCase() };
        setForm({ ...form, vehiculos_adicionales: updated });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="EDITAR DATOS DEL PASE" size="lg">
            <div className="space-y-6">
                <section>
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Users size={12} /> Información del Portador
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="NOMBRE COMPLETO" value={form.nombre_portador} onChange={e => setForm({...form, nombre_portador: e.target.value.toUpperCase()})} placeholder="EJ: JUAN PÉREZ" />
                        <Input label="CÉDULA / ID" value={form.cedula_portador} onChange={e => setForm({...form, cedula_portador: e.target.value.toUpperCase()})} placeholder="EJ: V-12345678" />
                        <Input label="EMAIL" type="email" value={form.email_portador} onChange={e => setForm({...form, email_portador: e.target.value.toLowerCase()})} placeholder="ejemplo@email.com" />
                        <Input label="TELÉFONO" value={form.telefono_portador} onChange={e => setForm({...form, telefono_portador: e.target.value})} placeholder="+58 412..." />
                    </div>
                </section>

                <section>
                    <h4 className="text-[10px] font-black text-warning uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Car size={12} /> Detalles del Vehículo Principal
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="PLACA" value={form.vehiculo_placa} onChange={e => setForm({...form, vehiculo_placa: e.target.value.toUpperCase()})} placeholder="ALFA-01" />
                        <Input label="MARCA" value={form.vehiculo_marca} onChange={e => setForm({...form, vehiculo_marca: e.target.value.toUpperCase()})} placeholder="TOYOTA" />
                        <Input label="MODELO" value={form.vehiculo_modelo} onChange={e => setForm({...form, vehiculo_modelo: e.target.value.toUpperCase()})} placeholder="FORTUNER" />
                        <Input label="COLOR" value={form.vehiculo_color} onChange={e => setForm({...form, vehiculo_color: e.target.value.toUpperCase()})} placeholder="NEGRO" />
                    </div>
                </section>

                {/* Vehículos Adicionales */}
                {(pase?.multi_vehiculo || form.vehiculos_adicionales.length > 0) && (
                    <section className="pt-4 border-t border-text-main/10">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                <Plus size={14} /> Vehículos Adicionales
                            </h4>
                            <Boton variant="ghost" className="h-7 px-3 text-[8px] font-black uppercase border-amber-500/20 text-amber-400 hover:bg-amber-500/10" onClick={addVehiculo}>
                                + Añadir Vehículo
                            </Boton>
                        </div>
                        
                        <div className="space-y-4">
                            {form.vehiculos_adicionales.map((v, idx) => (
                                <div key={idx} className="p-4 bg-bg-app/30 border border-text-main/5 rounded-xl relative group">
                                    <button 
                                        onClick={() => removeVehiculo(idx)}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    >
                                        <X size={12} />
                                    </button>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <Input label={`PLACA V${idx+2}`} value={v.placa} onChange={e => updateVehiculo(idx, 'placa', e.target.value)} />
                                        <Input label="MARCA" value={v.marca} onChange={e => updateVehiculo(idx, 'marca', e.target.value)} />
                                        <Input label="MODELO" value={v.modelo} onChange={e => updateVehiculo(idx, 'modelo', e.target.value)} />
                                        <Input label="COLOR" value={v.color} onChange={e => updateVehiculo(idx, 'color', e.target.value)} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-text-main/5">
                    <Boton variant="ghost" onClick={onClose}>Cancelar</Boton>
                    <Boton onClick={handleSave} disabled={loading}>
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Guardar Cambios'}
                    </Boton>
                </div>
            </div>
        </Modal>
    );
};

const ModalEnvioCorreosMasivos = ({ isOpen, onClose, lote, pase = null }) => {
    const [asunto, setAsunto] = useState('');
    const [cuerpo, setCuerpo] = useState(`Estimado {{nombre}},

Nos complace informarle que su pase de acceso para el evento ya ha sido generado exitosamente.

IMPORTANTE: Para garantizar un ingreso fluido y evitar retrasos en la alcabala, es OBLIGATORIO completar sus datos (vehículo y personales) en el portal táctico antes de su llegada.

{{qr_url}}

NORMAS DE SEGURIDAD Y CONVIVENCIA EN LA BASE:
• Velocidad Máxima: 40 km/h en todas las vías internas.
• Ruta Táctica: Diríjase directamente a su estacionamiento asignado sin desviarse.
• Control de Salida: Notifique obligatoriamente al parquero al retirarse para registrar su salida.
• Seguridad Militar: Prohibido fotografiar instalaciones sensibles o realizar conductas inapropiadas.
• Disciplina: Siga en todo momento las instrucciones del personal militar y de seguridad.

Le sugerimos tener su código QR a la mano al momento de llegar.

Saludos cordiales,
Comando de Base`);
    const [tipoEnvio, setTipoEnvio] = useState('solo_qr'); // 'solo_qr' o 'carnet_pdf'
    const [presetId, setPresetId] = useState('aegis');
    const [formato, setFormato] = useState('colgante');
    const [enviando, setEnviando] = useState(false);
    const [optimizando, setOptimizando] = useState(false);

    useEffect(() => {
        if (pase) {
            setAsunto(`Pase de Acceso - ${lote?.nombre_evento || 'Evento'}`);
        } else if (lote) {
            setAsunto(`Pases de Acceso - ${lote.nombre_evento}`);
        }
    }, [lote, pase]);

    const handleEnviar = async (e) => {
        e.preventDefault();
        setEnviando(true);
        try {
            const estilo = PRESETS_COLOR.find(p => p.id === presetId);
            const endpoint = pase 
                ? `/pases/lotes/${lote.id}/pases/${pase.id}/enviar-correo`
                : `/pases/lotes/${lote.id}/enviar-correos`;

            await api.post(endpoint, {
                asunto,
                cuerpo,
                adjuntar_pdf: tipoEnvio === 'carnet_pdf',
                tipo_envio: tipoEnvio,
                estilo_carnet: estilo,
                formato_carnet: formato
            });
            toast.success(pase ? 'Re-envío individual iniciado.' : 'Protocolo de difusión iniciado en segundo plano.');
            onClose();
        } catch (e) {
            toast.error('Error al despachar los correos.');
        } finally {
            setEnviando(false);
        }
    };

    const handleIAOptimize = async () => {
        setOptimizando(true);
        try {
            const res = await api.post('/ia/refinar-correo', {
                texto: cuerpo,
                contexto: lote?.nombre_evento || 'Evento de la Base'
            });
            if (res.data?.data) {
                setCuerpo(res.data.data);
                toast.success('Mensaje optimizado por IA Táctica');
            }
        } catch (e) {
            toast.error('Motor de IA no disponible');
        } finally {
            setOptimizando(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={pase ? "RE-ENVIAR PASE INDIVIDUAL" : "DIFUSIÓN MASIVA POR CORREO"} className="max-w-4xl">
            <form onSubmit={handleEnviar} className="space-y-6">
                
                <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 text-sky-400 text-[11px] font-bold flex gap-3 items-center">
                    <Info size={18} className="shrink-0" />
                    <div>
                        <strong>Manual de Operaciones:</strong> Esta herramienta envía un correo electrónico individual y personalizado a cada portador. 
                        La variable <code className="text-primary bg-primary/10 px-1 rounded">{'{{qr_url}}'}</code> permite al usuario descargar o ver su pase en tiempo real desde el portal.
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <Input 
                            label="ASUNTO DEL CORREO" 
                            value={asunto} 
                            onChange={e => setAsunto(e.target.value)} 
                            required 
                            className="bg-bg-app border-text-main/10"
                        />
                        
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black tracking-widest text-text-muted uppercase">CUERPO DEL MENSAJE</label>
                                <button 
                                    type="button"
                                    onClick={handleIAOptimize}
                                    disabled={optimizando}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[8px] font-black uppercase hover:bg-primary/20 transition-all disabled:opacity-50"
                                >
                                    {optimizando ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                                    Optimizar con IA
                                </button>
                            </div>
                            <textarea 
                                value={cuerpo} 
                                onChange={e => setCuerpo(e.target.value)}
                                className="w-full h-48 bg-bg-app border border-text-main/10 focus:border-primary rounded-xl p-4 text-[13px] font-medium text-white transition-all resize-none shadow-inner"
                                required
                            />
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[9px] text-text-muted font-bold">
                                    Variables: <code className="text-primary font-bold">{'{{nombre}}'}</code>, <code className="text-secondary font-bold">{'{{qr_url}}'}</code>
                                </p>
                                <span className="text-[8px] text-text-muted opacity-40 uppercase font-bold text-right">Los saltos de línea se formatean automáticamente</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <section className="space-y-3">
                            <label className="text-[10px] font-black tracking-widest text-text-muted uppercase px-1">TIPO DE ENTREGA</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTipoEnvio('solo_qr')}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                        tipoEnvio === 'solo_qr' ? 'bg-primary/10 border-primary text-primary' : 'bg-bg-app/50 border-text-main/10 text-text-muted hover:border-text-main/30'
                                    )}
                                >
                                    <QrCode size={20} />
                                    <span className="text-[10px] font-black uppercase">Solo QR</span>
                                    <span className="text-[8px] opacity-60 font-bold">Enlace interactivo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTipoEnvio('carnet_pdf')}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                        tipoEnvio === 'carnet_pdf' ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-lg shadow-sky-500/10' : 'bg-bg-app/50 border-text-main/10 text-text-muted hover:border-text-main/30'
                                    )}
                                >
                                    <Download size={20} />
                                    <span className="text-[10px] font-black uppercase">Carnet PDF</span>
                                    <span className="text-[8px] opacity-60 font-bold">Adjunto Tamaño Carta</span>
                                </button>
                            </div>
                        </section>

                        {tipoEnvio === 'carnet_pdf' && (
                            <section className="space-y-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black tracking-widest text-text-muted uppercase px-1">FORMATO DEL CARNET</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'colgante', label: 'Colgante' },
                                            { id: 'credencial', label: 'Credencial' },
                                            { id: 'ticket', label: 'Ticket' },
                                            { id: 'cartera', label: 'Cartera' }
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setFormato(f.id)}
                                                className={cn(
                                                    "flex items-center justify-between px-4 h-10 rounded-xl border transition-all",
                                                    formato === f.id ? "bg-primary/10 border-primary text-primary" : "bg-bg-app/50 border-text-main/10 text-text-muted hover:border-text-main/20"
                                                )}
                                            >
                                                <span className="text-[10px] font-black uppercase">{f.label}</span>
                                                {formato === f.id && <CheckCircle2 size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black tracking-widest text-text-muted uppercase px-1">ESTILO VISUAL</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {PRESETS_COLOR.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setPresetId(p.id)}
                                                className={cn(
                                                    "group relative h-10 rounded-xl border flex items-center justify-center transition-all overflow-hidden",
                                                    presetId === p.id ? "border-text-main ring-2 ring-text-main/20" : "border-text-main/10 hover:border-text-main/30"
                                                )}
                                                style={{ backgroundColor: p.fondo }}
                                            >
                                                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: p.primario }} />
                                                <span className="relative text-[9px] font-black uppercase tracking-tighter" style={{ color: p.primario }}>{p.nombre}</span>
                                                {presetId === p.id && (
                                                    <div className="absolute top-1 right-1">
                                                        <CheckCircle2 size={8} className="text-text-main" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-text-main/5">
                    <Boton variant="ghost" type="button" onClick={onClose} disabled={enviando}>
                        CANCELAR
                    </Boton>
                    <Boton type="submit" isLoading={enviando} className="bg-primary text-bg-app px-10 h-12 shadow-tactica">
                        {pase ? 'ENVIAR AHORA' : 'CONFIRMAR Y ENVIAR AL COMANDO'}
                    </Boton>
                </div>
            </form>
        </Modal>
    );
};


const ModalListaPases = ({ isOpen, onClose, lote, zonas }) => {
    const [pases, setPases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [paseEdicion, setPaseEdicion] = useState(null);
    const [paseQR, setPaseQR] = useState(null); 
    const [paseParaEmail, setPaseParaEmail] = useState(null);

    const fetchPases = useCallback(async () => {
        if (!lote?.id) return;
        setLoading(true);
        try {
            const res = await api.get(`/pases/lotes/${lote.id}/pases`);
            setPases(res.data);
        } catch (e) {
            toast.error('Error al cargar pases individuales');
        } finally {
            setLoading(false);
        }
    }, [lote?.id]);

    useEffect(() => { if (isOpen) fetchPases(); }, [isOpen, fetchPases]);

    const handleClose = () => { setPaseQR(null); onClose(); };

    const filtrados = useMemo(() => {
        if (!busqueda) return pases;
        const q = busqueda.toLowerCase();
        return pases.filter(p => 
            p.nombre_portador?.toLowerCase().includes(q) ||
            p.cedula_portador?.toLowerCase().includes(q) ||
            p.vehiculo_placa?.toLowerCase().includes(q) ||
            p.serial_legible?.toLowerCase().includes(q)
        );
    }, [pases, busqueda]);

    const handleCompartirWhatsApp = (pase) => {
        setPaseQR(pase); 
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={handleClose} title={`GESTIÓN DE PASES: ${lote?.nombre_evento}`} className="max-w-3xl">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Input 
                                placeholder="BUSCAR POR NOMBRE, CÉDULA O PLACA..." 
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="pl-10"
                            />
                            <LayoutGrid size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted opacity-70" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="h-16 w-full animate-pulse bg-bg-app/50 rounded-xl border border-text-main/10" />
                            ))
                        ) : filtrados.length > 0 ? (
                            filtrados.map(pase => (
                                <PaseRow 
                                    key={pase.id} 
                                    pase={pase} 
                                    zonas={zonas} 
                                    onCompartir={handleCompartirWhatsApp}
                                    onVerQR={setPaseQR}
                                    onEditar={setPaseEdicion}
                                    onEmail={(p) => setPaseParaEmail(p)}
                                />
                            ))
                        ) : (
                            <div className="text-center py-10 opacity-30 italic text-sm">
                                No se encontraron pases que coincidan...
                            </div>
                        )}
                    </div>
                </div>

                <ModalEditarPase 
                    isOpen={!!paseEdicion} 
                    onClose={() => setPaseEdicion(null)} 
                    pase={paseEdicion} 
                    onRefresh={fetchPases}
                />

                <ModalEnvioCorreosMasivos 
                    isOpen={!!paseParaEmail}
                    onClose={() => {
                        setPaseParaEmail(null);
                        fetchPases(); // Recargar para ver el nuevo estado
                    }}
                    lote={lote}
                    pase={paseParaEmail}
                />
            </Modal>

            <ModalVerQR
                pase={paseQR}
                lote={lote}
                isOpen={!!paseQR}
                onClose={() => setPaseQR(null)}
            />
        </>
    );
};

const TacticalKPIs = ({ lotes }) => {
    const stats = useMemo(() => {
        const totalPases = lotes.reduce((acc, l) => acc + (l.cantidad_pases || 0), 0);
        const usados = lotes.reduce((acc, l) => acc + (l.pases_usados || 0), 0);
        const activos = lotes.filter(l => new Date(l.fecha_fin) >= new Date()).length;
        const eficiencia = totalPases > 0 ? Math.round((usados / totalPases) * 100) : 0;
        
        return [
            { label: 'Lotes Activos', val: activos, icon: PackageOpen, color: 'text-primary', sub: 'Paquetes vigentes' },
            { label: 'Pases Totales', val: totalPases.toLocaleString(), icon: Ticket, color: 'text-warning', sub: 'Generados globalmente' },
            { label: 'Accesos Usados', val: usados.toLocaleString(), icon: UserCheck, color: 'text-success', sub: 'Registros en alcabala' },
            { label: 'Eficiencia', val: `${eficiencia}%`, icon: Shield, color: 'text-sky-400', sub: 'Uso de cupos' },
        ];
    }, [lotes]);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s, i) => (
                <div key={i} className="p-4 bg-bg-card border border-text-main/10 rounded-2xl flex items-center gap-4 group hover:bg-bg-high transition-all border-b-2 border-b-transparent hover:border-b-primary/50">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-bg-app border border-text-main/10 shadow-inner", s.color)}>
                        <s.icon size={22} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-text-main leading-tight">{s.val}</div>
                        <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">{s.label}</div>
                        <div className="text-[8px] text-text-muted opacity-40 uppercase font-bold mt-0.5">{s.sub}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const LoteCardV2 = ({ lote, zonas, tiposCustom, onRefresh, onVerPases, onEliminar, onDifundir }) => {
    const [generando, setGenerando] = useState(false);
    const [progreso, setProgreso] = useState(0);
    const [modalExportOpen, setModalExportOpen] = useState(false);

    const info = TIPO_INFO[lote.tipo_pase] || TIPO_INFO.general;
    const Icon = info.icon;

    const handleGenerarZip = async () => {
        setGenerando(true);
        setProgreso(0);
        try {
            await pasesService.generarZip(lote.id);
            toast.success('Generación de QRs iniciada');
            const total = lote.cantidad_pases || 1;
            const intervalo = setInterval(async () => {
                try {
                    const res = await api.get(`/pases/lotes/${lote.id}/pases`);
                    const generados = Array.isArray(res.data) ? res.data.length : 0;
                    const pct = Math.min(100, Math.round((generados / total) * 100));
                    setProgreso(pct);
                    if (pct >= 100) {
                        clearInterval(intervalo);
                        setGenerando(false);
                    }
                } catch { }
            }, 1800);
            setTimeout(() => { clearInterval(intervalo); setGenerando(false); }, 180_000);
        } catch (e) {
            toast.error('Error al generar QRs');
            setGenerando(false);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 p-3 bg-bg-card border border-text-main/10 rounded-2xl group hover:border-primary/20 hover:bg-bg-high/60 transition-all">
            
            <div className="flex items-center justify-between gap-3 w-full xl:w-auto xl:flex-1">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl border border-text-main/5 shadow-inner shrink-0", info.bg)}>
                        <Icon className={info.color} size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-black text-text-main uppercase leading-tight truncate">{lote.nombre_evento}</h3>
                            {lote.tipo_acceso && lote.tipo_acceso !== 'general' && badgeTipo(lote.tipo_acceso, lote.tipo_custom_label)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono text-text-muted font-bold bg-bg-low/40 px-1.5 py-0.5 rounded border border-text-main/10">
                                {lote.codigo_serial}
                            </span>
                            <div className="flex items-center gap-3 text-text-muted text-[9px] font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1"><Calendar size={10} className="opacity-40" /> {new Date(lote.fecha_inicio).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><Clock size={10} className="opacity-40" /> Vence {new Date(lote.fecha_fin).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 px-3 border-l border-text-main/10 shrink-0">
                    <div className="text-center">
                        <div className="text-sm font-black text-text-main leading-none">{lote.cantidad_pases}</div>
                        <div className="text-[7px] font-black text-text-muted uppercase">Pases</div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-black text-success leading-none">{lote.pases_usados ?? 0}</div>
                        <div className="text-[7px] font-black text-text-muted uppercase">Usados</div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto pt-2 xl:pt-0 border-t xl:border-t-0 xl:border-l border-text-main/5 xl:pl-4">
                <div className="flex-1 xl:w-24 shrink-0 space-y-1">
                    <div className="flex justify-between items-center text-[7px] font-black tracking-widest uppercase mb-1">
                        <span className="text-text-muted">Estado</span>
                        <span className={lote.zip_generado || progreso >= 100 ? 'text-success' : generando ? 'text-primary' : 'text-warning'}>
                            {lote.zip_generado || progreso >= 100 ? 'LISTO' : generando ? `${progreso}%` : 'PENDIENTE'}
                        </span>
                    </div>
                    <div className="h-1 w-full bg-bg-app/50 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", lote.zip_generado || progreso >= 100 ? 'bg-success' : generando ? 'bg-primary' : 'bg-bg-low/20')} style={{ width: lote.zip_generado || progreso >= 100 ? '100%' : generando ? `${progreso}%` : '0%' }} />
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {lote.zip_generado || progreso >= 100 ? (
                        <>
                            <button 
                                onClick={() => setModalExportOpen(true)}
                                className="h-8 px-3 bg-success/15 hover:bg-success/25 border border-success/20 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                            >
                                <Download size={13} className="text-success" />
                                <span className="text-[9px] font-black text-success uppercase">ZIP</span>
                            </button>
                            {modalExportOpen && (
                                <ModalExportarLote 
                                    isOpen={modalExportOpen} 
                                    onClose={() => setModalExportOpen(false)} 
                                    lote={lote} 
                                />
                            )}
                        </>
                    ) : (
                        <Boton size="sm" onClick={handleGenerarZip} isLoading={generando} disabled={generando} className="h-8 px-3">
                            <QrCode size={13} /> <span className="hidden sm:inline">GENERAR</span>
                        </Boton>
                    )}
                    <button 
                        onClick={() => onDifundir(lote)}
                        className="h-8 px-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-xl flex items-center gap-2 transition-all"
                        title="Difundir Lote por Correo"
                    >
                        <Mail size={13} />
                        <span className="text-[9px] font-black uppercase hidden sm:inline">DIFUNDIR</span>
                    </button>
                    <Boton variant="ghost" size="sm" onClick={() => onVerPases(lote)} className="h-8 px-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-2 text-primary hover:bg-primary/20">
                        <Users size={13} /> <span className="text-[9px] font-black uppercase hidden sm:inline">GESTIONAR</span>
                        <ChevronRight className="sm:hidden" size={13} />
                    </Boton>
                    <button 
                        onClick={() => onEliminar(lote)}
                        className="h-8 w-8 bg-danger/10 hover:bg-danger/20 border border-danger/20 rounded-xl flex items-center justify-center transition-all text-danger"
                        title="Eliminar Lote Permanentemente"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
};


const TIPOS_PASE_OPTIONS = [
    { id: 'simple', label: 'Simple', icon: Ticket, desc: 'Sin datos previos' },
    { id: 'identificado', label: 'Identificado', icon: UserCheck, desc: 'Carga vía Excel' },
    { id: 'portal', label: 'Portal', icon: ExternalLink, desc: 'Auto-registro' },
];

const TIPOS_ACCESO_BASE = [
    { id: 'general', label: 'Público General', icon: Users },
    { id: 'staff', label: 'Staff / Apoyo', icon: Shield },
    { id: 'produccion', label: 'Productores', icon: LayoutGrid },
    { id: 'logistica', label: 'Logística', icon: Car },
    { id: 'vip', label: 'Invitados VIP', icon: Tag },
];


const ModalNuevoLote = ({ isOpen, onClose, zonas, tiposCustom, onCreated }) => {
    const { user } = useAuthStore();
    const [form, setForm] = useState({
        nombre_evento: '',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
        cantidad_pases: 10,
        tipo_pase: 'simple',
        tipo_acceso: 'general',
        tipo_acceso_custom_id: null,
        multi_vehiculo: false,
        max_vehiculos: 1,
        zona_asignada_id: null,
        puesto_asignado_id: null,
        max_accesos_por_pase: 1,
        max_accesos_ilimitados: false,
    });
    const [guardando, setGuardando] = useState(false);
    const [excelPases, setExcelPases] = useState(null);
    
    const [validacion, setValidacion] = useState(null);
    const [validando, setValidando] = useState(false);

    const OPCION_GENERAL = { id: 'general', label: 'Público General', icon: Users, color: null };
    const opcionesAcceso = useMemo(() => {
        const customs = tiposCustom
            .filter(tc => tc.activo !== false)
            .map(tc => ({
                id: tc.id,
                label: tc.nombre,
                icon: Tag,
                color: tc.color_hex || tc.color,
                isCustom: true
            }));
        return [OPCION_GENERAL, ...customs];
    }, [tiposCustom]);

    useEffect(() => {
        const validarCapacidad = async () => {
            if (!form.fecha_inicio || !form.fecha_fin || form.cantidad_pases < 1) {
                setValidacion(null);
                return;
            }

            setValidando(true);
            try {
                const resultado = await pasesService.validarCapacidad({
                    zona_id: form.zona_asignada_id,
                    tipo_acceso: form.tipo_acceso_custom_id ? 'custom' : form.tipo_acceso,
                    tipo_acceso_custom_id: form.tipo_acceso_custom_id,
                    cantidad: form.cantidad_pases,
                    inicio: form.fecha_inicio,
                    fin: form.fecha_fin
                });
                setValidacion(resultado);
            } catch (error) {
                console.error("Error en validación inteligente:", error);
            } finally {
                setValidando(false);
            }
        };

        const timer = setTimeout(validarCapacidad, 600);
        return () => clearTimeout(timer);
    }, [form.zona_asignada_id, form.fecha_inicio, form.fecha_fin, form.cantidad_pases, form.tipo_acceso, form.tipo_acceso_custom_id]);

    const tieneAlertas = validacion?.alertas?.length > 0;
    const bloqueado = validacion?.puede_crear === false;
    const alertasNivel1 = validacion?.alertas?.filter(a => a.nivel === 1) || [];
    const alertasNivel2 = validacion?.alertas?.filter(a => a.nivel === 2) || [];
    const alertasNivel3 = validacion?.alertas?.filter(a => a.nivel === 3) || [];

    const handleAplicarSugerencia = (sugerencia) => {
        if (sugerencia.accion === 'ajustar_cantidad' && sugerencia.cantidad_sugerida !== undefined) {
            setForm(prev => ({ ...prev, cantidad_pases: sugerencia.cantidad_sugerida }));
        } else if (sugerencia.accion === 'tomar_general_zona' && sugerencia.cantidad_sugerida !== undefined) {
            setForm(prev => ({ ...prev, cantidad_pases: sugerencia.cantidad_sugerida }));
        } else if (sugerencia.accion === 'usar_otra_zona' || sugerencia.accion === 'distribuir_otra_zona') {
            setForm(prev => ({ ...prev, zona_asignada_id: sugerencia.zona_id }));
            toast.success(`Zona cambiada a: ${sugerencia.zona_nombre}`);
        }
    };
    
    // ── Validación en Tiempo Real (3 niveles) ────────────────────────────
    useEffect(() => {
        const validarCapacidad = async () => {
            if (!form.fecha_inicio || !form.fecha_fin || form.cantidad_pases < 1) {
                setValidacion(null);
                return;
            }
            setValidando(true);
            try {
                const res = await pasesService.validarCapacidad({
                    zona_id: form.zona_asignada_id,
                    tipo_acceso: form.tipo_acceso,
                    tipo_acceso_custom_id: form.tipo_acceso_custom_id,
                    cantidad: form.cantidad_pases,
                    inicio: form.fecha_inicio,
                    fin: form.fecha_fin
                });
                setValidacion(res);
            } catch (e) {
                console.error("Error en validación táctica:", e);
            } finally {
                setValidando(false);
            }
        };

        const timer = setTimeout(validarCapacidad, 600);
        return () => clearTimeout(timer);
    }, [form.zona_asignada_id, form.fecha_inicio, form.fecha_fin, form.cantidad_pases, form.tipo_acceso, form.tipo_acceso_custom_id]);

    const handleDescargarPlantilla = () => {
        const headers = [
            "NOMBRE COMPLETO", "CEDULA", "EMAIL", "TELEFONO", 
            "PLACA V1", "MARCA V1", "MODELO V1", "COLOR V1",
            "PLACA V2", "MARCA V2", "MODELO V2", "COLOR V2",
            "PLACA V3", "MARCA V3", "MODELO V3", "COLOR V3",
            "PLACA V4", "MARCA V4", "MODELO V4", "COLOR V4"
        ];
        const example = [
            "EJ: JUAN PEREZ", "12345678", "juan@correo.com", "04120000000", 
            "ABC-123", "TOYOTA", "COROLLA", "BLANCO",
            "", "", "", "",
            "", "", "", "",
            "", "", "", ""
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, example]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PLANTILLA_PASES");
        XLSX.writeFile(wb, `PLANTILLA_PASES_${form.nombre_evento || 'EV'}.xlsx`);
    };

    const handleCargarExcelFrontend = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                const dataRows = rows.slice(1).filter(r => r.some(v => v));

                if (dataRows.length !== form.cantidad_pases) {
                    toast.error(`ERROR TÁCTICO: El Excel tiene ${dataRows.length} registros, pero solicitaste ${form.cantidad_pases} pases.`);
                    e.target.value = '';
                    setExcelPases(null);
                    return;
                }
                setExcelPases(dataRows);
                toast.success('Excel validado correctamente');
            } catch (err) {
                toast.error('Error al procesar el Excel');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSubmit = async () => {
        if (!form.nombre_evento.trim() || !form.fecha_fin) {
            toast.error('Completa los campos requeridos');
            return;
        }
        if (form.tipo_pase === 'identificado' && !excelPases) {
            toast.error('Debes cargar el Excel con los datos de los pases');
            return;
        }

        if (bloqueado) {
            const msg = alertasNivel3[0]?.mensaje || 'Capacidad total de la entidad superada';
            toast.error(`🚨 BLOQUEADO: ${msg}`, { duration: 6000 });
            return;
        }

        setGuardando(true);
        try {
            const cleanForm = { ...form };
            ['zona_asignada_id', 'puesto_asignado_id', 'tipo_acceso_custom_id'].forEach(key => {
                if (cleanForm[key] === '') cleanForm[key] = null;
            });

            const payload = {
                ...cleanForm,
                entidad_id: user?.entidad_id,
                excel_data: excelPases, 
                distribucion_automatica: tieneAlertas,
                
                zona_id: cleanForm.zona_asignada_id,
                puesto_id: cleanForm.puesto_asignado_id,
                max_accesos_por_pase: cleanForm.max_accesos_ilimitados ? null : cleanForm.max_accesos_por_pase,
                max_vehiculos: cleanForm.multi_vehiculo ? cleanForm.max_vehiculos : 1
            };
            await pasesService.crearLote(payload);
            toast.success('Lote de pases creado con éxito');
            onCreated?.();
            onClose();
        } catch (e) {
            const errorData = e.response?.data?.detail;
            if (Array.isArray(errorData)) {
                const msg = errorData.map(err => `${err.loc[err.loc.length-1]}: ${err.msg}`).join(', ');
                toast.error(`ERROR TÁCTICO: ${msg.toUpperCase()}`);
            } else {
                toast.error(errorData || 'Error al crear lote');
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="NUEVO LOTE DE PASES" className="max-w-3xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                
                <div className="space-y-6">
                <div>
                    <label className="text-[10px] font-black text-text-muted/60 uppercase tracking-widest block mb-3">1. Selecciona el Tipo de Pase</label>
                    <div className="grid grid-cols-3 gap-2">
                        {TIPOS_PASE_OPTIONS.map(t => {
                            const Icon = t.icon;
                            const sel = form.tipo_pase === t.id;
                            return (
                                <button key={t.id} onClick={() => setForm({ ...form, tipo_pase: t.id })}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                                        sel ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(78,222,163,0.1)]' : 'bg-bg-app/50 border-text-main/10 text-text-muted hover:border-text-main/20'
                                    )}>
                                    <Icon size={18} />
                                    <span className="text-[10px] font-black uppercase">{t.label}</span>
                                    <span className="text-[7px] opacity-60 font-bold">{t.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Clasificación del portador - SelectTactivo para ahorro de espacio */}
                <div className="pt-2">
                    <SelectTactivo 
                        label="2. Categoría de Acceso"
                        icon={<Tag size={12} className="text-primary" />}
                        placeholder="Seleccionar categoría..."
                        options={opcionesAcceso.map(t => ({ 
                            value: t.id,
                            label: t.label.toUpperCase()
                        }))}
                        value={(() => {
                            // Si es 'general', mostrar la opción fija
                            if (form.tipo_acceso === 'general' || !form.tipo_acceso_custom_id) {
                                return { value: 'general', label: 'PÚBLICO GENERAL' };
                            }
                            // Si es custom, buscar por UUID
                            const opt = opcionesAcceso.find(t => t.id === form.tipo_acceso_custom_id);
                            return opt ? { value: opt.id, label: opt.label.toUpperCase() } : { value: 'general', label: 'PÚBLICO GENERAL' };
                        })()}
                        onChange={(opt) => {
                            if (!opt || opt.value === 'general') {
                                // Público General: tipo_acceso='general', sin ID custom
                                setForm({ ...form, tipo_acceso: 'general', tipo_acceso_custom_id: null });
                            } else {
                                // Tipo custom: tipo_acceso='custom' + UUID
                                setForm({ ...form, tipo_acceso: 'custom', tipo_acceso_custom_id: opt.value });
                            }
                        }}
                        isSearchable
                    />
                </div>

                {/* Datos del lote */}
                <div className="space-y-4 pt-2 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <Input label="Nombre del Evento / Lote *"
                                value={form.nombre_evento}
                                onChange={e => setForm({ ...form, nombre_evento: e.target.value.toUpperCase() })}
                                placeholder="EJ: CONCIERTO ANIVERSARIO 2026" />
                        </div>
                        <Input label="Fecha inicio" type="date" value={form.fecha_inicio}
                            onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
                        <Input label="Fecha fin *" type="date" value={form.fecha_fin}
                            onChange={e => setForm({ ...form, fecha_fin: e.target.value })} />
                        <div className="space-y-1">
                            <Input label="Cantidad de pases" type="number" min="1" value={form.cantidad_pases}
                                onChange={e => {
                                    const v = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                                    setForm({ ...form, cantidad_pases: v === '' ? '' : Math.max(1, v) });
                                }} />
                            {validando && (
                                <p className="text-[8px] text-primary uppercase font-bold px-1 flex items-center gap-1">
                                    <Loader2 size={10} className="animate-spin" /> Validando capacidad...
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Input 
                                label="Máx. accesos por pase" 
                                type="number" 
                                value={form.max_accesos_ilimitados ? '' : form.max_accesos_por_pase}
                                disabled={form.max_accesos_ilimitados}
                                onChange={e => {
                                    const valStr = e.target.value;
                                    setForm({ ...form, max_accesos_por_pase: valStr === '' ? '' : parseInt(valStr) || 0 });
                                }} 
                            />
                            <label className="flex items-center gap-2 px-1 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={form.max_accesos_ilimitados}
                                    onChange={(e) => setForm({ ...form, max_accesos_ilimitados: e.target.checked })}
                                    className="w-3 h-3 rounded border-text-main/20 bg-bg-app/50 text-primary focus:ring-offset-0 focus:ring-primary"
                                />
                                <span className="text-[8px] font-black uppercase text-text-muted group-hover:text-primary transition-colors">Accesos Ilimitados</span>
                            </label>
                        </div>

                    </div>
                </div>
                </div>

                {/* ══ COLUMNA DERECHA ══ */}
                <div className="space-y-6 flex flex-col h-full">
                    {/* Asignación táctica zona/puesto */}
                    <div className="space-y-4">
                        <SelectTactivo 
                            label="Zona de Estacionamiento"
                            icon={<MapPin size={10} className="text-primary" />}
                            placeholder="Buscar zona física..."
                            options={zonas.map(z => ({ 
                                value: z.zona_id, 
                                label: z.zona_nombre?.toUpperCase() || `ZONA ${z.zona_id.slice(-4)}`
                            }))}
                            value={zonas.find(z => z.zona_id === form.zona_asignada_id) ? {
                                value: form.zona_asignada_id,
                                label: zonas.find(z => z.zona_id === form.zona_asignada_id)?.zona_nombre?.toUpperCase()
                            } : null}
                            onChange={(opt) => setForm({ ...form, zona_asignada_id: opt?.value || null })}
                            isClearable
                        />

                        {/* ══ Panel de Inteligencia Táctica — Validación en Tiempo Real ══ */}
                        {!validando && validacion && !tieneAlertas && form.fecha_fin && (
                            <div className="bg-success/5 border border-success/20 rounded-xl p-3 flex items-center gap-2.5 animate-in fade-in-50 duration-300">
                                <CheckCircle2 size={16} className="text-success shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-success uppercase tracking-widest">Capacidad Disponible</p>
                                    <p className="text-[8px] text-text-muted font-bold mt-0.5">
                                        {validacion.resumen.disponible_total_entidad} puestos libres en la entidad
                                        {validacion.resumen.cupo_zona_disponible !== null && ` · ${validacion.resumen.cupo_zona_disponible} en esta zona`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!validando && tieneAlertas && (
                            <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                {/* ── Alertas Nivel 1: Categoría ── */}
                                {alertasNivel1.map((alerta, i) => (
                                    <div key={`n1-${i}`} className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-3.5 space-y-3">
                                        <div className="flex gap-2.5">
                                            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">N1 · {alerta.titulo}</span>
                                                </div>
                                                <p className="text-[9px] text-text-muted font-bold mt-1 leading-relaxed">{alerta.mensaje}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-[8px] text-text-muted">Reservados: <span className="text-white font-black">{alerta.cupo_reservado}</span></span>
                                                    <span className="text-[8px] text-text-muted">En uso: <span className="text-amber-400 font-black">{alerta.en_uso}</span></span>
                                                    <span className="text-[8px] text-text-muted">Libres: <span className="text-success font-black">{alerta.disponible}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        {alerta.sugerencias?.length > 0 && (
                                            <div className="space-y-1.5 pt-1">
                                                <p className="text-[7px] font-black text-primary/70 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Zap size={9} /> Soluciones sugeridas
                                                </p>
                                                {alerta.sugerencias.map((sug, j) => (
                                                    <button key={j} onClick={() => handleAplicarSugerencia(sug)}
                                                        className="w-full flex items-center justify-between bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 p-2.5 rounded-lg transition-all group cursor-pointer">
                                                        <span className="text-[9px] font-bold text-text-main group-hover:text-primary transition-colors">{sug.mensaje}</span>
                                                        <ArrowRight size={12} className="text-text-muted group-hover:text-primary shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* ── Alertas Nivel 2: Zona ── */}
                                {alertasNivel2.map((alerta, i) => (
                                    <div key={`n2-${i}`} className="bg-orange-500/8 border border-orange-500/25 rounded-xl p-3.5 space-y-3">
                                        <div className="flex gap-2.5">
                                            <ShieldAlert size={16} className="text-orange-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">N2 · {alerta.titulo}</span>
                                                <p className="text-[9px] text-text-muted font-bold mt-1 leading-relaxed">{alerta.mensaje}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-[8px] text-text-muted">Asignados: <span className="text-white font-black">{alerta.cupo_total}</span></span>
                                                    <span className="text-[8px] text-text-muted">Comprometidos: <span className="text-orange-400 font-black">{alerta.en_uso}</span></span>
                                                    <span className="text-[8px] text-text-muted">Libres: <span className="text-success font-black">{alerta.disponible}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        {alerta.sugerencias?.length > 0 && (
                                            <div className="space-y-1.5 pt-1">
                                                <p className="text-[7px] font-black text-primary/70 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Zap size={9} /> Soluciones sugeridas
                                                </p>
                                                {alerta.sugerencias.map((sug, j) => (
                                                    <button key={j} onClick={() => handleAplicarSugerencia(sug)}
                                                        className="w-full flex items-center justify-between bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 p-2.5 rounded-lg transition-all group cursor-pointer">
                                                        <span className="text-[9px] font-bold text-text-main group-hover:text-primary transition-colors">{sug.mensaje}</span>
                                                        <ArrowRight size={12} className="text-text-muted group-hover:text-primary shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* ── Alertas Nivel 3: Bloqueo Total ── */}
                                {alertasNivel3.map((alerta, i) => (
                                    <div key={`n3-${i}`} className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-4 space-y-3 animate-in zoom-in-95">
                                        <div className="flex gap-2.5">
                                            <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">🚨 {alerta.titulo}</span>
                                                <p className="text-[9px] text-text-muted font-bold mt-1 leading-relaxed">{alerta.mensaje}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-[8px] text-text-muted">Total: <span className="text-white font-black">{alerta.cupo_total}</span></span>
                                                    <span className="text-[8px] text-text-muted">En uso: <span className="text-red-400 font-black">{alerta.en_uso}</span></span>
                                                    <span className="text-[8px] text-text-muted">Máximo: <span className="text-success font-black">{alerta.disponible}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        {alerta.sugerencias?.length > 0 && (
                                            <div className="space-y-1.5 pt-1">
                                                {alerta.sugerencias.map((sug, j) => (
                                                    <button key={j} onClick={() => handleAplicarSugerencia(sug)}
                                                        className="w-full flex items-center justify-between bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 p-2.5 rounded-lg transition-all group cursor-pointer">
                                                        <span className="text-[9px] font-bold text-red-300 group-hover:text-white transition-colors">{sug.mensaje}</span>
                                                        <ArrowRight size={12} className="text-red-400 shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Resumen compacto */}
                                {validacion?.resumen && (
                                    <div className="bg-bg-app/30 border border-text-main/10 rounded-lg p-2.5 flex items-center justify-between">
                                        <span className="text-[7px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                                            <Info size={9} /> Capacidad Entidad
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[8px] text-text-muted">Total: <span className="text-white font-black">{validacion.resumen.cupo_total_entidad}</span></span>
                                            <span className="text-[8px] text-text-muted">Libre: <span className={cn("font-black", validacion.resumen.disponible_total_entidad > 0 ? 'text-success' : 'text-red-400')}>{validacion.resumen.disponible_total_entidad}</span></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Sección Excel para Identificados y Portal */}
                    {(form.tipo_pase === 'identificado' || form.tipo_pase === 'portal') && (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-4 animate-in slide-in-from-bottom-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet size={16} className="text-primary" />
                                    <span className="text-[10px] font-black text-text-main uppercase">Carga de Integrantes</span>
                                </div>
                                <button 
                                    onClick={handleDescargarPlantilla}
                                    className="text-[9px] font-black text-primary hover:underline uppercase flex items-center gap-1.5"
                                >
                                    <Download size={12} /> Plantilla
                                </button>
                            </div>
                            
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls"
                                    onChange={handleCargarExcelFrontend}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                />
                                <div className={cn(
                                    "p-6 border-2 border-dashed rounded-xl flex flex-col items-center gap-2 transition-all",
                                    excelPases ? 'bg-success/5 border-success/30 text-success' : 'bg-bg-app/50 border-text-main/10 text-text-muted group-hover:border-primary/40'
                                )}>
                                    {excelPases ? <CheckCircle2 size={24} /> : <Upload size={24} />}
                                    <span className="text-[10px] font-black uppercase">
                                        {excelPases ? `${excelPases.length} REGISTROS CARGADOS` : 'Haga clic o arrastre el Excel aquí'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Multi-vehículo */}
                    <button onClick={() => setForm({ ...form, multi_vehiculo: !form.multi_vehiculo })}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-bg-app/50 border border-text-main/10 hover:bg-bg-app/80 transition-all">
                        <div className="flex items-center gap-2">
                            <Car size={15} className="text-text-muted" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-text-main">Acceso Multi-Vehículo</span>
                        </div>
                        <span className={form.multi_vehiculo ? "text-success text-[10px] font-black" : "text-text-muted/40 text-[10px] font-black"}>
                            {form.multi_vehiculo ? "ACTIVO" : "NO"}
                        </span>
                    </button>

                    {form.multi_vehiculo && (
                        <div>
                            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-2">
                                Máx. vehículos por pase
                            </label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map(n => (
                                    <button key={n} onClick={() => setForm({ ...form, max_vehiculos: n })}
                                        className={cn("flex-1 h-10 rounded-xl border-2 text-sm font-black transition-all",
                                            form.max_vehiculos === n ? 'bg-primary/10 border-primary text-primary' : 'bg-bg-app/50 border-text-main/10 text-text-muted')}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Botones de acción al final de la columna derecha */}
                    <div className="flex items-center gap-3 pt-6 mt-auto border-t border-text-main/10">
                        <Boton variant="ghost" className="flex-1 h-14 bg-bg-app/50 border-text-main/10 hover:bg-bg-app/80 text-[11px] font-black uppercase rounded-xl transition-all" onClick={onClose}>Cancelar</Boton>
                        <Boton onClick={handleSubmit} disabled={guardando || bloqueado}
                            className={cn(
                                "flex-[2] h-14 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all",
                                bloqueado 
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed opacity-70' 
                                    : 'bg-primary text-bg-app shadow-tactica hover:scale-[1.02]'
                            )}>
                            {guardando ? <RefreshCw size={16} className="animate-spin" /> : bloqueado ? <><XCircle size={15} /> BLOQUEADO</> : <><Plus size={15} /> Crear Lote</>}
                        </Boton>
                    </div>
                </div>

            </div>
        </Modal>
    );
};

// ──── Página Principal ────────────────────────────────────────────────────────

export default function EventosV2() {
    const { user } = useAuthStore();
    const [solicitudes, setSolicitudes] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [zonas, setZonas] = useState([]);
    const [tiposCustom, setTiposCustom] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showSolicitudModal, setShowSolicitudModal] = useState(false);
    const [loteDetalle, setLoteDetalle] = useState(null); // Nuevo estado para drill-down
    const [loteEliminar, setLoteEliminar] = useState(null);
    const [loteParaEmail, setLoteParaEmail] = useState(null);
    const [eliminando, setEliminando] = useState(false);
    const [formSolicitud, setFormSolicitud] = useState({
        nombre_evento: '', fecha_evento: '', cantidad_solicitada: 10, motivo: '', tipo_pase: 'simple', entidad_id: user?.entidad_id
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        
        const fetchSafe = async (fn, fallback = []) => {
            try {
                const res = await fn();
                return res;
            } catch (err) {
                console.warn("Fallo táctico en carga (Eventos):", err);
                return fallback;
            }
        };

        try {
            const [sData, lData, asigData, tData] = await Promise.all([
                fetchSafe(() => eventosService.getSolicitudes()),
                fetchSafe(() => pasesService.listarLotes()),
                fetchSafe(() => zonaService.getMisAsignaciones(), []),
                fetchSafe(() => zonaService.listarTiposAcceso(user?.entidad_id), []),
            ]);

            setSolicitudes(sData);
            setLotes(lData);
            setZonas(asigData);
            setTiposCustom(tData);
        } catch (e) {
            console.error("Error crítico en sincronización de eventos:", e);
        } finally {
            setLoading(false);
        }
    }, [user?.entidad_id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEliminarLote = async () => {
        if (!loteEliminar) return;
        setEliminando(true);
        try {
            await pasesService.eliminarLote(loteEliminar.id);
            toast.success('Lote eliminado permanentemente');
            setLoteEliminar(null);
            fetchData();
        } catch (e) {
            toast.error('Error al ejecutar protocolo de eliminación');
        } finally {
            setEliminando(false);
        }
    };

    const handleSolicitud = async (e) => {
        e.preventDefault();
        try {
            await eventosService.crearSolicitud({ ...formSolicitud, entidad_id: user?.entidad_id });
            toast.success('Protocolo enviado a Mando');
            setShowSolicitudModal(false);
            fetchData();
        } catch (e) {
            toast.error('Error al enviar solicitud');
        }
    };

    const pendientes = solicitudes.filter(s => s.estado === 'pendiente');

    return (
        <div className="p-4 space-y-6 pb-32 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* Cabecera Táctica */}
            <header className="relative overflow-hidden bg-bg-card/30 rounded-2xl border border-white/5 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Decoración de fondo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32" />
                
                {/* Bloque Izquierdo: Identidad */}
                <div className="relative flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-lg shadow-primary/5">
                        <Calendar className="text-primary" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-text-main uppercase tracking-tighter leading-none">
                            Eventos y Pases
                        </h1>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2 px-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
                            Gestión de Accesos Masivos — {user?.entidad_nombre}
                        </p>
                    </div>
                </div>

                {/* Bloque Derecho: Acciones */}
                <div className="relative flex items-center gap-2 w-full sm:w-auto">
                    <Boton 
                        onClick={() => setShowModal(true)} 
                        className="gap-2 h-12 px-6 bg-primary text-bg-app font-black uppercase tracking-widest text-[11px] shadow-tactica hover:scale-[1.02] transition-all whitespace-nowrap min-w-fit"
                    >
                        <PlusCircle size={18} /> 
                        Crear Nuevo Lote
                    </Boton>
                </div>
            </header>

            {/* Panel de Indicadores KPI */}
            {!loading && lotes.length > 0 && <TacticalKPIs lotes={lotes} />}

            {/* ERROR NO PARKING */}
            {zonas.length === 0 && !loading && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-3 text-warning">
                    <Shield className="shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider">Configuración de Estacionamiento Incompleta</p>
                        <p className="text-[10px] mt-1 font-bold opacity-80 leading-relaxed">
                            No puedes generar pases masivos en este momento. Debes tener asignaciones de estacionamiento activas. Si ya el Comando Central te asignó espacios, asegúrate de consolidar tu esquema de estacionamientos en el panel de Estacionamientos.
                        </p>
                    </div>
                </div>
            )}

            {/* Solicitudes Pendientes */}
            {pendientes.length > 0 && (
                <section className="space-y-3">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2 px-1">
                        <Clock size={11} className="text-warning" /> {pendientes.length} solicitud(es) en revisión
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pendientes.map(s => (
                            <Card key={s.id} className="bg-bg-card/40 border-warning/20 border-l-4 border-l-warning">
                                <CardContent className="p-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-text-main uppercase">{s.nombre_evento}</p>
                                        <p className="text-[9px] text-text-muted mt-0.5">{s.fecha_evento} · {s.cantidad_solicitada} pases</p>
                                    </div>
                                    <span className="text-[8px] font-black text-warning bg-warning/10 px-2.5 py-1.5 rounded-full border border-warning/20 uppercase">En Revisión</span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* Lotes de Pases */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                        <LayoutGrid size={11} className="text-primary" /> {lotes.length} lotes activos
                    </p>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowSolicitudModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-[9px] font-black uppercase border border-warning/10 hover:bg-warning/20 transition-all"
                        >
                            <Clock size={11} /> Solicitar Evento
                        </button>
                        <button onClick={fetchData} className="p-1.5 rounded-lg bg-bg-app/50 hover:bg-bg-app/80 transition-all">
                            <RefreshCw size={13} className={cn("text-text-muted", loading && 'animate-spin')} />
                        </button>
                    </div>
                </div>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array(3).fill(0).map((_, i) => <div key={i} className="h-52 rounded-2xl bg-bg-app/50 animate-pulse border border-text-main/10" />)}
                    </div>
                ) : lotes.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {lotes.map(lote => (
                            <LoteCardV2 
                                key={lote.id} 
                                lote={lote} 
                                zonas={zonas} 
                                tiposCustom={tiposCustom} 
                                onRefresh={fetchData} 
                                onVerPases={setLoteDetalle} 
                                onEliminar={setLoteEliminar}
                                onDifundir={setLoteParaEmail}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="relative group py-24 flex flex-col items-center gap-6 bg-bg-card/10 rounded-2xl border border-dashed border-white/10 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative w-20 h-20 bg-bg-app/50 rounded-2xl flex items-center justify-center border border-text-main/10 shadow-inner">
                            <PackageOpen className="text-text-muted/20" size={40} />
                        </div>
                        
                        <div className="relative text-center px-6 space-y-2">
                            <h3 className="text-text-main font-black uppercase tracking-[0.2em] text-sm">
                                Terminal de Pases Vacía
                            </h3>
                            <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto leading-relaxed opacity-60">
                                No se detectan lotes de acceso activos para {user?.entidad_nombre}. 
                                Utiliza el panel superior para iniciar un nuevo protocolo.
                            </p>
                        </div>

                        <Boton 
                            onClick={() => setShowModal(true)} 
                            variant="ghost"
                            className="relative mt-2 h-10 px-6 gap-2 text-[9px] font-black uppercase border-white/5 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                        >
                            <Plus size={14} /> Iniciar Primer Lote
                        </Boton>
                    </div>
                )}
            </section>

            {/* Modal crear lote v2 */}
            <ModalNuevoLote isOpen={showModal} onClose={() => setShowModal(false)} zonas={zonas} tiposCustom={tiposCustom} onCreated={fetchData} />

            {/* Modal Gestión de Pases Individuales */}
            <ModalListaPases 
                isOpen={!!loteDetalle} 
                onClose={() => setLoteDetalle(null)} 
                lote={loteDetalle} 
                zonas={zonas} 
            />

            {/* Modal de Confirmación de Eliminación Táctica */}
            <Modal 
                isOpen={!!loteEliminar} 
                onClose={() => !eliminando && setLoteEliminar(null)} 
                title="ALERTA DE SEGURIDAD"
                size="md"
            >
                <div className="text-center space-y-6 py-4">
                    <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center border border-danger/20 mx-auto animate-pulse">
                        <AlertTriangle size={40} className="text-danger" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-tight">¿Anular y Eliminar Lote?</h3>
                        <p className="text-xs text-text-muted leading-relaxed font-bold">
                            Esta acción es <span className="text-danger font-black uppercase underline">irreversible</span>. 
                            Se anularán todos los accesos del lote <span className="text-text-main font-mono bg-bg-app/50 px-1.5 rounded border border-text-main/10">{loteEliminar?.codigo_serial}</span> y se borrarán sus archivos de la nube.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Boton variant="ghost" className="flex-1" onClick={() => setLoteEliminar(null)} disabled={eliminando}>
                            CANCELAR
                        </Boton>
                        <Boton className="flex-1 bg-danger hover:bg-danger/80" onClick={handleEliminarLote} isLoading={eliminando}>
                            SÍ, ELIMINAR TODO
                        </Boton>
                    </div>
                </div>
            </Modal>

            {/* Modal solicitud evento */}
            <Modal isOpen={showSolicitudModal} onClose={() => setShowSolicitudModal(false)} title="NUEVA SOLICITUD FL-08">
                <form onSubmit={handleSolicitud} className="space-y-4">
                    <Input label="Nombre del evento *" value={formSolicitud.nombre_evento}
                        onChange={e => setFormSolicitud({ ...formSolicitud, nombre_evento: e.target.value.toUpperCase() })} required />
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Fecha programada *" type="date" value={formSolicitud.fecha_evento}
                            onChange={e => setFormSolicitud({ ...formSolicitud, fecha_evento: e.target.value })} required />
                        <Input label="Pases solicitados" type="number" value={formSolicitud.cantidad_solicitada}
                            onChange={e => setFormSolicitud({ ...formSolicitud, cantidad_solicitada: parseInt(e.target.value) })} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1.5">Justificación *</label>
                        <textarea required value={formSolicitud.motivo}
                            onChange={e => setFormSolicitud({ ...formSolicitud, motivo: e.target.value })}
                            rows={3} placeholder="Describe la finalidad del evento..."
                            className="w-full bg-bg-app/50 border border-text-main/10 rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:border-primary/50 outline-none resize-none placeholder:text-text-muted/20" />
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-white/5">
                        <Boton type="button" variant="ghost" className="flex-1" onClick={() => setShowSolicitudModal(false)}>Cancelar</Boton>
                        <Boton type="submit" className="flex-[2] bg-primary text-bg-app h-12 font-black uppercase">Enviar a Mando</Boton>
                    </div>
                </form>
            </Modal>

            {/* Modal Difusión de Correo Masivo */}
            <ModalEnvioCorreosMasivos
                isOpen={!!loteParaEmail}
                onClose={() => setLoteParaEmail(null)}
                lote={loteParaEmail}
            />
        </div>
    );
}
