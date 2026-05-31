import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, 
  User, Car, ShieldAlert, Award, FileText, Check, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { combustibleService } from '../../services/combustible.service';
import { entidadService } from '../../services/entidad.service';

export default function ColaAprobacionesCombustible() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true);
  const [cargandoEntidades, setCargandoEntidades] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  
  // Guardamos las entidades seleccionadas para cada solicitud de tipo 'vehiculo_no_registrado'
  const [entidadesSeleccionadas, setEntidadesSeleccionadas] = useState({});

  useEffect(() => {
    cargarEntidades();
    cargarSolicitudes();
    
    // Intervalo de actualización en tiempo real (cada 15 segundos)
    const interval = setInterval(() => {
      cargarSolicitudes(true);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const cargarEntidades = async () => {
    setCargandoEntidades(true);
    try {
      const res = await entidadService.listarEntidades();
      setEntidades(res || []);
    } catch (e) {
      console.error("Error al cargar entidades civiles:", e);
    } finally {
      setCargandoEntidades(false);
    }
  };

  const cargarSolicitudes = async (silencioso = false) => {
    if (!silencioso) setCargandoSolicitudes(true);
    try {
      const datos = await combustibleService.getSolicitudesPendientes();
      setSolicitudes(datos || []);
    } catch (e) {
      if (!silencioso) toast.error("Error al cargar la cola de aprobaciones remota.");
    } finally {
      if (!silencioso) setCargandoSolicitudes(false);
    }
  };

  const handleResolver = async (solicitudId, estado, placa) => {
    setProcesandoId(solicitudId);
    try {
      const entidadId = entidadesSeleccionadas[solicitudId] || null;
      await combustibleService.resolverSolicitud(solicitudId, estado, entidadId);
      
      toast.success(
        estado === 'aprobada' 
          ? `Solicitud de vehículo ${placa} APROBADA con éxito` 
          : `Solicitud de vehículo ${placa} RECHAZADA`
      );
      
      // Remover de la lista local
      setSolicitudes(prev => prev.filter(s => s.id !== solicitudId));
      
      // Limpiar selección de entidad si la hubiese
      setEntidadesSeleccionadas(prev => {
        const copia = { ...prev };
        delete copia[solicitudId];
        return copia;
      });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al procesar la solicitud de combustible.");
    } finally {
      setProcesandoId(null);
    }
  };

  const handleSeleccionarEntidad = (solicitudId, entidadId) => {
    setEntidadesSeleccionadas(prev => ({
      ...prev,
      [solicitudId]: entidadId
    }));
  };

  // Helpers visuales
  const renderTipoBadge = (tipo) => {
    switch (tipo) {
      case 'vehiculo_no_registrado':
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-red-500/10 border border-red-500/30 text-red-400">No Registrado</span>;
      case 'vehiculo_no_autorizado':
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-warning/10 border border-warning/30 text-warning-sec">No Autorizado</span>;
      case 'limite_entidad_excedido':
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-purple-500/10 border border-purple-500/30 text-purple-400">Cupo Entidad Excedido</span>;
      default:
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-white/5 border border-white/10 text-text-muted">{tipo.replace(/_/g, ' ')}</span>;
    }
  };

  const formatTiempoTranscurrido = (fechaIso) => {
    const ahora = new Date();
    const creacion = new Date(fechaIso);
    const difSeg = Math.floor((ahora - creacion) / 1000);
    
    if (difSeg < 60) return `${difSeg}s`;
    const difMin = Math.floor(difSeg / 60);
    if (difMin < 60) return `${difMin}m`;
    const difHor = Math.floor(difMin / 60);
    return `${difHor}h`;
  };

  return (
    <div className="min-h-screen bg-[#0E1322] text-text-main p-4 space-y-4 font-sans">
      {/* HEADER TÁCTICO */}
      <div className="flex flex-row justify-between items-center bg-[#1A1F2F] border border-white/5 rounded-xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 rounded-full bg-danger" />
            <h1 className="text-sm font-black uppercase tracking-widest text-text-main font-mono">Buzón de Aprobación Remota</h1>
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Autorizaciones en tiempo real para suministro especial de combustible</p>
        </div>
        <button 
          onClick={() => cargarSolicitudes()}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-text-main transition-all cursor-pointer"
          title="Actualizar cola"
        >
          {cargandoSolicitudes ? (
            <RefreshCw size={15} className="animate-spin text-success" />
          ) : (
            <RefreshCw size={15} />
          )}
        </button>
      </div>

      {/* BANDEJA OPERATIVA */}
      {cargandoSolicitudes ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={32} className="animate-spin text-danger" />
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-mono">Monitoreando canal de emergencia...</p>
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 bg-[#1A1F2F] border border-dashed border-white/10 rounded-2xl">
          <Clock size={48} className="text-text-muted animate-pulse" />
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-text-muted">Buzón de Emergencia Despejado</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">No hay solicitudes de combustible pendientes de resolución</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {solicitudes.map(sol => {
            const esNoRegistrado = sol.tipo_solicitud === 'vehiculo_no_registrado';
            
            return (
              <div 
                key={sol.id} 
                className="bg-[#1A1F2F] border border-white/5 hover:border-white/10 rounded-xl p-4 flex flex-col justify-between gap-4 transition-all"
              >
                {/* CABECERA TARJETA */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black font-mono tracking-wider text-text-main">{sol.placa}</span>
                      {renderTipoBadge(sol.tipo_solicitud)}
                    </div>
                    <p className="text-[10px] font-black uppercase text-success tracking-widest font-mono">
                      Cantidad Solicitada: {sol.cantidad_solicitada} Litros
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded text-[9px] font-mono text-text-muted">
                    <Clock size={10} />
                    Hace {formatTiempoTranscurrido(sol.fecha)}
                  </div>
                </div>

                {/* DETALLES DE VEHÍCULO / CONDUCTOR */}
                <div className="bg-[#0E1322] border border-white/5 rounded-lg p-3 space-y-2 text-[10px] font-sans">
                  {/* Conductor */}
                  {sol.conductor && (
                    <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
                      <User size={13} className="text-text-muted" />
                      <div>
                        <span className="text-text-muted uppercase text-[8px] block">Conductor</span>
                        <span className="font-bold text-text-main uppercase">{sol.conductor} {sol.cedula ? `(C.I. ${sol.cedula})` : ''}</span>
                      </div>
                    </div>
                  )}

                  {/* Detalles Físicos */}
                  {esNoRegistrado ? (
                    <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
                      <Car size={13} className="text-text-muted" />
                      <div>
                        <span className="text-text-muted uppercase text-[8px] block">Detalles del Vehículo</span>
                        <span className="font-bold text-text-main uppercase">
                          {sol.marca || 'S/M'} · {sol.modelo || 'S/M'} · {sol.color || 'S/C'}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Justificación */}
                  <div className="flex items-start gap-2">
                    <FileText size={13} className="text-text-muted mt-0.5" />
                    <div>
                      <span className="text-text-muted uppercase text-[8px] block">Justificación de Emergencia</span>
                      <span className="text-text-sec italic">"{sol.motivo}"</span>
                    </div>
                  </div>
                </div>

                {/* VÍNCULO A ENTIDAD (SOLO VEHÍCULOS NO REGISTRADOS) */}
                {esNoRegistrado && (
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                      <Award size={12} /> Vincular a Entidad Oficial
                    </label>
                    <select
                      value={entidadesSeleccionadas[sol.id] || ''}
                      onChange={(e) => handleSeleccionarEntidad(sol.id, e.target.value)}
                      className="w-full bg-[#0E1322] border border-white/10 rounded-xl px-3 h-10 text-[10px] text-text-main focus:outline-none focus:border-success transition-all"
                    >
                      <option value="">-- TRÁNSITO / EXTERNO (POR DEFECTO) --</option>
                      {entidades.map(ent => (
                        <option key={ent.id} value={ent.id}>{ent.nombre.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* BOTONES DE RESOLUCIÓN */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={() => handleResolver(sol.id, 'rechazada', sol.placa)}
                    disabled={procesandoId !== null}
                    className="flex-1 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <X size={12} />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleResolver(sol.id, 'aprobada', sol.placa)}
                    disabled={procesandoId !== null}
                    className="flex-[2] h-10 rounded-xl bg-success text-bg-app font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer transition-all hover:bg-success/90 active:scale-95 disabled:opacity-50"
                  >
                    <Check size={12} />
                    Aprobar Suministro
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
