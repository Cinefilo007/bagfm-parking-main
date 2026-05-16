/**
 * CalendarioLotes.jsx
 * Modal con calendario mensual que colorea las fechas con lotes activos.
 * Permite al admin seleccionar una fecha para consultar la disponibilidad proyectada.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight, Calendar, ParkingSquare } from 'lucide-react';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

/**
 * @param {Object} props
 * @param {boolean} props.abierto
 * @param {Function} props.onCerrar
 * @param {string} props.fechaSeleccionada - 'YYYY-MM-DD'
 * @param {Function} props.onSeleccionarFecha - (fechaStr: 'YYYY-MM-DD') => void
 * @param {Object} props.calendarioLotes - { 'YYYY-MM-DD': ['Zona A', ...] }
 * @param {boolean} props.cargando
 */
export function CalendarioLotes({
    abierto,
    onCerrar,
    fechaSeleccionada,
    onSeleccionarFecha,
    calendarioLotes = {},
    cargando = false,
}) {
    const hoy = new Date();

    const [mesVista, setMesVista] = useState(() => {
        const f = fechaSeleccionada ? new Date(fechaSeleccionada + 'T12:00:00') : hoy;
        return { mes: f.getMonth(), anio: f.getFullYear() };
    });

    // Al abrir, centrar en el mes de la fecha seleccionada
    useEffect(() => {
        if (abierto) {
            const f = fechaSeleccionada ? new Date(fechaSeleccionada + 'T12:00:00') : hoy;
            setMesVista({ mes: f.getMonth(), anio: f.getFullYear() });
        }
    }, [abierto, fechaSeleccionada]);

    const diasDelMes = useMemo(() => {
        const { mes, anio } = mesVista;
        const primerDia = new Date(anio, mes, 1);
        const ultimoDia = new Date(anio, mes + 1, 0);

        // Offset: lunes=0 ... domingo=6
        let offsetInicio = primerDia.getDay() - 1;
        if (offsetInicio < 0) offsetInicio = 6;

        const dias = [];
        // Celdas vacías al inicio
        for (let i = 0; i < offsetInicio; i++) {
            dias.push(null);
        }
        // Días del mes
        for (let d = 1; d <= ultimoDia.getDate(); d++) {
            dias.push(new Date(anio, mes, d));
        }
        return dias;
    }, [mesVista]);

    const irMesAnterior = () => {
        setMesVista(prev => {
            const d = new Date(prev.anio, prev.mes - 1, 1);
            return { mes: d.getMonth(), anio: d.getFullYear() };
        });
    };

    const irMesSiguiente = () => {
        setMesVista(prev => {
            const d = new Date(prev.anio, prev.mes + 1, 1);
            return { mes: d.getMonth(), anio: d.getFullYear() };
        });
    };

    const toISO = (fecha) => {
        if (!fecha) return null;
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const esHoy = (fecha) => {
        if (!fecha) return false;
        return toISO(fecha) === toISO(hoy);
    };

    const esSeleccionado = (fecha) => {
        if (!fecha) return false;
        return toISO(fecha) === fechaSeleccionada;
    };

    const tieneLotes = (fecha) => {
        if (!fecha) return false;
        return !!calendarioLotes[toISO(fecha)];
    };

    const lotesDelDia = (fecha) => {
        if (!fecha) return [];
        return calendarioLotes[toISO(fecha)] || [];
    };

    const [dayHover, setDayHover] = useState(null);

    return (
        <Modal
            isOpen={abierto}
            onClose={onCerrar}
            title="Seleccionar Fecha"
            subtitle="Las fechas marcadas tienen lotes de pases activos"
        >
            <div className="space-y-4 min-w-[300px]">
                {/* Navegación de mes */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={irMesAnterior}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                    >
                        <ChevronLeft size={16} className="text-text-muted" />
                    </button>
                    <p className="text-sm font-black text-text-main uppercase tracking-widest">
                        {MESES[mesVista.mes]} {mesVista.anio}
                    </p>
                    <button
                        onClick={irMesSiguiente}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                    >
                        <ChevronRight size={16} className="text-text-muted" />
                    </button>
                </div>

                {/* Cabecera de días de semana */}
                <div className="grid grid-cols-7 gap-1">
                    {DIAS_SEMANA.map(d => (
                        <div key={d} className="text-center text-[9px] font-black text-text-muted/50 uppercase py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Grid de días */}
                <div className="grid grid-cols-7 gap-1">
                    {diasDelMes.map((fecha, i) => {
                        if (!fecha) {
                            return <div key={`empty-${i}`} />;
                        }
                        const iso = toISO(fecha);
                        const seleccionado = esSeleccionado(fecha);
                        const conLotes = tieneLotes(fecha);
                        const hoyFlag = esHoy(fecha);
                        const hovering = dayHover === iso;
                        const zonas = lotesDelDia(fecha);

                        return (
                            <div key={iso} className="relative flex flex-col items-center">
                                <button
                                    onClick={() => {
                                        onSeleccionarFecha(iso);
                                        onCerrar();
                                    }}
                                    onMouseEnter={() => setDayHover(iso)}
                                    onMouseLeave={() => setDayHover(null)}
                                    className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold transition-all relative",
                                        seleccionado
                                            ? "bg-primary text-bg-app font-black shadow-lg shadow-primary/30"
                                            : hoyFlag
                                            ? "border border-primary/50 text-primary"
                                            : conLotes
                                            ? "bg-white/5 hover:bg-primary/20 text-text-main"
                                            : "hover:bg-white/5 text-text-muted/60"
                                    )}
                                >
                                    {fecha.getDate()}
                                </button>

                                {/* Punto indicador de lote */}
                                {conLotes && !seleccionado && (
                                    <div className="w-1 h-1 rounded-full bg-primary mt-0.5 shrink-0" />
                                )}
                                {seleccionado && <div className="w-1 h-1 rounded-full bg-primary/0 mt-0.5" />}

                                {/* Tooltip al hover */}
                                {hovering && conLotes && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-max max-w-[160px] bg-bg-high border border-primary/20 rounded-xl p-2 shadow-2xl pointer-events-none animate-in fade-in duration-150">
                                        <p className="text-[7px] font-black uppercase text-primary mb-1 tracking-widest flex items-center gap-1">
                                            <ParkingSquare size={8} /> Zonas activas
                                        </p>
                                        {zonas.map((z, zi) => (
                                            <p key={zi} className="text-[8px] text-text-main truncate">{z}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Leyenda */}
                <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-[8px] text-text-muted font-bold uppercase tracking-wider">Con lotes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-4 rounded-md border border-primary/50" />
                        <span className="text-[8px] text-text-muted font-bold uppercase tracking-wider">Hoy</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-4 rounded-md bg-primary" />
                        <span className="text-[8px] text-text-muted font-bold uppercase tracking-wider">Seleccionado</span>
                    </div>
                </div>

                {cargando && (
                    <div className="flex justify-center py-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default CalendarioLotes;
