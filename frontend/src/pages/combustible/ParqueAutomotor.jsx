import React, { useState, useEffect } from 'react';
import { 
  Car, RefreshCw, Upload, Edit3, Settings, ShieldAlert,
  CheckCircle, AlertTriangle, XCircle, Search, ToggleLeft, ToggleRight,
  Database, Flame, FileSpreadsheet, PlusCircle, Download,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { combustibleService } from '../../services/combustible.service';
import { entidadService } from '../../services/entidad.service';

export default function ParqueAutomotor() {
  const [vehiculos, setVehiculos] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [cargandoVehiculos, setCargandoVehiculos] = useState(true);
  const [cargandoEntidades, setCargandoEntidades] = useState(true);
  
  // Filtros
  const [filtroEntidad, setFiltroEntidad] = useState('');
  const [placaBusqueda, setPlacaBusqueda] = useState('');

  // Paginación
  const [page, setPage] = useState(0);
  const limit = 10;

  // Edición de límites de Entidad
  const [entidadSeleccionadaData, setEntidadSeleccionadaData] = useState(null);
  const [guardandoLimiteEntidad, setGuardandoLimiteEntidad] = useState(false);
  const [nuevoLimiteEntidad, setNuevoLimiteEntidad] = useState('');

  // Modal Edición Vehículo
  const [modalVehiculo, setModalVehiculo] = useState(null);
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);
  const [formVehiculo, setFormVehiculo] = useState({
    uso_vehiculo: '',
    tipo_combustible: '',
    capacidad_tanque: '',
    asignacion_combustible_semanal: '',
    autorizado_combustible: false
  });

  // Modal Carga Masiva Excel
  const [modalImportar, setModalImportar] = useState(false);
  const [archivoExcel, setArchivoExcel] = useState(null);
  const [entidadImportacion, setEntidadImportacion] = useState('');
  const [importandoExcel, setImportandoExcel] = useState(false);
  const [resumenImportacion, setResumenImportacion] = useState(null);

  // Modal Registro Individual
  const [modalRegistro, setModalRegistro] = useState(false);
  const [formRegistro, setFormRegistro] = useState({
    placa: '', entidad_id: '', marca: '', modelo: '', color: '',
    uso_vehiculo: 'particular', tipo_combustible: 'gasolina',
    capacidad_tanque: '', asignacion_combustible_semanal: '', autorizado_combustible: false
  });
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    cargarEntidades();
    cargarVehiculos();
  }, []);

  useEffect(() => {
    if (filtroEntidad) {
      const ent = entidades.find(e => e.id === filtroEntidad);
      if (ent) {
        setEntidadSeleccionadaData(ent);
        setNuevoLimiteEntidad(ent.limite_combustible_semanal || '0');
      } else {
        setEntidadSeleccionadaData(null);
      }
    } else {
      setEntidadSeleccionadaData(null);
    }
  }, [filtroEntidad, entidades]);

  const cargarEntidades = async () => {
    setCargandoEntidades(true);
    try {
      const res = await entidadService.listarEntidades();
      setEntidades(res || []);
    } catch (e) {
      toast.error("No se pudieron cargar las entidades civiles.");
    } finally {
      setCargandoEntidades(false);
    }
  };

  const cargarVehiculos = async () => {
    setCargandoVehiculos(true);
    try {
      const params = {};
      if (filtroEntidad) params.entidad_id = filtroEntidad;
      if (placaBusqueda) params.placa = placaBusqueda;

      const res = await combustibleService.getVehiculosParque(params);
      setVehiculos(res || []);
    } catch (e) {
      toast.error("Error al cargar la flota vehicular.");
    } finally {
      setCargandoVehiculos(false);
    }
  };

  const handleBuscar = (e) => {
    e.preventDefault();
    setPage(0);
    cargarVehiculos();
  };

  const handleToggleAutorizar = async (vehiculo) => {
    try {
      const nuevoEstado = !vehiculo.autorizado_combustible;
      await combustibleService.actualizarVehiculoCombustible(vehiculo.id, {
        autorizado_combustible: nuevoEstado
      });
      toast.success(nuevoEstado ? `Vehículo ${vehiculo.placa} autorizado para surtir` : `Vehículo ${vehiculo.placa} inhabilitado para surtir`);
      
      // Actualizar estado local
      setVehiculos(prev => prev.map(v => v.id === vehiculo.id ? { ...v, autorizado_combustible: nuevoEstado } : v));
    } catch (e) {
      toast.error("No se pudo actualizar el estado de autorización.");
    }
  };

  const handleAbrirEditarVehiculo = (vehiculo) => {
    setModalVehiculo(vehiculo);
    setFormVehiculo({
      uso_vehiculo: vehiculo.uso_vehiculo,
      tipo_combustible: vehiculo.tipo_combustible,
      capacidad_tanque: vehiculo.capacidad_tanque || '0',
      asignacion_combustible_semanal: vehiculo.asignacion_combustible_semanal || '0',
      autorizado_combustible: vehiculo.autorizado_combustible
    });
  };

  const handleGuardarVehiculo = async (e) => {
    e.preventDefault();
    setGuardandoVehiculo(true);
    try {
      await combustibleService.actualizarVehiculoCombustible(modalVehiculo.id, {
        uso_vehiculo: formVehiculo.uso_vehiculo,
        tipo_combustible: formVehiculo.tipo_combustible,
        capacidad_tanque: parseFloat(formVehiculo.capacidad_tanque) || 0,
        asignacion_combustible_semanal: parseFloat(formVehiculo.asignacion_combustible_semanal) || 0,
        autorizado_combustible: formVehiculo.autorizado_combustible
      });
      toast.success("Parámetros del vehículo actualizados correctamente.");
      setModalVehiculo(null);
      cargarVehiculos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar el vehículo.");
    } finally {
      setGuardandoVehiculo(false);
    }
  };

  const handleActualizarLimiteEntidad = async (e) => {
    e.preventDefault();
    if (!entidadSeleccionadaData) return;
    setGuardandoLimiteEntidad(true);
    try {
      // Usar entidadService para actualizar la cuota semanal de combustible
      const res = await entidadService.actualizarEntidad(entidadSeleccionadaData.id, {
        nombre: entidadSeleccionadaData.nombre,
        limite_combustible_semanal: parseFloat(nuevoLimiteEntidad) || 0
      });
      toast.success("Límite semanal de la entidad actualizado.");
      
      // Actualizar lista de entidades locales
      setEntidades(prev => prev.map(e => e.id === entidadSeleccionadaData.id ? { ...e, limite_combustible_semanal: parseFloat(nuevoLimiteEntidad) || 0 } : e));
    } catch (err) {
      toast.error("Error al actualizar cuota de la entidad.");
    } finally {
      setGuardandoLimiteEntidad(false);
    }
  };

  const handleSubirExcel = async (e) => {
    e.preventDefault();
    if (!archivoExcel || !entidadImportacion) return;
    setImportandoExcel(true);
    setResumenImportacion(null);
    try {
      const formData = new FormData();
      formData.append('file', archivoExcel);
      
      const res = await combustibleService.importarExcelParque(formData, entidadImportacion);
      toast.success("Carga masiva procesada exitosamente");
      setResumenImportacion(res.data);
      cargarVehiculos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al procesar la plantilla Excel.");
    } finally {
      setImportandoExcel(false);
    }
  };

  const handleDescargarPlantilla = async () => {
    try {
      const data = await combustibleService.descargarPlantilla();
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'TEMPLATE_PARQUE_AUTOMOTOR_BAGFM.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Plantilla descargada con éxito.");
    } catch (e) {
      toast.error("No se pudo descargar la plantilla de importación.");
    }
  };

  const handleRegistrarVehiculo = async (e) => {
    e.preventDefault();
    if (!formRegistro.placa.trim() || !formRegistro.entidad_id) {
      toast.error("La placa y la entidad son obligatorios.");
      return;
    }
    setRegistrando(true);
    try {
      await combustibleService.crearVehiculo({
        placa: formRegistro.placa.trim().toUpperCase(),
        entidad_id: formRegistro.entidad_id,
        marca: formRegistro.marca || null,
        modelo: formRegistro.modelo || null,
        color: formRegistro.color || null,
        uso_vehiculo: formRegistro.uso_vehiculo,
        tipo_combustible: formRegistro.tipo_combustible,
        capacidad_tanque: parseFloat(formRegistro.capacidad_tanque) || 0,
        asignacion_combustible_semanal: parseFloat(formRegistro.asignacion_combustible_semanal) || 0,
        autorizado_combustible: formRegistro.autorizado_combustible
      });
      toast.success(`Vehículo ${formRegistro.placa.toUpperCase()} registrado con éxito.`);
      setModalRegistro(false);
      setFormRegistro({ placa: '', entidad_id: '', marca: '', modelo: '', color: '', uso_vehiculo: 'particular', tipo_combustible: 'gasolina', capacidad_tanque: '', asignacion_combustible_semanal: '', autorizado_combustible: false });
      cargarVehiculos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al registrar el vehículo.");
    } finally {
      setRegistrando(false);
    }
  };

  // Helper para renderizar badges de uso
  const renderUsoBadge = (uso) => {
    switch (uso) {
      case 'protocolar':
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-purple-500/10 border border-purple-500/30 text-purple-400">Protocolar</span>;
      case 'servicio':
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">Servicios</span>;
      case 'particular':
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">Particular</span>;
      default:
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded bg-white/5 border border-white/10 text-text-muted">{uso}</span>;
    }
  };

  return (
    <div className="min-h-screen dark bg-bg-app text-text-main p-4 space-y-4 font-sans">
      {/* HEADER TÁCTICO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-card border border-bg-high/50 rounded-xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 rounded-full bg-success animate-pulse" />
            <h1 className="text-sm font-black uppercase tracking-widest text-text-main font-mono">Parque Automotor</h1>
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Control táctico de la flota y asignación de combustible de la base</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setModalRegistro(true)}
            className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-primary text-on-primary font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/90 transition-all cursor-pointer active:scale-95 shadow-tactica"
          >
            <PlusCircle size={14} />
            Registrar Vehículo
          </button>
          <button 
            onClick={() => setModalImportar(true)}
            className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-success text-on-primary font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-success/90 transition-all cursor-pointer active:scale-95 shadow-tactica"
          >
            <Upload size={14} />
            Carga Masiva
          </button>
          <button 
            onClick={() => { cargarEntidades(); cargarVehiculos(); }}
            className="w-10 h-10 rounded-xl bg-white/5 border border-bg-high/30 flex items-center justify-center text-text-muted hover:text-text-main transition-all"
            title="Refrescar datos"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* FILTROS Y CONTROLES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* BUSCADOR */}
        <div className="md:col-span-2 bg-bg-card border border-bg-high/50 rounded-xl p-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3 flex items-center gap-1.5">
            <Search size={12} /> Búsqueda y Segmentación
          </h3>
          <form onSubmit={handleBuscar} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="BUSCAR POR PLACA..."
                value={placaBusqueda}
                onChange={(e) => setPlacaBusqueda(e.target.value)}
                className="w-full bg-bg-low border border-bg-high/30 rounded-xl pl-4 pr-10 h-11 text-xs text-text-main font-display font-black tracking-wider focus:outline-none focus:border-success transition-all uppercase"
              />
              <button type="submit" className="absolute right-3 top-3.5 text-text-muted hover:text-text-main">
                <Search size={14} />
              </button>
            </div>
            
            <select
              value={filtroEntidad}
              onChange={(e) => setFiltroEntidad(e.target.value)}
              className="bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
            >
              <option value="">TODAS LAS ENTIDADES</option>
              {entidades.map(ent => (
                <option key={ent.id} value={ent.id}>{ent.nombre.toUpperCase()}</option>
              ))}
            </select>

            <button
              type="submit"
              className="h-11 px-5 rounded-xl bg-white/5 hover:bg-white/10 border border-bg-high/30 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Filtrar
            </button>
          </form>
        </div>

        {/* AJUSTES DE CUOTA GLOBAL DE LA ENTIDAD SELECCIONADA */}
        <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3 flex items-center gap-1.5">
            <Settings size={12} /> Límite Semanal Entidad
          </h3>
          {entidadSeleccionadaData ? (
            <form onSubmit={handleActualizarLimiteEntidad} className="space-y-3">
              <div>
                <p className="text-xs font-black text-text-main uppercase tracking-wide truncate">{entidadSeleccionadaData.nombre}</p>
                <p className="text-[9px] text-text-muted uppercase mt-0.5">Asignar litros semanales permitidos globales</p>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Cuota en Litros"
                    value={nuevoLimiteEntidad}
                    onChange={(e) => setNuevoLimiteEntidad(e.target.value)}
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-4 h-11 text-xs text-text-main font-display font-black focus:outline-none focus:border-success transition-all"
                  />
                  <span className="absolute right-3 top-3.5 text-[10px] font-black text-text-muted uppercase">Ltrs</span>
                </div>
                <button
                  type="submit"
                  disabled={guardandoLimiteEntidad}
                  className="px-4 rounded-xl bg-success text-on-primary font-black text-[10px] uppercase tracking-widest hover:bg-success/90 transition-all flex items-center justify-center cursor-pointer shadow-tactica"
                >
                  {guardandoLimiteEntidad ? <RefreshCw size={13} className="animate-spin" /> : "Guardar"}
                </button>
              </div>
            </form>
          ) : (
            <div className="h-[76px] flex items-center justify-center bg-white/5 border border-dashed border-bg-high/30 rounded-xl">
              <p className="text-[10px] text-text-muted uppercase tracking-wider text-center px-4">Seleccione una entidad para gestionar su límite semanal de litros</p>
            </div>
          )}
        </div>
      </div>

      {/* LISTADO DE VEHÍCULOS (PARQUE AUTOMOTOR) */}
      <div className="bg-bg-card border border-bg-high/50 rounded-xl p-4 overflow-hidden">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4 flex items-center gap-1.5">
          <Database size={13} /> Flota Registrada ({vehiculos.length} Vehículos)
        </h2>

        {cargandoVehiculos ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={28} className="animate-spin text-success" />
            <p className="text-[10px] text-text-muted uppercase tracking-widest">Cargando parque automotor...</p>
          </div>
        ) : vehiculos.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 bg-white/5 border border-dashed border-bg-high/30 rounded-xl">
            <Car size={36} className="text-text-muted" />
            <p className="text-xs text-text-muted italic">No se encontraron vehículos registrados con los criterios seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-bg-high/20 text-[8px] font-black uppercase tracking-widest text-text-muted">
                  <th className="py-2.5 px-3">Placa</th>
                  <th className="py-2.5 px-3">Vehículo</th>
                  <th className="py-2.5 px-3">Entidad</th>
                  <th className="py-2.5 px-3">Uso</th>
                  <th className="py-2.5 px-3">Combustible</th>
                  <th className="py-2.5 px-3">Límite Semanal</th>
                  <th className="py-2.5 px-3">Último Odómetro</th>
                  <th className="py-2.5 px-3 text-center">Autorizado Bomba</th>
                  <th className="py-2.5 px-3 text-right">Ajustes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-high/20 text-[11px] font-sans">
                {vehiculos.slice(page * limit, (page + 1) * limit).map(v => (
                  <tr key={v.id} className="hover:bg-bg-low/30 transition-all">
                    <td className="py-3 px-3 font-display font-black text-text-main tracking-wider">{v.placa}</td>
                    <td className="py-3 px-3 text-text-sec">
                      <div className="font-bold text-text-main">{v.marca}</div>
                      <div className="text-[9px] text-text-muted">{v.modelo} · {v.color}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold text-text-sec uppercase truncate max-w-[150px] inline-block">
                        {v.entidad_nombre || <span className="text-text-muted italic lowercase">Sin Entidad</span>}
                      </span>
                    </td>
                    <td className="py-3 px-3">{renderUsoBadge(v.uso_vehiculo)}</td>
                    <td className="py-3 px-3 uppercase font-display text-[9px] text-text-sec">
                      {v.tipo_combustible === 'diesel' ? (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold">Diésel</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">GASOLINA</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-display">
                      <span className="font-black text-text-main">{v.asignacion_combustible_semanal} L</span>
                      <span className="text-[8px] text-text-muted block font-sans">Tanque: {v.capacidad_tanque}L</span>
                    </td>
                    <td className="py-3 px-3 font-display font-bold text-text-sec">{v.ultimo_kilometraje} km</td>
                    <td className="py-3 px-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleToggleAutorizar(v)}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer shadow-sm",
                            v.autorizado_combustible 
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20" 
                              : "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
                          )}
                        >
                          {v.autorizado_combustible ? "AUTORIZADO" : "INHABILITADO"}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleAbrirEditarVehiculo(v)}
                        className="w-8 h-8 rounded-lg bg-white/5 border border-bg-high/30 hover:bg-white/10 transition-all flex items-center justify-center ml-auto text-text-muted hover:text-text-main cursor-pointer"
                        title="Editar parámetros"
                      >
                        <Edit3 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargandoVehiculos && vehiculos.length > limit && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-bg-high/20">
            <button 
              disabled={page === 0} 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main disabled:opacity-30 transition-all cursor-pointer"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <div className="flex flex-col items-center">
              <span className="text-xs font-display font-black text-success">PÁGINA {page + 1}</span>
            </div>
            <button 
              disabled={vehiculos.length <= (page + 1) * limit} 
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main disabled:opacity-30 transition-all cursor-pointer"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* MODAL EDICIÓN PARÁMETROS VEHÍCULO */}
      {modalVehiculo && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-bg-high/50 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-high/30 bg-bg-app">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-success" />
                <p className="text-[10px] font-black uppercase tracking-widest text-text-main font-mono">Ajustes Combustible: {modalVehiculo.placa}</p>
              </div>
              <button 
                onClick={() => setModalVehiculo(null)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main cursor-pointer"
              >
                <XCircle size={15} />
              </button>
            </div>

            <form onSubmit={handleGuardarVehiculo} className="p-4 space-y-4">
              {/* Autorización rápida */}
              <div className="flex justify-between items-center bg-white/5 border border-bg-high/30 rounded-xl p-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-main block">Autorizado para Surtir</span>
                  <span className="text-[8px] text-text-muted uppercase">Permitir despacho directo en bomba</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormVehiculo(prev => ({ ...prev, autorizado_combustible: !prev.autorizado_combustible }))}
                  className="text-text-main focus:outline-none cursor-pointer"
                >
                  {formVehiculo.autorizado_combustible ? (
                    <ToggleRight className="text-success" size={32} />
                  ) : (
                    <ToggleLeft className="text-text-muted" size={32} />
                  )}
                </button>
              </div>

              {/* Tipo de uso */}
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Tipo de Uso del Vehículo</label>
                <select
                  value={formVehiculo.uso_vehiculo}
                  onChange={(e) => setFormVehiculo(prev => ({ ...prev, uso_vehiculo: e.target.value }))}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                >
                  <option value="particular">PARTICULAR</option>
                  <option value="protocolar">PROTOCOLAR</option>
                  <option value="servicio">SERVICIO / OPERATIVO</option>
                </select>
              </div>

              {/* Tipo de combustible */}
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Tipo de Combustible</label>
                <select
                  value={formVehiculo.tipo_combustible}
                  onChange={(e) => setFormVehiculo(prev => ({ ...prev, tipo_combustible: e.target.value }))}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                >
                  <option value="gasolina">GASOLINA</option>
                  <option value="diesel">Diésel</option>
                </select>
              </div>

              {/* Litros Tanque y Límite Semanal */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Capacidad Tanque</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formVehiculo.capacidad_tanque}
                      onChange={(e) => setFormVehiculo(prev => ({ ...prev, capacidad_tanque: e.target.value }))}
                      className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main font-display font-black focus:outline-none focus:border-success transition-all"
                      placeholder="Ej: 50"
                    />
                    <span className="absolute right-3 top-3.5 text-[8px] font-black text-text-muted font-sans">L</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Límite Semanal (Sugerido)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formVehiculo.asignacion_combustible_semanal}
                      onChange={(e) => setFormVehiculo(prev => ({ ...prev, asignacion_combustible_semanal: e.target.value }))}
                      className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main font-display font-black focus:outline-none focus:border-success transition-all"
                      placeholder="Ej: 30"
                    />
                    <span className="absolute right-3 top-3.5 text-[8px] font-black text-text-muted font-sans">L</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalVehiculo(null)}
                  className="w-1/3 h-11 rounded-xl bg-white/5 border border-bg-high/30 text-[10px] font-black uppercase tracking-widest text-text-muted cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoVehiculo}
                  className="flex-1 h-11 rounded-xl bg-success text-on-primary font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer shadow-tactica"
                >
                  {guardandoVehiculo ? <RefreshCw size={13} className="animate-spin" /> : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CARGA MASIVA DE EXCEL */}
      {modalImportar && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-bg-card rounded-2xl border border-bg-high/50 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-high/30 bg-bg-app">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-success" />
                <p className="text-[10px] font-black uppercase tracking-widest text-text-main font-mono">Carga Masiva: Flota Automotriz</p>
              </div>
              <button 
                onClick={() => { setModalImportar(false); setArchivoExcel(null); setEntidadImportacion(''); setResumenImportacion(null); }}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:text-text-main cursor-pointer"
              >
                <XCircle size={15} />
              </button>
            </div>
 
            <div className="p-4 space-y-4 overflow-y-auto flex-1 scrollbar-tactical">
              {/* Formulario de carga */}
              <form onSubmit={handleSubirExcel} className="space-y-4">
                {/* Selector de Entidad */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Entidad de Asignación (Obligatorio)</label>
                  <select
                    value={entidadImportacion}
                    onChange={(e) => setEntidadImportacion(e.target.value)}
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold uppercase"
                    required
                  >
                    <option value="">-- SELECCIONE LA ENTIDAD --</option>
                    {entidades.map(ent => (
                      <option key={ent.id} value={ent.id}>{ent.nombre.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="border-2 border-dashed border-bg-high/30 rounded-xl p-6 bg-white/5 flex flex-col items-center justify-center text-center gap-2">
                  <FileSpreadsheet className="text-success mb-1" size={32} />
                  <div>
                    <span className="text-xs font-bold text-text-main block">Seleccionar plantilla Excel (.xlsx)</span>
                    <span className="text-[9px] text-text-muted uppercase mt-1 block font-sans">El archivo debe contener placa, marca, modelo, capacidad de tanque, etc.</span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={(e) => setArchivoExcel(e.target.files[0])}
                    className="w-full text-xs text-text-muted mt-2 cursor-pointer bg-white/5 border border-bg-high/30 rounded px-2 py-1 file:hidden"
                  />
                  {archivoExcel && (
                    <span className="text-[10px] text-success font-black uppercase tracking-wider mt-1 font-display">
                      Archivo listo: {archivoExcel.name}
                    </span>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleDescargarPlantilla}
                    className="mt-3 text-[9px] text-success font-black uppercase tracking-widest hover:bg-success/20 flex items-center justify-center gap-1.5 cursor-pointer bg-success/10 border border-success/30 px-4 py-2 rounded-lg active:scale-95 transition-all"
                  >
                    <Download size={12} /> Descargar Plantilla Oficial
                  </button>
                </div>
 
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setModalImportar(false); setArchivoExcel(null); setEntidadImportacion(''); setResumenImportacion(null); }}
                    className="w-1/3 h-11 rounded-xl bg-white/5 border border-bg-high/30 text-[10px] font-black uppercase tracking-widest text-text-muted cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={importandoExcel || !archivoExcel || !entidadImportacion}
                    className="flex-1 h-11 rounded-xl bg-success text-on-primary font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-tactica"
                  >
                    {importandoExcel ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                    Procesar Plantilla
                  </button>
                </div>
              </form>

              {/* Resumen de importación si fue exitosa */}
              {resumenImportacion && (
                <div className="bg-bg-app border border-bg-high/50 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-success flex items-center gap-1">
                    <CheckCircle size={12} /> Carga Procesada Exitosamente
                  </p>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold mt-1">
                    <div className="bg-white/5 border border-bg-high/30 rounded p-2">
                      <span className="text-text-muted text-[8px] uppercase block tracking-wider mb-1">Leídos</span>
                      <span className="text-text-main text-sm">{resumenImportacion.leidos || 0}</span>
                    </div>
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-2">
                      <span className="text-emerald-400 text-sm">{resumenImportacion.creados || 0}</span>
                    </div>
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded p-2">
                      <span className="text-blue-400 text-sm">{resumenImportacion.actualizados || 0}</span>
                    </div>
                  </div>

                  {resumenImportacion.errores && resumenImportacion.errores.length > 0 && (
                    <div className="pt-2 border-t border-bg-high/20">
                      <p className="text-[9px] font-black uppercase tracking-widest text-danger flex items-center gap-1 mb-1.5">
                        <AlertTriangle size={11} /> Advertencias y Errores ({resumenImportacion.errores.length})
                      </p>
                      <ul className="text-[9px] text-red-400/90 font-mono space-y-1 max-h-[120px] overflow-y-auto scrollbar-tactical bg-black/30 p-2 rounded border border-red-500/10">
                        {resumenImportacion.errores.map((err, idx) => (
                          <li key={idx} className="border-b border-white/5 pb-1 last:border-0 last:pb-0">{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ MODAL REGISTRO INDIVIDUAL â”€â”€â”€ */}
      {modalRegistro && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bg-high/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-tactical">
            <div className="p-4 border-b border-bg-high/20 flex justify-between items-center sticky top-0 bg-bg-card z-10">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Registrar Vehículo Individual</h3>
              </div>
              <button onClick={() => setModalRegistro(false)} className="text-text-muted hover:text-text-main cursor-pointer">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleRegistrarVehiculo} className="p-5 space-y-4">
              {/* Placa (obligatorio) */}
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                  <Car size={10} /> Placa *
                </label>
                <input
                  type="text"
                  value={formRegistro.placa}
                  onChange={(e) => setFormRegistro(p => ({ ...p, placa: e.target.value.toUpperCase() }))}
                  placeholder="Ej: ABC123D"
                  maxLength={10}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main font-display font-black tracking-widest focus:outline-none focus:border-success transition-all uppercase"
                  required
                />
              </div>

              {/* Entidad (obligatorio) */}
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                  <Database size={10} /> Entidad *
                </label>
                <select
                  value={formRegistro.entidad_id}
                  onChange={(e) => setFormRegistro(p => ({ ...p, entidad_id: e.target.value }))}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  required
                >
                  <option value="">Seleccionar entidad...</option>
                  {entidades.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.nombre.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Marca, Modelo, Color (opcionales) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Marca</label>
                  <input type="text" value={formRegistro.marca}
                    onChange={(e) => setFormRegistro(p => ({ ...p, marca: e.target.value }))}
                    placeholder="Toyota"
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Modelo</label>
                  <input type="text" value={formRegistro.modelo}
                    onChange={(e) => setFormRegistro(p => ({ ...p, modelo: e.target.value }))}
                    placeholder="Hilux"
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Color</label>
                  <input type="text" value={formRegistro.color}
                    onChange={(e) => setFormRegistro(p => ({ ...p, color: e.target.value }))}
                    placeholder="Blanco"
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  />
                </div>
              </div>

              {/* Uso y Tipo Combustible */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Uso Vehículo</label>
                  <select value={formRegistro.uso_vehiculo}
                    onChange={(e) => setFormRegistro(p => ({ ...p, uso_vehiculo: e.target.value }))}
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  >
                    <option value="particular">Particular</option>
                    <option value="protocolar">Protocolar</option>
                    <option value="servicio">Servicio</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Combustible</label>
                  <select value={formRegistro.tipo_combustible}
                    onChange={(e) => setFormRegistro(p => ({ ...p, tipo_combustible: e.target.value }))}
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  >
                    <option value="gasolina">⛽ Gasolina</option>
                    <option value="diesel">🛢️ Diésel</option>
                  </select>
                </div>
              </div>

              {/* Capacidad y Asignación */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Capacidad Tanque (L)</label>
                  <input type="number" step="0.1" min="0" value={formRegistro.capacidad_tanque}
                    onChange={(e) => setFormRegistro(p => ({ ...p, capacidad_tanque: e.target.value }))}
                    placeholder="60"
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-display font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Asig. Semanal (L)</label>
                  <input type="number" step="0.1" min="0" value={formRegistro.asignacion_combustible_semanal}
                    onChange={(e) => setFormRegistro(p => ({ ...p, asignacion_combustible_semanal: e.target.value }))}
                    placeholder="50"
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-display font-bold"
                  />
                </div>
              </div>

              {/* Toggle Autorización */}
              <div className="flex items-center justify-between bg-bg-low border border-bg-high/30 rounded-xl p-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Autorizar para Surtir Combustible</span>
                <button
                  type="button"
                  onClick={() => setFormRegistro(p => ({ ...p, autorizado_combustible: !p.autorizado_combustible }))}
                  className="cursor-pointer"
                >
                  {formRegistro.autorizado_combustible ? (
                    <ToggleRight size={28} className="text-success" />
                  ) : (
                    <ToggleLeft size={28} className="text-text-muted" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={registrando}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-on-primary font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-tactica"
              >
                {registrando ? <RefreshCw size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                {registrando ? 'Registrando...' : 'Registrar Vehículo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

