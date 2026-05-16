import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/auth.store';
import {
    ParkingSquare, Car as CarIcon, Users as UsersIcon, AlertTriangle, RefreshCw,
    Shield, Zap, Activity, Bell, Send, CheckCircle2,
    PhoneCall, Search, Clock, ChevronRight, LogOut,
    Radio, LayoutGrid, UserCog, XCircle
} from 'lucide-react';
import supervisorService from '../../services/supervisor.service';

// ──── Constantes ──────────────────────────────────────────────────────────────

const NIVEL_CONFIG = {
    1: { color: 'border-yellow-400/40 bg-yellow-400/5', dot: 'bg-yellow-400', text: 'text-yellow-400', emoji: '🟡', label: 'Nivel 1' },
    2: { color: 'border-orange-400/40 bg-orange-400/5', dot: 'bg-orange-400', text: 'text-orange-400', emoji: '🟠', label: 'Nivel 2' },
    3: { color: 'border-red-400/40 bg-red-400/5', dot: 'bg-red-400', text: 'text-red-400', emoji: '🔴', label: 'Nivel 3' },
    4: { color: 'border-red-600/50 bg-red-600/5', dot: 'bg-red-600', text: 'text-red-500', emoji: '🔴', label: 'Nivel 4' },
    5: { color: 'border-gray-400/40 bg-gray-900/60', dot: 'bg-gray-400', text: 'text-gray-300', emoji: '⚫', label: 'Nivel 5 — ALERTA MÁXIMA' },
};

// ──── Componentes ─────────────────────────────────────────────────────────────

const KpiCard = ({ label, valor, icon: Icon, color = 'text-primary' }) => (
    <Card className="flex flex-col p-4 rounded-2xl border-white/5">
        <div className="flex justify-between mb-3">
            <Icon size={20} className={color} />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
        </div>
        <div className={cn("text-2xl font-black tracking-tighter", color)}>{valor}</div>
        <div className="text-[8px] font-black uppercase tracking-widest text-text-muted/50 mt-0.5">{label}</div>
    </Card>
);

const FantasmaCard = ({ fantasma, onResolver, onBuscar, onLlamar, userRol }) => {
    const nivel = Math.min(fantasma.nivel_escalamiento || 1, 5);
    const cfg = NIVEL_CONFIG[nivel];
    const minutos = fantasma.minutos_transcurridos || 0;

    return (
        <div className={cn("p-4 rounded-xl border-2 transition-all space-y-3", cfg.color)}>
            <div className="flex items-start gap-3">
                <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 animate-pulse", cfg.dot)} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'inherit' }}>
                            {cfg.emoji} {cfg.label}
                        </span>
                        <span className={cn("text-sm font-black uppercase", cfg.text)}>
                            {fantasma.placa || 'SIN PLACA'}
                        </span>
                        <span className="text-[9px] text-text-muted font-bold flex items-center gap-1">
                            <Clock size={9} /> {minutos} min
                        </span>
                    </div>
                    <p className="text-[9px] text-text-muted mt-1">
                        {fantasma.marca && `${fantasma.marca} ${fantasma.modelo} ${fantasma.color}`}
                        {fantasma.zona_destino && ` — Destino: ${fantasma.zona_destino}`}
                    </p>
                    {fantasma.nombre_portador && (
                        <p className="text-[9px] text-text-muted mt-0.5">
                            👤 {fantasma.nombre_portador}
                            {fantasma.telefono && <span className="ml-2">📞 {fantasma.telefono}</span>}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => onResolver(fantasma)}
                    className="h-7 px-3 rounded-lg bg-success/20 text-success border border-success/30 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-success/30 transition-all">
                    <CheckCircle2 size={11} /> Llegó
                </button>
                {fantasma.telefono && (
                    <button onClick={() => onLlamar(fantasma)}
                        className="h-7 px-3 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/20 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-sky-500/25 transition-all">
                        <PhoneCall size={11} /> Llamar
                    </button>
                )}
                {(userRol === 'COMANDANTE' || userRol === 'ADMIN_BASE') && nivel >= 4 && (
                    <button onClick={() => onBuscar(fantasma)}
                        className="h-7 px-3 rounded-lg bg-danger/15 text-danger border border-danger/20 text-[9px] font-black uppercase flex items-center gap-1.5 hover:bg-danger/25 transition-all">
                        <Search size={11} /> Orden Búsqueda
                    </button>
                )}
            </div>
        </div>
    );
};

const InfraccionLeve = ({ infraccion, onResolver }) => (
    <div className="flex items-center gap-3 p-3 bg-bg-card/30 rounded-xl border border-white/5">
        <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-text-main uppercase">{infraccion.tipo?.replace('_', ' ')}</p>
            <p className="text-[8px] text-text-muted">{infraccion.placa || 'Vehículo'} · {infraccion.zona_nombre || 'Zona desconocida'}</p>
        </div>
        <button onClick={() => onResolver(infraccion)}
            className="shrink-0 h-7 px-2.5 rounded-lg bg-success/15 text-success border border-success/20 text-[9px] font-black uppercase flex items-center gap-1 hover:bg-success/25 transition-all">
            <CheckCircle2 size={10} /> Resolver
        </button>
    </div>
);

// ──── Página Principal ────────────────────────────────────────────────────────

const TABS = { MONITOR: 'monitor', FANTASMAS: 'fantasmas', INFRACCIONES: 'infracciones', PERSONAL: 'personal' };

export default function DashboardSupervisorParqueros() {
    const { user } = useAuthStore();
    const [tab, setTab] = useState(TABS.MONITOR);
    const [dashboard, setDashboard] = useState(null);
    const [fantasmas, setFantasmas] = useState([]);
    const [infraccionesLeves, setInfraccionesLeves] = useState([]);
    const [parqueros, setParqueros] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Broadcast
    const [txtBroadcast, setTxtBroadcast] = useState('');
    const [prioridadBroadcast, setPrioridadBroadcast] = useState('normal');
    const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        try {
            const [dsh, fan, inf, pqr] = await Promise.allSettled([
                supervisorService.getDashboard(),
                supervisorService.getFantasmas(),
                supervisorService.getInfraccionesLeves(),
                supervisorService.getParquerosActivos(),
            ]);
            if (dsh.status === 'fulfilled') setDashboard(dsh.value);
            if (fan.status === 'fulfilled') setFantasmas(fan.value);
            if (inf.status === 'fulfilled') setInfraccionesLeves(inf.value);
            if (pqr.status === 'fulfilled') setParqueros(pqr.value);
        } catch (e) {
            // Demo fallback
            setDashboard({
                vehiculos_en_zonas: 24,
                puestos_libres: 18,
                zonas_activas: 3,
                infracciones_hoy: 2,
            });
            setFantasmas([
                { id: 'f1', placa: 'ABC-123', nivel_escalamiento: 1, minutos_transcurridos: 18,
                  marca: 'Toyota', modelo: 'Hilux', color: 'Blanco',
                  nombre_portador: 'Juan Pérez', telefono: '0412-1234567', zona_destino: 'Zona A' },
                { id: 'f2', placa: 'XYZ-789', nivel_escalamiento: 3, minutos_transcurridos: 43,
                  zona_destino: 'Zona B' },
                { id: 'f3', placa: 'LMN-456', nivel_escalamiento: 5, minutos_transcurridos: 72,
                  marca: 'Ford', modelo: 'F150', color: 'Negro',
                  nombre_portador: 'María López', telefono: '0414-9876543', zona_destino: 'Zona A' },
            ]);
            setInfraccionesLeves([
                { id: 'i1', tipo: 'mal_estacionado', placa: 'DEF-321', zona_nombre: 'Zona VIP' },
                { id: 'i2', tipo: 'conducta_indebida', placa: 'UVW-654', zona_nombre: 'Parqueo Logístico' },
            ]);
            setParqueros([
                { id: 'p1', nombre: 'Carlos Ramírez', zona_nombre: 'Zona VIP Norte', vehiculos_atendidos: 8 },
                { id: 'p2', nombre: 'Pedro González', zona_nombre: 'Parqueo Logístico', vehiculos_atendidos: 12 },
                { id: 'p3', nombre: 'Luis Martínez', zona_nombre: 'Zona Staff', vehiculos_atendidos: 5 },
            ]);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarDatos();
        const interval = setInterval(cargarDatos, 20000);
        return () => clearInterval(interval);
    }, [cargarDatos]);

    const handleResolver = async (fantasma) => {
        try {
            await supervisorService.resolverFantasma(fantasma.id);
            toast.success(`${fantasma.placa} marcado como llegado`);
            setFantasmas(prev => prev.filter(f => f.id !== fantasma.id));
        } catch (e) {
            toast.error('Error al resolver');
        }
    };

    const handleOrdenBusqueda = async (fantasma) => {
        try {
            await supervisorService.emitirOrdenBusqueda(fantasma.id, {
                notas: `Orden emitida desde supervisión. Vehículo no localizado.`,
            });
            toast.success('Orden de búsqueda emitida a supervisores de ronda', { icon: '🔍' });
        } catch (e) {
            toast.error('Error al emitir orden');
        }
    };

    const handleLlamar = (fantasma) => {
        if (fantasma.telefono) {
            window.location.href = `tel:${fantasma.telefono}`;
        }
    };

    const handleResolverInfraccion = async (infraccion) => {
        try {
            await supervisorService.resolverInfraccion(infraccion.id, 'resolver', 'Resuelta por supervisor de parqueros');
            toast.success('Infracción resuelta');
            setInfraccionesLeves(prev => prev.filter(i => i.id !== infraccion.id));
        } catch (e) {
            toast.error('No tienes permiso para resolver esta infracción');
        }
    };

    const handleBroadcast = async () => {
        if (!txtBroadcast.trim()) { toast.error('Escribe un mensaje'); return; }
        setEnviandoBroadcast(true);
        try {
            await supervisorService.enviarBroadcast(txtBroadcast, prioridadBroadcast);
            toast.success('Mensaje enviado a todos los parqueros');
            setTxtBroadcast('');
        } catch (e) {
            toast.error('Error al enviar broadcast');
        } finally {
            setEnviandoBroadcast(false);
        }
    };

    // Stats derivadas
    const stats = {
        vehiculos: dashboard?.vehiculos_en_zonas ?? '—',
        libres: dashboard?.puestos_libres ?? '—',
        zonas: dashboard?.zonas_activas ?? '—',
        fantasmasNivel: fantasmas.filter(f => f.nivel_escalamiento >= 3).length,
    };

    const tabs = [
        { id: TABS.MONITOR, label: 'Monitor', icon: Activity, badge: null },
        { id: TABS.FANTASMAS, label: 'Fantasmas', icon: Search, badge: fantasmas.length || null },
        { id: TABS.INFRACCIONES, label: 'Infracciones', icon: AlertTriangle, badge: infraccionesLeves.length || null },
        { id: TABS.PERSONAL, label: 'Personal', icon: UsersIcon, badge: null },
    ];

    return (
        <div className="min-h-screen bg-bg-app pb-24">

            {/* Header */}
            <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                            <Shield className="text-primary" size={18} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-text-main uppercase tracking-wide leading-none">Supervisión</h1>
                            <p className="text-[9px] text-text-muted font-bold flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                                Director de Parqueos — En turno
                            </p>
                        </div>
                    </div>
                    <button onClick={cargarDatos} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                        <RefreshCw size={15} className={cn("text-text-muted", cargando && 'animate-spin')} />
                    </button>
                </div>
            </header>

            <div className="max-w-3xl mx-auto p-4 space-y-4">

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-2">
                    <KpiCard label="Vehículos" valor={stats.vehiculos} icon={CarIcon} color="text-primary" />
                    <KpiCard label="Libres" valor={stats.libres} icon={ParkingSquare} color="text-success" />
                    <KpiCard label="Zonas" valor={stats.zonas} icon={LayoutGrid} color="text-sky-400" />
                    <KpiCard label="Urgentes" valor={stats.fantasmasNivel} icon={AlertTriangle} color={stats.fantasmasNivel > 0 ? 'text-danger' : 'text-text-muted'} />
                </div>

                {/* Broadcast rápido */}
                <Card className="p-4 rounded-2xl border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                        <Radio size={14} className="text-primary" />
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Broadcast a Parqueros</p>
                    </div>
                    <div className="flex gap-2">
                        <textarea
                            value={txtBroadcast}
                            onChange={e => setTxtBroadcast(e.target.value)}
                            placeholder="Instrucción o aviso para todos los parqueros..."
                            rows={2}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:border-primary/50 outline-none placeholder:text-white/20 resize-none"
                        />
                        <div className="flex flex-col gap-1.5">
                            <select value={prioridadBroadcast} onChange={e => setPrioridadBroadcast(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-[9px] font-black text-text-muted outline-none">
                                <option value="normal">Normal</option>
                                <option value="urgente">Urgente</option>
                            </select>
                            <button onClick={handleBroadcast} disabled={enviandoBroadcast || !txtBroadcast.trim()}
                                className="flex-1 px-3 rounded-xl bg-primary text-bg-app flex items-center justify-center gap-1 disabled:opacity-30 transition-all hover:bg-primary/80">
                                {enviandoBroadcast ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Tabs */}
                <div className="flex bg-bg-card/40 rounded-xl p-1 border border-white/5 gap-1 overflow-x-auto no-scrollbar">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={cn(
                                "flex-1 min-w-fit flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all relative whitespace-nowrap",
                                tab === t.id ? 'bg-primary text-bg-app shadow-md' : 'text-text-muted hover:text-text-main hover:bg-white/5'
                            )}>
                            <t.icon size={13} />
                            {t.label}
                            {t.badge > 0 && (
                                <span className={cn(
                                    "ml-1 text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center",
                                    tab === t.id ? 'bg-bg-app/30 text-bg-app' : 'bg-danger text-white'
                                )}>
                                    {t.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── TAB: MONITOR ── */}
                {tab === TABS.MONITOR && (
                    <div className="space-y-3">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                            <Activity size={11} className="text-primary" /> Estado de Zonas en Tiempo Real
                        </p>
                        {cargando ? (
                            Array(3).fill(0).map((_, i) => (
                                <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                            ))
                        ) : (
                            <div className="space-y-2">
                                {parqueros.map(pq => (
                                    <div key={pq.id} className="flex items-center gap-3 p-3 bg-bg-card/30 rounded-xl border border-white/5">
                                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                            <UserCog size={16} className="text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-text-main uppercase">{pq.nombre}</p>
                                            <p className="text-[9px] text-text-muted">{pq.zona_nombre}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-black text-success">{pq.vehiculos_atendidos}</p>
                                            <p className="text-[8px] text-text-muted/50 uppercase">Atendidos</p>
                                        </div>
                                    </div>
                                ))}
                                {parqueros.length === 0 && (
                                    <div className="text-center py-8 text-text-muted/40">
                                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-[9px] font-black uppercase tracking-widest">Sin parqueros en turno</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: FANTASMAS ── */}
                {tab === TABS.FANTASMAS && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                <Search size={11} className="text-primary" />
                                Vehículos Fantasma ({fantasmas.length})
                            </p>
                        </div>
                        {/* Leyenda */}
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(NIVEL_CONFIG).map(([nivel, cfg]) => (
                                <span key={nivel} className="flex items-center gap-1 text-[8px] font-bold text-text-muted/60">
                                    <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                                    {cfg.label}
                                </span>
                            ))}
                        </div>
                        {fantasmas.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                                <CheckCircle2 size={36} className="mx-auto text-success/40 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">
                                    Sin vehículos fantasma activos
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {[...fantasmas].sort((a, b) => (b.nivel_escalamiento || 0) - (a.nivel_escalamiento || 0)).map(f => (
                                    <FantasmaCard
                                        key={f.id}
                                        fantasma={f}
                                        userRol={user?.rol}
                                        onResolver={handleResolver}
                                        onBuscar={handleOrdenBusqueda}
                                        onLlamar={handleLlamar}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: INFRACCIONES LEVES ── */}
                {tab === TABS.INFRACCIONES && (
                    <div className="space-y-3">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                            <AlertTriangle size={11} className="text-yellow-400" />
                            Infracciones Leves Pendientes ({infraccionesLeves.length})
                        </p>
                        {/* Info de competencia */}
                        <div className="flex items-start gap-2.5 p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-xl">
                            <AlertTriangle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-text-muted">
                                Como Supervisor de Parqueros puedes resolver infracciones <strong className="text-yellow-400">LEVES</strong>. Las infracciones MODERADAS, GRAVES y CRÍTICAS deben ser escaladas al personal de la base.
                            </p>
                        </div>
                        {infraccionesLeves.length === 0 ? (
                            <div className="text-center py-10 text-text-muted/40">
                                <CheckCircle2 size={36} className="mx-auto mb-2 text-success/40" />
                                <p className="text-[9px] font-black uppercase tracking-widest">Sin infracciones leves pendientes</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {infraccionesLeves.map(i => (
                                    <InfraccionLeve key={i.id} infraccion={i} onResolver={handleResolverInfraccion} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: PERSONAL ── */}
                {tab === TABS.PERSONAL && (
                    <div className="space-y-3">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                            <UsersIcon size={11} className="text-primary" />
                            Parqueros en Turno ({parqueros.length})
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {parqueros.map(pq => (
                                <div key={pq.id} className="flex items-center gap-3 p-4 bg-bg-card/30 rounded-xl border border-white/5">
                                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                                        <UserCog size={20} className="text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-text-main uppercase">{pq.nombre}</p>
                                        <p className="text-[9px] text-text-muted flex items-center gap-1">
                                            <ParkingSquare size={9} /> {pq.zona_nombre}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-right">
                                            <p className="text-sm font-black text-success">{pq.vehiculos_atendidos}</p>
                                            <p className="text-[7px] text-text-muted/50 uppercase">Atendidos</p>
                                        </div>
                                        <ChevronRight size={16} className="text-text-muted/30" />
                                    </div>
                                </div>
                            ))}
                            {parqueros.length === 0 && (
                                <div className="text-center py-10 text-text-muted/40">
                                    <UsersIcon size={36} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Sin parqueros en turno activo</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
