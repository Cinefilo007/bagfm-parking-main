import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogIn, LogOut, AlertCircle, Clock, ShieldCheck, Zap, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { alcabalaService } from '../../services/alcabala.service';

const LiveEventLog = ({ puntoNombre = null }) => {
    const [eventos, setEventos] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [polling, setPolling] = useState(false);
    const [showScrollArrow, setShowScrollArrow] = useState(false);
    
    const containerRef = useRef(null);
    const isFetchingRef = useRef(false);

    const loadEventos = useCallback(async (isInitial = false, pageNum = 1) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        
        if (isInitial) setPolling(true);
        else setLoading(true);

        try {
            const data = await alcabalaService.getHistorialTactico(pageNum, 20, puntoNombre);
            
            if (isInitial || pageNum === 1) {
                // Polling or initial load: prepend new items uniquely
                setEventos(prev => {
                    if (pageNum === 1 && !isInitial) {
                        return data.items;
                    }
                    // For polling, just merge carefully (assuming ID is unique)
                    const existingIds = new Set(prev.map(e => e.id));
                    const newItems = data.items.filter(e => !existingIds.has(e.id));
                    return [...newItems, ...prev]; // Prepend new
                });
            } else {
                // Infinite scroll load more
                setEventos(prev => {
                    const existingIds = new Set(prev.map(e => e.id));
                    const newItems = data.items.filter(e => !existingIds.has(e.id));
                    return [...prev, ...newItems]; // Append at end
                });
            }

            setHasMore(data.items.length === 20);
        } catch (error) {
            console.error("Error loading tactical events:", error);
        } finally {
            if (isInitial) setPolling(false);
            else setLoading(false);
            isFetchingRef.current = false;
        }
    }, [puntoNombre]);

    // Initial Load & Polling Interval
    useEffect(() => {
        loadEventos(false, 1);
        
        const interval = setInterval(() => {
            loadEventos(true, 1);
        }, 10000); // Poll every 10 seconds

        return () => clearInterval(interval);
    }, [loadEventos]);

    // Infinite Scroll & Scroll Indicator detection
    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        
        // Detección de Infinite Scroll (Cargar más del servidor)
        if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !loading && !isFetchingRef.current) {
            setPage(prev => {
                const next = prev + 1;
                loadEventos(false, next);
                return next;
            });
        }

        // Detección de indicador visual (Flecha flotante)
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 20;
        setShowScrollArrow(!isAtBottom && scrollHeight > clientHeight);
    };

    // Verificar si hay scroll al cargar eventos o cambiar tamaño
    useEffect(() => {
        const checkScroll = () => {
            if (containerRef.current) {
                const { clientHeight, scrollHeight } = containerRef.current;
                setShowScrollArrow(scrollHeight > clientHeight + 10);
            }
        };
        checkScroll();
        // Un pequeño timeout porque las animaciones de entrada pueden cambiar el scrollHeight
        const timeout = setTimeout(checkScroll, 500);
        return () => clearTimeout(timeout);
    }, [eventos]);

    return (
        <div className="flex flex-col h-full overflow-hidden relative border border-white/5 rounded-3xl bg-bg-card/20 p-4">
            {polling && (
                <div className="absolute top-4 right-6 bg-primary/20 p-1 rounded-full animate-pulse z-10">
                    <Zap size={10} className="text-primary" />
                </div>
            )}
            
            <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4 scrollbar-tactical"
            >
                {eventos.length === 0 && !loading && !polling ? (
                    <div className="flex-1 min-h-[150px] flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl">
                        <ShieldCheck size={32} className="text-text-muted opacity-20 mb-3" />
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] opacity-40">Sin novedad en el frente</p>
                    </div>
                ) : (
                    eventos.map((evento) => (
                        <div key={evento.id} className="flex items-start gap-3 p-3 bg-bg-low/30 rounded-2xl border border-white/5 hover:bg-bg-high/10 transition-all group animate-in slide-in-from-right-4 duration-300">
                            
                            <div className="flex flex-col items-center gap-1.5 mt-0.5">
                                <div className={cn(
                                    "p-2 rounded-xl border flex items-center justify-center",
                                    evento.tipo === 'entrada' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    evento.tipo === 'salida' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                    'bg-red-500/10 text-red-500 border-red-500/20'
                                )}>
                                    {evento.tipo === 'entrada' ? <LogIn size={14} /> : 
                                     evento.tipo === 'salida' ? <LogOut size={14} /> : 
                                     <AlertCircle size={14} />}
                                </div>
                                {evento.es_pase_temporal && (
                                    <span className="px-1 py-[2px] rounded-[3px] bg-cyan-500/10 border border-cyan-500/20 text-[6px] font-black text-cyan-500 uppercase tracking-widest leading-none text-center">
                                        TEMP<br/>PASS
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-black text-text-main uppercase truncate pr-2">
                                        {evento.usuario}
                                    </span>
                                    <span className="text-[8px] font-mono text-text-muted mt-0.5 shrink-0">
                                        {(() => {
                                            const d = new Date(evento.timestamp);
                                            const s = Math.floor((new Date() - d) / 1000);
                                            if (s < 60) return 'ahora';
                                            const m = Math.floor(s / 60);
                                            if (m < 60) return `Hace ${m}m`;
                                            const h = Math.floor(m / 60);
                                            return h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h/24)}d`;
                                        })()}
                                    </span>
                                </div>
                                
                                <p className="text-[9px] text-text-muted font-bold uppercase tracking-tight mt-0.5 flex items-center gap-1">
                                    <Clock size={10} className="opacity-40" />
                                    {evento.tipo === 'entrada' ? 'Ingreso por' : 'Egreso por'} <span className="text-primary/70 truncate">{evento.punto}</span>
                                </p>
                                
                                {evento.vehiculo && evento.vehiculo !== "SIN VEHÍCULO" && (
                                    <div className="flex items-center gap-2 mt-0.5 ml-3.5">
                                        <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-1 truncate">
                                            <span className="w-1 h-1 rounded-full bg-primary/40 inline-block shrink-0"/>
                                            {evento.vehiculo}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                
                {loading && (
                    <div className="py-4 flex justify-center">
                        <div className="flex gap-1 h-1 w-12">
                            <div className="flex-1 bg-primary/40 rounded-full animate-pulse" />
                            <div className="flex-1 bg-primary/40 rounded-full animate-pulse delay-75" />
                            <div className="flex-1 bg-primary/40 rounded-full animate-pulse delay-150" />
                        </div>
                    </div>
                )}
            </div>

            {/* Indicador de más contenido (Flecha flotante) */}
            {showScrollArrow && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce pointer-events-none">
                    <div className="bg-primary/10 backdrop-blur-md p-1.5 rounded-full border border-primary/20 shadow-lg shadow-primary/10">
                        <ChevronDown size={14} className="text-primary" />
                    </div>
                </div>
            )}

            {/* Gradiente de desvanecimiento al final */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-bg-app/20 to-transparent pointer-events-none" />
        </div>
    );
};

export default LiveEventLog;
