import React, { useState, useEffect, useCallback } from 'react';
import { 
    AlertTriangle, Clock, MapPin, Car, 
    RefreshCw, ChevronLeft, ShieldAlert,
    Phone, User, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { parqueroService } from '../../services/parquero.service';
import { Card } from '../../components/ui/Card';

const TarjetaVehiculoPerdido = ({ vehiculo }) => {
    return (
        <Card className="p-4 border-l-4 border-l-danger bg-danger/5 border-danger/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShieldAlert size={48} className="text-danger" />
            </div>
            
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-danger/20 flex items-center justify-center shrink-0 border border-danger/30">
                    <Car size={24} className="text-danger" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-black text-danger tracking-tighter uppercase">
                            {vehiculo.placa || 'SIN PLACA'}
                        </h3>
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-danger text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
                            <Clock size={10} />
                            +{vehiculo.minutos_transcurridos} MIN
                        </span>
                    </div>
                    
                    <p className="text-[11px] font-black text-text-main uppercase tracking-widest mt-1">
                        {vehiculo.marca} {vehiculo.modelo} {vehiculo.color && `· ${vehiculo.color}`}
                    </p>
                    
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-[10px] text-text-muted">
                            <MapPin size={12} className="text-danger/60" />
                            <span className="font-bold">ORIGEN:</span> {vehiculo.punto_alcabala}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted">
                            <Clock size={12} className="text-danger/60" />
                            <span className="font-bold">HORA ALCABALA:</span> {new Date(vehiculo.hora_alcabala).toLocaleTimeString()}
                        </div>
                        {vehiculo.nombre_conductor && (
                            <div className="flex items-center gap-2 text-[10px] text-text-muted col-span-full">
                                <User size={12} className="text-danger/60" />
                                <span className="font-bold">PORTADOR:</span> {vehiculo.nombre_conductor}
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                         {vehiculo.telefono_conductor ? (
                             <a 
                                 href={`tel:${vehiculo.telefono_conductor}`}
                                 className="flex-1 h-10 rounded-lg bg-success/20 border border-success/30 text-success text-[10px] font-black uppercase tracking-widest hover:bg-success/30 transition-all flex items-center justify-center gap-2"
                             >
                                 <Phone size={12} /> Llamar
                             </a>
                         ) : (
                             <div className="flex-1 h-10 rounded-lg bg-white/5 border border-white/10 text-text-muted text-[10px] font-black uppercase tracking-widest flex items-center justify-center">
                                 Sin Teléfono
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </Card>
    );
};

const VistaVehiculosPerdidos = () => {
    const navigate = useNavigate();
    const [perdidos, setPerdidos] = useState([]);
    const [cargando, setCargando] = useState(true);

    const cargarPerdidos = useCallback(async () => {
        try {
            const data = await parqueroService.getVehiculosPerdidos();
            setPerdidos(data);
        } catch (err) {
            toast.error("Error al cargar vehículos perdidos");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarPerdidos();
        const interval = setInterval(cargarPerdidos, 20000);
        return () => clearInterval(interval);
    }, [cargarPerdidos]);

    return (
        <div className="min-h-screen bg-bg-app pb-24">
            {/* Header Táctico */}
            <div className="bg-bg-card/90 backdrop-blur-md border-b border-white/5 px-4 py-4 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/parquero/dashboard')}
                            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:bg-white/10 transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-sm font-black text-text-main uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShieldAlert size={18} className="text-danger" />
                                Vehículos Perdidos
                            </h1>
                            <p className="text-[9px] text-text-muted font-bold tracking-widest uppercase mt-0.5">
                                Alerta de Tiempo Límite Excedido
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setCargando(true); cargarPerdidos(); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all active:scale-90"
                    >
                        <RefreshCw size={16} className={cn("text-text-muted", cargando && "animate-spin")} />
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
                {/* Banner Informativo */}
                <Card className="p-4 bg-bg-card border-warning/20 border-l-4 border-l-warning">
                    <div className="flex gap-3">
                        <AlertTriangle className="text-warning shrink-0" size={20} />
                        <div>
                            <p className="text-[10px] font-black text-warning uppercase tracking-widest">Procedimiento Crítico</p>
                            <p className="text-[9px] text-text-muted mt-1 leading-relaxed uppercase">
                                Los siguientes vehículos han pasado por la alcabala de entrada con destino a esta zona 
                                pero no han reportado ingreso en el tiempo reglamentario. 
                                <span className="text-text-main font-bold"> Verifique la ruta o notifique al Supervisor.</span>
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Listado de Perdidos */}
                {cargando && perdidos.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-4 opacity-40">
                        <RefreshCw size={40} className="animate-spin text-text-muted" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Analizando Trazabilidad...</p>
                    </div>
                ) : perdidos.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                        {perdidos.map((v, i) => (
                            <TarjetaVehiculoPerdido key={v.qr_id || i} vehiculo={v} />
                        ))}
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-success/10 border border-success/20 flex items-center justify-center relative">
                            <Car size={32} className="text-success opacity-40" />
                            <div className="absolute inset-0 rounded-full border-2 border-success/30 border-dashed animate-[spin_10s_linear_infinite]" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-black text-text-main uppercase tracking-widest">Sin Anomalías</p>
                            <p className="text-[9px] text-text-muted uppercase tracking-wider mt-1">Todos los vehículos en ruta dentro del tiempo establecido</p>
                        </div>
                        <button 
                             onClick={() => navigate('/parquero/dashboard')}
                             className="px-6 py-3 rounded-xl bg-primary text-on-primary font-black text-[10px] uppercase tracking-widest shadow-tactica hover:brightness-110 active:scale-95 transition-all"
                        >
                            Volver a Mi Zona
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VistaVehiculosPerdidos;
