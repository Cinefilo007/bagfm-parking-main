import React, { useState, useEffect, useCallback } from 'react';
import {
  Copy, ChevronDown, ChevronRight, Loader2, Fuel, LogIn,
  AlertTriangle, ShieldCheck, Merge, CheckCircle2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Card } from '../ui/Card';
import { Boton } from '../ui/Boton';
import { vehiculosService } from '../../services/vehiculos.service';
import { cn } from '../../lib/utils';

/**
 * Saneamiento de fichas duplicadas del registro de vehículos.
 *
 * La misma placa quedó cargada varias veces con formatos distintos, y eso parte el
 * historial de un carro entre dos fichas: la que ve combustible puede no ser la que
 * ve la alcabala.
 *
 * No se ofrece "eliminar" a secas. Cinco tablas apuntan a `vehiculos` con
 * ON DELETE RESTRICT, asi que una ficha con historial no se puede borrar sin
 * perderlo. Lo que se hace es FUSIONAR: el historial se mueve a la ficha que se
 * conserva y la otra desaparece.
 */

const USO = [
  { clave: 'abastecimientos', etiqueta: 'Abastecimientos', Icono: Fuel, destacado: true },
  { clave: 'accesos', etiqueta: 'Accesos', Icono: LogIn, destacado: true },
  { clave: 'infracciones', etiqueta: 'Infracciones', Icono: AlertTriangle },
  { clave: 'membresias', etiqueta: 'Membresías', Icono: ShieldCheck },
  { clave: 'codigos_qr', etiqueta: 'Códigos QR', Icono: Copy },
  { clave: 'pases', etiqueta: 'Pases', Icono: Copy },
  { clave: 'solicitudes_combustible', etiqueta: 'Solicitudes comb.', Icono: Fuel },
  { clave: 'puestos_ocupados', etiqueta: 'Puestos', Icono: Copy },
];

const fecha = (v) =>
  v ? new Date(v).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const Ficha = ({ ficha, esSugerida, onFusionar, ocupado }) => (
  <div
    className={cn(
      'rounded-xl border p-3',
      esSugerida ? 'border-success/50 bg-success/5' : 'border-bg-high/40'
    )}
  >
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-black text-text-main">
            {ficha.placa_guardada}
          </span>
          {esSugerida && (
            <span className="inline-flex items-center gap-1 rounded bg-success/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success">
              <CheckCircle2 className="h-3 w-3" /> Más usada
            </span>
          )}
          {!ficha.activo && (
            <span className="rounded bg-text-sec/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-text-sec">
              Inactiva
            </span>
          )}
        </div>

        <p className="mt-0.5 text-xs text-text-sec">
          {[ficha.marca, ficha.modelo, ficha.color].filter(Boolean).join(' · ') || 'Sin datos'}
        </p>
        <p className="text-[11px] text-text-sec">
          {ficha.socio || ficha.entidad || 'Sin titular'}
          {ficha.autorizado_combustible && (
            <span className="ml-2 font-bold text-warning">
              · Autorizado combustible ({ficha.asignacion_combustible_semanal} L/sem)
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-text-sec/70">
          Creada {fecha(ficha.created_at)}
          {ficha.ultimo_abastecimiento && ` · Último abast. ${fecha(ficha.ultimo_abastecimiento)}`}
          {ficha.ultimo_acceso && ` · Último acceso ${fecha(ficha.ultimo_acceso)}`}
        </p>
      </div>

      <Boton
        size="sm"
        variant={esSugerida ? 'ghost' : 'secundario'}
        disabled={ocupado}
        onClick={() => onFusionar(ficha)}
      >
        <Merge className="h-3.5 w-3.5" /> Conservar esta
      </Boton>
    </div>

    {/* El uso es lo que decide: una ficha con abastecimientos y accesos es la que
        el sistema ha estado usando de verdad. */}
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {USO.map((entrada) => {
        // El icono se saca como constante y no se desestructura en el parámetro:
        // este proyecto no tiene eslint-plugin-react, así que el uso dentro de JSX
        // no cuenta como uso y un parámetro así queda marcado como no utilizado.
        const { clave, etiqueta, destacado } = entrada;
        const Icono = entrada.Icono;
        const n = ficha.uso?.[clave] || 0;
        if (!n && !destacado) return null;
        return (
          <span
            key={clave}
            className={cn(
              'inline-flex items-center gap-1 text-[11px]',
              n > 0 ? 'font-bold text-text-main' : 'text-text-sec/50'
            )}
          >
            <Icono className="h-3 w-3" />
            {n} {etiqueta}
          </span>
        );
      })}
    </div>
  </div>
);

const Grupo = ({ grupo, onFusionado }) => {
  const [abierto, setAbierto] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  // La más usada es la candidata natural a conservar; en empate, la más antigua.
  const sugerida = [...grupo.fichas].sort(
    (a, b) => b.total_referencias - a.total_referencias
      || new Date(a.created_at) - new Date(b.created_at)
  )[0];

  const fusionar = async (conservar) => {
    const otras = grupo.fichas.filter((f) => f.id !== conservar.id);
    const perdidas = otras.reduce((s, f) => s + f.total_referencias, 0);

    const aviso =
      `Conservar la ficha ${conservar.placa_guardada} y eliminar ${otras.length} más.\n\n` +
      (perdidas > 0
        ? `Se moverán ${perdidas} registros (abastecimientos, accesos, etc.) a la ficha que conserva. No se pierde historial.\n\n`
        : 'Las otras fichas no tienen historial asociado.\n\n') +
      'Esta acción no se puede deshacer. ¿Continuar?';

    if (!window.confirm(aviso)) return;

    setOcupado(true);
    try {
      for (const otra of otras) {
        await vehiculosService.fusionar(otra.id, conservar.id);
      }
      toast.success(`${grupo.placa} unificada`);
      onFusionado();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo fusionar');
      setOcupado(false);
    }
  };

  return (
    <Card elevation={2} className="border-bg-high/10">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {abierto ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
        <span className="font-mono text-base font-black text-text-main">{grupo.placa}</span>
        <span className="text-xs text-text-sec">{grupo.fichas.length} fichas</span>
        {ocupado && <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary" />}
      </button>

      {abierto && (
        <div className="mt-3 space-y-2">
          {grupo.fichas.map((f) => (
            <Ficha
              key={f.id}
              ficha={f}
              esSugerida={f.id === sugerida.id}
              ocupado={ocupado}
              onFusionar={fusionar}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

export const VehiculosDuplicados = () => {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setGrupos(await vehiculosService.getDuplicados());
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudieron cargar los duplicados');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <Card elevation={2} className="border-bg-high/10 py-10 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
        <p className="mt-2 text-sm font-bold uppercase tracking-wide text-text-main">
          Sin placas duplicadas
        </p>
        <p className="mt-1 text-xs text-text-sec">
          Cada vehículo del registro tiene una sola ficha.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card elevation={2} className="border-warning/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-xs leading-relaxed text-text-sec">
            <p className="font-bold text-text-main">
              {grupos.length} placa{grupos.length > 1 ? 's' : ''} con más de una ficha
            </p>
            <p className="mt-1">
              Son el mismo vehículo cargado varias veces con la placa escrita distinto.
              Al elegir cuál conservar, <strong>el historial de las otras se mueve a
              esa</strong> y luego se eliminan: no se pierde ningún abastecimiento ni
              ningún acceso.
            </p>
          </div>
        </div>
      </Card>

      {grupos.map((g) => (
        <Grupo key={g.placa} grupo={g} onFusionado={cargar} />
      ))}
    </div>
  );
};
