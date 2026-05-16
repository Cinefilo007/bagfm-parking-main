import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Package, FileText, Settings, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Boton } from '../ui/Boton';
import { toast } from 'react-hot-toast';
import { pasesService } from '../../services/pasesService';
import PlantillaPreview from '../carnets/PlantillaPreview';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useAuthStore } from '../../store/auth.store';

// Helper de fuentes en base64 (CORS prevention)
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
    { id: 'navy', nombre: 'Navy', primario: '#60a5fa', fondo: '#0f172a', textoHeader: '#ffffff', textoNombre: '#e2e8f0' },
    { id: 'obsidian', nombre: 'Obsidian', primario: '#a855f7', fondo: '#000000', textoHeader: '#ffffff', textoNombre: '#e5e5e5' },
    { id: 'vip', nombre: 'VIP', primario: '#facc15', fondo: '#111111', textoHeader: '#000000', textoNombre: '#fef08a' },
    { id: 'clasico', nombre: 'Clásico', primario: '#3b82f6', fondo: '#ffffff', textoHeader: '#ffffff', textoNombre: '#1e293b' },
    { id: 'crimson', nombre: 'Crimson', primario: '#ef4444', fondo: '#450a0a', textoHeader: '#ffffff', textoNombre: '#fecaca' }
];

const PAPER_SIZES = {
    carta: { orientacion: 'portrait', width: 215.9, height: 279.4, name: 'Carta (Letter)' },
    a4: { orientacion: 'portrait', width: 210.0, height: 297.0, name: 'A4' },
    oficio: { orientacion: 'portrait', width: 215.9, height: 355.6, name: 'Oficio (Legal)' }
};

export default function ModalExportarLote({ isOpen, onClose, lote }) {
    const [step, setStep] = useState(1);
    const [tipoDescarga, setTipoDescarga] = useState('full'); // 'qr' or 'full'
    const [plantilla, setPlantilla] = useState('colgante');
    const [preset, setPreset] = useState('aegis');
    const [formato, setFormato] = useState('pdf'); // 'pdf' or 'zip'
    const [papel, setPapel] = useState('carta');
    
    const [procesando, setProcesando] = useState(false);
    const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
    const [paseActualIdx, setPaseActualIdx] = useState(-1);
    const [pasesMemoria, setPasesMemoria] = useState([]);
    const [fontCSSData, setFontCSSData] = useState(null);

    const hiddenPreviewRef = useRef(null);

    // Resetear al abrir
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setTipoDescarga('full');
            setProcesando(false);
            setProgreso({ actual: 0, total: 0 });
            setPaseActualIdx(-1);
            setPasesMemoria([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const iniciarProceso = async () => {
        if (tipoDescarga === 'excel') {
            onClose();
            try {
                await pasesService.descargarExcelLote(lote.id);
                toast.success('Listado Excel descargado correctamente');
            } catch (e) {
                toast.error('Error al generar el listado Excel');
            }
            return;
        }

        if (tipoDescarga === 'qr') {
            onClose();
            if (lote.zip_url) {
                window.open(lote.zip_url, '_blank');
                toast.success('Descarga de ZIP iniciada');
            } else {
                toast.error('Generación del ZIP aún no completada en el servidor');
            }
            return;
        }

        setProcesando(true);
        setStep(2); // Vista de progreso

        try {
            toast.loading('Obteniendo datos...', { id: 'lote-export' });
            
            // 1. Fetch de fuentes para que html-to-image no rompa por CORS
            const fontCSS = await preloadBase64Fonts();
            setFontCSSData(fontCSS);

            // 2. Fetch de Pases Reales
            const listado = await pasesService.listarPasesLote(lote.id);
            if (!listado || listado.length === 0) throw new Error('No hay pases vigentes en este paquete');
            
            setProgreso({ actual: 0, total: listado.length });
            setPasesMemoria(listado);
            toast.success('Datos obtenidos, iniciando renderizado.', { id: 'lote-export' });
            setPaseActualIdx(0);
        } catch (error) {
            toast.error(error.message || 'Error inicializando descarga', { id: 'lote-export' });
            setProcesando(false);
            setStep(1);
        }
    };

    // UseEffect que procesa pase por pase, dejando respirar a React
    useEffect(() => {
        if (!procesando || paseActualIdx < 0 || paseActualIdx >= pasesMemoria.length) return;

        const timer = setTimeout(async () => {
            const paseInfo = pasesMemoria[paseActualIdx];
            
            try {
                const domNode = hiddenPreviewRef.current;
                if (!domNode) throw new Error('DOM Node no encontrado');

                const dataUrl = await toPng(domNode, {
                    pixelRatio: 3,
                    width: domNode.offsetWidth,
                    height: domNode.offsetHeight,
                    fontEmbedCSS: fontCSSData,
                    style: { transform: 'scale(1)', margin: '0' }
                });

                // Guardamos el PNG en memoria
                paseInfo._pngBuffer = dataUrl;
                paseInfo._pxWidth = domNode.offsetWidth;
                paseInfo._pxHeight = domNode.offsetHeight;
                
                // Siguiente iteración
                setProgreso(p => ({ ...p, actual: p.actual + 1 }));
                if (paseActualIdx + 1 < pasesMemoria.length) {
                    setPaseActualIdx(paseActualIdx + 1);
                } else {
                    compilarDocumento(pasesMemoria);
                }

            } catch (e) {
                console.error('Error rasterizando pase', e);
                toast.error(`Error en el pase #${paseActualIdx + 1}. Se ha abortado.`);
                setProcesando(false);
            }

        }, 150); // Mínimo de 150ms para que React actualice el DOM con el nuevo QR y Textos antes del snapshot

        return () => clearTimeout(timer);
    }, [paseActualIdx, procesando, pasesMemoria]);


    const compilarDocumento = async (pasesList) => {
        toast.loading('Compilando resultado final...', { id: 'compilado' });
        try {
            if (formato === 'zip') {
                const zip = new JSZip();
                const folder = zip.folder(`CARNETS_${lote.codigo_serial}`);
                
                pasesList.forEach(p => {
                    const b64 = p._pngBuffer.split(',')[1];
                    const name = `${p.nombre_portador || 'PASE'}_${p.serial_legible}.png`.replace(/ /g, '_');
                    folder.file(name, b64, {base64: true});
                });
                
                const blob = await zip.generateAsync({ type: 'blob' });
                saveAs(blob, `CARNETS_${lote.codigo_serial}.zip`);
            } else {
                // Lógica de PDF multi-tarjeta
                const papelData = PAPER_SIZES[papel];
                const pdf = new jsPDF({
                    orientation: papelData.orientacion,
                    unit: 'mm',
                    format: [papelData.width, papelData.height]
                });

                // Ancho base estándar que mantiene proporciones CR80
                let carnet_ancho_mm = 54;
                if (plantilla === 'colgante') carnet_ancho_mm = 65;
                if (plantilla === 'credencial') carnet_ancho_mm = 65;
                if (plantilla === 'cartera') carnet_ancho_mm = 90;
                if (plantilla === 'ticket') carnet_ancho_mm = 85;

                const mg_x = 10;
                const mg_y = 10;
                const spc_x = 5;
                const spc_y = 5;

                let x = mg_x;
                let y = mg_y;
                let max_h_row = 0;

                for (let i = 0; i < pasesList.length; i++) {
                    const p = pasesList[i];
                    const ascRatio = p._pxHeight / p._pxWidth;
                    const h_mm = carnet_ancho_mm * ascRatio;

                    // Salto de línea
                    if (x + carnet_ancho_mm > papelData.width - mg_x + 1 && i !== 0) {
                        x = mg_x;
                        y += max_h_row + spc_y;
                        max_h_row = 0;
                    }

                    // Salto de página
                    if (y + h_mm > papelData.height - mg_y + 1) {
                        pdf.addPage();
                        x = mg_x;
                        y = mg_y;
                        max_h_row = 0;
                    }

                    pdf.addImage(p._pngBuffer, 'PNG', x, y, carnet_ancho_mm, h_mm);
                    x += carnet_ancho_mm + spc_x;
                    if (h_mm > max_h_row) max_h_row = h_mm;
                }
                
                pdf.save(`CARNETS_${lote.codigo_serial}.pdf`);
            }

            toast.success('Descarga exitosa', { id: 'compilado' });
            onClose();
            
        } catch (e) {
            console.error(e);
            toast.error('Error generando archivo final', { id: 'compilado' });
        } finally {
            setProcesando(false);
        }
    };


    const { user } = useAuthStore();

    // Extrae la data del `CodigoQR` para inyectarla en la plantilla
    const buildDatosPreview = (paseObj) => {
        if (!paseObj) return {};
        const veh = paseObj.vehiculo_placa || null;
        let zona_n = null;
        if (lote.zona_asignada) zona_n = lote.zona_asignada.nombre;

        return {
            nombre: paseObj.nombre_portador || 'SIN REGISTRO',
            cedula: paseObj.cedula_portador || null,
            entidad: lote.entidad?.nombre || user?.entidad_nombre || 'SIN ENTIDAD',
            evento: lote.nombre_evento,
            vehiculo_placa: veh,
            zona_nombre: zona_n,
            tipo_acceso: lote.tipo_acceso_custom ? lote.tipo_acceso_custom.nombre : lote.tipo_pase,
            fecha_inicio: new Date(lote.fecha_inicio).toLocaleDateString(),
            fecha_fin: new Date(lote.fecha_fin).toLocaleDateString(),
            qr: paseObj.token, // Token puro para el validador
            serial: paseObj.serial_legible
        };
    };

    const confGenerica = {
        titulo: 'BAGFM ACCESS',
        subtitulo: 'BASE AÉREA GRAL. FRANCISCO DE MIRANDA',
        colores: PRESETS_COLOR.find(p => p.id === preset) || PRESETS_COLOR[0]
    };

    // Datos vigentes para el motor de render oculto en el iterador
    const pPaseTemp = paseActualIdx >= 0 && paseActualIdx < pasesMemoria.length ? pasesMemoria[paseActualIdx] : null;
    const datosDinamicosActuales = buildDatosPreview(pPaseTemp);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:pl-72 bg-black/80 backdrop-blur-sm">
            <div className="bg-bg-card w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* HEAD */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-sm font-black uppercase text-text-main flex items-center gap-2">
                            <Package size={16} className="text-primary" /> Exportar Pases Reales
                        </h2>
                        <span className="text-[10px] uppercase tracking-widest text-text-muted mt-1">LOTE: {lote.codigo_serial}</span>
                    </div>
                    {!procesando && (
                        <button onClick={onClose} className="p-2 text-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* BODY */}
                <div className="p-5 overflow-y-auto w-full">
                    
                    {step === 1 && (
                        <div className="space-y-6">
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black tracking-widest text-text-muted uppercase">Tipo de descarga</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div 
                                        onClick={() => setTipoDescarga('qr')}
                                        className={cn("p-4 border rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2", 
                                        tipoDescarga === 'qr' ? 'bg-primary/10 border-primary text-primary' : 'bg-black/20 border-white/5 text-text-muted hover:bg-white/5')}
                                    >
                                        <Package size={24} />
                                        <span className="text-xs font-black uppercase">Solo Archivos QR</span>
                                    </div>
                                    <div 
                                        onClick={() => setTipoDescarga('full')}
                                        className={cn("p-4 border rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2", 
                                        tipoDescarga === 'full' ? 'bg-primary/10 border-primary text-primary' : 'bg-black/20 border-white/5 text-text-muted hover:bg-white/5')}
                                    >
                                        <FileText size={24} />
                                        <span className="text-xs font-black uppercase">Carnets Diseñados</span>
                                    </div>
                                    <div 
                                        onClick={() => setTipoDescarga('excel')}
                                        className={cn("p-4 border rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2 col-span-2", 
                                        tipoDescarga === 'excel' ? 'bg-primary/10 border-primary text-primary' : 'bg-black/20 border-white/5 text-text-muted hover:bg-white/5')}
                                    >
                                        <FileSpreadsheet size={24} />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black uppercase">Listado Excel</span>
                                            <span className="text-[9px] opacity-60 uppercase font-bold">Incluye links de acceso rápido</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {tipoDescarga === 'full' && (
                                <div className="space-y-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-bottom-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-text-main">Ajustes visuales</h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black tracking-widest text-text-muted uppercase">Plantilla</label>
                                            <select 
                                                value={plantilla} onChange={e => setPlantilla(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-xs text-white uppercase font-bold focus:outline-none focus:border-primary transition-colors"
                                            >
                                                <option value="colgante">Colgante</option>
                                                <option value="credencial">Credencial</option>
                                                <option value="ticket">Ticket</option>
                                                <option value="cartera">Cartera</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black tracking-widest text-text-muted uppercase">Tema</label>
                                            <select 
                                                value={preset} onChange={e => setPreset(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-xs text-white uppercase font-bold focus:outline-none focus:border-primary transition-colors"
                                            >
                                                {PRESETS_COLOR.map(p => (
                                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <h3 className="text-xs font-black uppercase tracking-wider text-text-main pt-2">Archivo de Salida</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black tracking-widest text-text-muted uppercase">Formato</label>
                                            <select 
                                                value={formato} onChange={e => setFormato(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-xs text-white uppercase font-bold focus:outline-none focus:border-primary transition-colors"
                                            >
                                                <option value="pdf">Documento PDF</option>
                                                <option value="zip">Imágenes (ZIP)</option>
                                            </select>
                                        </div>
                                        {formato === 'pdf' && (
                                            <div className="space-y-1 animate-in fade-in">
                                                <label className="text-[9px] font-black tracking-widest text-text-muted uppercase">Papel de Impresión</label>
                                                <select 
                                                    value={papel} onChange={e => setPapel(e.target.value)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-xs text-white uppercase font-bold focus:outline-none focus:border-primary transition-colors"
                                                >
                                                    {Object.entries(PAPER_SIZES).map(([k, p]) => (
                                                        <option key={k} value={k}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                                <div className="w-16 h-16 bg-black/40 border border-primary/30 rounded-2xl flex items-center justify-center relative">
                                    <Settings className="text-primary animate-spin" size={24} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-black uppercase tracking-wider text-text-main">
                                    Generando lote...
                                </h3>
                                <div className="w-full flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest pb-1 border-b border-white/5">
                                    <span>Pase actual</span>
                                    <span className="text-primary">{progreso.actual} / {progreso.total}</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                                    <div 
                                        className="h-full bg-primary transition-all duration-300" 
                                        style={{ width: `${Math.round((progreso.actual / progreso.total) * 100)}%` }} 
                                    />
                                </div>
                            </div>
                            
                            {/* Hidden DOM renderer node! Se inyectan los datos aquí para procesarlos */}
                            <div className="fixed top-[-9000px] left-[-9000px] opacity-0 pointer-events-none -z-50 shrink-0 w-max overflow-visible">
                                <div ref={hiddenPreviewRef}>
                                    {pPaseTemp && (
                                        <PlantillaPreview plantilla={plantilla} config={confGenerica} datos={datosDinamicosActuales} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                {step === 1 && (
                    <div className="p-4 border-t border-white/5 flex justify-end bg-black/20 rounded-b-2xl">
                        <Boton variant="primary" onClick={iniciarProceso} className="w-full sm:w-auto h-11 text-xs">
                            <Download size={14} className="mr-2" />
                            COMENZAR PROCESAMIENTO
                        </Boton>
                    </div>
                )}
            </div>
        </div>
    );
}
