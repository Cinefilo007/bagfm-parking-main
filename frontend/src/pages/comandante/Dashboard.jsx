import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Target, CarFront, ShieldAlert, AlertTriangle, ArrowUpRight } from 'lucide-react';
import MapaTactico from '../../components/MapaTactico';
import EventMonitor from '../../components/dashboard/EventMonitor';
import TrafficChart from '../../components/dashboard/TrafficChart';
import { mapaService } from '../../services/mapaService';

export default function DashboardComando() {
  const [situacion, setSituacion] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Polling cada 10s
    return () => clearInterval(interval);
  }, []);

  const stats = situacion ? [
    { label: 'Vehículos Dentro', valor: situacion.vehiculos_dentro, highlight: false, icon: CarFront },
    { label: 'Accesos Hoy', valor: situacion.total_accesos_hoy, highlight: false, icon: Target },
    { label: 'Infracciones Activas', valor: situacion.alertas_activas, highlight: 'alerta', icon: AlertTriangle },
    { label: 'Bloqueados', valor: situacion.bloqueados_total || 0, highlight: 'error', icon: ShieldAlert },
  ] : [];

  return (
    <div className="min-h-screen bg-bg-app">
      <Header 
        titulo="Centro de Comando" 
        subtitle="ESTADO OPERATIVO // BAGFM" 
      />
      
      <main className="px-4 lg:px-8 mt-[-1rem] pb-24">
        {/* KPI ROW: 4 tarjetas alineadas en pantallas grandes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

        {/* BOTTOM SECTION: 2/3 Map + Chart and 1/3 Events */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch h-[720px]">
          
          {/* Columna Izquierda: Mapa Táctico + Gráfico (Ocupa 8/12 = 66%) */}
          <div className="flex flex-col h-full lg:col-span-8 gap-6">
             <div className="flex-1 min-h-0">
                <MapaTactico pollingEnabled={false} situacionPreload={situacion} />
             </div>
             <div className="h-[240px] flex-shrink-0">
                <TrafficChart />
             </div>
          </div>

          {/* Columna Derecha: Monitor de Eventos (Ocupa 4/12 = 33%) */}
          <div className="lg:col-span-4 h-[720px] flex flex-col">
             <div className="flex-1 min-h-0">
                <EventMonitor situacion={situacion} />
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}
