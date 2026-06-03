import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
  Droplet, TrendingUp, CarFront, ShieldCheck, Activity, Sunrise, Sunset,
  X, Check, ChevronDown, ChevronUp, Bell, FileText, User, Award
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { combustibleService } from '../../services/combustible.service';
import { entidadService } from '../../services/entidad.service';
import { useAuthStore } from '../../store/auth.store';
import { generarReporteCierre } from '../../utils/fuelReportGenerator';

// ─── Helpers ────────────────────────────────────────────────────────────────
const getNivel = (pct) => {
  if (pct > 50) return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-[0_0_14px_rgba(16,185,129,0.3)]', label: 'Óptimo' };
  if (pct > 20) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-[0_0_14px_rgba(245,158,11,0.3)]', label: 'Precaución' };
  return { bar: 'bg-red-500 animate-pulse', text: 'text-red-400', glow: 'shadow-[0_0_14px_rgba(239,68,68,0.4)]', label: 'Crítico' };
};

const formatTiempo = (iso) => {
  const seg = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (seg < 60) return `${seg}s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
};

const renderTipoBadge = (tipo) => {
  const map = {
    vehiculo_no_registrado: { label: 'No Registrado', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    vehiculo_no_autorizado: { label: 'No Autorizado', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
    limite_entidad_excedido: { label: 'Cupo Excedido', cls: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
  };
  const m = map[tipo] || { label: tipo, cls: 'bg-white/5 border-white/10 text-text-muted' };
  return <span className={cn('px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded border', m.cls)}>{m.label}</span>;
};

// ─── Componente KPI Card ─────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, unit, color = 'text-emerald-400' }) => (
  <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color === 'text-emerald-400' ? 'bg-emerald-500/10' : color === 'text-amber-400' ? 'bg-amber-500/10' : 'bg-blue-500/10')}>
        <Icon size={16} className={color} />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className={cn('text-2xl font-black font-display', color)}>{value}</span>
      {unit && <span className="text-xs text-text-muted font-bold">{unit}</span>}
    </div>
  </div>
);

// ─── Componente TanqueCard ────────────────────────────────────────────────────
const TanqueCard = ({ tanque, onRegistrarLectura }) => {
  const nivel = getNivel(tanque.porcentaje);
  return (
    <div className={cn('bg-bg-card border rounded-xl p-4 space-y-3 relative overflow-hidden', nivel.glow, 'border-bg-high/50')}>
      <div className={cn('absolute -right-3 -top-3 w-20 h-20 rounded-full filter blur-3xl opacity-10 pointer-events-none', tanque.porcentaje > 50 ? 'bg-emerald-500' : tanque.porcentaje > 20 ? 'bg-amber-500' : 'bg-red-500')} />
      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-text-main">{tanque.nombre}</h3>
            <span className={cn('text-[8px] font-black uppercase px-1.5 py-0.5 rounded mt-1 inline-block',
              tanque.tipo_combustible === 'gasolina' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            )}>
              {tanque.tipo_combustible === 'gasolina' ? '⛽ Gasolina' : '🛢️ Diésel'}
            </span>
          </div>
          <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full', nivel.text,
            tanque.porcentaje > 50 ? 'bg-emerald-500/10' : tanque.porcentaje > 20 ? 'bg-amber-500/10' : 'bg-red-500/10'
          )}>
            {nivel.label}
          </span>
        </div>
        {/* Nivel */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className={cn('text-3xl font-black font-display', nivel.text)}>{Math.round(tanque.porcentaje)}</span>
          <span className="text-xs font-black text-text-muted">%</span>
        </div>
        <div className="w-full bg-bg-app h-2.5 rounded-full overflow-hidden border border-bg-high/40 mb-2">
          <div className={cn('h-full rounded-full transition-all duration-700', nivel.bar)} style={{ width: `${Math.min(tanque.porcentaje, 100)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] mb-3">
          <span className="font-display font-black text-text-main">{Number(tanque.cantidad_actual).toFixed(1)} L</span>
          <span className="text-text-muted font-mono">/ {Number(tanque.capacidad_maxima).toFixed(0)} L máx</span>
        </div>
        {/* Badges apertura/cierre */}
        <div className="flex gap-2 flex-wrap">
          <span className={cn('flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded border',
            tanque.tiene_apertura_hoy ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-text-muted'
          )}>
            <Sunrise size={9} /> Apertura
          </span>
          <span className={cn('flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded border',
            tanque.tiene_cierre_hoy ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-text-muted'
          )}>
            <Sunset size={9} /> Cierre
          </span>
        </div>
        {/* Botones de lectura */}
        <div className="flex gap-2 mt-3">
          {!tanque.tiene_apertura_hoy && (
            <button
              onClick={() => onRegistrarLectura(tanque, 'apertura_dia')}
              className="flex-1 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Sunrise size={10} /> Apertura
            </button>
          )}
          {tanque.tiene_apertura_hoy && !tanque.tiene_cierre_hoy && (
            <button
              onClick={() => onRegistrarLectura(tanque, 'cierre_dia')}
              className="flex-1 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-blue-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Sunset size={10} /> Cierre
            </button>
          )}
          {tanque.tiene_apertura_hoy && tanque.tiene_cierre_hoy && (
            <div className="flex-1 h-8 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-400/60 font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-1">
              <CheckCircle size={10} /> Día Completo
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function DashboardSupervisorBomberos() {
  const { user } = useAuthStore();
  const [kpis, setKpis] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [entidadesSeleccionadas, setEntidadesSeleccionadas] = useState({});
  const [modalLectura, setModalLectura] = useState(null); // { tanque, tipo }
  const [formLectura, setFormLectura] = useState({ cantidad_medida: '', observaciones: '' });
  const [guardandoLectura, setGuardandoLectura] = useState(false);
  const [tabActiva, setTabActiva] = useState('tanques'); // tanques | monitor | solicitudes
  const [fechaFiltro, setFechaFiltro] = useState('');

  const cargarKpis = useCallback(async (silencioso = false, fechaArg = null) => {
    if (!silencioso) setCargando(true);
    try {
      const fechaUsar = fechaArg !== null ? fechaArg : fechaFiltro;
      const fechaISO = fechaUsar ? new Date(fechaUsar + 'T00:00:00').toISOString() : null;
      const d = await combustibleService.getDashboardKpisSupervisorBomberos(fechaISO);
      setKpis(d);
    } catch (e) {
      if (!silencioso) toast.error('Error al cargar el dashboard.');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  const cargarSolicitudes = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargandoSolicitudes(true);
    try {
      const d = await combustibleService.getSolicitudesPendientes();
      setSolicitudes(d || []);
    } catch (e) {
      if (!silencioso) console.error(e);
    } finally {
      if (!silencioso) setCargandoSolicitudes(false);
    }
  }, []);

  useEffect(() => {
    cargarKpis(false, fechaFiltro);
    cargarSolicitudes();
    entidadService.listarEntidades().then(r => setEntidades(r || [])).catch(() => {});
    const interval = setInterval(() => {
      cargarKpis(true, fechaFiltro);
      cargarSolicitudes(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [cargarKpis, cargarSolicitudes, fechaFiltro]);

  const handleResolver = async (id, estado, placa) => {
    setProcesandoId(id);
    try {
      const entidadId = entidadesSeleccionadas[id] || null;
      await combustibleService.resolverSolicitud(id, estado, entidadId);
      toast.success(estado === 'aprobada' ? `✅ Suministro de ${placa} APROBADO` : `❌ Solicitud de ${placa} RECHAZADA`);
      setSolicitudes(prev => prev.filter(s => s.id !== id));
      cargarKpis(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al procesar la solicitud.');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleGuardarLectura = async (e) => {
    e.preventDefault();
    if (!formLectura.cantidad_medida) { toast.error('Ingrese la cantidad medida.'); return; }
    setGuardandoLectura(true);
    try {
      const res = await combustibleService.registrarLecturaDiaria({
        tanque_id: modalLectura.tanque.id,
        cantidad_medida: parseFloat(formLectura.cantidad_medida),
        observaciones: formLectura.observaciones || null,
        tipo_lectura: modalLectura.tipo,
      });
      const tipoLabel = modalLectura.tipo === 'apertura_dia' ? 'Apertura' : 'Cierre';
      toast.success(`${tipoLabel} del día registrada para "${modalLectura.tanque.nombre}".`);
      
      // Si es Cierre, generar el PDF
      if (modalLectura.tipo === 'cierre_dia') {
        const lecturaId = res.id || (res.data && res.data.id);
        const reporteData = await combustibleService.obtenerReporteCierreData(lecturaId);
        const supervisorNombre = `${user?.nombre || ''} ${user?.apellido || ''}`.trim();
        generarReporteCierre(reporteData.kpis, reporteData.modalLectura, reporteData.formLectura, supervisorNombre);
        toast.success('Reporte de cierre generado (PDF).');
      }

      setModalLectura(null);
      setFormLectura({ cantidad_medida: '', observaciones: '' });
      cargarKpis(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar la lectura.');
    } finally {
      setGuardandoLectura(false);
    }
  };

  const tabs = [
    { id: 'tanques', label: 'Tanques', icon: Droplet },
    { id: 'monitor', label: 'Monitor', icon: Activity },
    { id: 'solicitudes', label: 'Solicitudes', icon: Bell, badge: solicitudes.length },
  ];

  return (
    <div className="min-h-screen dark bg-bg-app text-text-main font-sans">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-bg-app/95 backdrop-blur border-b border-bg-high/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Flame size={18} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-widest text-text-main">Centro de Control · Bomberos</h1>
              <p className="text-[9px] text-amber-400 font-black uppercase tracking-widest">Supervisor de Bomberos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="bg-bg-card border border-bg-high/30 rounded-xl px-2 h-9 text-xs font-mono text-text-main focus:border-amber-500/50 outline-none"
            />
            <button onClick={() => { cargarKpis(false); cargarSolicitudes(false); }} className="w-9 h-9 rounded-xl bg-white/5 border border-bg-high/30 flex items-center justify-center text-text-muted hover:text-text-main transition-all cursor-pointer">
              <RefreshCw size={14} className={cargando ? 'animate-spin text-amber-400' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPIs RÁPIDOS */}
        {!cargando && kpis && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-bg-card border border-bg-high/50 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-emerald-400"><Droplet size={14} /><span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Abastecido</span></div>
              </div>
              <div className="flex justify-between items-end">
                <div><span className="text-xl font-display font-black text-emerald-400">{kpis.litros_hoy.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-text-muted">L / DÍA</span></span></div>
                <div className="text-right"><span className="text-sm font-display font-bold text-text-sec">{kpis.litros_semana?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} <span className="text-[8px] text-text-muted">L / SEM</span></span></div>
              </div>
            </div>
            
            <div className="bg-bg-card border border-bg-high/50 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-blue-400"><CarFront size={14} /><span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Cargas</span></div>
              </div>
              <div className="flex justify-between items-end">
                <div><span className="text-xl font-display font-black text-blue-400">{kpis.cargas_hoy} <span className="text-[10px] text-text-muted">/ DÍA</span></span></div>
                <div className="text-right"><span className="text-sm font-display font-bold text-text-sec">{kpis.cargas_semana || 0} <span className="text-[8px] text-text-muted">/ SEM</span></span></div>
              </div>
            </div>

            <KpiCard icon={Bell} label="Solicitudes Pendientes" value={kpis.solicitudes_pendientes} color={kpis.solicitudes_pendientes > 0 ? 'text-red-400' : 'text-text-muted'} />
            <KpiCard icon={TrendingUp} label="Stock Total" value={kpis.stock_total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unit="L" color="text-amber-400" />
          </div>
        )}
        {cargando && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="bg-bg-card border border-bg-high/50 rounded-xl p-4 h-24 animate-pulse" />)}
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-1 bg-bg-card border border-bg-high/30 rounded-xl p-1">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTabActiva(t.id)}
                className={cn(
                  'flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-all relative cursor-pointer',
                  tabActiva === t.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-text-muted hover:text-text-sec'
                )}
              >
                <Icon size={13} />
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[7px] font-black flex items-center justify-center">{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB: TANQUES */}
        {tabActiva === 'tanques' && (
          <div className="space-y-3">
            {cargando ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <RefreshCw size={28} className="animate-spin text-amber-400" />
                <p className="text-[10px] text-text-muted uppercase tracking-widest font-mono">Cargando estado de tanques...</p>
              </div>
            ) : kpis?.tanques?.length === 0 ? (
              <div className="py-16 text-center">
                <Droplet size={40} className="text-text-muted opacity-20 mx-auto mb-3" />
                <p className="text-xs text-text-muted">No hay tanques registrados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(kpis?.tanques || []).map(t => (
                  <TanqueCard key={t.id} tanque={t} onRegistrarLectura={(tanque, tipo) => { setModalLectura({ tanque, tipo }); setFormLectura({ cantidad_medida: String(tanque.cantidad_actual), observaciones: '' }); }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: MONITOR EN TIEMPO REAL */}
        {tabActiva === 'monitor' && (
          <div className="bg-bg-card border border-bg-high/50 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-bg-high/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-widest">Vehículos Abastecidos Hoy</h3>
              </div>
              <span className="text-[9px] text-text-muted font-mono bg-bg-low border border-bg-high/30 px-2 py-0.5 rounded">Auto-refresca 30s</span>
            </div>
            {cargando ? (
              <div className="py-16 flex items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-amber-400" />
              </div>
            ) : kpis?.abastecimientos_hoy?.length === 0 ? (
              <div className="py-16 text-center">
                <Activity size={40} className="text-text-muted opacity-20 mx-auto mb-3" />
                <p className="text-xs text-text-muted">Sin abastecimientos registrados hoy.</p>
              </div>
            ) : (
              <div className="divide-y divide-bg-high/20">
                {(kpis?.abastecimientos_hoy || []).map(a => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', a.tiene_alerta ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20')}>
                        <CarFront size={13} className={a.tiene_alerta ? 'text-red-400' : 'text-emerald-400'} />
                      </div>
                      <div>
                        <p className="text-xs font-black tracking-wider text-text-main">{a.placa}</p>
                        <p className="text-[9px] text-text-muted">{a.entidad} · {a.marca} {a.modelo}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-400 font-display">{Number(a.litros).toFixed(2)} L</p>
                      <p className="text-[9px] text-text-muted font-mono">Hace {formatTiempo(a.fecha)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: SOLICITUDES EXCEPCIONALES */}
        {tabActiva === 'solicitudes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-bg-card border border-bg-high/50 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Buzón de Aprobaciones</span>
              </div>
              <button onClick={() => cargarSolicitudes(false)} className="text-[9px] text-text-muted flex items-center gap-1 hover:text-text-sec cursor-pointer">
                <RefreshCw size={10} className={cargandoSolicitudes ? 'animate-spin' : ''} /> Actualizar
              </button>
            </div>

            {cargandoSolicitudes ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <RefreshCw size={24} className="animate-spin text-red-400" />
                <p className="text-[10px] text-text-muted uppercase tracking-widest font-mono">Monitoreando canal de emergencia...</p>
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 bg-bg-card border border-dashed border-bg-high/30 rounded-2xl">
                <Clock size={40} className="text-text-muted opacity-30 animate-pulse" />
                <p className="text-xs font-bold text-text-muted">Buzón Despejado</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wide">No hay solicitudes pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {solicitudes.map(sol => {
                  const esNoReg = sol.tipo_solicitud === 'vehiculo_no_registrado';
                  return (
                    <div key={sol.id} className="bg-bg-card border border-bg-high/50 rounded-xl p-4 space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-black font-display text-text-main">{sol.placa}</span>
                            {renderTipoBadge(sol.tipo_solicitud)}
                          </div>
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">
                            {sol.cantidad_solicitada} L solicitados
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-bg-low border border-bg-high/30 px-2 py-1 rounded text-[9px] font-mono text-text-muted">
                          <Clock size={9} /> Hace {formatTiempo(sol.fecha)}
                        </div>
                      </div>
                      {/* Detalles */}
                      <div className="bg-bg-app border border-bg-high/40 rounded-lg p-3 text-[10px] space-y-2">
                        {sol.conductor && (
                          <div className="flex items-center gap-2">
                            <User size={11} className="text-text-muted shrink-0" />
                            <span className="font-bold text-text-main uppercase">{sol.conductor} {sol.cedula ? `(C.I. ${sol.cedula})` : ''}</span>
                          </div>
                        )}
                        {esNoReg && (
                          <div className="flex items-center gap-2">
                            <CarFront size={11} className="text-text-muted shrink-0" />
                            <span className="font-bold text-text-main uppercase">{sol.marca || 'S/M'} · {sol.modelo || 'S/M'} · {sol.color || 'S/C'}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <FileText size={11} className="text-text-muted shrink-0 mt-0.5" />
                          <span className="text-text-sec italic">"{sol.motivo}"</span>
                        </div>
                      </div>
                      {/* Vincular entidad si no registrado */}
                      {esNoReg && (
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5"><Award size={10} /> Vincular Entidad</label>
                          <select
                            value={entidadesSeleccionadas[sol.id] || ''}
                            onChange={e => setEntidadesSeleccionadas(p => ({ ...p, [sol.id]: e.target.value }))}
                            className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-10 text-[10px] text-text-main focus:outline-none focus:border-amber-500 transition-all font-bold"
                          >
                            <option value="">-- TRÁNSITO / EXTERNO (POR DEFECTO) --</option>
                            {entidades.map(ent => <option key={ent.id} value={ent.id}>{ent.nombre.toUpperCase()}</option>)}
                          </select>
                        </div>
                      )}
                      {/* Botones */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolver(sol.id, 'rechazada', sol.placa)}
                          disabled={procesandoId !== null}
                          className="flex-1 h-11 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        >
                          <X size={12} /> Rechazar
                        </button>
                        <button
                          onClick={() => handleResolver(sol.id, 'aprobada', sol.placa)}
                          disabled={procesandoId !== null}
                          className="flex-[2] h-11 rounded-xl bg-amber-500 text-black font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-50"
                        >
                          <Check size={12} /> Aprobar Suministro
                        </button>
                      </div>
                      {/* Nota auditoría */}
                      <div className="flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                        <ShieldCheck size={10} className="text-amber-400 shrink-0" />
                        <p className="text-[8px] text-amber-400/70">Tu aprobación será registrada y notificada al Comandante y Admin Base.</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR LECTURA */}
      {modalLectura && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bg-high/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-bg-high/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {modalLectura.tipo === 'apertura_dia'
                  ? <Sunrise size={16} className="text-emerald-400" />
                  : <Sunset size={16} className="text-blue-400" />
                }
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-text-main">
                    {modalLectura.tipo === 'apertura_dia' ? 'Apertura del Día' : 'Cierre del Día'}
                  </h3>
                  <p className="text-[9px] text-text-muted">{modalLectura.tanque.nombre}</p>
                </div>
              </div>
              <button onClick={() => setModalLectura(null)} className="text-text-muted hover:text-text-main cursor-pointer"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleGuardarLectura} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Cantidad Medida (Litros) *</label>
                <input
                  type="number" step="0.1" min="0"
                  value={formLectura.cantidad_medida}
                  onChange={e => setFormLectura(p => ({ ...p, cantidad_medida: e.target.value }))}
                  placeholder={`Máx: ${modalLectura.tanque.capacidad_maxima} L`}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-12 text-sm text-text-main focus:outline-none focus:border-amber-500 transition-all font-display font-black"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Observaciones (Opcional)</label>
                <textarea
                  value={formLectura.observaciones}
                  onChange={e => setFormLectura(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Notas del turno..."
                  rows={2}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-amber-500 transition-all resize-none"
                />
              </div>
              <button
                type="submit" disabled={guardandoLectura}
                className={cn(
                  'w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50',
                  modalLectura.tipo === 'apertura_dia'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                )}
              >
                {guardandoLectura ? <RefreshCw size={14} className="animate-spin" /> : modalLectura.tipo === 'apertura_dia' ? <Sunrise size={14} /> : <Sunset size={14} />}
                {guardandoLectura ? 'Guardando...' : modalLectura.tipo === 'apertura_dia' ? 'Registrar Apertura' : 'Registrar Cierre'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
