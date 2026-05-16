import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/auth.store';
import {
  CarFront, Users, MapPin, AlertTriangle,
  TrendingUp, Activity, UserCog, Clock,
  LogIn, LogOut, Navigation, RefreshCw,
  ChevronRight, Phone, Gauge, CheckCircle2,
  XCircle, Wifi, WifiOff, TriangleAlert
} from 'lucide-react';
import { cn } from '../../lib/utils';
import api from '../../services/api';

// ── Íconos de evento en el historial ──
const IconoEvento = ({ tipo, tipo_evento }) => {
  if (tipo_evento === 'ingreso_zona' || (tipo === 'entrada' && tipo_evento === 'ingreso_zona')) {
    return <LogIn size={14} className="text-success" />;
  }
  if (tipo_evento === 'salida_zona' || (tipo === 'salida' && tipo_evento === 'salida_zona')) {
    return <LogOut size={14} className="text-warning" />;
  }
  if (tipo === 'entrada') {
    return <LogIn size={14} className="text-primary" />;
  }
  if (tipo === 'salida') {
    return <LogOut size={14} className="text-warning" />;
  }
  return <Activity size={14} className="text-text-muted" />;
};

// ── Etiqueta de tipo de evento ──
const EtiquetaEvento = ({ tipo, tipo_evento }) => {
  const config = {
    alcabala_entrada: { label: 'ALCABALA IN', color: 'text-primary border-primary/20 bg-primary/5' },
    alcabala_salida: { label: 'ALCABALA OUT', color: 'text-warning border-warning/20 bg-warning/5' },
    ingreso_zona: { label: 'INGRESO ZONA', color: 'text-success border-success/20 bg-success/5' },
    salida_zona: { label: 'SALIDA BASE', color: 'text-warning border-warning/20 bg-warning/5' },
  };

  const key = tipo_evento === 'alcabala'
    ? `alcabala_${tipo}`
    : tipo_evento;

  const cfg = config[key] || { label: tipo.toUpperCase(), color: 'text-text-muted border-white/10 bg-white/5' };

  return (
    <span className={cn(
      "text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border uppercase",
      cfg.color
    )}>
      {cfg.label}
    </span>
  );
};

function formatTimeAgo(dateString) {
  if (!dateString) return '--:--';
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Hace unos seg';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} hr${hours > 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

// ── Barra de ocupación ──
const BarraOcupacion = ({ pct }) => {
  const color = pct > 85 ? 'bg-danger' : pct > 60 ? 'bg-warning' : 'bg-primary';
  return (
    <div className="h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-1000", color)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
};

export default function DashboardEntidad() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [vistaHistorial, setVistaHistorial] = useState('flujo'); // 'flujo' | 'en_camino' | 'perdidos'

  const cargarDashboard = useCallback(async (mostrarSyncing = false) => {
    if (!user?.entidad_id) return;
    if (mostrarSyncing) setSyncing(true);
    try {
      const res = await api.get('/entidades/me/dashboard');
      setData(res.data);
      setError(null);
      setLastSync(new Date());
    } catch (e) {
      console.error('[Dashboard Entidad] Error:', e);
      setError(e.response?.data?.detail || 'Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    cargarDashboard();
    const interval = setInterval(() => cargarDashboard(true), 15000);
    return () => clearInterval(interval);
  }, [cargarDashboard]);

  const entidadNombre = data?.entidad_nombre || user?.entidad_nombre || 'PANEL DE ENTIDAD';
  const kpis = data?.kpis || {};
  const zonas = data?.zonas || [];
  const historial = data?.historial || [];
  const perdidos = data?.vehiculos_perdidos || [];
  const enCamino = data?.vehiculos_en_camino || [];
  const parqueros = data?.parqueros || [];

  // ── Pantalla de carga ──
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-app flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Iniciando Panel Táctico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-app">
      {/* Cabecera estilo Comandante */}
      <Header
        titulo={entidadNombre}
        subtitle="PANEL DE CONTROL // ENTIDAD"
        actionElement={
          <div className="flex items-center gap-3">
            {lastSync && (
              <span className="text-[9px] font-mono text-text-muted hidden sm:block">
                Sync: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => cargarDashboard(true)}
              disabled={syncing}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
              title="Actualizar datos"
            >
              <RefreshCw size={14} className={cn("text-text-muted", syncing && "animate-spin text-primary")} />
            </button>
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest",
              error
                ? "bg-danger/10 border-danger/20 text-danger"
                : "bg-primary/10 border-primary/20 text-primary"
            )}>
              {error ? <WifiOff size={10} /> : <Wifi size={10} />}
              {error ? 'ERROR' : syncing ? 'SYNC' : 'LIVE'}
            </div>
          </div>
        }
      />

      <main className="px-4 lg:px-8 mt-[-1rem] pb-28 space-y-8">

        {/* ── FILA 1: KPIs Principales ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Capacidad Total',
              valor: kpis.capacidad_total ?? 0,
              icon: MapPin,
              highlight: false
            },
            {
              label: 'Vehículos Dentro',
              valor: kpis.vehiculos_activos ?? 0,
              icon: CarFront,
              highlight: kpis.vehiculos_activos > 0 ? false : false
            },
            {
              label: 'Vehículos Perdidos',
              valor: kpis.total_perdidos ?? 0,
              icon: AlertTriangle,
              highlight: (kpis.total_perdidos ?? 0) > 0 ? 'alerta' : false
            },
            {
              label: 'Parqueros Activos',
              valor: kpis.total_parqueros ?? 0,
              icon: UserCog,
              highlight: false
            },
          ].map((stat, i) => {
            const Icono = stat.icon;
            return (
              <Card
                key={i}
                elevation={2}
                className="flex flex-col relative overflow-hidden group hover:bg-bg-high transition-all border-bg-high/10"
              >
                <div className="flex justify-between items-start mb-4">
                  <Icono
                    size={24}
                    className={
                      stat.highlight === 'alerta' ? 'text-warning' :
                      stat.highlight === 'error' ? 'text-danger' :
                      'text-primary/70'
                    }
                  />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/20 group-hover:bg-primary/50 transition-colors" />
                </div>
                <div className={cn(
                  "font-display font-black text-4xl tracking-tighter leading-none mb-1",
                  stat.highlight === 'alerta' ? 'text-warning' :
                  stat.highlight === 'error' ? 'text-danger' : 'text-text-main'
                )}>
                  {stat.valor}
                </div>
                <div className="text-[9px] uppercase font-black tracking-widest text-text-muted">
                  {stat.label}
                </div>
              </Card>
            );
          })}
        </div>

        {/* ── FILA 2: Indicadores de Uso + Socios ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Puestos Libres',
              valor: kpis.libres_total ?? 0,
              color: 'text-primary',
              bg: 'bg-primary/10',
              icon: CheckCircle2
            },
            {
              label: 'Uso Actual',
              valor: `${kpis.uso_pct ?? 0}%`,
              color: (kpis.uso_pct ?? 0) > 85 ? 'text-danger' : (kpis.uso_pct ?? 0) > 60 ? 'text-warning' : 'text-primary',
              bg: 'bg-white/5',
              icon: Gauge
            },
            {
              label: 'Socios Registrados',
              valor: kpis.total_socios ?? 0,
              color: 'text-secondary',
              bg: 'bg-secondary/10',
              icon: Users
            },
            {
              label: 'Zonas Asignadas',
              valor: zonas.length,
              color: 'text-text-main',
              bg: 'bg-white/5',
              icon: Navigation
            },
          ].map((p, i) => (
            <Card key={i} className={cn("border-white/5 flex items-center gap-4 p-5 rounded-xl", p.bg)}>
              <div className={cn("p-3 rounded-xl bg-black/20", p.color)}>
                <p.icon size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-text-muted tracking-widest leading-none mb-1">{p.label}</div>
                <div className={cn("text-2xl font-black font-display tracking-tighter", p.color)}>{p.valor}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* ── FILA 3: Historial de Flujo + Capacidad por Zona ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Historial de Flujo Vehicular */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-primary" />
                <h3 className="text-xs font-black text-text-main uppercase tracking-[0.2em] opacity-60 italic">
                  Monitor Vehicular
                </h3>
              </div>
            </div>

            {/* Pestañas de navegación */}
            <div className="flex items-center gap-1 bg-bg-low/60 p-1 rounded-xl border border-white/5">
              {[
                { id: 'flujo', label: 'Flujo', icon: Activity, count: historial.length, color: 'primary' },
                { id: 'en_camino', label: 'En Camino', icon: Navigation, count: enCamino.length, color: 'warning' },
                { id: 'perdidos', label: 'Perdidos', icon: TriangleAlert, count: perdidos.length, color: 'danger' },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = vistaHistorial === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setVistaHistorial(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      isActive
                        ? tab.id === 'perdidos'
                          ? 'bg-danger/15 text-danger border border-danger/20'
                          : tab.id === 'en_camino'
                            ? 'bg-warning/10 text-warning border border-warning/20'
                            : 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-text-muted hover:bg-white/5'
                    )}
                  >
                    <TabIcon size={10} />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={cn(
                        "ml-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black",
                        tab.id === 'perdidos' ? 'bg-danger/20 text-danger' :
                        tab.id === 'en_camino' ? 'bg-warning/20 text-warning' :
                        'bg-primary/20 text-primary'
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="bg-bg-low/40 border border-white/5 backdrop-blur-md rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]" style={{ height: '420px' }}>
              <div className="h-full overflow-y-auto p-4 space-y-2 custom-scrollbar">

                {/* ── VISTA: FLUJO ── */}
                {vistaHistorial === 'flujo' && (
                  historial.length === 0 ? (
                    <div className="h-full flex items-center justify-center flex-col opacity-20">
                      <Activity size={48} className="mb-4" />
                      <span className="text-xs font-black uppercase tracking-widest">Sin actividad operativa</span>
                    </div>
                  ) : historial.map((ev, i) => (
                    <div
                      key={ev.id || i}
                      className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5 hover:bg-white/5 transition-all group cursor-default"
                    >
                      <div className={cn(
                        "w-1 rounded-full mt-1 shrink-0",
                        ev.tipo_evento === 'alcabala' && ev.tipo === 'entrada' ? 'bg-primary h-10' :
                        ev.tipo_evento === 'alcabala' && ev.tipo === 'salida' ? 'bg-warning h-10' :
                        ev.tipo_evento === 'ingreso_zona' ? 'bg-success h-10' :
                        ev.tipo_evento === 'salida_zona' ? 'bg-secondary h-10' :
                        'bg-text-muted/30 h-10'
                      )} />
                      <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-1">
                        <IconoEvento tipo={ev.tipo} tipo_evento={ev.tipo_evento} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <EtiquetaEvento tipo={ev.tipo} tipo_evento={ev.tipo_evento} />
                          <span className="font-mono text-xs font-black text-text-main tracking-wider">{ev.placa}</span>
                          {ev.marca && (
                            <span className="text-[10px] text-text-muted truncate">
                              {[ev.marca, ev.modelo].filter(Boolean).join(' ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-text-muted truncate max-w-[180px] font-medium leading-tight">
                              {ev.portador !== 'DESCONOCIDO' ? ev.portador : 'Vehículo no registrado'}
                            </span>
                            <span className="text-[8.5px] font-mono text-text-muted/70 truncate max-w-[180px] mt-0.5 leading-tight uppercase">
                              {ev.punto_acceso}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] font-mono text-text-muted shrink-0 pt-0.5">
                            <Clock size={9} />
                            {ev.timestamp ? formatTimeAgo(ev.timestamp) : '--:--'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* ── VISTA: EN CAMINO ── */}
                {vistaHistorial === 'en_camino' && (
                  enCamino.length === 0 ? (
                    <div className="h-full flex items-center justify-center flex-col opacity-20">
                      <Navigation size={48} className="mb-4" />
                      <span className="text-xs font-black uppercase tracking-widest">Ningún vehículo en tránsito</span>
                    </div>
                  ) : enCamino.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-warning/[0.04] rounded-xl border border-warning/15 hover:bg-warning/[0.08] transition-all"
                    >
                      <div className="w-1 bg-warning h-12 rounded-full shrink-0 mt-1" />
                      <div className="w-6 h-6 rounded-lg bg-warning/10 flex items-center justify-center shrink-0 mt-1">
                        <Navigation size={13} className="text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border uppercase text-warning border-warning/20 bg-warning/5">
                            EN CAMINO
                          </span>
                          <span className="font-mono text-xs font-black text-text-main tracking-wider">{v.placa}</span>
                          {v.marca && (
                            <span className="text-[10px] text-text-muted truncate">
                              {[v.marca, v.modelo].filter(Boolean).join(' ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-text-muted font-medium leading-tight">
                              {v.portador !== 'DESCONOCIDO' ? v.portador : 'Vehículo no registrado'}
                            </span>
                            <span className="text-[8.5px] font-mono text-warning/70 uppercase leading-tight">
                              → {v.zona_nombre}
                            </span>
                            <span className="text-[8px] font-mono text-text-muted/60 uppercase leading-tight">
                              Alcabala: {v.punto_acceso}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-black text-warning">{v.minutos_transcurridos} min</div>
                            <div className="text-[8px] font-mono text-text-muted">de {v.tiempo_limite} permitidos</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* ── VISTA: PERDIDOS ── */}
                {vistaHistorial === 'perdidos' && (
                  perdidos.length === 0 ? (
                    <div className="h-full flex items-center justify-center flex-col opacity-20">
                      <CheckCircle2 size={48} className="mb-4 text-success" />
                      <span className="text-xs font-black uppercase tracking-widest">Sin vehículos perdidos</span>
                    </div>
                  ) : perdidos.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-danger/[0.07] rounded-xl border border-danger/25 hover:bg-danger/[0.12] transition-all"
                    >
                      <div className="w-1 bg-danger h-14 rounded-full shrink-0 mt-1 animate-pulse" />
                      <div className="w-6 h-6 rounded-lg bg-danger/15 flex items-center justify-center shrink-0 mt-1">
                        <TriangleAlert size={13} className="text-danger" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border uppercase text-danger border-danger/30 bg-danger/10 animate-pulse">
                            PERDIDO
                          </span>
                          <span className="font-mono text-xs font-black text-danger tracking-wider">{v.placa}</span>
                          {v.marca && (
                            <span className="text-[10px] text-text-muted truncate">
                              {[v.marca, v.modelo].filter(Boolean).join(' ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-text-muted font-medium leading-tight">
                              {v.portador !== 'DESCONOCIDO' ? v.portador : 'Desconocido'}
                            </span>
                            <span className="text-[8.5px] font-mono text-danger/60 uppercase leading-tight">
                              Destino: {v.zona_nombre || '—'}
                            </span>
                            <span className="text-[8px] font-mono text-text-muted/60 uppercase leading-tight">
                              Por: {v.punto_acceso}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] font-black text-danger">{v.minutos_transcurridos} min</div>
                            <div className="text-[8px] font-mono text-danger/50">+{v.minutos_transcurridos - v.tiempo_limite} sobre límite</div>
                            {v.telefono && (
                              <a
                                href={`tel:${v.telefono}`}
                                className="mt-1 flex items-center gap-0.5 text-[8px] font-mono text-primary hover:underline"
                              >
                                <Phone size={8} /> {v.telefono}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}

              </div>
            </div>
          </div>

          {/* Capacidad en tiempo real por zona */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <MapPin size={14} className="text-secondary" />
              <h3 className="text-xs font-black text-text-main uppercase tracking-[0.2em] opacity-60 italic">
                Capacidad en Tiempo Real
              </h3>
            </div>

            <div className="space-y-3" style={{ maxHeight: '460px', overflowY: 'auto' }}>
              {zonas.length === 0 ? (
                <div className="bg-bg-low/40 border border-white/5 rounded-2xl p-8 text-center">
                  <MapPin size={32} className="mx-auto text-text-muted opacity-20 mb-3" />
                  <p className="text-[10px] uppercase font-black tracking-widest text-text-muted opacity-40">
                    No hay zonas asignadas
                  </p>
                </div>
              ) : zonas.map((zona) => (
                <div
                  key={zona.zona_id}
                  className="bg-bg-low/40 border border-white/5 rounded-2xl p-4 space-y-3 hover:bg-white/[0.02] transition-all"
                >
                  {/* Nombre de zona y uso */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-text-main uppercase tracking-tight truncate">
                      {zona.zona_nombre}
                    </h4>
                    <span className={cn(
                      "text-lg font-black font-display leading-none",
                      zona.uso_pct > 85 ? 'text-danger' :
                      zona.uso_pct > 60 ? 'text-warning' :
                      'text-primary'
                    )}>
                      {zona.uso_pct}%
                    </span>
                  </div>

                  {/* Barra de uso */}
                  <BarraOcupacion pct={zona.uso_pct} />

                  {/* KPIs de la zona */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Cupo', val: zona.cupo_asignado, color: 'text-text-muted' },
                      { label: 'Ocupados', val: zona.ocupados, color: 'text-warning' },
                      { label: 'Libres', val: zona.libres, color: 'text-primary' },
                    ].map((k, i) => (
                      <div key={i} className="text-center p-2 bg-black/20 rounded-lg">
                        <div className={cn("text-lg font-black font-display leading-none", k.color)}>
                          {k.val}
                        </div>
                        <div className="text-[8px] uppercase font-black tracking-widest text-text-muted mt-0.5">
                          {k.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Parqueros en zona */}
                  {zona.parqueros?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                      {zona.parqueros.map((pq, i) => (
                        <span
                          key={i}
                          className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20"
                        >
                          {pq.nombre.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FILA 4: Vehículos Perdidos ── */}
        {perdidos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle size={14} className="text-warning animate-pulse" />
              <h3 className="text-xs font-black text-text-main uppercase tracking-[0.2em] opacity-80 italic">
                Alerta: Vehículos en Tránsito Retrasados
              </h3>
              <span className="px-2 py-0.5 bg-warning/10 text-warning border border-warning/20 rounded-full text-[8px] font-black uppercase tracking-widest">
                {perdidos.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {perdidos.map((p, i) => (
                <div
                  key={i}
                  className="bg-warning/5 border border-warning/20 rounded-xl p-4 space-y-2 hover:bg-warning/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-warning tracking-wider">{p.placa}</span>
                    <span className="text-[8px] font-black uppercase text-warning/70 bg-warning/10 px-2 py-0.5 rounded-full">
                      +{p.minutos_transcurridos}min
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted truncate">
                    {[p.marca, p.modelo].filter(Boolean).join(' ') || 'Sin datos del vehículo'}
                  </div>
                  <div className="text-[10px] font-black text-text-main uppercase truncate">
                    {p.portador}
                  </div>
                  {p.telefono && (
                    <a
                      href={`tel:${p.telefono}`}
                      className="flex items-center gap-1.5 text-[9px] text-primary font-bold hover:underline"
                    >
                      <Phone size={10} />
                      {p.telefono}
                    </a>
                  )}
                  <div className="text-[8px] text-text-muted font-mono">
                    Entrada: {p.hora_alcabala
                      ? new Date(p.hora_alcabala).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'
                    } · Límite: {p.tiempo_limite}min
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FILA 5: Rendimiento de Parqueros ── */}
        <div className="space-y-3 pb-6">
          <div className="flex items-center gap-2 px-1">
            <UserCog size={14} className="text-secondary" />
            <h3 className="text-xs font-black text-text-main uppercase tracking-[0.2em] opacity-60 italic">
              Rendimiento de Parqueros — Hoy
            </h3>
          </div>

          <div className="bg-bg-low/40 border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {parqueros.length === 0 ? (
                <div className="col-span-full py-12 text-center">
                  <UserCog size={40} className="mx-auto text-text-muted opacity-20 mb-3" />
                  <div className="text-[10px] uppercase font-black tracking-widest text-text-muted opacity-40">
                    No hay parqueros asignados a zonas de esta entidad
                  </div>
                </div>
              ) : parqueros.map((pq) => {
                // Buscar zona del parquero
                const zonaParquero = zonas.find(z => z.zona_id === pq.zona_id);
                return (
                  <div
                    key={pq.id}
                    className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary font-black border border-secondary/20 shrink-0">
                        {pq.nombre[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-text-main uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                          {pq.nombre}
                        </div>
                        <div className="text-[9px] text-text-muted font-bold tracking-widest uppercase truncate">
                          {zonaParquero?.zona_nombre || 'SIN ZONA'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        "text-base font-black font-display leading-none",
                        pq.ops_hoy > 0 ? 'text-primary' : 'text-text-muted/40'
                      )}>
                        {pq.ops_hoy}
                      </div>
                      <div className="text-[7px] text-text-muted uppercase font-black tracking-tighter mt-1">OPS HOY</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
