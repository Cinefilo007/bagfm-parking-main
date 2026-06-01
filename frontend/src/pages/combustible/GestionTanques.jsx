import React, { useState, useEffect } from 'react';
import { 
  Flame, RefreshCw, PlusCircle, Edit3, Trash2, 
  CheckCircle, AlertTriangle, XCircle, Database, Droplet,
  ClipboardList, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { combustibleService } from '../../services/combustible.service';

export default function GestionTanques() {
  const [tanques, setTanques] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Modal Crear Tanque
  const [modalCrear, setModalCrear] = useState(false);
  const [formCrear, setFormCrear] = useState({
    nombre: '',
    tipo_combustible: 'gasolina',
    capacidad_maxima: '',
    cantidad_actual: ''
  });
  const [creando, setCreando] = useState(false);

  // Modal Editar Tanque
  const [modalEditar, setModalEditar] = useState(null);
  const [formEditar, setFormEditar] = useState({
    nombre: '',
    capacidad_maxima: ''
  });
  const [editando, setEditando] = useState(false);

  // Confirmación de eliminación
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // Historial General Paginado
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [totalHistorial, setTotalHistorial] = useState(0);
  const limit = 10;

  useEffect(() => {
    cargarTanques();
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [pagina]);

  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try {
      const skip = pagina * limit;
      const res = await combustibleService.obtenerHistorialAbastecimientos(skip, limit);
      setHistorial(res.data || []);
      setTotalHistorial(res.total || 0);
    } catch (e) {
      console.error("Error al cargar historial:", e);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const cargarTanques = async () => {
    setCargando(true);
    try {
      const res = await combustibleService.getTanques();
      setTanques(res.data || []);
    } catch (e) {
      toast.error("Error al cargar los tanques de combustible.");
    } finally {
      setCargando(false);
    }
  };

  const handleCrearTanque = async (e) => {
    e.preventDefault();
    if (!formCrear.nombre.trim() || !formCrear.capacidad_maxima) {
      toast.error("Complete los campos obligatorios.");
      return;
    }
    setCreando(true);
    try {
      await combustibleService.crearTanque({
        nombre: formCrear.nombre.trim(),
        tipo_combustible: formCrear.tipo_combustible,
        capacidad_maxima: parseFloat(formCrear.capacidad_maxima),
        cantidad_actual: parseFloat(formCrear.cantidad_actual) || 0
      });
      toast.success("Tanque registrado con éxito.");
      setModalCrear(false);
      setFormCrear({ nombre: '', tipo_combustible: 'gasolina', capacidad_maxima: '', cantidad_actual: '' });
      cargarTanques();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear el tanque.");
    } finally {
      setCreando(false);
    }
  };

  const handleAbrirEditar = (tanque) => {
    setModalEditar(tanque);
    setFormEditar({
      nombre: tanque.nombre,
      capacidad_maxima: tanque.capacidad_maxima
    });
  };

  const handleEditarTanque = async (e) => {
    e.preventDefault();
    if (!formEditar.nombre.trim() || !formEditar.capacidad_maxima) return;
    setEditando(true);
    try {
      await combustibleService.editarTanque(modalEditar.id, {
        nombre: formEditar.nombre.trim(),
        capacidad_maxima: parseFloat(formEditar.capacidad_maxima)
      });
      toast.success("Tanque actualizado con éxito.");
      setModalEditar(null);
      cargarTanques();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al editar el tanque.");
    } finally {
      setEditando(false);
    }
  };

  const handleEliminarTanque = async () => {
    if (!confirmEliminar) return;
    setEliminando(true);
    try {
      await combustibleService.eliminarTanque(confirmEliminar.id);
      toast.success(`Tanque "${confirmEliminar.nombre}" desactivado.`);
      setConfirmEliminar(null);
      cargarTanques();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al desactivar el tanque.");
    } finally {
      setEliminando(false);
    }
  };

  const getNivelColor = (porcentaje) => {
    if (porcentaje > 50) return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]' };
    if (porcentaje > 20) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]' };
    return { bar: 'bg-red-500 animate-pulse', text: 'text-red-400', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]' };
  };

  return (
    <div className="min-h-screen dark bg-bg-app text-text-main p-4 space-y-4 font-sans">
      {/* HEADER TÁCTICO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-card border border-bg-high/50 rounded-xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-5 rounded-full bg-success animate-pulse" />
            <h1 className="text-sm font-black uppercase tracking-widest text-text-main font-mono">Tanques de Combustible</h1>
          </div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Gestión de los tanques de la bomba de combustible de la base</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setModalCrear(true)}
            className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-success text-on-primary font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-success/90 transition-all cursor-pointer active:scale-95 shadow-tactica"
          >
            <PlusCircle size={14} />
            Registrar Tanque
          </button>
          <button 
            onClick={cargarTanques}
            className="w-10 h-10 rounded-xl bg-white/5 border border-bg-high/30 flex items-center justify-center text-text-muted hover:text-text-main transition-all cursor-pointer"
            title="Refrescar datos"
          >
            {cargando ? <RefreshCw size={15} className="animate-spin text-success" /> : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      {/* LISTADO DE TANQUES */}
      {cargando ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 bg-bg-card border border-bg-high/50 rounded-xl">
          <RefreshCw size={36} className="animate-spin text-success" />
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-mono">Cargando inventario de tanques...</p>
        </div>
      ) : tanques.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 bg-bg-card border border-bg-high/50 rounded-xl">
          <Database size={48} className="text-text-muted opacity-20" />
          <p className="text-xs text-text-muted italic">No hay tanques registrados.</p>
          <p className="text-[10px] text-text-muted uppercase">Registre un tanque para iniciar las operaciones de la bomba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tanques.map(tanque => {
            const nivel = getNivelColor(tanque.porcentaje);
            return (
              <div key={tanque.id} className="bg-bg-card border border-bg-high/50 rounded-xl p-5 relative overflow-hidden group hover:border-bg-high transition-all">
                {/* Glow de fondo según nivel */}
                <div className={cn(
                  "absolute -right-4 -top-4 w-32 h-32 rounded-full filter blur-3xl opacity-10 pointer-events-none",
                  tanque.porcentaje > 50 ? 'bg-emerald-500' : tanque.porcentaje > 20 ? 'bg-amber-500' : 'bg-red-500'
                )} />

                {/* Header del tanque */}
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-text-main">{tanque.nombre}</h3>
                    <span className={cn(
                      "inline-block px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded",
                      tanque.tipo_combustible === 'gasolina' 
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                    )}>
                      {tanque.tipo_combustible === 'gasolina' ? '⛽ Gasolina' : '🛢️ Diésel'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleAbrirEditar(tanque)}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-bg-high/30 flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
                      title="Editar tanque"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button 
                      onClick={() => setConfirmEliminar(tanque)}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-bg-high/30 flex items-center justify-center text-text-muted hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
                      title="Desactivar tanque"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Indicador de nivel visual */}
                <div className="relative z-10 space-y-3">
                  {/* Porcentaje grande */}
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-4xl font-black font-display tracking-tight", nivel.text)}>
                      {Math.round(tanque.porcentaje)}
                    </span>
                    <span className="text-sm font-black text-text-muted">%</span>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-bg-app h-3 rounded-full overflow-hidden border border-bg-high/50">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-700", nivel.bar, nivel.glow)}
                      style={{ width: `${Math.min(tanque.porcentaje, 100)}%` }}
                    />
                  </div>

                  {/* Litros */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-display font-black text-text-main">
                      {tanque.cantidad_actual.toLocaleString('es-ES', { maximumFractionDigits: 1 })} L
                    </span>
                    <span className="text-[9px] text-text-muted font-mono uppercase">
                      / {tanque.capacidad_maxima.toLocaleString('es-ES', { maximumFractionDigits: 0 })} L max
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NOTA INFORMATIVA */}
      <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-3 text-warning">
        <AlertTriangle className="shrink-0 mt-0.5" size={16} />
        <p className="text-[10px] font-medium leading-relaxed">
          <strong className="font-black">Nota de seguridad:</strong> La cantidad actual de cada tanque se actualiza automáticamente con la lectura semanal del bombero y los abastecimientos realizados a los vehículos. No es posible modificarla directamente desde esta vista.
        </p>
      </div>

      {/* Historial General Paginado */}
      <div className="bg-bg-card border border-white/5 shadow-2xl rounded-2xl overflow-hidden mt-6">
        <div className="p-4 border-b border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center border border-success/20">
              <ClipboardList size={20} className="text-success" />
            </div>
            <div>
              <h3 className="font-black text-text-main tracking-wide">Historial General</h3>
              <p className="text-[10px] text-text-muted mt-0.5">Registro de todos los abastecimientos realizados en la base</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={pagina === 0 || cargandoHistorial}
              onClick={() => setPagina(p => p - 1)}
              className="w-10 h-10 rounded-xl border border-white/5 bg-bg-low flex items-center justify-center hover:bg-white/5 text-text-muted hover:text-text-main disabled:opacity-50 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="h-10 px-4 rounded-xl border border-white/5 bg-bg-low flex items-center justify-center text-xs font-black text-text-main font-mono">
              {cargandoHistorial ? (
                <RefreshCw size={14} className="animate-spin text-text-muted" />
              ) : (
                `${pagina + 1} / ${Math.max(1, Math.ceil(totalHistorial / limit))}`
              )}
            </div>
            <button 
              disabled={(pagina + 1) * limit >= totalHistorial || cargandoHistorial}
              onClick={() => setPagina(p => p + 1)}
              className="w-10 h-10 rounded-xl border border-white/5 bg-bg-low flex items-center justify-center hover:bg-white/5 text-text-muted hover:text-text-main disabled:opacity-50 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-bg-low/30">
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-text-muted">Fecha</th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-text-muted">Vehículo</th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-text-muted">Entidad</th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-text-muted text-right">Litros</th>
                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-text-muted">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cargandoHistorial ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-text-muted">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                    <p className="text-xs uppercase tracking-widest font-black">Cargando Historial...</p>
                  </td>
                </tr>
              ) : historial.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-text-muted text-xs uppercase tracking-widest font-black">
                    No hay registros de abastecimiento.
                  </td>
                </tr>
              ) : (
                historial.map(h => (
                  <tr key={h.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-text-sec">
                        {new Date(h.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-black text-text-main tracking-wider">{h.placa}</p>
                      <p className="text-[10px] text-text-muted truncate max-w-[150px]">{h.marca} {h.modelo}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold text-text-sec uppercase tracking-wider">{h.entidad}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        {Number(h.litros).toFixed(1)} L
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold text-text-muted uppercase truncate max-w-[120px] block">
                        {h.bombero}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL CREAR TANQUE --- */}
      {modalCrear && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bg-high/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-bg-high/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-success" />
                <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Registrar Nuevo Tanque</h3>
              </div>
              <button onClick={() => setModalCrear(false)} className="text-text-muted hover:text-text-main cursor-pointer">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCrearTanque} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                  <Database size={10} /> Nombre del Tanque *
                </label>
                <input
                  type="text"
                  value={formCrear.nombre}
                  onChange={(e) => setFormCrear(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Tanque Principal Gasolina"
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                  <Flame size={10} /> Tipo de Combustible *
                </label>
                <select
                  value={formCrear.tipo_combustible}
                  onChange={(e) => setFormCrear(p => ({ ...p, tipo_combustible: e.target.value }))}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                >
                  <option value="gasolina">â›½ Gasolina</option>
                  <option value="diesel">ðŸ›¢ï¸ DiÃ©sel</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                    <Droplet size={10} /> Capacidad MÃ¡x. (L) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formCrear.capacidad_maxima}
                    onChange={(e) => setFormCrear(p => ({ ...p, capacidad_maxima: e.target.value }))}
                    placeholder="10000"
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-display font-bold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-text-muted tracking-widest flex items-center gap-1">
                    <Droplet size={10} /> Cantidad Actual (L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formCrear.cantidad_actual}
                    onChange={(e) => setFormCrear(p => ({ ...p, cantidad_actual: e.target.value }))}
                    placeholder="5000"
                    className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-display font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creando}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-success to-emerald-600 text-on-primary font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-tactica"
              >
                {creando ? <RefreshCw size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                {creando ? 'Registrando...' : 'Registrar Tanque'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ MODAL EDITAR TANQUE â”€â”€â”€ */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bg-high/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-bg-high/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Editar Tanque</h3>
              </div>
              <button onClick={() => setModalEditar(null)} className="text-text-muted hover:text-text-main cursor-pointer">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleEditarTanque} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Nombre del Tanque</label>
                <input
                  type="text"
                  value={formEditar.nombre}
                  onChange={(e) => setFormEditar(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-text-muted tracking-widest">Capacidad MÃ¡xima (Litros)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formEditar.capacidad_maxima}
                  onChange={(e) => setFormEditar(p => ({ ...p, capacidad_maxima: e.target.value }))}
                  className="w-full bg-bg-low border border-bg-high/30 rounded-xl px-3 h-11 text-xs text-text-main focus:outline-none focus:border-success transition-all font-display font-bold"
                  required
                />
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[9px] text-text-muted leading-relaxed">
                  La <strong className="text-amber-400">cantidad actual</strong> ({modalEditar.cantidad_actual.toLocaleString('es-ES', { maximumFractionDigits: 1 })} L) no es editable desde aquÃ­. Se actualiza automÃ¡ticamente por lectura semanal y abastecimientos.
                </p>
              </div>

              <button
                type="submit"
                disabled={editando}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-on-primary font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-tactica"
              >
                {editando ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {editando ? 'Actualizando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ MODAL CONFIRMAR ELIMINAR â”€â”€â”€ */}
      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-card border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <Trash2 size={28} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-text-main mb-1">Desactivar Tanque</h3>
                <p className="text-xs text-text-muted">
                  Â¿EstÃ¡ seguro que desea desactivar el tanque <strong className="text-red-400">"{confirmEliminar.nombre}"</strong>?
                </p>
                <p className="text-[9px] text-text-muted mt-2 italic">
                  No se puede desactivar si tiene abastecimientos vinculados esta semana.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmEliminar(null)}
                  className="flex-1 h-11 rounded-xl bg-white/5 border border-bg-high/30 text-text-muted font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEliminarTanque}
                  disabled={eliminando}
                  className="flex-1 h-11 rounded-xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  {eliminando ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {eliminando ? 'Eliminando...' : 'Desactivar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

