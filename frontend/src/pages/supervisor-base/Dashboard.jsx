import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/utils';
import { 
    Shield, 
    Car as CarIcon, 
    Users, 
    AlertTriangle, 
    Map as MapIcon, 
    Radio, 
    Search, 
    RefreshCw, 
    Activity, 
    ShieldAlert, 
    ChevronRight, 
    User as UserIcon, 
    CheckCircle2,
    Filter, 
    Database, 
    ArrowUpRight
} from 'lucide-react';
import supervisorBaseService from '../../services/supervisorBase.service';
import MapaBaseReal from '../../components/MapaBaseReal';
import { toast } from 'react-hot-toast';

const AlertaBadge = ({ nivel }) => {
    const styles = {
        CRITICA: 'bg-danger/20 text-danger border-danger/30',
        ALTA: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
        MEDIA: 'bg-warning/20 text-warning border-warning/30',
        BAJA: 'bg-primary/20 text-primary border-primary/30',
        NINGUNA: 'bg-success/20 text-success border-success/30'
    };
    return (
        <span className={cn(
            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border",
            styles[nivel] || styles.NINGUNA
        )}>
            {nivel}
        </span>
    );
};

const DashboardSupervisorBase = () => {
    const [situacion, setSituacion] = useState(null);
    const [registro, setRegistro] = useState([]);
    const [infracciones, setInfracciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [sit, reg, inf] = await Promise.all([
                supervisorBaseService.getSituacion(),
                supervisorBaseService.getRegistroGlobal({ busqueda: search }),
                supervisorBaseService.getInfraccionesMapa()
            ]);
            setSituacion(sit);
            setRegistro(reg.items || []);
            setInfracciones(inf.con_coordenadas || []);
        } catch (error) {
            toast.error("Error sincronizando Sentinel");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 60000); // Cada minuto
        return () => clearInterval(interval);
    }, [search]);

    return (
        <div className="p-4 md:p-6 space-y-6 pb-24 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Táctico y KPIs */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <header className="xl:col-span-1 bg-bg-card/30 p-6 rounded-[32px] border border-white/5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-amber-400/10 rounded-2xl border border-amber-400/20">
                                <Shield className="text-amber-400" size={32} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-text-main uppercase tracking-tighter leading-none">
                                    Sentinel Interface
                                </h1>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-2">
                                    Control Táctico de Seguridad
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3 mt-8">
                            <div className="flex items-center justify-between p-4 bg-bg-app/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <CarIcon size={18} className="text-primary" />
                                    <span className="text-xs font-black text-text-muted uppercase">Censo Activo</span>
                                </div>
                                <span className="text-xl font-black text-text-main font-display">{situacion?.vehiculos_en_base || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-bg-app/40 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert size={18} className="text-danger" />
                                    <span className="text-xs font-black text-text-muted uppercase">Alertas IA</span>
                                </div>
                                <span className="text-xl font-black text-danger font-display">{situacion?.alertas_activas || 0}</span>
                            </div>
                        </div>
                    </div>
                    <Boton 
                        onClick={loadData} 
                        variant="ghost" 
                        className="mt-8 w-full border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest py-6"
                    >
                        <RefreshCw size={14} className={cn("mr-2", loading && "animate-spin")} />
                        Sincronizar Base de Datos
                    </Boton>
                </header>

                <div className="xl:col-span-2 h-[400px] xl:h-auto rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative">
                    <MapaBaseReal 
                        situacion={situacion}
                        incidentes={infracciones}
                        onSelectEntity={() => {}}
                    />
                    <div className="absolute top-6 left-6 z-[500] pointer-events-none">
                        <div className="bg-bg-modal/80 backdrop-blur-md p-4 rounded-2xl border border-white/5 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                                <span className="text-[9px] font-black text-text-main uppercase tracking-widest">Incidentes Críticos</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className="text-[9px] font-black text-text-main uppercase tracking-widest">Alcabalas Activas</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Listado Maestro Unificado */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Database size={20} className="text-primary" />
                        <h2 className="text-xl font-black text-text-main uppercase tracking-tight italic">
                            Registro Maestro de Entidades
                        </h2>
                    </div>
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="BUSCAR VEHÍCULO O PERSONA..."
                            className="w-full h-12 bg-bg-card/40 border border-white/10 rounded-xl pl-12 pr-4 text-sm font-bold text-text-main focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-text-muted/40 uppercase"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading && registro.length === 0 ? (
                        Array(6).fill(0).map((_, i) => (
                            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                        ))
                    ) : registro.length === 0 ? (
                        <div className="col-span-full p-20 text-center bg-bg-card/20 rounded-[32px] border border-dashed border-white/10">
                            <Database size={48} className="mx-auto text-text-muted/20 mb-4" />
                            <p className="text-sm font-black text-text-muted uppercase tracking-widest opacity-40">
                                Sin registros coincidentes en la base de datos
                            </p>
                        </div>
                    ) : (
                        registro.map((item) => (
                            <Card 
                                key={`${item.tipo}-${item.id}`} 
                                className="p-4 border-white/5 bg-bg-card/30 hover:bg-bg-high/40 transition-all group flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all",
                                        item.tipo === 'VEHICULO' 
                                            ? "bg-sky-500/10 border-sky-500/20 text-sky-400 group-hover:bg-sky-500 group-hover:text-white" 
                                            : "bg-primary/10 border-primary/20 text-primary group-hover:bg-primary group-hover:text-bg-app"
                                    )}>
                                        {item.tipo === 'VEHICULO' ? <CarIcon size={24} /> : <UserIcon size={24} />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <AlertaBadge nivel={item.alerta} />
                                            <span className={cn(
                                                "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                                                item.estado === 'EN_BASE' || item.estado === 'ACTIVO' 
                                                    ? "bg-success/20 text-success" 
                                                    : "bg-white/5 text-text-muted"
                                            )}>
                                                {item.estado.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-black text-text-main uppercase truncate tracking-tight">
                                            {item.titulo}
                                        </h3>
                                        <p className="text-[10px] font-bold text-text-muted uppercase truncate">
                                            {item.subtitulo}
                                        </p>
                                    </div>
                                </div>
                                <Boton variant="ghost" size="sm" className="h-10 w-10 p-0 text-text-muted/40 hover:text-primary">
                                    <ArrowUpRight size={18} />
                                </Boton>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardSupervisorBase;
