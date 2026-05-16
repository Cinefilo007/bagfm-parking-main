import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/auth.store';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import {
    ParkingSquare, Plus, Trash2, RefreshCw, Edit3, Edit2, X,
    MapPin, Clock, Users, Shield, ChevronRight,
    ChevronDown, Settings, LayoutGrid, Building2, Layers,
    AlertTriangle, CheckCircle2, Timer, Hash,
    Lock, Unlock, Zap, Activity, MessageCircle, UserCheck, QrCode, Download, Loader2, Scissors, Target, Sparkles, Check, Car as CarIcon,
    Send, Mail, Smartphone, Copy, Share2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import PlantillaPreview from '../../components/carnets/PlantillaPreview';
import SelectTactivo from '../../components/ui/SelectTactivo';
import zonaService from '../../services/zona.service';
import api from '../../services/api';
import { QRCode } from 'react-qr-code';
import { ModalConfirmacion } from '../../components/ui/ModalConfirmacion';
import { ModalPaseBase } from '../../components/comando/ModalPaseBase';
import MapaTactico from '../../components/MapaTactico';
import { 
    calculatePolygonArea, 
    estimateCapacity, 
    getPolygonOrientation, 
    rotatePoint, 
    isPointInPolygon,
    STANDARDS,
    getDistanceMeters 
} from '../../lib/geometry';


const preloadBase64Fonts = async () => {
    try {
        const styleSheets = Array.from(document.styleSheets);
        let finalCss = '';
        for (const sheet of styleSheets) {
            try {
                const rules = Array.from(sheet.cssRules || []);
                for (const rule of rules) {
                    if (rule.type === CSSRule.FONT_FACE_RULE) {
                        finalCss += rule.cssText + '\n';
                    }
                }
            } catch (e) {
                // Ignore cross-origin errors
            }
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

// ──── Sub-componentes ─────────────────────────────────────────────────────────

const StatBadge = ({ valor, label, color = 'text-text-muted', subLabel }) => (
    <div className="text-center group">
        <div className={cn("text-xl font-black tracking-tighter transition-transform group-hover:scale-110", color)}>{valor}</div>
        <div className="text-[7px] font-black uppercase tracking-widest text-text-muted/50">{label}</div>
        {subLabel && <div className="text-[6px] font-bold text-text-muted/30 uppercase">{subLabel}</div>}
    </div>
);

const PuestoCuadro = ({ puesto, onClick }) => {
    const ocupado = puesto.estado === 'ocupado';
    const config = puesto.reservado_base 
        ? { border: 'border-indigo-500/30', bg: 'bg-indigo-500/8', dot: 'bg-indigo-400', icon: 'text-indigo-400' }
        : { border: 'border-white/10', bg: 'bg-white/5', dot: 'bg-text-muted', icon: 'text-text-muted' };

    // Etiqueta principal: si está ocupado y tiene placa, mostrarla; si no, el código
    const etiquetaPrincipal = ocupado && puesto.vehiculo_placa
        ? puesto.vehiculo_placa
        : (puesto.numero_puesto || puesto.codigo || '—');

    return (
        <button
            onClick={onClick}
            className={cn(
                'relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 hover:brightness-110',
                config.border, config.bg
            )}
        >
            <div className={cn('w-2 h-2 rounded-full mb-1', ocupado ? 'animate-pulse bg-danger' : config.dot)} />
            <ParkingSquare size={16} className={ocupado ? 'text-danger' : config.icon} />
            <span className="text-[7px] font-black uppercase tracking-tight mt-1 text-text-main leading-none">
                {etiquetaPrincipal}
            </span>
            <span className={cn(
                'text-[5px] font-black uppercase tracking-wide leading-none mt-0.5',
                ocupado ? 'text-danger' : puesto.reservado_base ? 'text-indigo-400' : 'text-text-muted'
            )}>
                {ocupado ? 'OCUPADO' : 'BASE'}
            </span>
            {puesto.reservado_base && <Lock size={7} className="absolute top-1 right-1 text-indigo-400/60" />}
        </button>
    );
};

const PuestoChip = ({ puesto, onEliminar, onEditar, onGPS }) => {
    const colorMap = {
        libre: 'bg-success/15 border-success/30 text-success',
        ocupado: 'bg-danger/15 border-danger/20 text-danger',
        reservado: 'bg-warning/15 border-warning/20 text-warning',
        reservado_base: 'bg-warning/30 border-warning/50 text-warning ring-1 ring-warning/30',
        mantenimiento: 'bg-text-muted/10 border-text-muted/20 text-text-muted/60',
    };
    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase transition-all hover:bg-white/5",
            colorMap[puesto.estado] || colorMap.libre
        )}>
            <span>{puesto.numero_puesto || puesto.codigo}</span>
            {puesto.latitud && <MapPin size={8} className="text-primary animate-pulse" />}
            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/10">
                <button onClick={() => onGPS(puesto)} title="Capturar GPS para este puesto"
                    className="hover:text-primary transition-all opacity-50 hover:opacity-100">
                    <Zap size={9} />
                </button>
                <button onClick={() => onEliminar(puesto)} title="Eliminar puesto"
                    className="hover:text-danger transition-all opacity-50 hover:opacity-100">
                    <Trash2 size={9} />
                </button>
            </div>
        </div>
    );
};

const ZonaRow = ({ 
    zona, entidades, asignaciones, zonas, refreshKeyBase, onEditar, onEliminar, 
    onGestionarPuestos, onAjustarTiempo, onAsignar, 
    onEliminarAsignacion, onEliminarPuesto, onCapturarGPSPuesto,
    onGenerarPaseBase, onVerDetalle
}) => {
    const [expandida, setExpandida] = useState(false);
    const puestos = zona.puestos || [];
    const asignacionesZona = asignaciones.filter(a => a.zona_id === zona.id);
    const totalAsignado = asignacionesZona.reduce((acc, a) => acc + (a.cupo_asignado || 0), 0);
    const reservadoBase = asignacionesZona.reduce((acc, a) => acc + (a.cupo_reservado_base || 0), 0);

    const puestosOcupados = zona.ocupacion_actual || 0;

    const puestosLibres = Math.max(0, zona.capacidad_total - totalAsignado - reservadoBase - puestosOcupados);

    const puestosReservados = reservadoBase; 

    // Puestos base (físicos y virtuales) - Ahora vienen del servidor para mostrar ocupación real
    const [puestosBaseServidor, setPuestosBaseServidor] = useState([]);
    
    useEffect(() => {
        const fetchPuestosBase = async () => {
            try {
                const res = await api.get(`/comando/puestos-reservados?zona_id=${zona.id}`);
                setPuestosBaseServidor(res.data);
            } catch (e) {
                console.error("Error al cargar puestos base", e);
            }
        };
        // Refrescar cada vez que la zona se expande, cambia el estado global o el trigger local
        if (expandida) fetchPuestosBase();
    }, [expandida, zona.id, asignaciones, zonas, refreshKeyBase]);

    // Combinar puestos base del servidor con el cupo total reservado
    const puestosBaseCompletos = (() => {
        // 1. Empezamos con los pases reales que el servidor dice que están activos
        const listaFinal = puestosBaseServidor.map(p => ({
            ...p,
            reservado_base: true,
            estado: p.estado || 'ocupado',
            // Subir la placa al nivel raíz para que PuestoCuadro la muestre directamente
            vehiculo_placa: p.detalle_pase?.vehiculo_placa || null,
        }));
        
        // 2. Calculamos cuántas cajas libres faltan según el cupo reservado de la base
        // reservadoBase viene de la asignación configurada
        const cuposOcupadosActuales = listaFinal.length;
        const faltantes = Math.max(0, reservadoBase - cuposOcupadosActuales);
        
        // 3. Agregamos las cajas libres necesarias
        for (let i = 0; i < faltantes; i++) {
            listaFinal.push({
                id: `v-empty-${zona.id}-${i}`,
                numero_puesto: `BASE-FREE`,
                estado: 'libre',
                reservado_base: true,
                virtual: true
            });
        }
        return listaFinal;
    })();

    return (
        <div className="bg-bg-card/40 border border-white/5 rounded-2xl overflow-hidden transition-all">
            {/* Cabecera de la zona (Responsiva) */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Bloque 1: Identificación y Nombre */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                        onClick={() => setExpandida(!expandida)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all shrink-0"
                    >
                        <ChevronDown size={16} className={cn("text-text-muted transition-transform", expandida && "rotate-180")} />
                    </button>
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                        <ParkingSquare size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-text-main uppercase tracking-tight truncate">{zona.nombre}</h3>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 opacity-60">
                            <span className="text-[8px] text-text-muted flex items-center gap-1">
                                <Hash size={9} /> Cap: {zona.capacidad_total || '∞'}
                            </span>
                            {zona.tiempo_limite_llegada_min && (
                                <span className="text-[8px] text-text-muted flex items-center gap-1">
                                    <Clock size={9} /> {zona.tiempo_limite_llegada_min} min
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bloque 2: Indicadores (KPIs internos) y Botones de Acción */}
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 md:pl-4 sm:border-l border-white/5">
                    <div className="flex items-center gap-3 pr-2 sm:pr-0">
                        <StatBadge valor={puestosLibres} label="Lib." color="text-success" />
                        <StatBadge valor={puestosOcupados} label="Ocu." color="text-danger" />
                        <StatBadge valor={puestosReservados} label="Res." color="text-warning" />
                    </div>

                    <div className="flex items-center gap-0.5 bg-white/5 sm:bg-transparent p-1 sm:p-0 rounded-xl">
                        <button onClick={() => onAsignar(zona)} title="Asignar"
                            className="p-2 rounded-lg hover:bg-primary/10 text-text-muted hover:text-primary transition-all">
                            <Building2 size={14} />
                        </button>
                        <button onClick={() => onAjustarTiempo(zona)} title="Tiempo"
                            className="p-2 rounded-lg hover:bg-warning/10 text-text-muted hover:text-warning transition-all">
                            <Timer size={14} />
                        </button>
                        <button onClick={() => onGestionarPuestos(zona)} title="Puestos"
                            className="p-2 rounded-lg hover:bg-sky-500/10 text-text-muted hover:text-sky-400 transition-all">
                            <LayoutGrid size={14} />
                        </button>
                        <button onClick={() => onEditar(zona)} title="Editar"
                            className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-main transition-all">
                            <Edit3 size={14} />
                        </button>
                        <button onClick={() => onEliminar(zona)} title="Eliminar"
                            className="p-2 rounded-lg hover:bg-danger/10 text-text-muted/40 hover:text-danger transition-all">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Detalle expandido */}
            {expandida && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Asignaciones por entidad */}
                    {asignacionesZona.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-[8px] font-black uppercase tracking-widest text-text-muted/50 flex items-center gap-1.5">
                                <Building2 size={9} /> Puestos asignados por entidad
                            </p>
                            {asignacionesZona.map(asig => {
                                const entidad = entidades.find(e => e.id === asig.entidad_id);
                                return (
                                    <div key={asig.id} className="flex items-center gap-3 p-2.5 bg-white/3 rounded-xl border border-white/5">
                                        <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                            <Building2 size={12} className="text-primary" />
                                        </div>
                                        <span className="text-[10px] font-black text-text-main uppercase flex-1 truncate">
                                            {entidad?.nombre || asig.entidad_id}
                                        </span>
                                        <span className="text-[9px] font-bold text-success">{asig.cupo_asignado} cupos</span>
                                        {asig.cupo_reservado_base > 0 && (
                                            <span className="text-[9px] font-bold text-warning">+{asig.cupo_reservado_base} base</span>
                                        )}
                                        <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                                            <button onClick={() => onAsignar(zona, asig)} title="Editar asignación"
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-main transition-all">
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => onEliminarAsignacion(asig)} title="Eliminar asignación"
                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted/40 hover:text-red-400 transition-all">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-[9px] text-text-muted/40 italic">Sin puestos asignados a entidades</p>
                    )}

                    {/* Puestos */}
                    {puestos.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[8px] font-black uppercase tracking-widest text-text-muted/50 flex items-center gap-1.5">
                                <ParkingSquare size={9} /> Puestos ({puestos.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {puestos.map(p => (
                                    <PuestoChip
                                        key={p.id}
                                        puesto={p}
                                        onEliminar={onEliminarPuesto}
                                        onEditar={() => { }}
                                        onGPS={onCapturarGPSPuesto}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Puestos Reservados Base (Diseño Parquero) */}
                    {puestosReservados > 0 && (
                        <div className="space-y-2 p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                            <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1.5 px-1">
                                <Shield size={9} /> Cupos Reservados del Comando (Click para Asignar)
                            </p>
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                {puestosBaseCompletos.map(p => (
                                    <PuestoCuadro 
                                        key={p.id} 
                                        puesto={p} 
                                        onClick={() => {
                                            if (p.estado === 'ocupado') {
                                                onVerDetalle(p);
                                            } else {
                                                onGenerarPaseBase(zona);
                                            }
                                        }} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {!asignacionesZona.length && !puestos.length && !puestosReservados && (
                        <p className="text-center text-[9px] text-text-muted/30 uppercase tracking-widest py-2">
                            Zona sin configuración adicional
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ──── Página Principal ────────────────────────────────────────────────────────

const FORM_ZONA_INICIAL = {
    nombre: '', descripcion_ubicacion: '', capacidad_total: '',
    latitud: '', longitud: '', tiempo_limite_llegada_min: 15,
};

export default function GestionZonas() {
    const { user } = useAuthStore();
    const [zonas, setZonas] = useState([]);
    const [entidades, setEntidades] = useState([]);
    const [asignaciones, setAsignaciones] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Modales
    const [modalZona, setModalZona] = useState(false);
    const [modalPuestos, setModalPuestos] = useState(false);
    const [modalAsignar, setModalAsignar] = useState(false);
    const [modalTiempo, setModalTiempo] = useState(false);
    const [modalPaseBase, setModalPaseBase] = useState(false);
    const [modalDetallePuesto, setModalDetallePuesto] = useState(false);
    const [puestoDetalle, setPuestoDetalle] = useState(null);
    const [liberandoPuesto, setLiberandoPuesto] = useState(false);
    const [zonaActiva, setZonaActiva] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, loading: false });
    const [refreshKeyBase, setRefreshKeyBase] = useState(0); 
    const qrSectionRef = useRef(null);
    const [mostrarQR, setMostrarQR] = useState(false);
    
    // Estados para Georreferenciación Avanzada (Aegis Tactical v2.3)
    const [drawingMode, setDrawingMode] = useState(false);
    const [tempPoints, setTempPoints] = useState([]);
    const [modalMapaReferencia, setModalMapaReferencia] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiIteration, setAiIteration] = useState(0);

    // Parámetros de Diseño Táctico Pro
    const [configIA, setConfigIA] = useState({
        angulo: 90,
        patron: 'doble',
        anchoPasillo: 6.0,
        accesos: []
    });
    const [accessPointMode, setAccessPointMode] = useState(null); // 'entry' | 'exit' | null

    const handleAISuggestion = async (points) => {
        if (!points || points.length < 3) return;
        
        setAiLoading(true);
        toast.loading("IA Calculando Distribución Avanzada...", { id: 'ai-analysis' });
        
        setTimeout(() => {
            const area = calculatePolygonArea(points);
            const spots = estimateCapacity(area);

            // Calcular Centroide para rotaciones
            const latSum = points.reduce((s, p) => s + p[0], 0);
            const lngSum = points.reduce((s, p) => s + p[1], 0);
            const centroide = [latSum / points.length, lngSum / points.length];

            // Plano de Área Utilizable (REDUCIDO AL 3% SEGÚN SOLICITUD)
            const poligonoSugerido = points.map(p => [
                p[0] + (centroide[0] - p[0]) * 0.03,
                p[1] + (centroide[1] - p[1]) * 0.03
            ]);

            // ESCALADO MÉTRICO REAL (Preciso para 10°N)
            const latRad = centroide[0] * Math.PI / 180;
            const METERS_PER_DEG_LAT = 111320;
            const METERS_PER_DEG_LNG = 111320 * Math.cos(latRad);

            // Determinar orientación óptima + Iteración (0, 90, 180, 270)
            const baseAngle = getPolygonOrientation(points);
            const orientationAngle = baseAngle + (aiIteration * (Math.PI / 2));
            
            // Rotar puntos al eje neutro para medir dimensiones reales en metros
            const rotatedPoints = points.map(p => rotatePoint(p, centroide, -orientationAngle));
            
            // Medir dimensiones en grados y convertirlas a metros para el loop
            const lats = rotatedPoints.map(p => p[0]);
            const lngs = rotatedPoints.map(p => p[1]);
            
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            const ANCHO_PASILLO = configIA.anchoPasillo;
            const ANCHO_PUESTO = 2.5;
            const simLines = [];
            const stepSpotDepth = STANDARDS.SPOT_DEPTH / METERS_PER_DEG_LAT;
            const stepAisle = ANCHO_PASILLO / METERS_PER_DEG_LAT;
            const spotWidthDeg = ANCHO_PUESTO / METERS_PER_DEG_LNG;
            
            let currentLat = minLat;
            let rowCounter = 0;
            let totalSpotsCount = 0;
            const puestosMetadata = [];

            // Patrón de distribución: 'simple' (P-F-P) o 'doble' (P-F-F-P)
            const pattern = configIA.patron || 'simple';

            while (currentLat < maxLat) {
                // Determinar si esta fila es Pasillo o Puesto según el patrón
                let isAisle = false;
                let isDobleFrontera = false;

                if (pattern === 'simple') {
                    isAisle = rowCounter % 2 !== 0;
                } else {
                    isAisle = (rowCounter + 1) % 3 === 0;
                    isDobleFrontera = rowCounter % 3 === 0; 
                }

                const step = isAisle ? stepAisle : stepSpotDepth;
                if (currentLat + step > maxLat) break;
                
                const lineType = isAisle ? 'via' : 'puesto';
                const color = isAisle ? '#f59e0b' : '#8b5cf6';
                
                const start1 = rotatePoint([currentLat, minLng], centroide, orientationAngle);
                const end1 = rotatePoint([currentLat, maxLng], centroide, orientationAngle);
                const start2 = rotatePoint([currentLat + step, minLng], centroide, orientationAngle);
                const end2 = rotatePoint([currentLat + step, maxLng], centroide, orientationAngle);
                
                const isInside = (p1, p2) => isPointInPolygon(p1, points) && isPointInPolygon(p2, points);

                if (isInside(start1, end1)) {
                    simLines.push({ points: [start1, end1], type: lineType, color });
                }
                
                if (isDobleFrontera && isInside(start2, end2)) {
                    simLines.push({ points: [start2, end2], type: 'divisor_doble', color: '#A855F7' });
                } else if (isInside(start2, end2)) {
                    simLines.push({ points: [start2, end2], type: lineType, color });
                }

                if (!isAisle) {
                    const skewOffset = configIA.angulo !== 90 ? (stepSpotDepth * Math.tan((90 - configIA.angulo) * Math.PI / 180)) : 0;
                    const margin = (maxLng - minLng) * 0.05;

                    for (let lng = minLng + margin; lng <= maxLng - margin - spotWidthDeg; lng += spotWidthDeg) {
                        const p1 = rotatePoint([currentLat, lng], centroide, orientationAngle);
                        const p2 = rotatePoint([currentLat + step, lng + skewOffset], centroide, orientationAngle);
                        
                        if (isInside(p1, p2)) {
                            simLines.push({ points: [p1, p2], type: 'separador', color: '#6366f1' });
                            totalSpotsCount++;
                            
                            // Guardar centro para numeración táctica
                            const center = rotatePoint([currentLat + (step/2), lng + (spotWidthDeg/2)], centroide, orientationAngle);
                            puestosMetadata.push({ number: totalSpotsCount, center });
                        }
                    }
                } else {
                    const midLat = currentLat + (step / 2);
                    const flowPoints = [0.25, 0.5, 0.75];
                    flowPoints.forEach(pos => {
                        const f1 = rotatePoint([midLat, minLng + (maxLng-minLng)*(pos-0.02)], centroide, orientationAngle);
                        const f2 = rotatePoint([midLat, minLng + (maxLng-minLng)*(pos+0.02)], centroide, orientationAngle);
                        if (isPointInPolygon(f1, points)) {
                            simLines.push({ points: [f1, f2], type: 'flujo', color: '#f59e0b' });
                        }
                    });
                }

                currentLat += step;
                rowCounter++;
            }

            setAiSuggestions({
                puestosCount: totalSpotsCount,
                puestos: puestosMetadata,
                distribución: pattern === 'doble' ? 'Back-to-Back (F-F)' : 'Lineal (P-F-P)',
                eficiencia: `${(STANDARDS.MIN_EFFICIENCY * 100).toFixed(0)}%`,
                lineas: simLines,
                poligonoSugerido: poligonoSugerido,
                areaUtilizable: Math.floor(area * STANDARDS.MIN_EFFICIENCY)
            });
            
            setAiIteration(prev => (prev + 1) % 4);
            setAiLoading(false);
            toast.success(`Distribución: ${totalSpotsCount} puestos detectados`, { id: 'ai-analysis' });
        }, 1000);
    };

    const handleFinalizarDiseno = () => {
        if (tempPoints.length < 3) {
            toast.error("Debe definir un área mínima (3 puntos)");
            return;
        }
        
        // TRANSFERENCIA CRÍTICA AL FORMULARIO PRINCIPAL
        setFormZona(prev => ({
            ...prev,
            poligono: tempPoints,
            area_m2: calculatePolygonArea(tempPoints),
            config_ia: configIA,
            grilla_tactica: aiSuggestions?.lineas || []
        }));

        setDrawingMode(false);
        setModalMapaReferencia(false);
        toast.success("Diseño táctico acoplado al formulario");
    };

    const handleLimpiarDiseno = () => {
        setConfirmConfig({
            isOpen: true,
            title: 'LIMPIAR DISEÑO ACTUAL',
            message: '¿Desea borrar todo el trazado y empezar de cero? Esta acción no se puede deshacer.',
            onConfirm: () => {
                setTempPoints([]);
                setAiSuggestions(null);
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                toast.success("Área de trabajo despejada");
            }
        });
    };

    // Estados para Carnetización
    const [modoExport, setModoExport] = useState('qr');
    const [presetId, setPresetId] = useState('militar');
    const [capturando, setCapturando] = useState(false);
    const [modalCompartirBase, setModalCompartirBase] = useState(false);
    const [copiadoLink, setCopiadoLink] = useState(false);
    const carnetRef = useRef(null);


    // Forms
    const [formZona, setFormZona] = useState(FORM_ZONA_INICIAL);
    const [editandoZona, setEditandoZona] = useState(null);
    const [guardando, setGuardando] = useState(false);

    // Puestos
    const [puestosZona, setPuestosZona] = useState([]);
    const [nuevoCodigo, setNuevoCodigo] = useState('');
    const [nuevaLatPuesto, setNuevaLatPuesto] = useState('');
    const [nuevaLonPuesto, setNuevaLonPuesto] = useState('');
    const [creandoPuesto, setCreandoPuesto] = useState(false);
    
    // Batch Puestos
    const [batchConfig, setBatchConfig] = useState({ prefijo: '', cantidad: 0 });
    const [creandoBatch, setCreandoBatch] = useState(false);

    // Asignación puestos
    const [formAsig, setFormAsig] = useState({ entidad_id: '', cupo_asignado: 1, cupo_reservado_base: 0, notas: '' });
    const [editandoAsig, setEditandoAsig] = useState(null);
    const [asignando, setAsignando] = useState(false);

    // Tiempo límite
    const [nuevoTiempo, setNuevoTiempo] = useState(15);
    const [ajustando, setAjustando] = useState(false);

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        try {
            const [zonasData, entidadesData, asigData] = await Promise.all([
                zonaService.listarZonas(),
                api.get('/entidades').then(r => r.data).catch(() => []),
                zonaService.listarAsignaciones().catch(() => []),
            ]);
            setZonas(zonasData);
            setEntidades(entidadesData);
            setAsignaciones(asigData);
        } catch (e) {
            // Demo fallback
            setZonas([
                {
                    id: 'z1', nombre: 'Zona VIP Norte', capacidad_total: 20, tiempo_limite_llegada_min: 15, latitud: '10.1234', longitud: '-66.9876', puestos: [
                        { id: 'p1', codigo: 'A-01', estado: 'libre' },
                        { id: 'p2', codigo: 'A-02', estado: 'ocupado' },
                        { id: 'p3', codigo: 'A-03', estado: 'libre' },
                    ]
                },
                { id: 'z2', nombre: 'Parqueo Logístico', capacidad_total: 50, tiempo_limite_llegada_min: 25, puestos: [] },
                { id: 'z3', nombre: 'Zona Staff', capacidad_total: 30, tiempo_limite_llegada_min: 15, puestos: [] },
            ]);
            setEntidades([
                { id: 'e1', nombre: 'CÍRCULO MILITAR VEN' },
                { id: 'e2', nombre: 'ASOCIACIÓN AMIGOS BASE' },
            ]);
            setAsignaciones([
                { id: 'a1', zona_id: 'z1', entidad_id: 'e1', cupo_asignado: 10, cupo_reservado_base: 2 },
                { id: 'a2', zona_id: 'z2', entidad_id: 'e2', cupo_asignado: 20, cupo_reservado_base: 0 },
            ]);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargarDatos(); }, [cargarDatos]);

    // ── CRUD Zona ────────────────────────────────────────────────────────────

    const abrirModalZona = (zona = null) => {
        setEditandoZona(zona);
        setFormZona(zona ? {
            nombre: zona.nombre || '', 
            descripcion_ubicacion: zona.descripcion_ubicacion || '',
            capacidad_total: zona.capacidad_total || '',
            latitud: zona.latitud || '', 
            longitud: zona.longitud || '',
            poligono: zona.poligono || null,
            area_m2: zona.area_m2 || null,
            tiempo_limite_llegada_min: zona.tiempo_limite_llegada_min || 15,
            config_ia: zona.config_ia || { angulo: 90, patron: 'simple', anchoPasillo: 6.0, accesos: [] },
            grilla_tactica: zona.grilla_tactica || []
        } : { ...FORM_ZONA_INICIAL, poligono: null, area_m2: null, config_ia: { angulo: 90, patron: 'simple', anchoPasillo: 6.0, accesos: [] }, grilla_tactica: [] });
        setModalZona(true);
    };

    const handleGuardarZona = async () => {
        if (!formZona.nombre.trim()) { toast.error('Nombre requerido'); return; }
        setGuardando(true);
        try {
            const latStr = formZona.latitud?.toString().trim();
            const lonStr = formZona.longitud?.toString().trim();
            const descStr = formZona.descripcion_ubicacion?.trim();

            const datos = {
                nombre: formZona.nombre.trim(),
                capacidad_total: formZona.capacidad_total ? parseInt(formZona.capacidad_total, 10) : 0,
                descripcion_ubicacion: descStr || null,
                latitud: (latStr && !isNaN(parseFloat(latStr))) ? parseFloat(latStr) : null,
                longitud: (lonStr && !isNaN(parseFloat(lonStr))) ? parseFloat(lonStr) : null,
                tiempo_limite_llegada_min: parseInt(formZona.tiempo_limite_llegada_min, 10) || 15,
                poligono: formZona.poligono || null,
                area_m2: formZona.area_m2 || null,
                config_ia: formZona.config_ia || null,
                grilla_tactica: formZona.grilla_tactica || null,
            };
            if (editandoZona) {
                await zonaService.actualizarZona(editandoZona.id, datos);
                toast.success('Zona actualizada');
            } else {
                await zonaService.crearZona(datos);
                toast.success('Zona creada');
            }
            setModalZona(false);
            cargarDatos();
        } catch (e) {
            console.error("Error al guardar zona:", e.response?.data);
            const detail = e.response?.data?.detail;
            
            if (Array.isArray(detail)) {
                const mensaje = detail.map(d => `${d.loc?.[d.loc.length - 1] || 'Campo'}: ${d.msg}`).join(', ');
                toast.error(`Error de validación: ${mensaje}`);
            } else if (typeof detail === 'object' && detail !== null) {
                toast.error(`Error de validación: Revisar la consola para más detalles.`);
            } else {
                toast.error(detail || 'Error al guardar zona');
            }
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminarZona = (zona) => {
        setConfirmConfig({
            isOpen: true,
            title: 'ELIMINAR ZONA TÁCTICA',
            message: `¿Está seguro de que desea eliminar la zona "${zona.nombre}"? Esta acción purgará todos los registros asociados de forma permanente.`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, loading: true }));
                try {
                    await zonaService.eliminarZona(zona.id);
                    toast.success('Zona eliminada correctamente');
                    cargarDatos();
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                } catch (e) {
                    toast.error('Error crítico al eliminar la zona');
                } finally {
                    setConfirmConfig(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

    // ── Gestión de Puestos ───────────────────────────────────────────────────

    const abrirModalPuestos = async (zona) => {
        setZonaActiva(zona);
        try {
            const puestos = await zonaService.getPuestosZona(zona.id);
            setPuestosZona(puestos);
        } catch (e) {
            setPuestosZona(zona.puestos || []);
        }
        setModalPuestos(true);
    };

    const handleCrearBatch = async () => {
        if (!batchConfig.prefijo.trim() || !batchConfig.cantidad) { toast.error('Datos incompletos'); return; }
        
        const cantidad = parseInt(batchConfig.cantidad);
        const totalSimulado = puestosZona.length + cantidad;
        
        if (totalSimulado > zonaActiva.capacidad_total) {
            toast.error(`Error: Se excedería la capacidad total (${zonaActiva.capacidad_total}). Disponibles: ${zonaActiva.capacidad_total - puestosZona.length}`);
            return;
        }

        setCreandoBatch(true);
        try {
            await api.post(`/zonas/${zonaActiva.id}/puestos`, {
                prefijo: batchConfig.prefijo.toUpperCase(),
                cantidad: parseInt(batchConfig.cantidad)
            });
            const puestos = await zonaService.getPuestosZona(zonaActiva.id);
            setPuestosZona(puestos);
            setBatchConfig({ prefijo: '', cantidad: 0 });
            toast.success(`${batchConfig.cantidad} puestos generados`);
            cargarDatos();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al generar lote');
        } finally {
            setCreandoBatch(false);
        }
    };

    const handleCapturarGPSPuesto = async (puesto) => {
        if (!("geolocation" in navigator)) return toast.error("GPS no disponible");
        
        const loadingToast = toast.loading(`Capturando GPS para ${puesto.numero_puesto}...`);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const lat = pos.coords.latitude.toFixed(6);
                const lon = pos.coords.longitude.toFixed(6);
                await api.patch(`/zonas/puestos/${puesto.id}`, { latitud: lat, longitud: lon });
                
                setPuestosZona(prev => prev.map(p => p.id === puesto.id ? { ...p, latitud: lat, longitud: lon } : p));
                toast.dismiss(loadingToast);
                toast.success(`GPS de puesto ${puesto.numero_puesto} actualizado`);
            } catch (e) {
                toast.dismiss(loadingToast);
                toast.error("Error al guardar coordenadas");
            }
        }, (err) => {
            toast.dismiss(loadingToast);
            toast.error("Error GPS: Permiso denegado");
        });
    };

    const handleEliminarPuesto = async (puesto) => {
        try {
            await zonaService.eliminarPuesto(puesto.id);
            setPuestosZona(prev => prev.filter(p => p.id !== puesto.id));
            toast.success('Puesto eliminado');
        } catch (e) {
            toast.error('Error al eliminar puesto');
        }
    };

    // ── Asignación de Cuota ──────────────────────────────────────────────────

    const abrirModalAsignar = (zona, asig = null) => {
        setZonaActiva(zona);
        if (asig) {
            setEditandoAsig(asig);
            setFormAsig({
                entidad_id: asig.entidad_id,
                cupo_asignado: asig.cupo_asignado,
                cupo_reservado_base: asig.cupo_reservado_base || 0,
                notas: asig.notas || ''
            });
        } else {
            setEditandoAsig(null);
            setFormAsig({ entidad_id: '', cupo_asignado: 1, cupo_reservado_base: 0, notas: '' });
        }
        setModalAsignar(true);
    };

    const handleAsignarPuestos = async () => {
        if (!formAsig.entidad_id) { toast.error('Selecciona una entidad'); return; }
        setAsignando(true);
        try {
            const payload = {
                ...formAsig,
                cupo_asignado: parseInt(formAsig.cupo_asignado) || 0,
                cupo_reservado_base: parseInt(formAsig.cupo_reservado_base) || 0
            };
            if (editandoAsig) {
                await zonaService.actualizarAsignacion(editandoAsig.id, payload);
                toast.success('Asignación actualizada correctamente');
            } else {
                await zonaService.crearAsignacion({ ...payload, zona_id: zonaActiva.id });
                toast.success('Puestos asignados correctamente');
            }
            setModalAsignar(false);
            cargarDatos();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al procesar asignación');
        } finally {
            setAsignando(false);
        }
    };

    const handleEliminarAsignacion = (asig) => {
        setConfirmConfig({
            isOpen: true,
            title: 'REVOCAR ASIGNACIÓN TÁCTICA',
            message: `¿CONFIRMA LA REVOCACIÓN de los cupos para la entidad? Esta acción liberará la capacidad en la zona pero no eliminará los puestos físicos si ya fueron generados.`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, loading: true }));
                try {
                    await zonaService.eliminarAsignacion(asig.id);
                    toast.success('Asignación revocada');
                    cargarDatos();
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                } catch (e) {
                    toast.error('Error al revocar asignación');
                } finally {
                    setConfirmConfig(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

    // ── Tiempo Límite ────────────────────────────────────────────────────────

    const handleVerDetalle = (puesto) => {
        setPuestoDetalle(puesto);
        setMostrarQR(false); // Resetear estado QR al abrir
        setModalDetallePuesto(true);
    };

    const datosDinamicosActuales = useMemo(() => {
        if (!puestoDetalle?.detalle_pase) return {};
        const pase = puestoDetalle.detalle_pase;
        return {
            nombre: pase.nombre_portador || 'SIN REGISTRO',
            cedula: pase.cedula_portador || null,
            entidad: 'COMANDO BAGFM',
            evento: zonaActiva?.nombre || 'ZONA OFICIAL',
            vehiculo_placa: pase.vehiculo_placa || null,
            zona_nombre: zonaActiva?.nombre || null,
            tipo_acceso: 'PASE TÁCTICO',
            fecha_inicio: pase.fecha_inicio ? new Date(pase.fecha_inicio).toLocaleDateString() : new Date().toLocaleDateString(),
            fecha_fin: pase.fecha_expiracion ? new Date(pase.fecha_expiracion).toLocaleDateString() : 'PERMANENTE',
            qr: pase.token || pase.serial_legible || '',
            serial: pase.serial_legible || ''
        };
    }, [puestoDetalle, zonaActiva]);

    const presetObj = PRESETS_COLOR.find(p => p.id === presetId) || PRESETS_COLOR[0];
    const confGenerica = {
        titulo: 'BAGFM ACCESS',
        subtitulo: 'BASE AÉREA GRAL. FRANCISCO DE MIRANDA',
        colores: presetObj
    };

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

    const generarImagenCarnetOQR = async () => {
        setCapturando(true);
        try {
            if (modoExport === 'qr') {
                const svgEl = qrSectionRef.current?.querySelector('svg');
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

    const handleDescargarBase = async () => {
        if (!puestoDetalle?.detalle_pase) return;
        try {
            const pase = puestoDetalle.detalle_pase;
            const blob = await generarImagenCarnetOQR();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${modoExport === 'qr' ? 'QR' : 'CARNET'}_${pase.serial_legible}.png`;
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

    const handleWhatsAppBase = async () => {
        if (!puestoDetalle?.detalle_pase) return;
        const pase = puestoDetalle.detalle_pase;
        try {
            toast.loading('Preparando imagen...', { id: 'wa-share' });
            const mensaje = [
                `🎫 *PASE DE BASE — ${zonaActiva?.nombre?.toUpperCase() || 'BAGFM'}*`,
                `📋 Serial: \`${pase.serial_legible}\``,
                `👤 Portador: ${pase.nombre_portador}`,
                `🚗 Vehículo: ${pase.vehiculo_placa} (${pase.vehiculo_marca})`,
                ``,
                `_Sistema BAGFM Access_`,
            ].join('\n');

            const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);
            
            if (isMobile && navigator.share && navigator.canShare) {
                try {
                    const blob = await generarImagenCarnetOQR();
                    const file = new File([blob], `${pase.serial_legible}.png`, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: `Pase Oficial Base`, text: mensaje });
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

            // Fallback a web
            const urlWhatsApp = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
            window.open(urlWhatsApp, '_blank');
            toast.dismiss('wa-share');
            if (!isMobile) toast("En PC debes descargar el archivo y adjuntarlo", { icon: '💡' });
        } catch (err) {
            console.error(err);
            toast.error('Error enviando a WhatsApp', { id: 'wa-share' });
        }
    };

    // ── Compartir multicanal (WhatsApp, Telegram, Email, SMS, PWA) ──
    const handleCompartirCanal = async (canal) => {
        if (!puestoDetalle?.detalle_pase) return;
        const pase = puestoDetalle.detalle_pase;
        const mensaje = [
            `🎫 *PASE DE BASE — ${zonaActiva?.nombre?.toUpperCase() || 'BAGFM'}*`,
            `📋 Serial: \`${pase.serial_legible}\``,
            `👤 Portador: ${pase.nombre_portador || 'PENDIENTE'}`,
            `🚗 Vehículo: ${pase.vehiculo_placa || '—'} ${pase.vehiculo_marca ? '(' + pase.vehiculo_marca + ')' : ''}`.trim(),
            ``,
            `_Sistema BAGFM Access_`,
        ].join('\n');

        // Canal PWA (navigator.share nativo)
        if (canal === 'pwa') {
            if (!navigator.share) {
                toast.error('Tu navegador no soporta compartir nativo');
                return;
            }
            try {
                toast.loading('Preparando imagen...', { id: 'pwa-share' });
                const blob = await generarImagenCarnetOQR();
                const file = new File([blob], `${pase.serial_legible}.png`, { type: 'image/png' });
                const canShareFiles = navigator.canShare?.({ files: [file] });
                if (canShareFiles) {
                    await navigator.share({ files: [file], title: 'Pase Oficial Base', text: mensaje });
                } else {
                    await navigator.share({ title: 'Pase Oficial Base', text: mensaje });
                }
                toast.dismiss('pwa-share');
            } catch (e) {
                toast.dismiss('pwa-share');
                if (e.name !== 'AbortError') toast.error('Error al compartir');
            }
            return;
        }

        const urls = {
            whatsapp: pase.telefono_portador
                ? `https://wa.me/${pase.telefono_portador.replace(/\D/g,'')}?text=${encodeURIComponent(mensaje)}`
                : `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
            telegram: `https://t.me/share/url?url=${encodeURIComponent('https://bagfm.app')}&text=${encodeURIComponent(mensaje)}`,
            email: `mailto:?subject=PASE OFICIAL BAGFM&body=${encodeURIComponent(mensaje)}`,
            sms: `sms:?body=${encodeURIComponent(mensaje)}`,
        };
        window.open(urls[canal], '_blank');
    };

    const handleLiberarPuestoBase = async () => {
        if (!puestoDetalle?.detalle_pase?.id) return;
        
        setLiberandoPuesto(true);
        try {
            await api.delete(`/comando/pases-reservados/${puestoDetalle.detalle_pase.id}`);
            toast.success('Puesto liberado y pase anulado con éxito');
            setModalDetallePuesto(false);
            setRefreshKeyBase(prev => prev + 1); // Forzar refresco solo de las cajas de puestos
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Error al liberar puesto');
        } finally {
            setLiberandoPuesto(false);
        }
    };

    const abrirModalPaseBase = (zona) => {
        setZonaActiva(zona);
        setModalPaseBase(true);
    };

    const abrirModalTiempo = (zona) => {
        setZonaActiva(zona);
        setNuevoTiempo(zona.tiempo_limite_llegada_min || 15);
        setModalTiempo(true);
    };

    const handleAjustarTiempo = async () => {
        setAjustando(true);
        try {
            await zonaService.ajustarTiempoLimite(zonaActiva.id, nuevoTiempo);
            toast.success(`Tiempo límite actualizado a ${nuevoTiempo} min`);
            setModalTiempo(false);
            cargarDatos();
        } catch (e) {
            toast.error('Error al ajustar tiempo');
        } finally {
            setAjustando(false);
        }
    };

    // ── Stats globales ───────────────────────────────────────────────────────
    const totalCapacidad = zonas.reduce((acc, z) => acc + (z.capacidad_total || 0), 0);
    const totalOcupados = zonas.reduce((acc, z) => acc + (z.ocupacion_actual || 0), 0);
    
    const totalReservados = asignaciones.reduce((acc, a) => acc + (a.cupo_reservado_base || 0), 0);



    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-6 space-y-5 pb-24 max-w-5xl mx-auto animate-in fade-in duration-500">

            {/* Header */}
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 
                               bg-bg-card/30 p-4 md:p-5 rounded-2xl border border-white/5">
                <div className="min-w-0">
                    <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-primary/10 rounded-xl shrink-0">
                            <ParkingSquare className="text-primary" size={24} />
                        </div>
                        <span className="uppercase">Gestión de Zonas</span>
                    </h1>
                    <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
                        Distribución y Georreferenciación de Estacionamientos
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto self-end">
                    <Boton onClick={() => abrirModalZona()} className="gap-2 h-11 px-6 w-full sm:w-auto shrink-0 
                                                        bg-primary text-bg-app font-black uppercase tracking-widest text-[11px]
                                                        rounded-xl shadow-tactica hover:scale-[1.02] active:scale-[0.98] transition-all">
                        <Plus size={16} />
                        <span>Nueva Zona Táctica</span>
                    </Boton>
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Zonas Activas', valor: zonas?.length || 0, color: 'text-primary', icon: ParkingSquare },
                    { label: 'Cap. Total', valor: totalCapacidad || 0, color: 'text-success', icon: Hash },
                    { label: 'Ocupación Total', valor: totalOcupados || 0, color: 'text-danger', icon: Activity },
                    { label: 'Reservados', valor: totalReservados || 0, color: 'text-warning', icon: Shield },
                ].map(s => {
                    const Icon = s.icon;
                    return (
                        <Card key={s.label} className="p-3 md:p-4 rounded-2xl border-white/5 flex items-center gap-3 bg-bg-card">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border", 
                                s.color.replace('text-', 'bg-') + "/10",
                                s.color.replace('text-', 'border-') + "/20"
                            )}>
                                <Icon className={s.color} size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest leading-none mb-1">{s.label}</p>
                                <p className={cn("text-lg font-display font-black leading-none", s.color)}>{String(s.valor)}</p>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Instrucciones */}
            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/15 rounded-xl">
                <Shield size={16} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[9px] text-text-muted leading-relaxed">
                    Gestiona la capacidad táctica de la base. Configura tiempos límite, georreferencia puestos y reserva espacios VIP para personal autorizado.
                </p>
            </div>
            {cargando ? (
                <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                    ))}
                </div>
            ) : zonas.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                    <ParkingSquare size={48} className="mx-auto text-white/10 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">No hay zonas registradas</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {zonas.map(zona => (
                        <ZonaRow
                            key={zona.id}
                            zona={zona}
                            entidades={entidades}
                            asignaciones={asignaciones}
                            zonas={zonas}
                            onEditar={abrirModalZona}
                            onEliminar={handleEliminarZona}
                            onGestionarPuestos={abrirModalPuestos}
                            onAjustarTiempo={abrirModalTiempo}
                            onAsignar={abrirModalAsignar}
                            onEliminarAsignacion={handleEliminarAsignacion}
                            onEliminarPuesto={handleEliminarPuesto}
                            onCapturarGPSPuesto={handleCapturarGPSPuesto}
                            onGenerarPaseBase={(z) => { setZonaActiva(z); setModalPaseBase(true); }}
                            onVerDetalle={handleVerDetalle}
                            refreshKeyBase={refreshKeyBase}
                        />
                    ))}
                </div>
            )}

            {/* ── MODAL: Crear/Editar Zona ── */}
            <Modal isOpen={modalZona} onClose={() => setModalZona(false)} title={editandoZona ? 'EDITAR ZONA' : 'NUEVA ZONA'} balanced={true}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Input label="Nombre de la Zona *" value={formZona.nombre}
                                onChange={e => setFormZona({ ...formZona, nombre: e.target.value })}
                                placeholder="Ej: Zona VIP Norte, Parqueo Logístico..." />
                        </div>
                        <Input label="Capacidad *" type="number" value={formZona.capacidad_total}
                            onChange={e => setFormZona({ ...formZona, capacidad_total: e.target.value })}
                            placeholder="Ej: 50" />
                        <Input label="Tiempo Límite (min)" type="number" value={formZona.tiempo_limite_llegada_min}
                            onChange={e => setFormZona({ ...formZona, tiempo_limite_llegada_min: e.target.value })}
                            placeholder="15" />
                        <Input label="Latitud" value={formZona.latitud}
                            onChange={e => setFormZona({ ...formZona, latitud: e.target.value })}
                            placeholder="10.123456" />
                        <Input label="Longitud" value={formZona.longitud}
                            onChange={e => setFormZona({ ...formZona, longitud: e.target.value })}
                            placeholder="-66.987654" />
                        <div className="col-span-2">
                            <Input label="Descripción de Ubicación" value={formZona.descripcion_ubicacion}
                                onChange={e => setFormZona({ ...formZona, descripcion_ubicacion: e.target.value })}
                                placeholder="Descripción breve de la zona..." />
                        </div>
                    </div>
                    <div className="col-span-2 space-y-3">
                        <Boton 
                            onClick={() => {
                                setTempPoints(formZona.poligono || []);
                                setDrawingMode(true);
                                setModalMapaReferencia(true);
                            }} 
                            className="w-full h-11 bg-warning text-black border border-black/10 text-[11px] gap-3 font-black uppercase shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.01] active:scale-[0.98] transition-all"
                        >
                            <Scissors size={15} /> 
                            <span>Establecer Límites Tácticos (Satelital)</span>
                        </Boton>

                        <Boton onClick={() => {
                            if ("geolocation" in navigator) {
                                toast.loading("Obteniendo ubicación GPS...");
                                navigator.geolocation.getCurrentPosition((pos) => {
                                    setFormZona(f => ({ ...f, latitud: pos.coords.latitude.toFixed(6), longitud: pos.coords.longitude.toFixed(6) }));
                                    toast.dismiss();
                                    toast.success("Ubicación capturada");
                                }, (err) => {
                                    toast.dismiss();
                                    toast.error("Error al obtener GPS: Permiso denegado");
                                });
                            } else {
                                toast.error("GPS no disponible en este navegador");
                            }
                        }} className="w-full h-11 bg-primary text-bg-app border border-primary/20 text-[10px] gap-2 font-black uppercase shadow-[0_0_15px_rgba(78,222,163,0.2)] hover:scale-[1.01] transition-all">
                            <MapPin size={14} /> Usar mi ubicación actual (GPS Móvil)
                        </Boton>
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-white/5">
                        <Boton variant="ghost" className="flex-1" onClick={() => setModalZona(false)}>Cancelar</Boton>
                        <Boton onClick={handleGuardarZona} disabled={guardando}
                            className="flex-[2] bg-primary text-bg-app h-12 font-black uppercase tracking-wider">
                            {guardando ? <RefreshCw size={16} className="animate-spin" /> : editandoZona ? 'Guardar Cambios' : 'Crear Zona'}
                        </Boton>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Gestión de Puestos ── */}
            <Modal isOpen={modalPuestos} onClose={() => setModalPuestos(false)} title={`GESTIÓN DE PUESTOS — ${zonaActiva?.nombre}`} balanced={true}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] text-text-muted uppercase tracking-widest">
                            Generación masiva y georreferenciación de puestos físicos.
                        </p>
                        <div className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-lg border border-primary/20">
                           CAPACIDAD: {puestosZona.length} / {zonaActiva?.capacidad_total || 0}
                        </div>
                    </div>

                    {/* Formulario LOTE (Batch) */}
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-4 shadow-inner">
                        <div className="flex items-center gap-2">
                             <Zap size={14} className="text-primary" />
                             <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">Generación por Lote (Optimizado)</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Prefijo (Ex: A)" value={batchConfig.prefijo}
                                onChange={e => setBatchConfig({ ...batchConfig, prefijo: e.target.value.toUpperCase() })}
                                placeholder="A, B, VIP..." />
                            <Input label="Cantidad" type="number" value={batchConfig.cantidad || ''}
                                onChange={e => setBatchConfig({ ...batchConfig, cantidad: e.target.value })}
                                placeholder="Ej: 50" />
                        </div>
                        <Boton onClick={handleCrearBatch} disabled={creandoBatch || !batchConfig.prefijo || !batchConfig.cantidad}
                            className="w-full h-11 bg-primary text-bg-app rounded-xl text-[11px] font-black uppercase gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                            {creandoBatch ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                            Generar Lote de Puestos
                        </Boton>
                    </div>

                    {/* Lista de puestos */}
                    {puestosZona.length > 0 ? (
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 bg-black/10 rounded-lg">
                            {puestosZona.map(p => (
                                <PuestoChip key={p.id} puesto={p} onEliminar={handleEliminarPuesto} onEditar={() => { }} onGPS={handleCapturarGPSPuesto} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-[9px] text-text-muted/30 uppercase tracking-widest py-4">
                            Sin puestos creados para esta zona
                        </p>
                    )}
                    <Boton variant="ghost" className="w-full" onClick={() => setModalPuestos(false)}>Cerrar</Boton>
                </div>
            </Modal>

            {/* ── MODAL: Asignar Puestos a Entidad ── */}
            <Modal isOpen={modalAsignar} onClose={() => setModalAsignar(false)} 
                   title={editandoAsig ? `EDITAR ASIGNACIÓN — ${zonaActiva?.nombre}` : `ASIGNAR PUESTOS — ${zonaActiva?.nombre}`} 
                   balanced={true}>
                <div className="space-y-4">
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ParkingSquare size={40} />
                        </div>
                        <p className="text-[9px] text-text-muted relative z-10">
                            Asigna una cantidad de puestos de esta zona a una entidad alojada. También puedes reservar puestos para uso exclusivo del personal de la base dentro de esa asignación.
                        </p>
                        
                        {zonaActiva && (
                            <div className="mt-3 pt-3 border-t border-primary/10 flex items-center justify-between relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-[7px] font-black uppercase tracking-widest text-text-muted/50">Disponibilidad Actual</span>
                                    <span className={cn(
                                        "text-lg font-black tracking-tight",
                                        (zonaActiva.capacidad_total - (asignaciones.filter(a => a.zona_id === zonaActiva.id && a.id !== editandoAsig?.id).reduce((acc, a) => acc + (a.cupo_asignado || 0) + (a.cupo_reservado_base || 0), 0))) <= 0 ? 'text-danger' : 'text-primary'
                                    )}>
                                        {zonaActiva.capacidad_total - (asignaciones.filter(a => a.zona_id === zonaActiva.id && a.id !== editandoAsig?.id).reduce((acc, a) => acc + (a.cupo_asignado || 0) + (a.cupo_reservado_base || 0), 0))} PUESTOS LIBRES
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[7px] font-black uppercase tracking-widest text-text-muted/50">Capacidad Total</span>
                                    <div className="text-sm font-bold text-text-main">{zonaActiva.capacidad_total} PUESTOS</div>
                                </div>
                            </div>
                        )}
                    </div>
                    <SelectTactivo 
                        label="Entidad *"
                        icon={<Building2 size={12} />}
                        placeholder="Buscar y seleccionar entidad..."
                        options={entidades.map(e => ({ value: e.id, label: e.nombre }))}
                        value={entidades.filter(e => e.id === formAsig.entidad_id).map(e => ({ value: e.id, label: e.nombre }))[0] || null}
                        onChange={(opt) => setFormAsig({ ...formAsig, entidad_id: opt ? opt.value : '' })}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Puestos asignados" type="number" value={formAsig.cupo_asignado}
                            onChange={e => setFormAsig({ ...formAsig, cupo_asignado: e.target.value })}
                            placeholder="Ej: 15" />
                        <Input label="Reservado base" type="number" value={formAsig.cupo_reservado_base}
                            onChange={e => setFormAsig({ ...formAsig, cupo_reservado_base: e.target.value })}
                            placeholder="0" />
                    </div>
                    <Input label="Notas (opcional)" value={formAsig.notes}
                        onChange={e => setFormAsig({ ...formAsig, notes: e.target.value })}
                        placeholder="Observaciones..." />
                    <div className="flex gap-3 pt-2 border-t border-white/5">
                        <Boton variant="ghost" className="flex-1" onClick={() => setModalAsignar(false)}>Cancelar</Boton>
                        <Boton onClick={handleAsignarPuestos} disabled={asignando || !formAsig.entidad_id}
                            className="flex-[2] bg-primary text-bg-app h-12 font-black uppercase">
                            {asignando ? <RefreshCw size={16} className="animate-spin" /> : <><Building2 size={15} /> {editandoAsig ? 'Actualizar Cupos' : 'Asignar Puestos'}</>}
                        </Boton>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Ajustar Tiempo Límite ── */}
            <Modal isOpen={modalTiempo} onClose={() => setModalTiempo(false)} title={`TIEMPO LÍMITE — ${zonaActiva?.nombre}`}>
                <div className="space-y-5">
                    <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl flex items-start gap-3">
                        <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                        <p className="text-[9px] text-text-muted">
                            Ajusta temporalmente el tiempo máximo permitido para que un vehículo llegue a esta zona tras pasar por la alcabala. En eventos masivos con colas, aumenta este valor.
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-[8px] font-black text-text-muted/50 uppercase tracking-widest mb-3">Tiempo límite (minutos)</p>
                        <div className="flex items-center justify-center gap-4">
                            <button onClick={() => setNuevoTiempo(Math.max(5, nuevoTiempo - 5))}
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-text-main font-black text-lg hover:bg-white/10 transition-all">
                                −
                            </button>
                            <span className="text-5xl font-black text-text-main w-24 text-center">{nuevoTiempo}</span>
                            <button onClick={() => setNuevoTiempo(Math.min(120, nuevoTiempo + 5))}
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-text-main font-black text-lg hover:bg-white/10 transition-all">
                                +
                            </button>
                        </div>
                        <p className="text-[9px] text-text-muted/40 mt-3">Config. base: {zonaActiva?.tiempo_limite_llegada_min || 15} min</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[10, 15, 20, 30, 45, 60, 90, 120].map(t => (
                            <button key={t} onClick={() => setNuevoTiempo(t)}
                                className={cn(
                                    "h-10 rounded-xl border-2 text-xs font-black transition-all",
                                    nuevoTiempo === t
                                        ? 'bg-warning/10 border-warning text-warning'
                                        : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20'
                                )}>
                                {t}m
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-white/5">
                        <Boton variant="ghost" className="flex-1" onClick={() => setModalTiempo(false)}>Cancelar</Boton>
                        <Boton onClick={handleAjustarTiempo} disabled={ajustando}
                            className="flex-[2] bg-warning text-bg-app h-12 font-black uppercase">
                            {ajustando && <RefreshCw size={16} className="animate-spin" />}
                            {!ajustando && <Timer size={15} />}
                            {ajustando ? 'Aplicando...' : 'Aplicar Tiempo'}
                        </Boton>
                    </div>
                </div>
            </Modal>
            <ModalConfirmacion
                {...confirmConfig}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
            />
            <ModalPaseBase 
                isOpen={modalPaseBase} 
                onClose={() => setModalPaseBase(false)}
                zona={zonaActiva}
                onGenerated={cargarDatos}
            />

            {/* Modal Detalle Puesto Base */}
            <Modal
                isOpen={modalDetallePuesto}
                onClose={() => setModalDetallePuesto(false)}
                title="DETALLE DE ASIGNACIÓN — BASE"
                className="lg:max-w-4xl max-w-2xl"
            >
                {puestoDetalle && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* ── COLUMNA IZQUIERDA: Detalles y Botones ── */}
                        <div className="flex flex-col gap-6 h-full">
                            <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/20">
                                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                                    <Shield className="text-primary" size={24} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-text-main uppercase">
                                        Puesto: {puestoDetalle.numero_puesto}
                                    </h4>
                                    <p className="text-[10px] text-text-muted uppercase font-bold">
                                        Acceso Prioritario de Comando
                                    </p>
                                </div>
                            </div>

                            {puestoDetalle.detalle_pase && (
                                <div className="space-y-6 flex-1">
                                    <div className="space-y-4">
                                        <h5 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                            <Users size={12} /> Datos del Portador
                                        </h5>
                                        <div className="space-y-2">
                                            <div className="flex justify-between border-b border-white/5 py-1">
                                                <span className="text-[10px] text-text-muted uppercase">Nombre:</span>
                                                <span className="text-[11px] font-bold text-text-main uppercase">{puestoDetalle.detalle_pase.nombre_portador}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/5 py-1">
                                                <span className="text-[10px] text-text-muted uppercase">Serial:</span>
                                                <span className="text-[11px] font-mono text-primary font-bold uppercase">{puestoDetalle.detalle_pase.serial_legible}</span>
                                            </div>
                                            {/* Vigencia del pase */}
                                            <div className="flex justify-between border-b border-white/5 py-1">
                                                <span className="text-[10px] text-text-muted uppercase">Válido desde:</span>
                                                <span className="text-[11px] font-bold text-text-main">
                                                    {puestoDetalle.detalle_pase.fecha_inicio
                                                        ? new Date(puestoDetalle.detalle_pase.fecha_inicio).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                        : '—'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/5 py-1">
                                                <span className="text-[10px] text-text-muted uppercase">Vence:</span>
                                                <span className={`text-[11px] font-bold ${
                                                    puestoDetalle.detalle_pase.fecha_expiracion && new Date(puestoDetalle.detalle_pase.fecha_expiracion) < new Date()
                                                        ? 'text-danger'
                                                        : 'text-warning'
                                                }`}>
                                                    {puestoDetalle.detalle_pase.fecha_expiracion
                                                        ? new Date(puestoDetalle.detalle_pase.fecha_expiracion).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                        : 'PERMANENTE'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h5 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                            <ParkingSquare size={12} /> Vehículo Asignado
                                        </h5>
                                        <div className="space-y-2">
                                            <div className="flex justify-between border-b border-white/5 py-1">
                                                <span className="text-[10px] text-text-muted uppercase">Placa:</span>
                                                <span className="text-[11px] font-bold text-text-main uppercase">{puestoDetalle.detalle_pase.vehiculo_placa}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/5 py-1">
                                                <span className="text-[10px] text-text-muted uppercase">Vehículo:</span>
                                                <span className="text-[11px] font-bold text-text-main uppercase">
                                                    {puestoDetalle.detalle_pase.vehiculo_marca} {puestoDetalle.detalle_pase.vehiculo_modelo}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Controles de Acción Integrados al Final de Columna 1 */}
                            <div className="flex flex-col gap-3 pt-6 border-t border-white/5 mt-auto">
                                <div className="flex flex-col sm:flex-row gap-3 w-full">
                                    <button
                                        onClick={handleDescargarBase}
                                        className="flex-1 h-11 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex justify-center items-center gap-2 text-[10px] font-black uppercase text-text-muted hover:text-white transition-all cursor-pointer"
                                    >
                                        <Download size={15} /> Descargar
                                    </button>
                                    <button
                                        onClick={() => setModalCompartirBase(true)}
                                        className="flex-[1.5] h-11 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 hover:border-transparent rounded-xl flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase cursor-pointer shadow-lg shadow-indigo-500/5"
                                    >
                                        <Share2 size={15} /> Compartir
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-text-muted hover:text-text-main font-black uppercase text-[10px] transition-all cursor-pointer" 
                                        onClick={() => setModalDetallePuesto(false)}
                                    >
                                        Cerrar
                                    </button>
                                    <button 
                                        className={cn(
                                            "flex-1 h-10 rounded-xl font-black uppercase text-[10px] transition-all border cursor-pointer",
                                            "bg-danger/10 text-danger border-danger/20 hover:bg-danger hover:text-white"
                                        )}
                                        onClick={handleLiberarPuestoBase}
                                        disabled={liberandoPuesto}
                                    >
                                        {liberandoPuesto ? 'Liberando...' : 'Liberar y Anular Pase'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── COLUMNA DERECHA: Visualización y Edición ── */}
                        {puestoDetalle.detalle_pase && (
                            <div className="flex flex-col p-5 bg-black/30 rounded-2xl border border-white/5 relative overflow-hidden h-full min-h-[420px]">
                                
                                {/* Contenedor Visualizable (centrado flexiblemente) */}
                                <div className="flex-1 flex flex-col justify-center items-center w-full mb-6 relative">
                                    <div 
                                        className="w-full relative rounded-2xl bg-black/20 border border-white/5 overflow-hidden transition-all duration-300 ease-in-out" 
                                        style={{ height: layout.h, maxWidth: '340px' }}
                                    >
                                        {capturando && (
                                             <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                                                 <Loader2 size={32} className="text-primary animate-spin" />
                                             </div>
                                        )}
                                        
                                        {modoExport === 'qr' ? (
                                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                                <div ref={qrSectionRef} className="bg-white rounded-2xl p-4 shadow-xl shadow-black/40" style={{ width: 188, height: 188, display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                                                    {puestoDetalle.detalle_pase?.token ? (
                                                        <QRCode value={puestoDetalle.detalle_pase.token} size={156} bgColor="#ffffff" fgColor="#0d1117" level="M" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 p-4 text-center m-auto">
                                                            <Shield size={24} className="text-danger animate-pulse" />
                                                            <span className="text-[8px] text-danger font-black uppercase">Falta Token</span>
                                                        </div>
                                                    )}
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
                                    {modoExport === 'qr' && (
                                        <div className="space-y-1 text-center mt-4">
                                            <p className="text-[8px] text-primary font-black uppercase tracking-widest">Pase Oficial Firmado</p>
                                        </div>
                                    )}
                                </div>

                                {/* Controles de Formato y Estilo ubicados siempre al fondo */}
                                <div className="w-full flex justify-center mt-auto pt-4 border-t border-white/5">
                                    <div className="w-full flex gap-3 text-left">
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
                                                    onChange={option => setPresetId(option?.value || 'militar')}
                                                    options={PRESETS_COLOR.map(p => ({ value: p.id, label: p.nombre }))}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ── MODAL: Compartir Pase ── */}
            <Modal
                isOpen={modalCompartirBase}
                onClose={() => setModalCompartirBase(false)}
                title="COMPARTIR PASE"
                balanced
                className="max-w-sm"
            >
                {puestoDetalle?.detalle_pase && (
                    <div className="space-y-4 pb-2">
                        {/* Info del pase */}
                        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                                <Shield size={18} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-text-main uppercase">{puestoDetalle.detalle_pase.nombre_portador || 'SIN REGISTRO'}</p>
                                <p className="text-[9px] text-text-muted font-mono">{puestoDetalle.detalle_pase.serial_legible}</p>
                                <p className="text-[9px] text-primary font-black">{puestoDetalle.detalle_pase.vehiculo_placa || '—'}</p>
                            </div>
                        </div>

                        {/* Canales de compartición */}
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleCompartirCanal('whatsapp')}
                                className="py-3.5 bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/20 hover:border-transparent rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-black uppercase">
                                <MessageCircle size={18} />
                                <span>WhatsApp</span>
                            </button>
                            <button onClick={() => handleCompartirCanal('telegram')}
                                className="py-3.5 bg-[#229ED9]/10 hover:bg-[#229ED9] text-[#229ED9] hover:text-white border border-[#229ED9]/20 hover:border-transparent rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-black uppercase">
                                <Send size={18} />
                                <span>Telegram</span>
                            </button>
                            <button onClick={() => handleCompartirCanal('email')}
                                className="py-3.5 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white border border-white/10 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-black uppercase">
                                <Mail size={18} />
                                <span>Email</span>
                            </button>
                            <button onClick={() => handleCompartirCanal('sms')}
                                className="py-3.5 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white border border-white/10 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-[10px] font-black uppercase">
                                <Smartphone size={18} />
                                <span>SMS</span>
                            </button>
                        </div>

                        {/* Botón PWA nativo (siempre visible, destaca en mobile) */}
                        <button onClick={() => handleCompartirCanal('pwa')}
                            className="w-full py-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500 hover:to-purple-500 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-transparent rounded-xl flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase shadow-lg shadow-indigo-500/10">
                            <Share2 size={15} /> Compartir imagen (App / PWA)
                        </button>

                        <button onClick={() => setModalCompartirBase(false)}
                            className="w-full h-9 text-text-muted hover:text-white transition-all text-[10px] font-black uppercase cursor-pointer">
                            Cerrar
                        </button>
                    </div>
                )}
            </Modal>

            {/* ── MODAL: Mapa de Referencia (Dibujo Táctico) ── */}
            <Modal 
                isOpen={modalMapaReferencia} 
                onClose={() => { 
                    setModalMapaReferencia(false); 
                    setDrawingMode(false); 
                    setAiSuggestions(null);
                }} 
                title="REFERENCIACIÓN TÁCTICA DE ÁREA"
                className="max-w-5xl h-[85vh]"
            >
                <div className="h-[calc(85vh-120px)] relative">
                    {/* LABORATORIO DE DISEÑO TÁCTICO */}
                    {drawingMode && tempPoints.length >= 3 && (
                        <div className="absolute top-4 right-4 z-[2000] w-56 pointer-events-auto">
                            <div className="bg-[#161B2B]/95 backdrop-blur-3xl border border-white/10 p-2.5 rounded-xl shadow-2xl overflow-hidden">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5 text-indigo-400">
                                        <Activity size={12} />
                                        <h3 className="text-[10px] font-black uppercase tracking-tighter">Aegis Lab</h3>
                                    </div>
                                    <span className="text-[7px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-bold">V3.1</span>
                                </div>
                                <div className="space-y-2.5">
                                    {/* CONTADOR DE CAPACIDAD IA */}
                                    {tempPoints.length >= 3 && (
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-white/5 border border-white/10 p-2 rounded-xl flex flex-col items-center">
                                                <span className="text-[8px] font-black uppercase text-text-muted">Área Bruta</span>
                                                <span className="text-sm font-black text-text-main">
                                                    {calculatePolygonArea(tempPoints).toLocaleString()} <span className="text-[8px] font-normal text-text-muted">m²</span>
                                                </span>
                                            </div>
                                            {aiSuggestions && (
                                                <div className="flex-1 bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-xl flex flex-col items-center animate-pulse">
                                                    <span className="text-[8px] font-black uppercase text-indigo-400">Puestos IA</span>
                                                    <span className="text-sm font-black text-indigo-400">
                                                        {aiSuggestions.puestosCount} <span className="text-[8px] font-normal text-indigo-400/70">Unid.</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted flex justify-between">
                                            Patrón Funcional <span>{configIA.patron === 'doble' ? 'Back-to-Back' : 'Lineal'}</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => {
                                                    setConfigIA({...configIA, patron: 'simple'});
                                                    setTimeout(() => handleAISuggestion(tempPoints), 10);
                                                }}
                                                className={cn(
                                                    "flex-1 py-1.5 rounded-lg text-[9px] font-bold border flex items-center justify-center gap-2",
                                                    configIA.patron === 'simple' ? "bg-indigo-500 border-indigo-400 text-white" : "bg-white/5 border-white/5 text-text-muted"
                                                )}
                                            >
                                                <LayoutGrid size={10}/> P-F-P
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setConfigIA({...configIA, patron: 'doble'});
                                                    setTimeout(() => handleAISuggestion(tempPoints), 10);
                                                }}
                                                className={cn(
                                                    "flex-1 py-1.5 rounded-lg text-[9px] font-bold border flex items-center justify-center gap-2",
                                                    configIA.patron === 'doble' ? "bg-indigo-500 border-indigo-400 text-white" : "bg-white/5 border-white/5 text-text-muted"
                                                )}
                                            >
                                                <Layers size={10}/> F-F-P
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[9px] font-black p-0 uppercase tracking-widest text-text-muted flex items-center gap-1">
                                                Ancho de Vía
                                            </label>
                                            <span className="text-[11px] font-mono font-bold text-indigo-400">{configIA.anchoPasillo}m</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="4" 
                                            max="12" 
                                            step="0.5"
                                            value={configIA.anchoPasillo}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setConfigIA(prev => ({ ...prev, anchoPasillo: val }));
                                                setTimeout(() => handleAISuggestion(tempPoints), 10);
                                            }}
                                            className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-indigo-500"
                                        />
                                        <div className="flex justify-between text-[7px] text-text-muted font-bold px-1 uppercase opacity-50">
                                            <span>Compactos (4m)</span>
                                            <span>Libertad (12m)</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted flex justify-between">
                                            Ángulo de Puestos <span>{configIA.angulo}°</span>
                                        </label>
                                        <div className="flex gap-2">
                                            {[90, 45, 60].map(a => (
                                                <button 
                                                    key={a}
                                                    onClick={() => {
                                                        setConfigIA({...configIA, angulo: a});
                                                        setTimeout(() => handleAISuggestion(tempPoints), 10);
                                                    }}
                                                    className={cn(
                                                        "flex-1 py-1 rounded-lg text-[9px] font-bold border transition-all",
                                                        configIA.angulo === a ? "bg-indigo-500 border-indigo-400 text-white" : "bg-white/5 border-white/5 text-text-muted"
                                                    )}
                                                >
                                                    {a}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted font-bold">Accesos</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setAccessPointMode(accessPointMode === 'entry' ? null : 'entry')}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-all text-[9px]",
                                                    accessPointMode === 'entry' ? "bg-primary/20 border-primary" : "bg-white/5 border-white/5 text-text-muted"
                                                )}
                                            >
                                                <Target size={12} className="text-primary"/> Entrada
                                            </button>
                                            <button 
                                                onClick={() => setAccessPointMode(accessPointMode === 'exit' ? null : 'exit')}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border transition-all text-[9px]",
                                                    accessPointMode === 'exit' ? "bg-danger/20 border-danger" : "bg-white/5 border-white/5 text-text-muted"
                                                )}
                                            >
                                                <X size={12} className="text-danger"/> Salida
                                            </button>
                                        </div>
                                    </div>

                                    {configIA.accesos.length > 0 && (
                                         <button 
                                            onClick={() => setConfigIA({...configIA, accesos: []})}
                                            className="w-full py-1 bg-danger/10 text-danger text-[8px] font-black uppercase rounded-lg border border-danger/20"
                                         >
                                             Limpiar Marcadores ({configIA.accesos.length})
                                         </button>
                                    )}
                                    <div className="space-y-1.5 pt-3 border-t border-white/10">
                                        <button 
                                            onClick={() => handleAISuggestion(tempPoints)}
                                            disabled={tempPoints.length < 3 || aiLoading}
                                            className="w-full py-2 bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                                        >
                                            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {aiLoading ? 'Calculando...' : 'Actualizar'}
                                        </button>
                                        <button 
                                            onClick={handleFinalizarDiseno}
                                            disabled={tempPoints.length < 3}
                                            className="w-full py-2 bg-primary text-bg-app rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                                        >
                                            <Check size={12} /> Finalizar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <MapaTactico 
                        drawingMode={drawingMode}
                        tempPoints={tempPoints}
                        aiSuggestions={aiSuggestions}
                        aiLoading={aiLoading}
                        accessPoints={configIA.accesos}
                        accessPointMode={accessPointMode}
                        onPointAdded={(lat, lng) => {
                            if (accessPointMode) {
                                setConfigIA(prev => ({
                                    ...prev,
                                    accesos: [...prev.accesos, { lat, lng, type: accessPointMode }]
                                }));
                                setAccessPointMode(null);
                                if (aiSuggestions) handleAISuggestion(tempPoints);
                                return;
                            }
                            const newPoints = [...tempPoints, [lat, lng]];
                            setTempPoints(newPoints);
                            if (aiSuggestions) handleAISuggestion(newPoints);
                        }}
                        onPointMoved={(index, lat, lng) => {
                            const newPoints = [...tempPoints];
                            newPoints[index] = [lat, lng];
                            setTempPoints(newPoints);
                            if (aiSuggestions) handleAISuggestion(newPoints);
                        }}
                        onPointDeleted={(index, importedPoints) => {
                            if (index === -1 && importedPoints) {
                                // Caso especial: Importar polígono existente del mapa
                                setTempPoints(importedPoints);
                                handleAISuggestion(importedPoints);
                                toast.success("Geometría importada para edición");
                                return;
                            }
                            const newPoints = tempPoints.filter((_, i) => i !== index);
                            setTempPoints(newPoints);
                            if (aiSuggestions) handleAISuggestion(newPoints);
                        }}
                        onAISuggestion={handleAISuggestion}
                        onPolygonComplete={(points) => {
                            const area = calculatePolygonArea(points);
                            
                            setFormZona(f => ({ 
                                ...f, 
                                poligono: points, 
                                area_m2: area,
                                capacidad_total: aiSuggestions?.puestosCount || f.capacidad_total || estimateCapacity(area),
                                // Datos para persistencia Aegis Tactic
                                config_ia: configIA,
                                grilla_tactica: aiSuggestions?.lineas || []
                            }));
                            
                            setAiSuggestions(null);
                            setModalMapaReferencia(false);
                            setDrawingMode(false);
                            toast.success(`Área georreferenciada con IA: ${area.toLocaleString()} m²`);
                        }}
                        pollingEnabled={false}
                    />
                    
                    {tempPoints.length > 0 && (
                        <button 
                            onClick={() => {
                                setTempPoints([]);
                                setAiSuggestions(null);
                                toast("Trazado eliminado", { icon: '🧹' });
                            }}
                            className="absolute bottom-[148px] left-6 z-[2001] w-11 h-11 bg-danger/90 backdrop-blur-md text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all border border-danger/20 hover:bg-danger"
                            title="Eliminar Trazo"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                </div>
            </Modal>
        </div>
    );
}
