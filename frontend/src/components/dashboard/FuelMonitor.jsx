import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Droplet, Activity, ClipboardList, AlertTriangle, CheckCircle2, X, Camera, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { combustibleService } from '../../services/combustible.service';

function formatTimeAgo(dateString) {
  if (!dateString) return '--';
  const d = new Date(dateString);
  const s = Math.floor((new Date() - d) / 1000);
  if (s < 60) return 'ahora';
  const m = Math.floor(s / 60);
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d`;
}

const FuelMonitor = () => {
  const [kpis, setKpis] = useState(null);
  const [vistaMonitor, setVistaMonitor] = useState('tanques');
  const [cargando, setCargando] = useState(true);
  const [abastecimientoSeleccionado, setAbastecimientoSeleccionado] = useState(null);

  const fetchKpis = async () => {
    try {
      const data = await combustibleService.getDashboardKpis();
      setKpis(data);
    } catch (err) {
      console.error("Error cargando KPIs de combustible:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 30000); // Polling cada 30s
    return () => clearInterval(interval);
  }, []);

  const tanques = kpis?.tanques || [];
  const ultimos = kpis?.ultimos_abastecimientos || [];
  const solicitudesPendientes = kpis?.solicitudes_pendientes || 0;

  const getNivelColor = (porcentaje) => {
    if (porcentaje > 50) return { bar: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    if (porcentaje > 20) return { bar: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/20' };
    return { bar: 'bg-red-500 animate-pulse', text: 'text-red-400', border: 'border-red-500/20' };
  };

  const TABS = [
    { id: 'tanques', label: 'Tanques', icon: Droplet, count: tanques.length, showCount: true },
    { id: 'flujo', label: 'Flujo', icon: Activity, count: ultimos.length, showCount: false },
    { id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList, count: solicitudesPendientes, showCount: true },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-card rounded-3xl border border-bg-high/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-bg-high/10 bg-bg-high/5 flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-xs font-display font-black text-text-main uppercase tracking-widest">Monitor SISTEMA DE COMBUSTIBLE</h3>
          <p className="text-[9px] text-text-muted font-bold font-mono uppercase mt-0.5">Bomba Combustible // Live</p>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] font-black text-emerald-400 uppercase">Sync 30s</span>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-1 bg-bg-low/40 p-1.5 mx-3 mt-3 rounded-xl border border-white/5 shrink-0">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = vistaMonitor === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setVistaMonitor(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer',
                isActive
                  ? tab.id === 'solicitudes' && solicitudesPendientes > 0
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-text-muted hover:bg-white/5'
              )}
            >
              <TabIcon size={9} />
              {tab.label}
              {tab.showCount && tab.count > 0 && (
                <span className={cn(
                  'ml-0.5 px-1 py-0.5 rounded-full text-[7px] font-black',
                  tab.id === 'solicitudes' ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-h-0 relative mt-2">
        
        {cargando ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <Flame size={36} className="mb-3 animate-pulse text-success" />
            <span className="text-[9px] font-black uppercase tracking-widest">Cargando datos de la bomba...</span>
          </div>
        ) : (
          <>
            {/* â”--”€ Tanques â”--”€ */}
            {vistaMonitor === 'tanques' && (
              <div className="h-full overflow-y-auto p-3 space-y-2.5 scrollbar-tactical">
                {tanques.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[200px] opacity-20">
                    <Droplet size={36} className="mb-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Sin tanques registrados</span>
                  </div>
                ) : tanques.map((t) => {
                  const nivel = getNivelColor(t.porcentaje);
                  return (
                    <div key={t.id} className={cn(
                      "p-3 rounded-2xl border transition-all",
                      nivel.border,
                      "bg-white/[0.02] hover:bg-white/[0.04]"
                    )}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 rounded-full" style={{ background: t.porcentaje > 50 ? '#10b981' : t.porcentaje > 20 ? '#f59e0b' : '#ef4444' }} />
                          <div>
                            <span className="text-[10px] font-black text-text-main uppercase tracking-wider block">{t.nombre}</span>
                            <span className="text-[8px] font-bold text-text-muted uppercase">
                              {t.tipo_combustible === 'gasolina' ? '⛽ Gasolina' : 'Diésel'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={cn("text-lg font-black font-display", nivel.text)}>{Math.round(t.porcentaje)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-bg-app h-2 rounded-full overflow-hidden border border-bg-high/30">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-700", nivel.bar)}
                          style={{ width: `${Math.min(t.porcentaje, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[8px] font-mono text-text-muted">
                        <span>{t.cantidad_actual.toLocaleString('es-ES', { maximumFractionDigits: 1 })} L</span>
                        <span>/ {t.capacidad_maxima.toLocaleString('es-ES', { maximumFractionDigits: 0 })} L</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* â”--”€ Flujo (Live Feed) â”--”€ */}
            {vistaMonitor === 'flujo' && (
              <div className="h-full overflow-y-auto p-3 space-y-1.5 scrollbar-tactical">
                {ultimos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[200px] opacity-20">
                    <CheckCircle2 size={36} className="mb-3 text-success" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Sin abastecimientos recientes</span>
                  </div>
                ) : ultimos.map((a, i) => (
                  <div 
                    key={a.id || i}
                    onClick={() => setAbastecimientoSeleccionado(a)}
                    className={cn(
                      "flex items-start gap-2 p-2.5 rounded-xl border transition-all cursor-pointer",
                      a.tiene_alerta 
                        ? "bg-red-500/[0.06] border-red-500/20 hover:bg-red-500/[0.1]"
                        : "bg-white/[0.02] border-bg-high/10 hover:bg-white/[0.04]"
                    )}
                  >
                    <div className={cn(
                      "w-1 h-10 rounded-full shrink-0 mt-0.5",
                      a.tiene_alerta ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                    )} />
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" 
                      style={{ background: a.tiene_alerta ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }}>
                      {a.tiene_alerta ? <AlertTriangle size={11} className="text-red-400" /> : <Droplet size={11} className="text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-[10px] font-black text-text-main tracking-wider">{a.placa}</span>
                        <span className="text-[8px] font-bold text-text-muted">{formatTimeAgo(a.fecha)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] text-text-muted truncate">{a.entidad || 'Sin Entidad'} - {a.marca} {a.modelo}</span>
                        <span className={cn(
                          "text-[9px] font-display font-black",
                          a.tiene_alerta ? 'text-red-400' : 'text-emerald-400'
                        )}>
                          {Number(a.litros).toFixed(1)} L
                        </span>
                      </div>
                      {a.tiene_alerta && (
                        <span className="text-[7px] font-black text-red-400 uppercase tracking-wider bg-red-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                          âš  Sospecha de fraude
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* â”--”€ Solicitudes â”--”€ */}
            {vistaMonitor === 'solicitudes' && (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                <div className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center mb-4",
                  solicitudesPendientes > 0 
                    ? "bg-orange-500/10 border border-orange-500/20" 
                    : "bg-emerald-500/10 border border-emerald-500/20"
                )}>
                  <span className={cn(
                    "text-3xl font-black font-display",
                    solicitudesPendientes > 0 ? 'text-orange-400' : 'text-emerald-400'
                  )}>
                    {solicitudesPendientes}
                  </span>
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest text-text-main mb-1">
                  {solicitudesPendientes > 0 ? 'Solicitudes Pendientes' : 'Sin Solicitudes Pendientes'}
                </h4>
                <p className="text-[9px] text-text-muted mb-4">
                  {solicitudesPendientes > 0
                    ? `Hay ${solicitudesPendientes} solicitud(es) de abastecimiento de emergencia esperando aprobación.`
                    : 'Todas las solicitudes de emergencia han sido resueltas.'}
                </p>
                {solicitudesPendientes > 0 && (
                  <Link
                    to="/combustible/aprobaciones"
                    className="h-10 px-6 rounded-xl bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-600 transition-all"
                  >
                    <ClipboardList size={13} />
                    Ver Cola de Aprobaciones
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-bg-high/5 border-t border-bg-high/10 flex justify-between items-center opacity-60 shrink-0">
        <span className="text-[8px] font-mono uppercase tracking-widest text-text-muted">SISTEMA DE COMBUSTIBLE Protocol v9.0</span>
        <div className="flex gap-1 h-1.5 w-16">
          <div className="flex-1 bg-emerald-500/40 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <div className="flex-1 bg-amber-500/40 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.3)] delay-75" />
          <div className="flex-1 bg-emerald-500/40 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)] delay-150" />
        </div>
      </div>

      {/* Modal Abastecimiento Detalles */}
      {abastecimientoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-bg-high/10">
              <div>
                <h3 className="text-sm font-black text-text-main font-display">DETALLES SUMINISTRO</h3>
                <p className="text-[10px] text-text-muted">{abastecimientoSeleccionado.placa} · {formatTimeAgo(abastecimientoSeleccionado.fecha)}</p>
              </div>
              <button 
                onClick={() => setAbastecimientoSeleccionado(null)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto scrollbar-tactical space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bg-low p-2.5 rounded-xl border border-white/5">
                  <p className="text-[9px] font-black uppercase text-text-muted mb-1">Litros Surtidos</p>
                  <p className="text-xl font-black font-display text-emerald-400">{Number(abastecimientoSeleccionado.litros).toFixed(1)} L</p>
                </div>
                <div className="bg-bg-low p-2.5 rounded-xl border border-white/5">
                  <p className="text-[9px] font-black uppercase text-text-muted mb-1">Responsable</p>
                  <p className="text-[11px] font-bold text-text-main flex items-center gap-1.5"><User size={12} className="text-text-muted" /> {abastecimientoSeleccionado.bombero}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5"><Camera size={12}/> Evidencia Odómetro</p>
                <div className="bg-bg-low rounded-xl border border-white/5 overflow-hidden aspect-video flex items-center justify-center">
                  {abastecimientoSeleccionado.foto_odometro ? (
                    <img src={abastecimientoSeleccionado.foto_odometro} alt="Odómetro" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-text-muted font-bold">Sin foto</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5"><Camera size={12}/> Evidencia Surtidor</p>
                <div className="bg-bg-low rounded-xl border border-white/5 overflow-hidden aspect-video flex items-center justify-center">
                  {abastecimientoSeleccionado.foto_surtidor ? (
                    <img src={abastecimientoSeleccionado.foto_surtidor} alt="Surtidor" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-text-muted font-bold">Sin foto</span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FuelMonitor;

