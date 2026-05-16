import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, LogIn, LogOut, AlertTriangle, 
  ShieldCheck, ClipboardList, Info, 
  UserPlus, CheckCircle2, ShieldAlert,
  Zap, Activity, ChevronRight, Shield,
  Car, RefreshCw, Clock
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuthStore } from '../../store/auth.store';
import { useUIStore } from '../../store/ui.store';
import { Card, CardContent } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Badge } from '../../components/ui/Badge';
import { Header } from '../../components/layout/Header';
import { Input } from '../../components/ui/Input';
import { comandoService } from '../../services/comando.service';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import LiveEventLog from '../../components/dashboard/LiveEventLog';

const DashboardAlcabala = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { lockNavigation, setTacticalIdentity } = useUIStore();
    const { lastNotification } = useNotifications();
    
    const [situacion, setSituacion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ entradas: 0, salidas: 0, infracciones: 0 });

    const fetchSituacion = React.useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const data = await comandoService.getMiSituacion();
            setSituacion(data);
            if (data.stats) setStats(data.stats);
            
            // Sincronizar identidad con el store global para la barra lateral
            if (data.identificado && data.datos_guardia) {
                setTacticalIdentity({
                    grado: data.datos_guardia.grado,
                    nombre: data.datos_guardia.nombre,
                    apellido: data.datos_guardia.apellido,
                    punto: data.punto?.nombre
                });
            }
            
            lockNavigation(!data.identificado);
        } catch (error) {
            console.error('Error sincronizando situación:', error);
        } finally {
            setLoading(false);
        }
    }, [lockNavigation, setTacticalIdentity]);

    useEffect(() => {
        fetchSituacion(true);
        return () => lockNavigation(false);
    }, [fetchSituacion, lockNavigation]);

    useEffect(() => {
        if (situacion?.identificado) {
            const interval = setInterval(() => fetchSituacion(false), 15000);
            return () => clearInterval(interval);
        }
    }, [situacion?.identificado, fetchSituacion]);

    const handleIdentificar = async (formDatos) => {
        try {
            await comandoService.identificarGuardia({
                punto_id: situacion.punto.id,
                ...formDatos
            });
            toast.success('Protocolo de identidad verificado. Turno iniciado.');
            fetchSituacion();
        } catch (error) {
            toast.error('Error en validación de identidad');
        }
    };

    const handleIniciarEscaneo = (tipo) => {
        navigate(`/alcabala/scanner?tipo=${tipo}`);
    }

    if (loading) return (
        <div className="min-h-screen bg-bg-app flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Zap className="text-primary animate-pulse" size={48} />
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em]">Sincronizando Sistema...</p>
            </div>
        </div>
    );

    // SEGURIDAD: Si no hay situación (error 500) o no está identificado, NO mostrar el dashboard
    if (!situacion) {
        return (
            <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center p-6 text-center">
                <ShieldAlert size={64} className="text-danger mb-6 animate-pulse" />
                <h2 className="text-2xl font-black text-text-main uppercase italic mb-2">Error de Sincronización</h2>
                <p className="text-text-muted text-xs font-bold uppercase tracking-[0.2em] max-w-xs mx-auto mb-8">
                    No se pudo validar el estado del punto de acceso con el centro de mando.
                </p>
                <Boton onClick={() => fetchSituacion(true)} className="h-12 px-8 rounded-xl gap-2 font-black uppercase tracking-widest">
                    <RefreshCw size={18} /> Reintentar Conexión
                </Boton>
            </div>
        );
    }

    if (!situacion.identificado) {
        return <ModuloIdentificacion punto={situacion.punto} authUser={user} onConfirm={handleIdentificar} />;
    }

    return (
        <div className="p-4 md:p-6 space-y-6 pb-24 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* 1. Cabecera Principal - Identidad y Mando */}
            <header className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-bg-card/30 p-4 md:p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl shrink-0 border border-primary/20">
                        <Shield className="text-primary" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black dark:text-white text-text-main tracking-tighter uppercase italic">
                            {situacion?.punto?.nombre || 'Terminal Alcabala'}
                        </h1>
                        <p className="text-text-muted text-xs mt-0.5 flex items-center gap-1.5 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
                            Puesto de control y acceso
                        </p>
                    </div>
                </div>

                {/* Info del Profesional de Guardia (Derecha) */}
                <div className="flex items-center gap-4 bg-primary/5 p-3 px-5 rounded-2xl border border-primary/20">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Profesional de Guardia</p>
                        <p className="text-sm font-black text-text-main italic uppercase tracking-tight">
                            {situacion?.datos_guardia?.grado || 'S1'} {situacion?.datos_guardia?.nombre} {situacion?.datos_guardia?.apellido}
                        </p>
                    </div>
                </div>
            </header>
            
            {/* 2. Fila de KPIs - Estandarizados (Igual al Comandante) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Entradas Ciclo', valor: stats.entradas, icon: LogIn, color: 'text-primary' },
                    { label: 'Salidas Ciclo', valor: stats.salidas, icon: LogOut, color: 'text-warning' },
                    { label: 'Alertas Det.', valor: stats.infracciones, icon: AlertTriangle, color: stats.infracciones > 0 ? 'text-danger' : 'text-text-muted' },
                    { label: 'Órdenes Táct.', valor: 0, icon: ClipboardList, color: 'text-sky-400' }
                ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={i} className="flex flex-col p-4 md:p-6 relative overflow-hidden group hover:bg-bg-high transition-all border-white/5 rounded-2xl">
                             <div className="flex justify-between items-start mb-4">
                                <Icon size={24} className={stat.color} />
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/20 group-hover:bg-primary/50 transition-colors"></div>
                             </div>
                             <div className="font-display font-black text-2xl md:text-3xl tracking-tighter leading-none mb-1 text-text-main">
                                {stat.valor}
                             </div>
                             <div className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-text-muted opacity-60">
                                {stat.label}
                             </div>
                        </Card>
                    );
                })}
            </div>

            {/* 3. Acciones de Registro - Centradas y en una sola línea */}
            <div className="flex flex-col items-center justify-center py-4 gap-6">
                <div className="flex flex-row items-center gap-4 w-full max-w-2xl">
                    <button 
                        onClick={() => handleIniciarEscaneo('entrada')}
                        className="flex-1 flex items-center justify-center gap-4 bg-primary text-bg-app h-16 md:h-20 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-tactica outline-none px-6"
                    >
                        <LogIn size={28} strokeWidth={3} />
                        <span className="text-sm md:text-base font-black uppercase tracking-widest italic">Entrada</span>
                    </button>

                    <button 
                        onClick={() => handleIniciarEscaneo('salida')}
                        className="flex-1 flex items-center justify-center gap-4 bg-bg-card border-2 border-warning/30 text-warning h-16 md:h-20 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all outline-none px-6"
                    >
                        <LogOut size={28} strokeWidth={3} />
                        <span className="text-sm md:text-base font-black uppercase tracking-widest italic">Salida</span>
                    </button>
                </div>
            </div>

            {/* 4. Sección Inferior - Bitácora vs Órdenes Tácticas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Columna Izquierda: Bitácora Táctica */}
                <div className="space-y-4 flex flex-col h-[500px]">
                    <div className="flex items-center gap-3 px-2">
                        <Activity size={18} className="text-primary" />
                        <h3 className="text-xs font-black text-text-main uppercase tracking-[0.4em] italic">Bitácora en tiempo real</h3>
                    </div>
                    
                    <div className="flex-1 overflow-hidden pr-2">
                        <LiveEventLog puntoNombre={situacion.punto.nombre} />
                    </div>
                </div>

                {/* Columna Derecha: Órdenes Tácticas - Placeholder */}
                <div className="space-y-4 flex flex-col h-[500px]">
                    <div className="flex items-center gap-3 px-2">
                        <ClipboardList size={18} className="text-sky-400" />
                        <h3 className="text-xs font-black text-text-main uppercase tracking-[0.4em] italic">Órdenes Tácticas</h3>
                    </div>
                    
                    <div className="flex-1 bg-bg-card/40 border border-sky-500/10 rounded-[2.5rem] relative overflow-hidden p-8 flex flex-col items-center justify-center text-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />
                        
                        <div className="w-20 h-20 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400 mb-6 shadow-2xl shadow-sky-500/10 border border-sky-500/20">
                             <AlertTriangle size={36} className="animate-pulse" />
                        </div>
                        
                        <h4 className="text-lg font-black text-text-main uppercase italic mb-2 tracking-tight">Consigna de Mando</h4>
                        <p className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest max-w-xs leading-relaxed opacity-60">
                            No hay órdenes restrictivas vigentes para este punto de control. 
                            Mantenga vigilancia estándar y reporte toda novedad al centro de comando.
                        </p>
                        
                        <div className="mt-8 pt-8 border-t border-white/5 w-full">
                            <div className="flex items-center justify-center gap-6">
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Nivel Alerta</p>
                                    <span className="text-xs font-black text-success uppercase">Verde</span>
                                </div>
                                <div className="w-px h-8 bg-white/5" />
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Sector</p>
                                    <span className="text-xs font-black text-text-main uppercase">Alfa-1</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// COMPONENTE INTERNO: Formulario de Relevo Táctico
const ModuloIdentificacion = ({ punto, authUser, onConfirm }) => {
    const [form, setForm] = useState({
        grado: '',
        nombre: authUser?.nombre || '',
        apellido: authUser?.apellido || '',
        telefono: '',
        unidad: ''
    });

    return (
        <div className="min-h-screen bg-bg-app p-6 flex flex-col items-center justify-center animate-in fade-in duration-700">
            <div className="w-full max-w-lg space-y-8">
                <div className="text-center space-y-3">
                    <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-2xl shadow-primary/10">
                        <ShieldAlert size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-text-main uppercase tracking-tighter italic">Relevo Táctico</h1>
                    <p className="text-text-muted text-xs font-bold uppercase tracking-widest px-4">
                        Terminal: <span className="text-primary">{punto?.nombre}</span>
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-warning uppercase">
                        <Clock size={12} />
                        Corte de turno: 08:30 AM
                    </div>
                </div>

                <Card className="bg-bg-card border-white/5 shadow-tactica rounded-[2.5rem] overflow-hidden">
                    <form onSubmit={(e) => { e.preventDefault(); onConfirm(form); }} className="p-8 space-y-5">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-4">
                                <Input 
                                    label="Grado" required placeholder="Ej: S1"
                                    value={form.grado}
                                    onChange={e => setForm({...form, grado: e.target.value.toUpperCase()})}
                                />
                            </div>
                            <div className="col-span-8">
                                <Input 
                                    label="Unidad / Destino" required placeholder="BATALLÓN / UNIDAD"
                                    value={form.unidad}
                                    onChange={e => setForm({...form, unidad: e.target.value.toUpperCase()})}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Nombres" required
                                value={form.nombre}
                                onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
                            />
                            <Input 
                                label="Apellidos" required
                                value={form.apellido}
                                onChange={e => setForm({...form, apellido: e.target.value.toUpperCase()})}
                            />
                        </div>
                        <Input 
                            label="Teléfono de contacto" type="tel" required placeholder="04XX-XXXXXXX"
                            value={form.telefono}
                            onChange={e => setForm({...form, telefono: e.target.value})}
                        />
                        <Boton type="submit" className="w-full h-16 rounded-2xl gap-3 font-black text-sm shadow-xl shadow-primary/20 uppercase tracking-widest">
                            <LogIn size={20} />
                            Iniciar Turno Operativo
                        </Boton>
                    </form>
                </Card>

                <p className="text-center text-[9px] text-text-muted font-black uppercase tracking-[0.4em] opacity-20">
                    Aegis Tactical System — Secure Node Identification
                </p>
            </div>
        </div>
    );
};

export default DashboardAlcabala;
