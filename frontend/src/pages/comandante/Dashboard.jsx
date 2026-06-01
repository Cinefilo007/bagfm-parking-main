import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Target, CarFront, ShieldAlert, AlertTriangle, ArrowUpRight, Droplet, Fuel, ClipboardList, Database } from 'lucide-react';
import MapaTactico from '../../components/MapaTactico';
import EventMonitor from '../../components/dashboard/EventMonitor';
import FuelMonitor from '../../components/dashboard/FuelMonitor';
import TrafficChart from '../../components/dashboard/TrafficChart';
import { mapaService } from '../../services/mapaService';
import { combustibleService } from '../../services/combustible.service';

export default function DashboardComando() {
  const [situacion, setSituacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fuelKpis, setFuelKpis] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const data = await mapaService.getSituacion();
      setSituacion(data);
    } catch (error) {
      console.error("Error actualizando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFuelKpis = async () => {
    try {
      const data = await combustibleService.getDashboardKpis();
      setFuelKpis(data);
    } catch (error) {
      console.error("Error cargando KPIs de combustible:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchFuelKpis();
    const interval = setInterval(fetchDashboardData, 10000); // Polling accesos cada 10s
    const fuelInterval = setInterval(fetchFuelKpis, 30000); // Polling combustible cada 30s
    return () => { clearInterval(interval); clearInterval(fuelInterval); };
  }, []);

  const stats = situacion ? [
    { label: 'Vehículos Dentro', valor: situacion.vehiculos_dentro, highlight: false, icon: CarFront },
    { label: 'Accesos Hoy', valor: situacion.total_accesos_hoy, highlight: false, icon: Target },
    { label: 'Infracciones Activas', valor: situacion.alertas_activas, highlight: 'alerta', icon: AlertTriangle },
    { label: 'Bloqueados', valor: situacion.bloqueados_total || 0, highlight: 'error', icon: ShieldAlert },
  ] : [];

  const fuelStats = fuelKpis ? [
    { label: 'Litros Surtidos', valor: fuelKpis.total_litros_semana?.toLocaleString('es-ES', { maximumFractionDigits: 1 }), suffix: 'L', color: 'text-cyan-400', bgIcon: 'bg-cyan-500/10 border-cyan-500/20', icon: Droplet, link: null },
    { label: 'Cargas Semana', valor: fuelKpis.total_cargas_semana, suffix: '', color: 'text-emerald-400', bgIcon: 'bg-emerald-500/10 border-emerald-500/20', icon: Fuel, link: null },
    { label: 'Stock Combustible', valor: fuelKpis.stock_combustible_total?.toLocaleString('es-ES', { maximumFractionDigits: 0 }), suffix: 'L', color: 'text-amber-400', bgIcon: 'bg-amber-500/10 border-amber-500/20', icon: Database, link: '/combustible/tanques' },
    { label: 'Solicitudes Pendientes', valor: fuelKpis.solicitudes_pendientes, suffix: '', color: fuelKpis.solicitudes_pendientes > 0 ? 'text-orange-400' : 'text-emerald-400', bgIcon: fuelKpis.solicitudes_pendientes > 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-emerald-500/10 border-emerald-500/20', icon: ClipboardList, link: '/combustible/aprobaciones' },
    { label: 'Alertas Fraude', valor: fuelKpis.alertas_fraude_semana, suffix: '', color: fuelKpis.alertas_fraude_semana > 0 ? 'text-red-400' : 'text-emerald-400', bgIcon: fuelKpis.alertas_fraude_semana > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20', icon: ShieldAlert, link: '/combustible/reportes' },
  ] : [];

  return (
    <div className="min-h-screen bg-bg-app">
      <Header 
        titulo="Centro de Comando" 
        subtitle="ESTADO OPERATIVO // BAGFM" 
      />
      
      <main className="px-4 lg:px-8 mt-[-1rem] pb-24">
        {/* KPI ROW: 4 tarjetas de acceso vehicular */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {stats.map((stat, i) => {
            const Icono = stat.icon;
            const isSentinelLink = i === 0 || i === 1;
            const CardContent = (
              <>
                <div className="flex justify-between items-start mb-4">
                  <Icono 
                    size={24} 
                    className={
                      stat.highlight === 'alerta' ? 'text-warning' : 
                      stat.highlight === 'error' ? 'text-danger' : 
                      'text-primary/70'
                    } 
                  />
                  {isSentinelLink ? (
                    <ArrowUpRight size={14} className="text-text-muted opacity-30 group-hover:text-primary group-hover:opacity-100 transition-all" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/20 group-hover:bg-primary/50 transition-colors"></div>
                  )}
                </div>
                
                <div 
                  className={`font-display font-black text-4xl tracking-tighter leading-none mb-1 ${
                    stat.highlight === 'alerta' ? 'text-warning' : 
                    stat.highlight === 'error' ? 'text-danger' : 'text-text-main'
                  }`}
                >
                  {stat.valor}
                </div>
                
                <div className="text-[9px] uppercase font-black tracking-widest text-text-muted">
                  {stat.label}
                </div>
              </>
            );

            return isSentinelLink ? (
              <Link key={i} to="/supervisor-base/dashboard">
                <Card elevation={2} className="flex flex-col relative overflow-hidden group hover:bg-bg-high transition-all border-bg-high/10 cursor-pointer h-full">
                  {CardContent}
                </Card>
              </Link>
            ) : (
              <Card key={i} elevation={2} className="flex flex-col relative overflow-hidden group hover:bg-bg-high transition-all border-bg-high/10">
                {CardContent}
              </Card>
            );
          })}
        </div>

        {/* KPI ROW 2: 5 tarjetas de combustible (Aegis Fuel) */}
        {fuelKpis && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1.5 h-4 rounded-full bg-cyan-500" />
              <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Aegis Fuel — Bomba de Combustible</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {fuelStats.map((fs, i) => {
                const FuelIcon = fs.icon;
                const Inner = (
                  <Card key={i} elevation={2} className="flex flex-col relative overflow-hidden group hover:bg-bg-high transition-all border-bg-high/10 cursor-pointer h-full">
                    <div className="flex justify-between items-start mb-3">
                      <div className={`w-9 h-9 rounded-xl ${fs.bgIcon} border flex items-center justify-center`}>
                        <FuelIcon size={16} className={fs.color} />
                      </div>
                      {fs.link && <ArrowUpRight size={12} className="text-text-muted opacity-30 group-hover:opacity-100 transition-all" />}
                    </div>
                    <div className={`font-display font-black text-2xl tracking-tighter leading-none mb-0.5 ${fs.color}`}>
                      {fs.valor}{fs.suffix && <span className="text-sm ml-0.5 text-text-muted">{fs.suffix}</span>}
                    </div>
                    <div className="text-[8px] uppercase font-black tracking-widest text-text-muted">
                      {fs.label}
                    </div>
                  </Card>
                );
                return fs.link ? (
                  <Link key={i} to={fs.link}>{Inner}</Link>
                ) : (
                  <div key={i}>{Inner}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOTTOM SECTION: Map + Chart and Events + Fuel Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Columna Izquierda: Mapa Táctico + Gráfico (Ocupa 8/12 = 66%) */}
          <div className="flex flex-col lg:col-span-8 gap-6">
             <div className="h-[480px]">
                <MapaTactico pollingEnabled={false} situacionPreload={situacion} />
             </div>
             <div className="h-[240px] flex-shrink-0">
                <TrafficChart />
             </div>
          </div>

          {/* Columna Derecha: Monitor de Eventos + Fuel Monitor (Ocupa 4/12 = 33%) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
             <div className="h-[400px]">
                <EventMonitor situacion={situacion} />
             </div>
             <div className="h-[320px]">
                <FuelMonitor />
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}


