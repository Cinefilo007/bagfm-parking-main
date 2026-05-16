import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth.store';
import api from '../../services/api';
import { RefreshCw, AlertTriangle, ShieldAlert, CheckCircle, Clock, Car as CarIcon, FileText } from 'lucide-react';

// ─── Componentes tácticos locales ─────────────────────────────────────────────

const LayoutHeader = ({ titulo, subtitle }) => (
  <header className="sticky top-0 z-[50] bg-bg-app/90 backdrop-blur-md pb-4 pt-6 px-4 border-b border-white/5 flex items-center justify-between">
    <div>
      <p className="text-primary font-sans font-medium uppercase tracking-[0.1em] text-[10px] mb-1">{subtitle}</p>
      <h1 className="font-display font-bold text-2xl tracking-tight text-white leading-none uppercase">{titulo}</h1>
    </div>
  </header>
);

const TIPO_LABEL = {
  velocidad:       { label: 'Exceso Velocidad',  color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  estacionamiento: { label: 'Estacionamiento',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  acceso:          { label: 'Acc. No Autorizado', color: 'text-danger bg-danger/10 border-danger/20' },
  conducta:        { label: 'Conducta',           color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  documentacion:   { label: 'Documentación',      color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
};

const ESTADO_LABEL = {
  pendiente:  { label: 'Pendiente',  icon: Clock,        color: 'text-amber-400' },
  resuelta:   { label: 'Resuelta',   icon: CheckCircle,  color: 'text-primary'   },
  apelada:    { label: 'Apelada',    icon: FileText,     color: 'text-sky-400'   },
};

const InfraccionCard = ({ infraccion }) => {
  const tipo   = TIPO_LABEL[infraccion.tipo]   || { label: infraccion.tipo,   color: 'text-text-muted bg-white/5 border-white/10' };
  const estado = ESTADO_LABEL[infraccion.estado] || { label: infraccion.estado, icon: AlertTriangle, color: 'text-text-muted' };
  const EstadoIcon = estado.icon;

  return (
    <div className="p-5 bg-bg-card border border-white/5 rounded-2xl space-y-4 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${tipo.color}`}>
            {tipo.label}
          </span>
          <p className="text-sm font-bold text-text-main mt-3 leading-snug">{infraccion.descripcion}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase shrink-0 ${estado.color}`}>
          <EstadoIcon size={14} />
          {estado.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
        {infraccion.placa && (
          <div className="flex items-center gap-2 text-text-muted">
            <CarIcon size={12} className="shrink-0 opacity-40" />
            <span className="text-[10px] font-mono font-black tracking-widest text-white/60">{infraccion.placa}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-text-muted col-start-2 justify-end">
          <Clock size={12} className="shrink-0 opacity-40" />
          <span className="text-[10px] font-bold uppercase opacity-50">
            {new Date(infraccion.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {infraccion.monto_multa && (
        <div className="flex items-center justify-between bg-danger/5 border border-danger/10 rounded-xl px-4 py-2">
          <span className="text-[9px] font-black text-danger/70 uppercase tracking-widest">Multa Aplicada</span>
          <span className="text-sm font-black text-danger font-mono">${Number(infraccion.monto_multa).toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};

// ─── Página Principal ──────────────────────────────────────────────────────────

export default function InfraccionesSocio() {
  const { user } = useAuthStore();
  const [infracciones, setInfracciones] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const fetchInfracciones = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/infracciones/me');
      setInfracciones(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar las infracciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInfracciones(); }, []);

  const pendientes = infracciones.filter(i => i.estado === 'pendiente');
  const resueltas  = infracciones.filter(i => i.estado !== 'pendiente');

  return (
    <div className="min-h-screen bg-bg-app pb-24 flex flex-col font-sans text-text-main">
      <LayoutHeader titulo="Mis Infracciones" subtitle="Historial Disciplinario" />

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-2xl mx-auto w-full space-y-6">

        {/* KPI Header */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-center">
            <div className="text-3xl font-black text-danger leading-none">{pendientes.length}</div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-danger/70 mt-1">Pendientes</div>
          </div>
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-center">
            <div className="text-3xl font-black text-primary leading-none">{resueltas.length}</div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70 mt-1">Resueltas</div>
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
            <RefreshCw size={32} className="animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">Cargando Expediente...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-danger/10 border border-danger/20 rounded-2xl text-center">
            <ShieldAlert size={32} className="mx-auto text-danger mb-3 opacity-60" />
            <p className="text-sm font-black text-danger">{error}</p>
          </div>
        ) : infracciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5 border-2 border-dashed border-white/5 rounded-3xl">
            <div className="p-5 bg-primary/10 rounded-full">
              <CheckCircle size={40} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-white uppercase tracking-widest">Expediente Limpio</p>
              <p className="text-[11px] text-text-muted mt-2 font-medium opacity-60">No tienes infracciones registradas en el sistema.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendientes.length > 0 && (
              <>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-danger/70 px-1 flex items-center gap-2">
                  <AlertTriangle size={11} /> Infracciones Activas
                </p>
                {pendientes.map(i => <InfraccionCard key={i.id} infraccion={i} />)}
              </>
            )}
            {resueltas.length > 0 && (
              <>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted/50 px-1 mt-4 flex items-center gap-2">
                  <CheckCircle size={11} /> Historial Resuelto
                </p>
                {resueltas.map(i => <InfraccionCard key={i.id} infraccion={i} />)}
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
