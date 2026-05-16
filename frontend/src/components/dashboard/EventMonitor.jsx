import React, { useState } from 'react';
import { Activity, Navigation, TriangleAlert, Phone, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import LiveEventLog from './LiveEventLog';

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

const EventMonitor = ({ situacion = null }) => {
  const [vistaMonitor, setVistaMonitor] = useState('flujo');

  const enCamino = situacion?.vehiculos_en_camino || [];
  const perdidos = situacion?.vehiculos_perdidos || [];

  const TABS = [
    { id: 'flujo', label: 'Flujo', icon: Activity, count: 0, showCount: false },
    { id: 'en_camino', label: 'Camino', icon: Navigation, count: enCamino.length, showCount: true },
    { id: 'perdidos', label: 'Perdidos', icon: TriangleAlert, count: perdidos.length, showCount: true },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-card rounded-3xl border border-bg-high/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-bg-high/10 bg-bg-high/5 flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-xs font-display font-black text-text-main uppercase tracking-widest">Monitor Táctico de Eventos</h3>
          <p className="text-[9px] text-text-muted font-bold font-mono uppercase mt-0.5">Link Satelital // Live Stream</p>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-full border border-primary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[8px] font-black text-primary uppercase">Sync</span>
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
                'flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all',
                isActive
                  ? tab.id === 'perdidos'
                    ? 'bg-danger/15 text-danger border border-danger/20'
                    : tab.id === 'en_camino'
                      ? 'bg-warning/10 text-warning border border-warning/20'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-text-muted hover:bg-white/5'
              )}
            >
              <TabIcon size={9} />
              {tab.label}
              {tab.showCount && tab.count > 0 && (
                <span className={cn(
                  'ml-0.5 px-1 py-0.5 rounded-full text-[7px] font-black',
                  tab.id === 'perdidos' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
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

        {/* ── Flujo (LiveEventLog actual) ── */}
        {vistaMonitor === 'flujo' && <LiveEventLog />}

        {/* ── En Camino ── */}
        {vistaMonitor === 'en_camino' && (
          <div className="h-full overflow-y-auto p-3 space-y-2 scrollbar-tactical">
            {enCamino.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] opacity-20">
                <Navigation size={36} className="mb-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Ningún vehículo en tránsito</span>
              </div>
            ) : enCamino.map((v, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-warning/[0.04] rounded-2xl border border-warning/15 hover:bg-warning/[0.08] transition-all">
                <div className="w-1 bg-warning h-12 rounded-full shrink-0 mt-1" />
                <div className="w-6 h-6 rounded-lg bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Navigation size={12} className="text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[10px] font-black text-text-main tracking-wider">{v.placa}</span>
                    <span className="text-[9px] font-black text-warning">{v.minutos_transcurridos}m</span>
                  </div>
                  <p className="text-[8.5px] text-text-muted font-medium truncate leading-tight">
                    {v.portador !== 'DESCONOCIDO' ? v.portador : 'Vehículo no registrado'}
                  </p>
                  <p className="text-[8px] font-mono text-warning/70 uppercase truncate leading-tight mt-0.5">
                    → {v.zona_nombre}
                  </p>
                  <p className="text-[7.5px] font-mono text-text-muted/60 uppercase truncate leading-tight">
                    {v.punto_acceso} · límite {v.tiempo_limite}m
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Perdidos ── */}
        {vistaMonitor === 'perdidos' && (
          <div className="h-full overflow-y-auto p-3 space-y-2 scrollbar-tactical">
            {perdidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] opacity-20">
                <CheckCircle2 size={36} className="mb-3 text-success" />
                <span className="text-[9px] font-black uppercase tracking-widest">Sin vehículos perdidos</span>
              </div>
            ) : perdidos.map((v, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-danger/[0.07] rounded-2xl border border-danger/25 hover:bg-danger/[0.12] transition-all">
                <div className="w-1 bg-danger h-14 rounded-full shrink-0 mt-1 animate-pulse" />
                <div className="w-6 h-6 rounded-lg bg-danger/15 flex items-center justify-center shrink-0 mt-0.5">
                  <TriangleAlert size={12} className="text-danger" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[10px] font-black text-danger tracking-wider">{v.placa}</span>
                    <div className="text-right shrink-0">
                      <div className="text-[9px] font-black text-danger">{v.minutos_transcurridos}m</div>
                      <div className="text-[7px] font-mono text-danger/50">+{v.minutos_transcurridos - v.tiempo_limite} excedido</div>
                    </div>
                  </div>
                  <p className="text-[8.5px] text-text-muted font-medium truncate leading-tight">
                    {v.portador !== 'DESCONOCIDO' ? v.portador : 'Desconocido'}
                  </p>
                  <p className="text-[8px] font-mono text-danger/60 uppercase truncate leading-tight mt-0.5">
                    Destino: {v.zona_nombre || '—'}
                  </p>
                  <p className="text-[7.5px] font-mono text-text-muted/60 uppercase truncate leading-tight">
                    Por: {v.punto_acceso}
                  </p>
                  {v.telefono && (
                    <a href={`tel:${v.telefono}`} className="mt-1 flex items-center gap-1 text-[8px] font-mono text-primary hover:underline">
                      <Phone size={8} /> {v.telefono}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-bg-high/5 border-t border-bg-high/10 flex justify-between items-center opacity-60 shrink-0">
        <span className="text-[8px] font-mono uppercase tracking-widest text-text-muted">BAGFM Overlook Protocol v4.2.1</span>
        <div className="flex gap-1 h-1.5 w-16">
          <div className="flex-1 bg-emerald-500/40 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <div className="flex-1 bg-primary/40 rounded-full animate-pulse shadow-[0_0_8px_rgba(78,222,163,0.3)] delay-75" />
          <div className="flex-1 bg-emerald-500/40 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)] delay-150" />
        </div>
      </div>
    </div>
  );
};

export default EventMonitor;
