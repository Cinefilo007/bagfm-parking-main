import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/utils';
import { 
    Search, Users, User as UserIcon, ChevronRight, Shield, 
    Activity, AlertTriangle, CheckCircle2, Car as CarIcon
} from 'lucide-react';
import supervisorBaseService from '../../services/supervisorBase.service';
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
            ALERTA {nivel}
        </span>
    );
};

const CensoPersonas = () => {
    const [personas, setPersonas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedPersona, setSelectedPersona] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const loadData = async (val) => {
        setLoading(true);
        try {
            const data = await supervisorBaseService.getCensoPersonas({ busqueda: val });
            setPersonas(data.personas || []);
        } catch (error) {
            toast.error("Error al buscar personas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search.length > 2) loadData(search);
            else if (search === '') loadData('');
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleVerPerfil = async (cedula) => {
        try {
            toast.loading("Obteniendo trazabilidad...", { id: 'perfil' });
            const data = await supervisorBaseService.getPerfilPersona(cedula);
            setSelectedPersona(data);
            setIsModalOpen(true);
            toast.dismiss('perfil');
        } catch (error) {
            toast.error("Error al obtener perfil", { id: 'perfil' });
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-black text-text-main uppercase tracking-tight italic">
                    Censo de Personas y Trazabilidad
                </h1>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">
                    Fusión de Identidad y Análisis de Patrones Sentinel
                </p>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                    type="text"
                    placeholder="IDENTIFICAR POR CÉDULA O NOMBRE..."
                    className="w-full h-16 bg-bg-card/40 border border-white/10 rounded-2xl pl-12 pr-4 text-sm font-bold text-text-main focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-text-muted/40 uppercase"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                    <div className="col-span-full py-20 text-center animate-pulse">
                        <Users size={32} className="mx-auto text-primary/30 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/50">Consultando Base de Datos Central</span>
                    </div>
                ) : personas.length === 0 ? (
                    <div className="col-span-full p-20 text-center bg-bg-card/20 rounded-3xl border border-dashed border-white/10">
                        <Users size={48} className="mx-auto text-text-muted/20 mb-4" />
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest opacity-40 italic">
                            {search.length > 0 ? "No se encontraron resultados" : "Ingresa una cédula o nombre para iniciar"}
                        </p>
                    </div>
                ) : (
                    personas.map((p) => (
                        <button 
                            key={p.cedula}
                            onClick={() => handleVerPerfil(p.cedula)}
                            className="flex items-center gap-4 p-5 bg-bg-card/40 border border-white/5 rounded-2xl hover:bg-bg-high/40 transition-all text-left group"
                        >
                            <div className="w-14 h-14 rounded-xl bg-bg-app border border-white/10 flex items-center justify-center text-text-muted group-hover:text-primary group-hover:border-primary/30 transition-all">
                                <UserIcon size={28} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertaBadge nivel={p.alerta_nivel} />
                                    <span className="text-[10px] font-black text-primary uppercase tracking-tighter">
                                        V-{p.cedula}
                                    </span>
                                </div>
                                <h3 className="text-sm font-black text-text-main uppercase truncate">
                                    {p.nombre_completo}
                                </h3>
                                <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-text-muted uppercase">
                                    <span>{p.total_pases} PASES</span>
                                    <span>{p.total_vehiculos} VEHÍCULOS</span>
                                    <span>{p.total_accesos} ACCESOS</span>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-text-muted/40 group-hover:text-primary transition-all" />
                        </button>
                    ))
                )}
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title="Trazabilidad Sentinel"
                className="max-w-2xl"
            >
                {selectedPersona && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-bg-low/30 rounded-2xl border border-white/5">
                            <div className="w-16 h-16 rounded-2xl bg-bg-app border border-white/10 flex items-center justify-center text-primary">
                                <Shield size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-text-main uppercase tracking-tight leading-none">
                                    {selectedPersona.nombre_completo}
                                </h2>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">
                                    DOCUMENTO: V-{selectedPersona.cedula}
                                </p>
                                <div className="mt-2">
                                    <AlertaBadge nivel={selectedPersona.alerta_nivel} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Card className="p-3 border-white/5 bg-bg-card/40">
                                <p className="text-[8px] font-black text-text-muted uppercase mb-1">Visitas 30D</p>
                                <p className="text-lg font-black text-text-main font-display">{selectedPersona.total_pases}</p>
                            </Card>
                            <Card className="p-3 border-white/5 bg-bg-card/40">
                                <p className="text-[8px] font-black text-text-muted uppercase mb-1">Vehículos</p>
                                <p className="text-lg font-black text-text-main font-display">{selectedPersona.total_vehiculos}</p>
                            </Card>
                            <Card className="p-3 border-white/5 bg-bg-card/40">
                                <p className="text-[8px] font-black text-text-muted uppercase mb-1">Punto Frec.</p>
                                <p className="text-xs font-black text-primary truncate uppercase">{selectedPersona.punto_frecuente || 'N/A'}</p>
                            </Card>
                            <Card className="p-3 border-white/5 bg-bg-card/40">
                                <p className="text-[8px] font-black text-text-muted uppercase mb-1">Alerta IA</p>
                                <p className="text-lg font-black text-danger font-display">{selectedPersona.puntos_alerta}</p>
                            </Card>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                <Activity size={14} /> Análisis de Patrones Sentinel
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {selectedPersona.hallazgos.map((h, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-danger/5 border border-danger/10 rounded-xl">
                                        <AlertTriangle size={14} className="text-danger shrink-0" />
                                        <p className="text-[10px] font-bold text-text-main uppercase">{h}</p>
                                    </div>
                                ))}
                                {selectedPersona.hallazgos.length === 0 && (
                                    <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/10 rounded-xl">
                                        <CheckCircle2 size={14} className="text-success shrink-0" />
                                        <p className="text-[10px] font-bold text-success uppercase">Sin patrones anómalos detectados</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                                <CarIcon size={14} /> Vehículos Vinculados
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {selectedPersona.vehiculos.map((v, i) => (
                                    <div key={i} className="p-3 bg-bg-card/60 border border-white/5 rounded-xl flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-text-main uppercase">{v.marca} {v.modelo}</p>
                                            <p className="text-[11px] font-black text-primary uppercase">{v.placa}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-text-muted uppercase">Accesos</p>
                                            <p className="text-sm font-black text-text-main font-display">{v.usos}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CensoPersonas;
