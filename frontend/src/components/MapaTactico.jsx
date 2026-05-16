import React, { useEffect, useState } from 'react';
import { 
    Target, MapPin, X, Check, Search, Filter, Maximize2, Minimize2, 
    Shield, Users, Car as CarIcon, Scissors, Square, Activity, MousePointer2, Sparkles, Layers, Loader2
} from 'lucide-react';
import { mapaService } from '../services/mapaService';
import MapaBaseReal from './MapaBaseReal';
import { Card } from './ui/Card';
import { toast } from 'react-hot-toast';
import { calculatePolygonArea, estimateCapacity } from '../lib/geometry';
import { cn } from '../lib/utils';

const MapaTactico = ({ 
    pollingEnabled = true, 
    situacionPreload = null, 
    idsZonasPermitidas = null,
    idEntidadFiltro = null,
    allowGeoreference = true,
    drawingMode = false,
    tempPoints = [],
    aiSuggestions = null,
    onPointAdded = null,
    onPolygonComplete = null,
    onAISuggestion = null,
    onPointMoved = null,
    onPointDeleted = null,
    aiLoading = false,
    accessPoints = [],
    accessPointMode = null
}) => {
    const [situacion, setSituacion] = useState(situacionPreload);
    const [loading, setLoading] = useState(!situacionPreload);
    const [selected, setSelected] = useState(null);

    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedEntityToMove, setSelectedEntityToMove] = useState(null);
    const [showSelectionModal, setShowSelectionModal] = useState(false);
    const [showPolygons, setShowPolygons] = useState(true);

    const fetchSituacion = async () => {
        try {
            let data = await mapaService.getSituacion();
            
            // Aplicar filtrado si se especifican IDs permitidos
            if (idsZonasPermitidas) {
                data = {
                    ...data,
                    zonas_estacionamiento: data.zonas_estacionamiento.filter(z => idsZonasPermitidas.includes(z.id))
                };
            }
            
            if (idEntidadFiltro) {
                data = {
                    ...data,
                    entidades: data.entidades.filter(e => e.id === idEntidadFiltro)
                };
            }

            setSituacion(data);
        } catch (error) {
            console.error("Error cargando situación táctica:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (situacionPreload) {
            let data = situacionPreload;
            if (idsZonasPermitidas && data.zonas_estacionamiento) {
                data = {
                    ...data,
                    zonas_estacionamiento: data.zonas_estacionamiento.filter(z => idsZonasPermitidas.includes(z.id))
                };
            }
            if (idEntidadFiltro && data.entidades) {
                data = {
                    ...data,
                    entidades: data.entidades.filter(e => e.id === idEntidadFiltro)
                };
            }
            setSituacion(data);
            setLoading(false);
        }
    }, [situacionPreload, idsZonasPermitidas, idEntidadFiltro]);

    useEffect(() => {
        // Carga inicial si no hay precarga
        if (!situacionPreload) {
            fetchSituacion();
        }

        // Configurar polling si está habilitado
        if (pollingEnabled) {
            const interval = setInterval(fetchSituacion, 30000);
            return () => clearInterval(interval);
        }
    }, [pollingEnabled, situacionPreload]);

    const handleMapClick = async (lat, lng) => {
        if (drawingMode && onPointAdded) {
            onPointAdded(lat, lng);
            return;
        }

        if (!selectedEntityToMove) return;

        try {
            toast.loading("Georreferenciando...", { id: 'geo' });
            await mapaService.actualizarUbicacion(
                selectedEntityToMove.tipo,
                selectedEntityToMove.id,
                lat,
                lng
            );
            toast.success("Ubicación táctica establecida", { id: 'geo' });
            setIsAssigning(false);
            setSelectedEntityToMove(null);
            fetchSituacion();
        } catch (error) {
            toast.error("Error al georreferenciar", { id: 'geo' });
        }
    };

    if (loading) return (
        <div className="h-[450px] bg-bg-card rounded-2xl flex items-center justify-center border border-bg-high/10 animate-pulse">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-primary font-display text-xs tracking-widest uppercase">Estableciendo Link Satelital...</span>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 h-full relative">
            {/* Mapa de Situación Real */}
            <div className="flex-1 relative z-0 border border-bg-high/10 rounded-3xl overflow-hidden shadow-2xl bg-bg-low">
                <MapaBaseReal
                    situacion={situacion}
                    onSelectEntity={(e) => setSelected(e)}
                    assignmentMode={isAssigning}
                    drawingMode={drawingMode}
                    tempPoints={tempPoints}
                    onPointMoved={onPointMoved}
                    onPointDeleted={onPointDeleted}
                    accessPoints={accessPoints}
                    aiSuggestions={aiSuggestions}
                    showPolygons={showPolygons}
                    onMapClick={handleMapClick}
                    selectedForMove={selectedEntityToMove}
                    isFullscreen={false}
                    hideSituacion={drawingMode}
                />

                {/* Botón flotante para Alternar Polígonos (Capas) */}
                <button
                    onClick={() => setShowPolygons(!showPolygons)}
                    className={cn(
                        "absolute bottom-[88px] left-6 z-[1000] p-3 rounded-2xl border transition-all shadow-lg",
                        showPolygons 
                            ? "bg-primary text-bg-app border-primary/20 shadow-primary/20" 
                            : "bg-bg-card/80 text-text-muted border-white/5 backdrop-blur-md"
                    )}
                    title={showPolygons ? "Ocultar Áreas de Estacionamiento" : "Mostrar Áreas de Estacionamiento"}
                >
                    <Layers size={18} className={cn(showPolygons && "animate-pulse")} />
                </button>

                {/* Overlay de Dibujo - Deshabilitado en favor del Aegis Lab Unificado */}
                {/* {drawingMode && ( ... )} */}

                {/* BOTÓN FLOTANTE: Georreferenciar */}
                {allowGeoreference && (
                    <div className="absolute bottom-6 left-6 z-[1000]">
                        {!isAssigning ? (
                            <button
                                onClick={() => setShowSelectionModal(true)}
                                className="w-12 h-12 bg-primary text-bg-app rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(78,222,163,0.4)] hover:scale-110 active:scale-95 transition-all outline-none border-none"
                            >
                                <span className="text-3xl font-light leading-none mb-1">+</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-4 bg-warning/90 backdrop-blur-md border border-warning px-4 py-2 rounded-2xl shadow-xl animate-pulse">
                                <span className="text-[10px] font-black text-bg-app uppercase tracking-widest leading-none">{selectedEntityToMove?.nombre}</span>
                                <button
                                    onClick={() => { setIsAssigning(false); setSelectedEntityToMove(null); }}
                                    className="px-3 py-1 bg-bg-app text-warning rounded-lg text-[9px] font-bold uppercase hover:bg-warning hover:text-bg-app transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Selección */}
            {showSelectionModal && (
                 <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-bg-app/50 backdrop-blur-md animate-in fade-in duration-300">
                   <div className="bg-bg-modal w-full max-w-lg rounded-2xl border border-primary/20 shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                      <div className="p-8 border-b border-white/5 flex justify-between items-center bg-bg-low/30">
                         <div>
                            <h4 className="text-sm font-display font-black uppercase tracking-[0.3em] text-primary">Georreferenciación Táctica</h4>
                            <p className="text-[9px] text-text-muted font-bold uppercase mt-1 tracking-widest opacity-60 italic">Comando de Base // Link Satelital Activo</p>
                         </div>
                         <button onClick={() => setShowSelectionModal(false)} className="p-2.5 hover:bg-white/5 rounded-full transition-all text-text-muted hover:text-danger hover:rotate-90">
                            <X size={22} />
                         </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                         <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 px-2 opacity-50 flex items-center gap-2">
                             <div className="w-1 h-1 bg-primary rounded-full animate-pulse"/> Activos Disponibles para Despliegue
                         </span>
                         {[
                            ...(situacion?.entidades || []).map(e => ({...e, tipo_label: 'Entidad Alojada', tipo: 'entidad', color: 'text-purple-400', icon: <Users size={16}/>})),
                            ...(situacion?.alcabalas || []).map(a => ({...a, tipo_label: 'Punto de Control', tipo: 'alcabala', color: 'text-primary', icon: <Shield size={16}/>})),
                            ...(situacion?.zonas_estacionamiento || []).map(z => ({...z, tipo_label: 'Zona de Parqueo', tipo: 'zona', color: 'text-warning', icon: <Car size={16}/>}))
                         ].map(item => (
                            <button 
                               key={`${item.tipo}-${item.id}`}
                               onClick={() => {
                                  setSelectedEntityToMove(item);
                                  setIsAssigning(true);
                                  setShowSelectionModal(false);
                                  toast.success(`MODO RADAR: Haz clic en el mapa para posicionar ${item.nombre}`, {
                                      icon: '📡',
                                      style: { background: '#161B2B', color: '#DEE1F7', border: '1px solid #4EDEA3' }
                                  });
                               }}
                               className="flex items-center justify-between p-5 bg-white/5 rounded-xl border border-white/5 hover:bg-primary/5 hover:border-primary/40 transition-all text-left outline-none group"
                            >
                               <div className="flex items-center gap-5">
                                  <div className={`p-4 rounded-2xl bg-bg-app border border-white/5 group-hover:border-primary/30 transition-all shadow-inner ${item.color}`}>
                                     {item.icon}
                                  </div>
                                  <div className="flex flex-col">
                                     <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${item.color}`}>{item.tipo_label}</span>
                                     <span className="text-base font-black text-text-main uppercase tracking-tight group-hover:text-primary transition-colors">{item.nombre}</span>
                                     {(!item.latitud || item.latitud === 0) && (
                                        <div className="flex items-center gap-2 mt-2">
                                           <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                                           <span className="text-[10px] text-danger font-black uppercase tracking-widest">Fuera de Radar</span>
                                        </div>
                                     )}
                                  </div>
                               </div>
                               <Target size={24} className={(!item.latitud || item.latitud === 0) ? "text-danger animate-pulse" : "text-primary opacity-20 group-hover:opacity-100 transition-all"} />
                            </button>
                         ))}
                      </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapaTactico;
