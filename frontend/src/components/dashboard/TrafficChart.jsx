import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Activity, Calendar } from 'lucide-react';
import { mapaService } from '../../services/mapaService';

const TrafficChart = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [weeksAgo, setWeeksAgo] = useState(0);

    const fetchTrafico = async () => {
        setLoading(true);
        try {
            const result = await mapaService.getTrafico(weeksAgo);
            setData(result);
        } catch (error) {
            console.error("Error cargando historial de tráfico:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrafico();
    }, [weeksAgo]);

    if (loading && !data) {
        return (
            <div className="h-full bg-bg-low/30 rounded-2xl border border-white/5 animate-pulse flex items-center justify-center">
                <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Sincronizando Métricas...</span>
            </div>
        );
    }

    const points = data?.puntos || [];
    const maxVal = Math.max(...points.map(p => p.total), 5); // Al menos 5 para escala
    const height = 120;
    const width = 600;
    const padding = 20;

    // Generar coordenadas SVG
    const chartPoints = points.map((p, i) => {
        const x = (i * (width / (points.length - 1)));
        const y = height - (p.total / maxVal) * (height - padding * 2) - padding;
        return { x, y, val: p.total, dia: p.dia };
    });

    const linePath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <div className="flex flex-col h-full bg-bg-card rounded-2xl border border-bg-high/10 overflow-hidden shadow-xl p-4">
            {/* Header con Navegación */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Activity size={16} className="text-primary" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-display font-black text-text-main uppercase tracking-[0.2em]">Flujo Vehicular</h4>
                        <div className="flex items-center gap-2 mt-0.5 opacity-60">
                           <Calendar size={10} className="text-text-muted" />
                           <span className="text-[8px] font-mono text-text-muted uppercase font-bold">
                               {data?.semana.inicio} // {data?.semana.fin}
                           </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-bg-app rounded-xl p-1 border border-white/5">
                    <button 
                        onClick={() => setWeeksAgo(prev => prev + 1)}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-text-muted hover:text-primary transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-[9px] font-black text-text-main uppercase tracking-widest px-2 min-w-[80px] text-center">
                        {weeksAgo === 0 ? 'Semana Actual' : `T - ${weeksAgo} Sem`}
                    </span>
                    <button 
                        disabled={weeksAgo === 0}
                        onClick={() => setWeeksAgo(prev => Math.max(0, prev - 1))}
                        className={`p-1.5 rounded-lg transition-all ${weeksAgo === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5 text-text-muted hover:text-primary'}`}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Gráfico SVG */}
            <div className="flex-1 relative group">
                <svg 
                    viewBox={`0 0 ${width} ${height}`} 
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                >
                    {/* Guías Horizontales */}
                    {[0, 0.5, 1].map((lvl, i) => {
                        const y = height - (lvl * (height - padding * 2)) - padding;
                        return (
                            <line 
                                key={i}
                                x1="0" y1={y} x2={width} y2={y} 
                                stroke="currentColor" 
                                className="text-white/5" 
                                strokeDasharray="4 4"
                            />
                        );
                    })}

                    {/* Sombra del Área */}
                    <path
                        d={`${linePath} L ${width} ${height} L 0 ${height} Z`}
                        fill="url(#trafficGradient)"
                        className="opacity-20"
                    />

                    {/* Línea Principal */}
                    <path
                        d={linePath}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: 'drop-shadow(0 0 8px var(--primary))' }}
                        className="transition-all duration-700"
                    />

                    {/* Puntos de Datos */}
                    {chartPoints.map((p, i) => (
                        <g key={i} className="cursor-help">
                            <circle 
                                cx={p.x} cy={p.y} r="4" 
                                fill="var(--bg-card)" 
                                stroke="var(--primary)" 
                                strokeWidth="2"
                                className="hover:scale-150 transition-transform"
                            />
                            {/* Label Flotante (simplificado) */}
                            <text 
                                x={p.x} y={p.y - 12} 
                                className="text-[10px] font-black fill-text-main opacity-0 group-hover:opacity-100 transition-opacity" 
                                textAnchor="middle"
                            >
                                {p.val}
                            </text>
                            
                            {/* Eje X (Días) */}
                            <text 
                                x={p.x} y={height + 15} 
                                className="text-[8px] font-black fill-text-muted uppercase tracking-tighter" 
                                textAnchor="middle"
                            >
                                {p.dia}
                            </text>
                        </g>
                    ))}

                    {/* Definiciones */}
                    <defs>
                        <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            
            {/* Footer / Meta */}
            <div className="mt-8 pt-3 border-t border-white/5 flex justify-between items-center">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-[8px] font-bold text-text-muted uppercase">Nivel de Alerta: Estable</span>
                    </div>
                </div>
                <span className="text-[8px] font-mono text-text-muted opacity-40">MÉTRICAS BASADAS EN CONTROL DE ACCESO</span>
            </div>
        </div>
    );
};

export default TrafficChart;
