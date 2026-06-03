import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Calendar, Compass, RefreshCw, AlertTriangle, 
  Droplet, Database, User, ShieldAlert, Award, FileText, Search
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { combustibleService } from '../../services/combustible.service';
import { entidadService } from '../../services/entidad.service';
import { useAuthStore } from '../../store/auth.store';

export default function ReporteCombustible() {
  const { user } = useAuthStore();
  const [reporte, setReporte] = useState(null);
  const [entidades, setEntidades] = useState([]);
  const [cargandoReporte, setCargandoReporte] = useState(true);
  const [cargandoEntidades, setCargandoEntidades] = useState(true);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroEntidad, setFiltroEntidad] = useState('');

  const esAdminEntidad = user?.rol === 'ADMIN_ENTIDAD';

  useEffect(() => {
    if (!esAdminEntidad) {
      cargarEntidades();
    }
    
    // Rango inicial: desde lunes de la semana actual hasta hoy
    const hoy = new Date();
    const diaSemana = hoy.getDay(); 
    const difLunes = hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1); 
    const lunes = new Date(hoy.setDate(difLunes));
    
    // Formato YYYY-MM-DD
    const fInicio = lunes.toISOString().split('T')[0];
    const fFin = new Date().toISOString().split('T')[0];
    
    setFechaInicio(fInicio);
    setFechaFin(fFin);
    
    cargarReporte(fInicio, fFin, filtroEntidad);
  }, []);

  const cargarEntidades = async () => {
    setCargandoEntidades(true);
    try {
      const res = await entidadService.listarEntidades();
      setEntidades(res || []);
    } catch (e) {
      console.error("Error al cargar entidades civiles:", e);
    } finally {
      setCargandoEntidades(false);
    }
  };

  const cargarReporte = async (inicio = fechaInicio, fin = fechaFin, entidadId = filtroEntidad) => {
    setCargandoReporte(true);
    try {
      const params = {};
      if (inicio) params.inicio = new Date(inicio + 'T00:00:00').toISOString();
      if (fin) params.fin = new Date(fin + 'T23:59:59').toISOString();
      if (entidadId && !esAdminEntidad) params.entidad_id = entidadId;

      const res = await combustibleService.getReportes(params);
      setReporte(res);
    } catch (e) {
      toast.error("Error al cargar reporte de combustible.");
    } finally {
      setCargandoReporte(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    cargarReporte();
  };

  const calcularPorcentajeConsumo = (litros, total) => {
    if (!total || total === 0) return 0;
    return Math.round((litros / total) * 100);
  };

  return (
    <div className="min-h-screen dark bg-bg-app text-text-main p-4 space-y-4 font-sans">
      {/* HEADER TÁCTICO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-card border border-bg-high/50 rounded-xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 rounded-full bg-success animate-pulse" />
            <h1 className="text-sm font-black uppercase tracking-widest text-text-main font-mono">Panel Analítico de Consumo</h1>
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Auditoría de combustible y control de inventario de la bomba</p>
        </div>
        <button 
          onClick={() => cargarReporte()}
          className="w-10 h-10 rounded-xl bg-white/5 border border-bg-high/30 flex items-center justify-center text-text-muted hover:text-text-main transition-all cursor-pointer self-end sm:self-auto"
          title="Actualizar reporte"
        >
          {cargandoReporte ? (
            <RefreshCw size={15} className="animate-spin text-success" />
          ) : (
            <RefreshCw size={15} />
          )}
        </button>
      </div>

      {/* FILTROS TÁCTICOS */}
      <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4">
        <form onSubmit={handleFiltrar} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="grid grid-cols-2 gap-3 flex-1 w-full">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                <Calendar size={11} /> Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                <Calendar size={11} /> Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
              />
            </div>
          </div>

          {!esAdminEntidad && (
            <div className="space-y-1 w-full md:w-64">
              <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                <Award size={11} /> Filtrar Entidad
              </label>
              <select
                value={filtroEntidad}
                onChange={(e) => setFiltroEntidad(e.target.value)}
                className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
              >
                <option value="">TODAS LAS ENTIDADES</option>
                {entidades.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.nombre.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full md:w-auto h-11 px-6 rounded-xl bg-success text-on-primary font-black text-[10px] uppercase tracking-widest hover:bg-success/90 transition-all cursor-pointer shadow-tactica"
          >
            Generar Reporte
          </button>
        </form>
      </div>

      {cargandoReporte ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 bg-bg-card border border-bg-high/50 rounded-xl">
          <RefreshCw size={36} className="animate-spin text-success" />
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-mono">Consolidando registros de auditoría...</p>
        </div>
      ) : reporte ? (
        <div className="space-y-4">
          {/* TARJETAS DE KPIS PRINCIPALES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: LITROS */}
            <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4 flex justify-between items-center">
              <div className="space-y-1">
                <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block">Litros Surtidos</span>
                <span className="text-3xl font-black font-display text-success tracking-wide">
                  {reporte.total_litros.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[8px] text-text-muted block uppercase">Medida de volumen real</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success/5 border border-success/15 flex items-center justify-center text-success animate-pulse-slow">
                <Droplet size={20} />
              </div>
            </div>

            {/* KPI 2: CARGAS */}
            <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4 flex justify-between items-center">
              <div className="space-y-1">
                <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block">Transacciones</span>
                <span className="text-3xl font-black font-display text-text-main tracking-wide">
                  {reporte.total_cargas}
                </span>
                <span className="text-[8px] text-text-muted block uppercase">Abastecimientos completados</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-bg-high/30 flex items-center justify-center text-text-muted">
                <Database size={20} />
              </div>
            </div>

            {/* KPI 3: GASOLINA */}
            <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block">Gasolina Surtida</span>
                  <span className="text-xl font-bold font-display text-text-main block">
                    {(reporte.consumo_por_combustible?.gasolina || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                  </span>
                </div>
                <span className="text-[9px] font-black font-display text-emerald-400">
                  {calcularPorcentajeConsumo(reporte.consumo_por_combustible?.gasolina, reporte.total_litros)}%
                </span>
              </div>
              {/* Barra de progreso */}
              <div className="w-full bg-bg-app h-2 rounded-full overflow-hidden border border-bg-high/50">
                <div 
                  className="bg-emerald-500 h-full rounded-full" 
                  style={{ width: `${calcularPorcentajeConsumo(reporte.consumo_por_combustible?.gasolina, reporte.total_litros)}%` }}
                />
              </div>
            </div>

            {/* KPI 4: Diésel */}
            <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest block">Diésel Surtido</span>
                  <span className="text-xl font-bold font-display text-text-main block">
                    {(reporte.consumo_por_combustible?.diesel || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                  </span>
                </div>
                <span className="text-[9px] font-black font-display text-blue-400">
                  {calcularPorcentajeConsumo(reporte.consumo_por_combustible?.diesel, reporte.total_litros)}%
                </span>
              </div>
              {/* Barra de progreso */}
              <div className="w-full bg-bg-app h-2 rounded-full overflow-hidden border border-bg-high/50">
                <div 
                  className="bg-blue-500 h-full rounded-full" 
                  style={{ width: `${calcularPorcentajeConsumo(reporte.consumo_por_combustible?.diesel, reporte.total_litros)}%` }}
                />
              </div>
            </div>
          </div>

          {/* CUADRICULA DE REPORTES SECUNDARIOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* SECCIÓN 1: CONSUMO POR ENTIDAD (2 tercios en pantalla grande si es Comandante) */}
            <div className={cn(
              "bg-bg-card border border-bg-high/50 rounded-xl p-4",
              esAdminEntidad ? "lg:col-span-3" : "lg:col-span-2"
            )}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4 flex items-center gap-1.5 border-b border-bg-high/20 pb-2.5">
                <Award size={13} /> Consumo por Entidad
              </h3>
              
              {reporte.consumo_por_entidad && reporte.consumo_por_entidad.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted italic">No hay registros de consumo para las entidades civiles en este período.</div>
              ) : (
                <div className="space-y-4 max-h-[350px] overflow-y-auto scrollbar-tactical pr-1.5">
                  {reporte.consumo_por_entidad?.map((row, idx) => {
                    const pct = calcularPorcentajeConsumo(row.litros, reporte.total_litros);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-text-main uppercase truncate max-w-[280px]">{row.entidad}</span>
                          <span className="font-display text-text-sec">
                            <span className="font-black text-text-main">{row.litros.toFixed(2)} L</span> ({row.cargas} cargas)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-bg-app h-2.5 rounded-full overflow-hidden border border-bg-high/50">
                            <div 
                              className="bg-success h-full rounded-full" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold font-mono text-text-muted w-7 text-right">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: AUDITORÍA DE FRAUDE Y ALERTAS (1 tercio, u horizontal completo para admin de entidad) */}
            <div className={cn(
              "bg-bg-card border border-bg-high/50 rounded-xl p-4",
              esAdminEntidad ? "lg:col-span-3" : "lg:col-span-1"
            )}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-danger mb-4 flex items-center gap-1.5 border-b border-bg-high/20 pb-2.5">
                <ShieldAlert size={14} /> Alertas de Auditoría e IA
              </h3>

              {reporte.alertas_sospechosas && reporte.alertas_sospechosas.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-1.5 text-center bg-white/5 border border-dashed border-bg-high/30 rounded-xl">
                  <CheckCircle size={28} className="text-emerald-500" />
                  <p className="text-xs text-text-muted italic">Auditoría Limpia</p>
                  <p className="text-[9px] text-text-muted uppercase font-sans">No se detectaron discrepancias en kilometraje</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto scrollbar-tactical pr-1.5">
                  {reporte.alertas_sospechosas?.map((al, idx) => (
                    <div 
                      key={idx} 
                      className="bg-red-500/5 border border-red-500/25 rounded-xl p-3 space-y-2 relative overflow-hidden"
                    >
                      <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full filter blur-xl pointer-events-none" />
                      
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <span className="text-xs font-black font-display tracking-wider text-text-main">{al.placa}</span>
                          <span className="text-[8px] text-text-muted block uppercase">Bombero: {al.bombero}</span>
                        </div>
                        <span className="text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          SOSPECHA FRAUDE
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center font-display text-[9px] py-1 bg-black/30 border border-bg-high/30 rounded">
                        <div>
                          <span className="text-text-muted text-[7px] uppercase block font-sans">Odóm. Prev</span>
                          <span className="text-text-main font-bold">{al.km_anterior} km</span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[7px] uppercase block font-sans">Odóm. Act</span>
                          <span className="text-text-main font-bold">{al.km_actual} km</span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[7px] uppercase block font-sans">Litros</span>
                          <span className="text-text-main font-bold text-danger">{al.litros} L</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[8px] text-text-muted">
                        <span className="uppercase">
                          {new Date(al.fecha).toLocaleDateString('es-ES')} · {new Date(al.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {al.km_actual <= al.km_anterior ? (
                          <span className="text-red-400 font-bold uppercase">Odómetro inconsistente</span>
                        ) : (
                          <span className="text-red-400/90 italic">Rendimiento muy bajo</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 text-center text-xs text-text-muted">Ingrese filtros y presione 'Generar Reporte' para visualizar las estadísticas de consumo.</div>
      )}
    </div>
  );
}
