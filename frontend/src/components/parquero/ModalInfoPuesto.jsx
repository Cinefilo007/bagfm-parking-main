import React, { useState } from 'react';
import {
    ParkingSquare, X, Car, Shield, Lock, Unlock,
    Clock, AlertTriangle, CheckCircle2, RefreshCw, Tag
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { parqueroService } from '../../services/parquero.service';

// ──────────────────────────────────────────────────────────────────────────────
// Lógica de colores y etiquetas de estado
// ──────────────────────────────────────────────────────────────────────────────
const CONFIG_ESTADO = {
    libre:        { color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', dot: 'bg-success', label: 'Libre' },
    ocupado:      { color: 'text-danger',  bg: 'bg-danger/5',   border: 'border-danger/20',  dot: 'bg-danger',  label: 'Ocupado' },
    reservado:    { color: 'text-warning', bg: 'bg-warning/5',  border: 'border-warning/30', dot: 'bg-warning', label: 'Reservado' },
    mantenimiento:{ color: 'text-text-muted', bg: 'bg-white/5', border: 'border-white/10',   dot: 'bg-text-muted', label: 'Mantenimiento' },
};

/**
 * Modal de información de un puesto del mapa de estacionamiento.
 * Permite ver el estado del puesto y gestionar cambios básicos.
 *
 * @param {{ puesto: object, vehiculosEnZona: object[], onClose: function, onActualizar: function }} props
 */
const ModalInfoPuesto = ({ puesto, vehiculosEnZona = [], onClose, onActualizar }) => {
    const [cargando, setCargando] = useState(false);

    if (!puesto) return null;

    const cfg = CONFIG_ESTADO[puesto.estado] || CONFIG_ESTADO.libre;

    // Vehículo actualmente en este puesto
    const vehiculoEnPuesto = vehiculosEnZona.find(
        v => v.puesto_asignado_id === puesto.id
    );

    // ── Tipo de puesto ──────────────────────────────────────────────────────
    const esPuestoBase = puesto.reservado_base === true;
    const esPuestoEntidad = !esPuestoBase && puesto.reservado_entidad_id;

    const tipoPuesto = esPuestoBase
        ? { label: 'RESERVADO BASE', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', icon: Shield }
        : esPuestoEntidad
        ? { label: puesto.tipo_acceso_nombre || 'ENTIDAD', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', icon: Tag }
        : { label: 'GENERAL', color: 'text-text-muted', bg: 'bg-white/5', border: 'border-white/10', icon: ParkingSquare };

    // ── Acción: liberar puesto ocupado ─────────────────────────────────────
    const handleRegistrarSalida = async () => {
        if (!vehiculoEnPuesto) return;
        setCargando(true);
        try {
            await parqueroService.registrarSalidaPlaca(vehiculoEnPuesto.placa, puesto.zona_id);
            toast.success(`Salida registrada: ${vehiculoEnPuesto.placa}`);
            onActualizar?.();
            onClose();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No se pudo registrar la salida');
        } finally {
            setCargando(false);
        }
    };

    // ── Acción: cambiar estado del puesto ──────────────────────────────────
    const handleCambiarEstado = async (nuevoEstado) => {
        setCargando(true);
        try {
            await parqueroService.actualizarPuesto(puesto.id, { estado: nuevoEstado });
            toast.success(`Puesto ${puesto.numero_puesto} marcado como ${nuevoEstado}`);
            onActualizar?.();
            onClose();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No se pudo actualizar el puesto');
        } finally {
            setCargando(false);
        }
    };

    // ── Acción: asignar vehículo ───────────────────────────────────────────
    const handleAsignarVehiculo = async (vehiculoPaseId) => {
        setCargando(true);
        try {
            await parqueroService.asignarPuesto(vehiculoPaseId, puesto.id);
            toast.success(`Vehículo asignado al puesto ${puesto.numero_puesto}`);
            onActualizar?.();
            onClose();
        } catch (e) {
            toast.error(e.response?.data?.detail || 'No se pudo asignar el vehículo');
        } finally {
            setCargando(false);
        }
    };

    // Filtrar vehículos en zona que NO tienen puesto asignado
    const vehiculosDisponibles = vehiculosEnZona.filter(v => !v.puesto_asignado_id);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

                {/* ── Header ── */}
                <div className={cn(
                    'flex items-center justify-between px-4 py-3 border-b',
                    cfg.bg, cfg.border
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border', cfg.bg, cfg.border)}>
                            <ParkingSquare size={22} className={cfg.color} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-text-main uppercase tracking-wide">
                                {puesto.numero_puesto}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                                <span className={cn('text-[10px] font-black uppercase tracking-widest', cfg.color)}>
                                    {cfg.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                        <X size={16} className="text-text-muted" />
                    </button>
                </div>

                {/* ── Tipo de puesto ── */}
                <div className="px-4 pt-4">
                    {(() => {
                        const TipoIcon = tipoPuesto.icon;
                        return (
                            <div className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-xl border',
                                tipoPuesto.bg, tipoPuesto.border
                            )}>
                                <TipoIcon size={13} className={tipoPuesto.color} />
                                <span className={cn('text-[10px] font-black uppercase tracking-widest', tipoPuesto.color)}>
                                    {tipoPuesto.label}
                                </span>
                            </div>
                        );
                    })()}
                </div>

                {/* ── Vehículo actual (si ocupado) ── */}
                {puesto.estado === 'ocupado' && vehiculoEnPuesto && (
                    <div className="px-4 pt-3">
                        <div className="flex items-start gap-3 p-3 bg-danger/5 rounded-xl border border-danger/20">
                            <div className="w-9 h-9 bg-danger/10 rounded-xl flex items-center justify-center shrink-0">
                                <Car size={18} className="text-danger" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-text-main uppercase">{vehiculoEnPuesto.placa}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5 mb-1">
                                    {vehiculoEnPuesto.tipo_pase && (
                                        <span 
                                            className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border"
                                            style={{
                                                color: vehiculoEnPuesto.tipo_pase_color,
                                                backgroundColor: `${vehiculoEnPuesto.tipo_pase_color}10`,
                                                borderColor: `${vehiculoEnPuesto.tipo_pase_color}30`
                                            }}
                                        >
                                            {vehiculoEnPuesto.tipo_pase}
                                        </span>
                                    )}
                                    <p className="text-[10px] text-text-muted">
                                        {[vehiculoEnPuesto.color, vehiculoEnPuesto.marca, vehiculoEnPuesto.modelo].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                {vehiculoEnPuesto.nombre_portador && (
                                    <p className="text-[10px] font-bold text-success/80 uppercase tracking-tighter mb-1">
                                        {vehiculoEnPuesto.nombre_portador} {vehiculoEnPuesto.telefono_portador ? `· ${vehiculoEnPuesto.telefono_portador}` : ''}
                                    </p>
                                )}
                                {vehiculoEnPuesto.tiempo_en_zona_min != null && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <Clock size={10} className="text-text-muted" />
                                        <span className="text-[9px] text-text-muted">
                                            {vehiculoEnPuesto.tiempo_en_zona_min < 60
                                                ? `${vehiculoEnPuesto.tiempo_en_zona_min} min en zona`
                                                : `${Math.floor(vehiculoEnPuesto.tiempo_en_zona_min / 60)}h ${vehiculoEnPuesto.tiempo_en_zona_min % 60}min en zona`
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Puesto ocupado sin vehículo rastreable ── */}
                {puesto.estado === 'ocupado' && !vehiculoEnPuesto && (
                    <div className="px-4 pt-3">
                        <div className="flex items-center gap-2 p-3 bg-danger/5 rounded-xl border border-danger/20">
                            <AlertTriangle size={14} className="text-danger shrink-0" />
                            <p className="text-[10px] text-text-muted font-bold">
                                Vehículo sin datos rastreables en este puesto
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Puesto reservado para base ── */}
                {esPuestoBase && (
                    <div className="px-4 pt-3">
                        <div className="flex items-center gap-2 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                            <Lock size={13} className="text-indigo-400 shrink-0" />
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">
                                Apartado para personal de la base
                            </p>
                        </div>
                    </div>
                )}

                {/* ── SECCIÓN ASIGNAR VEHÍCULO ── */}
                {puesto.estado !== 'ocupado' && puesto.estado !== 'mantenimiento' && (
                    <div className="px-4 pt-4">
                        <div className="p-3 bg-bg-low rounded-xl border border-white/5">
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Car size={10} className="text-primary" /> Asignar Vehículo Aparcado
                            </p>
                            
                            <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                                {vehiculosDisponibles.length > 0 ? (
                                    vehiculosDisponibles.map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => handleAsignarVehiculo(v.id)}
                                            disabled={cargando}
                                            className="w-full flex items-center justify-between p-2.5 bg-white/5 hover:bg-primary/10 hover:border-primary/30 border border-transparent rounded-lg transition-all group"
                                        >
                                            <div className="text-left">
                                                <p className="text-[10px] font-black text-text-main uppercase leading-none">{v.placa}</p>
                                                <p className="text-[8px] text-text-muted mt-0.5 uppercase tracking-tighter">
                                                    {v.marca} {v.color}
                                                </p>
                                            </div>
                                            <CheckCircle2 size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-[8px] text-text-muted/50 italic py-2 text-center">
                                        No hay vehículos sin puesto en la zona
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Acciones ── */}
                <div className="px-4 py-4 space-y-2">

                    {/* Ocupado → registrar salida */}
                    {puesto.estado === 'ocupado' && vehiculoEnPuesto && !esPuestoBase && (
                        <button
                            onClick={handleRegistrarSalida}
                            disabled={cargando}
                            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-warning/10 border border-warning/30 text-warning text-[11px] font-black uppercase tracking-wider hover:bg-warning/20 transition-all active:scale-98 disabled:opacity-50"
                        >
                            {cargando
                                ? <RefreshCw size={14} className="animate-spin" />
                                : <Car size={14} />
                            }
                            Registrar Salida del Vehículo
                        </button>
                    )}

                    {/* Libre → marcar como mantenimiento */}
                    {puesto.estado === 'libre' && !esPuestoBase && (
                        <button
                            onClick={() => handleCambiarEstado('mantenimiento')}
                            disabled={cargando}
                            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-white/5 border border-white/10 text-text-muted text-[10px] font-black uppercase tracking-wider hover:bg-white/10 transition-all disabled:opacity-50"
                        >
                            {cargando ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
                            Poner en Mantenimiento
                        </button>
                    )}

                    {/* Mantenimiento → liberar */}
                    {puesto.estado === 'mantenimiento' && (
                        <button
                            onClick={() => handleCambiarEstado('libre')}
                            disabled={cargando}
                            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-success/10 border border-success/30 text-success text-[11px] font-black uppercase tracking-wider hover:bg-success/20 transition-all disabled:opacity-50"
                        >
                            {cargando ? <RefreshCw size={14} className="animate-spin" /> : <Unlock size={14} />}
                            Liberar Puesto
                        </button>
                    )}

                    {/* Ocupado sin vehículo rastreable → liberar manualmente */}
                    {puesto.estado === 'ocupado' && !vehiculoEnPuesto && !esPuestoBase && (
                        <button
                            onClick={() => handleCambiarEstado('libre')}
                            disabled={cargando}
                            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-success/10 border border-success/30 text-success text-[11px] font-black uppercase tracking-wider hover:bg-success/20 transition-all disabled:opacity-50"
                        >
                            {cargando ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Marcar como Libre
                        </button>
                    )}

                    {/* Cerrar */}
                    <button
                        onClick={onClose}
                        className="w-full h-9 rounded-xl bg-white/5 border border-white/10 text-text-muted text-[10px] font-black uppercase tracking-wider hover:bg-white/10 transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalInfoPuesto;
