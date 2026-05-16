import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { RefreshCw, Car as CarIcon, User as UserIcon, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import supervisorBaseService from '../../services/supervisorBase.service';
import { toast } from 'react-hot-toast';

const CensoVehicular = () => {
    const [vehiculos, setVehiculos] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await supervisorBaseService.getCensoVehicular();
            setVehiculos(data.vehiculos || []);
        } catch (error) {
            toast.error("Error al cargar censo vehicular");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-text-main uppercase tracking-tight italic">
                        Censo Vehicular en Tiempo Real
                    </h1>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Monitoreo de Fuerza de Tarea y Flujo Civil
                    </p>
                </div>
                <Boton variant="ghost" size="sm" onClick={loadData} className="h-10 w-10 p-0 bg-bg-card/30 border border-white/5">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </Boton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                    ))
                ) : vehiculos.length === 0 ? (
                    <div className="col-span-full p-20 text-center bg-bg-card/20 rounded-3xl border border-dashed border-white/10">
                        <CarIcon size={48} className="mx-auto text-text-muted/30 mb-4" />
                        <p className="text-xs font-bold text-text-muted uppercase tracking-widest">No hay vehículos reportados en base</p>
                    </div>
                ) : (
                    vehiculos.map((v) => (
                        <Card key={v.vehiculo_pase_id} className="p-4 border-white/5 bg-bg-card/40 hover:bg-bg-high/40 transition-all group relative overflow-hidden">
                            <div className="flex justify-between items-start relative z-10">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={cn(
                                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                                            v.estado === 'EN_ESTACIONAMIENTO' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                                        )}>
                                            {v.estado.replace('_', ' ')}
                                        </span>
                                        <span className="text-[10px] font-black text-primary uppercase tracking-tighter">
                                            {v.placa}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-black text-text-main uppercase truncate tracking-tight">
                                        {v.marca} {v.modelo}
                                    </h3>
                                    <div className="mt-3 space-y-1.5">
                                        <p className="text-[9px] text-text-muted font-bold uppercase flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center">
                                                <UserIcon size={10} />
                                            </div>
                                            <span className="truncate">{v.nombre_conductor}</span>
                                        </p>
                                        <p className="text-[9px] text-text-muted font-bold uppercase flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center">
                                                <MapPin size={10} />
                                            </div>
                                            <span className="truncate">{v.zona_nombre || 'Sector Desconocido'}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-2xl font-black text-text-main font-display leading-none">
                                        {v.horas_en_base || 0}h
                                    </div>
                                    <div className="text-[8px] font-black text-text-muted uppercase tracking-widest mt-1">
                                        En Base
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default CensoVehicular;
