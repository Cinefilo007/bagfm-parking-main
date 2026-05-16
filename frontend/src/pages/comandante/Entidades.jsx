import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from '../../components/ui/Boton';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Network, Plus, ShieldCheck, Store, Power, Activity, Users, Car as CarIcon, AlertTriangle, ChevronDown, Trash2, Edit2 } from 'lucide-react';
import api from '../../services/api';

export default function Entidades() {
  const navigate = useNavigate();
  const [entidades, setEntidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_entidades: 0, total_vehiculos: 0, total_usuarios: 0, total_inactivas: 0 });
  const [page, setPage] = useState(0);
  const limit = 5;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nuevaEntidad, setNuevaEntidad] = useState({
    nombre: '',
    codigo_slug: null,
    admin_cedula: '',
    admin_nombre: '',
    admin_apellido: '',
    admin_email: ''
  });


  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entidadADelete, setEntidadADelete] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [entidadAEditar, setEntidadAEditar] = useState(null);
  const [editando, setEditando] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get('/entidades/stats');
      setStats(res.data);
    } catch (err) {
      console.error("Error cargando stats", err);
    }
  };

  const fetchEntidades = async (p = page) => {
    setLoading(true);
    try {
      const skip = p * limit;
      const res = await api.get(`/entidades?skip=${skip}&limit=${limit}`);
      setEntidades(res.data);
      setHasMore(res.data.length === limit);
      fetchStats();
    } catch (err) {
      console.error("Error cargando entidades", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntidades();
  }, [page]);

  const handleToggleEstado = async (id) => {
    try {
      await api.post(`/entidades/${id}/toggle`);
      fetchEntidades();
    } catch (err) {
      console.error("Error al cambiar estado", err);
    }
  };

  const handleCrearEntidad = async (e) => {
    e.preventDefault();
    setCreando(true);
    try {
      const payload = {
        ...nuevaEntidad,
        capacidad_vehiculos: 1, // Capacidad base, se expande por zonas asignadas
        admin_password: nuevaEntidad.admin_cedula // Default a la cédula
      };
      if (!payload.codigo_slug) {
        delete payload.codigo_slug;
      }
      await api.post('/entidades', payload);
      setIsModalOpen(false);
      setNuevaEntidad({ 
        nombre: '', 
        codigo_slug: null,
        admin_cedula: '',
        admin_nombre: '',
        admin_apellido: '',
        admin_email: ''
      });

      fetchEntidades();
    } catch (err) {
      console.error("Error creando entidad", err);
      const msg = err.response?.data?.detail;
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg) || "Error al crear la entidad");
    } finally {
      setCreando(false);
    }
  };

  const handleConfirmarEliminacion = async () => {
    if (!entidadADelete) return;
    setEliminando(true);
    try {
      await api.delete(`/entidades/${entidadADelete.id}`);
      setDeleteModalOpen(false);
      setEntidadADelete(null);
      fetchEntidades();
    } catch (err) {
      console.error("Error eliminando entidad", err);
      alert("Error al procesar la baja definitiva");
    } finally {
      setEliminando(false);
    }
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!entidadAEditar) return;
    setEditando(true);
    try {
      await api.put(`/entidades/${entidadAEditar.id}`, {
        nombre: entidadAEditar.nombre,
        admin_nombre: entidadAEditar.admin_nombre,
        admin_apellido: entidadAEditar.admin_apellido,
        admin_cedula: entidadAEditar.admin_cedula,
        admin_email: entidadAEditar.admin_email
      });
      setEditModalOpen(false);
      setEntidadAEditar(null);
      fetchEntidades();
    } catch (err) {
      console.error("Error editando entidad", err);
      alert("Error al guardar los cambios");
    } finally {
      setEditando(false);
    }
  };

  const EntidadCard = ({ ent, handleToggleEstado }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
       <Card hoverable elevation={2} className="relative overflow-hidden group border-bg-high/10 bg-bg-card backdrop-blur-sm transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 bg-primary/30 h-full group-hover:bg-primary transition-all duration-500"></div>
          
          <div className="flex justify-between items-start mb-1">
             <div className="flex gap-4 cursor-pointer flex-1" onClick={() => setIsOpen(!isOpen)}>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                   <Store size={24} />
                </div>
                <div>
                   <h4 className="font-display font-black text-xl text-text-main uppercase tracking-tight">
                     {ent.nombre}
                   </h4>
                   <div className="mt-1 flex items-center gap-2">
                      <Badge variant={ent.activo ? 'activa' : 'suspendida'} className="text-[10px] h-5 font-black tracking-widest px-3 border-none bg-opacity-20 uppercase">
                        {ent.activo ? 'OPERATIVO' : 'SUSPENDIDA'}
                      </Badge>
                      <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                   </div>
                </div>
             </div>
             <div className="flex gap-2 relative z-10">
               <Boton 
                 variant="ghost" 
                 className={`p-2 min-h-0 w-auto rounded-full ${ent.activo ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-red-500 hover:bg-red-500/10'} border border-bg-high/10`}
                 onClick={(e) => {
                   e.stopPropagation();
                   handleToggleEstado(ent.id);
                 }}
                 title={ent.activo ? "Suspender Entidad" : "Reactivar Entidad"}
               >
                  <Power size={18} />
               </Boton>
               
               <Boton 
                 variant="ghost" 
                 className="p-2 min-h-0 w-auto rounded-full text-blue-400 hover:bg-blue-500/10 border border-bg-high/10"
                 onClick={(e) => {
                   e.stopPropagation();
                   setEntidadAEditar(ent);
                   setEditModalOpen(true);
                 }}
                 title="Editar Entidad"
               >
                  <Edit2 size={18} />
               </Boton>
               
               <Boton 
                 variant="ghost" 
                 className="p-2 min-h-0 w-auto rounded-full text-red-400 hover:bg-red-500/10 border border-bg-high/10"
                 onClick={(e) => {
                   e.stopPropagation();
                   setEntidadADelete(ent);
                   setDeleteModalOpen(true);
                 }}
                 title="Eliminar Permanente"
               >
                  <Trash2 size={18} />
               </Boton>
             </div>
          </div>

          {isOpen && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200 mt-2">
               <div className="grid grid-cols-3 gap-2 border-t border-bg-high/10 pt-2 pb-0.5">
                  <div className="flex flex-col border-r border-bg-high/10">
                     <span className="text-[8px] uppercase font-bold text-text-muted tracking-widest mb-0.5">
                       Capacidad
                     </span>
                     <span className="text-text-main font-mono font-bold text-sm">
                       {ent.total_capacidad} <span className="text-[9px] text-text-muted">VEH</span>
                     </span>
                  </div>
                  <div className="flex flex-col border-r border-bg-high/10 pl-2">
                     <span className="text-[8px] uppercase font-bold text-text-muted tracking-widest mb-0.5">
                       Socios
                     </span>
                     <span className="text-text-main font-mono font-bold text-sm">
                       {ent.total_usuarios || 0} <span className="text-[9px] text-text-muted">UFS</span>
                     </span>
                  </div>
                  <div className="flex flex-col pl-2">
                     <span className="text-[8px] uppercase font-bold text-text-muted tracking-widest mb-0.5">
                       Parque
                     </span>
                     <span className="text-text-main font-mono font-bold text-sm">
                       {ent.total_vehiculos || 0} <span className="text-[9px] text-text-muted">UNI</span>
                     </span>
                  </div>
               </div>
               
               <div className="mt-2 pt-2 border-t border-bg-high/10 flex justify-end">
                  <button 
                    onClick={() => navigate(`/comando/entidades/${ent.id}`)}
                    className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline underline-offset-4 flex items-center gap-2 group"
                  >
                     GESTIONAR CONCESIÓN
                     <ShieldCheck size={12} className="group-hover:scale-125 transition-transform" />
                  </button>
               </div>
            </div>
          )}
       </Card>
    );
  };

  return (
    <div className="p-4 space-y-8 pb-24 max-w-[1400px] mx-auto">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-bg-card/30 p-4 rounded-3xl border border-white/5">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-primary/10 rounded-xl">
                <Network className="text-primary shrink-0" size={24} />
            </div>
            <span className="truncate">Entidades Alojadas</span>
          </h1>
          <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Módulo de Concesiones // Comando
          </p>
        </div>
        <Boton 
          size="lg" 
          onClick={() => setIsModalOpen(true)}
          className="gap-2 h-12 px-8 w-full sm:w-fit shrink-0 whitespace-nowrap shadow-tactica hover:scale-[1.02] transition-transform"
        >
          <Plus size={20} />
          <span>Nueva Entidad</span>
        </Boton>
      </header>

      <main className="space-y-6">
        {/* Barra de Estadísticas Globales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8">
           <Card className="bg-bg-card border-bg-high/10 p-3 lg:p-4 flex items-center gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                 <Activity size={18} />
              </div>
              <div>
                 <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none mb-1">Entidades</p>
                 <p className="text-lg lg:text-xl font-display font-black text-text-main leading-none">{stats.total_entidades}</p>
              </div>
           </Card>
           <Card className="bg-bg-card border-bg-high/10 p-3 lg:p-4 flex items-center gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                 <Users size={18} />
              </div>
              <div>
                 <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none mb-1">Socios</p>
                 <p className="text-lg lg:text-xl font-display font-black text-text-main leading-none">{stats.total_usuarios}</p>
              </div>
           </Card>
           <Card className="bg-bg-card border-bg-high/10 p-3 lg:p-4 flex items-center gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                 <CarIcon size={18} />
              </div>
              <div>
                 <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none mb-1">Parque</p>
                 <p className="text-lg lg:text-xl font-display font-black text-text-main leading-none">{stats.total_vehiculos}</p>
              </div>
           </Card>
           <Card className="bg-bg-card border-bg-high/10 p-3 lg:p-4 flex items-center gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
                 <Power size={18} />
              </div>
              <div>
                 <p className="text-[9px] lg:text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none mb-1">Suspendidas</p>
                 <p className="text-lg lg:text-xl font-display font-black text-text-main leading-none">{stats.total_inactivas}</p>
              </div>
           </Card>
        </div>
        {loading ? (
            <p className="text-center text-text-muted text-sm tracking-widest uppercase">Cargando Tácticas...</p>
        ) : (
            <div className="space-y-4">
              {entidades.map(ent => (
                  <EntidadCard 
                    key={ent.id} 
                    ent={ent} 
                    handleToggleEstado={handleToggleEstado} 
                  />
              ))}
              
              {entidades.length === 0 && (
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-bg-card/20 animate-in fade-in zoom-in-95 duration-700">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                    <Network size={40} className="text-text-muted opacity-20" />
                  </div>
                  <h3 className="text-sm font-black text-text-muted uppercase tracking-[0.3em] opacity-40">
                    Sin entidades alojadas en la base
                  </h3>
                  <p className="text-[10px] text-text-muted/30 mt-2 font-bold uppercase tracking-widest">
                    Inicie el protocolo de alta para habilitar concesiones
                  </p>
                </div>
              )}
            </div>

        )}
        
        {/* Controles de Paginación */}
        {!loading && (entidades.length > 0 || page > 0) && (
           <div className="flex items-center justify-between pt-6 border-t border-bg-high/10 mt-4">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-text-main disabled:opacity-30 disabled:pointer-events-none hover:text-primary transition-colors"
              >
                 ← Anterior
              </button>
              <span className="text-[11px] font-mono font-bold text-text-muted uppercase">
                Página {page + 1}
              </span>
              <button
                disabled={!hasMore}
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-text-main disabled:opacity-30 disabled:pointer-events-none hover:text-primary transition-colors"
              >
                 Siguiente →
              </button>
           </div>
        )}
      </main>

      {/* Modal de Creación */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => !creando && setIsModalOpen(false)} 
        title="NUEVA ENTIDAD"
      >

        <form onSubmit={handleCrearEntidad} className="space-y-4 max-h-[70vh] overflow-y-auto px-1 no-scrollbar">
           <div className="space-y-3">
             <h3 className="text-[10px] uppercase font-bold text-primary tracking-[0.2em] mb-2 border-b border-primary/20 pb-1">
               Datos de la Concesión
             </h3>
              <Input 
                label="Nombre de la Entidad"
                icon={<Store size={16} />}
                required
                placeholder="Ej: AEROCLUB"
                value={nuevaEntidad.nombre}
                onChange={(e) => setNuevaEntidad({...nuevaEntidad, nombre: e.target.value.toUpperCase()})}
              />
            </div>

           <div className="space-y-3 pt-2">
             <h3 className="text-[10px] uppercase font-bold text-primary tracking-[0.2em] mb-2 border-b border-primary/20 pb-1">
               Datos del Administrador
             </h3>
             <div className="grid grid-cols-2 gap-3">
               <Input 
                 label="Nombre"
                 required
                 placeholder="Nombre"
                 value={nuevaEntidad.admin_nombre}
                 onChange={(e) => setNuevaEntidad({...nuevaEntidad, admin_nombre: e.target.value})}
               />
               <Input 
                 label="Apellido"
                 required
                 placeholder="Apellido"
                 value={nuevaEntidad.admin_apellido}
                 onChange={(e) => setNuevaEntidad({...nuevaEntidad, admin_apellido: e.target.value})}
               />
             </div>
             <Input 
               label="Cédula"
               required
               placeholder="V-12345678"
               value={nuevaEntidad.admin_cedula}
               onChange={(e) => setNuevaEntidad({...nuevaEntidad, admin_cedula: e.target.value})}
             />
              <Input 
                label="Email de Usuario"
                type="email"
                required
                placeholder="admin@entidad.com"
                value={nuevaEntidad.admin_email}
                onChange={(e) => setNuevaEntidad({...nuevaEntidad, admin_email: e.target.value})}
              />
              <p className="text-[9px] text-text-muted italic px-2 pt-1 uppercase font-bold tracking-tight opacity-50">
                * La clave de acceso temporal será el número de cédula.
              </p>
            </div>

           <div className="pt-4 sticky bottom-0 bg-bg-card pb-2">
             <Boton type="submit" className="w-full" disabled={creando}>
                {creando ? 'PROCESANDO...' : 'ESTABLECER ENTIDAD Y ADMIN'}
             </Boton>
           </div>
        </form>
      </Modal>

      {/* Modal de Confirmación Táctica (Eliminación) */}
      <Modal 
        isOpen={deleteModalOpen} 
        onClose={() => !eliminando && setDeleteModalOpen(false)} 
        title="Baja Definitiva"
      >
        <div className="text-center p-2">
           <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-500/20">
              <AlertTriangle size={32} />
           </div>
           <h3 className="font-display font-black text-xl text-text-main uppercase tracking-tight mb-2">
             ¿CONFIRMAR ELIMINACIÓN?
           </h3>
           <p className="text-sm text-text-muted mb-6 leading-relaxed">
             Estás por purgar la entidad <span className="text-red-400 font-bold">"{entidadADelete?.nombre}"</span>. <br/>
             Esta acción eliminará en cascada a todos los socios, vehículos y credenciales. 
             <span className="block mt-2 font-black text-xs text-red-500 uppercase tracking-widest italic">
               Acción irreversible de alto impacto.
             </span>
           </p>
           
           <div className="flex gap-3 mt-4">
              <Boton 
                variant="ghost" 
                className="flex-1 border-white/10" 
                onClick={() => setDeleteModalOpen(false)}
                disabled={eliminando}
              >
                CANCELAR
              </Boton>
              <Boton 
                className="flex-1 bg-red-600 hover:bg-red-700 border-red-500 text-white" 
                onClick={handleConfirmarEliminacion}
                disabled={eliminando}
              >
                {eliminando ? 'PURGANDO...' : 'SÍ, ELIMINAR'}
              </Boton>
           </div>
         </div>
      </Modal>

      {/* Modal de Edición */}
      <Modal 
        isOpen={editModalOpen} 
        onClose={() => !editando && setEditModalOpen(false)} 
        title="EDITAR ENTIDAD"
      >
        <form onSubmit={handleGuardarEdicion} className="space-y-4 max-h-[70vh] overflow-y-auto px-1 no-scrollbar">
           <div className="space-y-3">
             <h3 className="text-[10px] uppercase font-bold text-primary tracking-[0.2em] mb-2 border-b border-primary/20 pb-1">
               Datos Generales
             </h3>
              <Input 
                label="Nombre de la Entidad"
                icon={<Store size={16} />}
                required
                placeholder="Ej: AEROCLUB"
                value={entidadAEditar?.nombre || ''}
                onChange={(e) => setEntidadAEditar({...entidadAEditar, nombre: e.target.value.toUpperCase()})}
              />
            </div>

           <div className="space-y-3 pt-2">
             <h3 className="text-[10px] uppercase font-bold text-primary tracking-[0.2em] mb-2 border-b border-primary/20 pb-1">
               Datos del Administrador
             </h3>
             <div className="grid grid-cols-2 gap-3">
               <Input 
                 label="Nombre"
                 required
                 placeholder="Nombre"
                 value={entidadAEditar?.admin_nombre || ''}
                 onChange={(e) => setEntidadAEditar({...entidadAEditar, admin_nombre: e.target.value})}
               />
               <Input 
                 label="Apellido"
                 required
                 placeholder="Apellido"
                 value={entidadAEditar?.admin_apellido || ''}
                 onChange={(e) => setEntidadAEditar({...entidadAEditar, admin_apellido: e.target.value})}
               />
             </div>
             <Input 
               label="Cédula"
               required
               placeholder="V-12345678"
               value={entidadAEditar?.admin_cedula || ''}
               onChange={(e) => setEntidadAEditar({...entidadAEditar, admin_cedula: e.target.value})}
             />
              <Input 
                label="Email de Usuario"
                type="email"
                required
                placeholder="admin@entidad.com"
                value={entidadAEditar?.admin_email || ''}
                onChange={(e) => setEntidadAEditar({...entidadAEditar, admin_email: e.target.value})}
              />
            </div>

           <div className="pt-4 sticky bottom-0 bg-bg-card pb-2">
             <Boton type="submit" className="w-full" disabled={editando}>
                {editando ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
             </Boton>
           </div>
        </form>
      </Modal>
    </div>
  );
}
