import React, { useState, useEffect, useRef } from 'react';
import { Boton } from '../../components/ui/Boton';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { SocioCard } from '../../components/entidades/SocioCard';
import { useAuthStore } from '../../store/auth.store';
import { 
  Users, UserPlus, Hash, User as UserIcon, Mail, 
  Phone, Search, FileUp, Car as CarIcon, Plus, 
  Trash2, Download, RefreshCw, Filter,
  FileSpreadsheet, ShieldCheck, Clock, Pause,
  AlertTriangle, CheckCircle2, Upload, Calendar,
  ChevronLeft, ChevronRight, Edit2
} from 'lucide-react';
import api from '../../services/api';
import socioService from '../../services/socioService';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../../hooks/useNotifications';

// Estructura Táctica v2.3 (Flexibilidad de datos)
const COLUMNAS_REQUERIDAS = ['CEDULA', 'NOMBRE', 'APELLIDO', 'EMAIL', 'TELEFONO', 'V1_PLACA', 'V1_MARCA', 'V1_MODELO', 'V1_COLOR', 'V2_PLACA...', 'V4_COLOR'];
const COLUMNAS_FLEXIBLES = true; // Permite omitir datos obligatorios en importación masiva

export default function SociosEntidad() {
  const { user } = useAuthStore();
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);
  
  const [nuevoSocio, setNuevoSocio] = useState({
    cedula: '', nombre: '', apellido: '', email: '', telefono: '',
    entidad_id: user?.entidad_id, vehiculos: [], fecha_expiracion: '', puestos_asignados: 1
  });

  const [editSocio, setEditSocio] = useState({
    id: '', cedula: '', nombre: '', apellido: '', email: '', telefono: '',
    puestos_asignados: 1, fecha_expiracion: ''
  });

  // Estado del modal de importación
  const [importFile, setImportFile] = useState(null);
  const [importValidation, setImportValidation] = useState(null); // { valid, errors[], preview[] }
  const [importFechaExp, setImportFechaExp] = useState('');
  const [importando, setImportando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [isRenovarModalOpen, setIsRenovarModalOpen] = useState(false);
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [mesesRenovacion, setMesesRenovacion] = useState(1);
  
  // Soporte de Progreso (Aegis v2.6)
  const { lastNotification } = useNotifications();
  const [importProgress, setImportProgress] = useState({ actual: 0, total: 0, exitosos: 0, errores: 0 });

  useEffect(() => {
    if (lastNotification?.tipo === 'PROGRESO_IMPORTACION') {
      setImportProgress({
        actual: lastNotification.actual,
        total: lastNotification.total,
        exitosos: lastNotification.exitosos,
        errores: lastNotification.errores
      });
    }
  }, [lastNotification]);

  const fetchSocios = async () => {
    if (!user?.entidad_id) return;
    setLoading(true);
    try {
      const data = await socioService.listarPorEntidad(user.entidad_id);
      setSocios(data);
    } catch (err) {
      console.error("Error cargando socios", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSocios(); }, [user]);

  const handleCrearSocio = async (e) => {
    e.preventDefault();
    try {
      setCreando(true);
      const payload = { ...nuevoSocio, entidad_id: user.entidad_id };
      await api.post('/socios/', payload);
      setIsModalOpen(false);
      setNuevoSocio({ 
        cedula: '', nombre: '', apellido: '', email: '', telefono: '', 
        entidad_id: user.entidad_id, vehiculos: [], fecha_expiracion: '', puestos_asignados: 1
      });
      fetchSocios();
      toast.success('Miembro registrado con éxito');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar miembro');
    } finally {
      setCreando(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/socios/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'PLANTILLA_SOCIOS_BAGFM.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Error al descargar plantilla');
    }
  };

  // Validación del archivo Excel en el frontend
  const validarArchivoExcel = (file) => {
    const errors = [];
    
    // Validar extensión
    if (!file.name.endsWith('.xlsx')) {
      errors.push('El archivo debe ser formato .xlsx (Excel)');
      return { valid: false, errors, preview: [] };
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      errors.push('El archivo supera el límite de 5MB');
      return { valid: false, errors, preview: [] };
    }

    return { valid: true, errors: [], preview: [], fileName: file.name, fileSize: (file.size / 1024).toFixed(1) + ' KB' };
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validation = validarArchivoExcel(file);
    setImportFile(file);
    setImportValidation(validation);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const ejecutarImportacion = async () => {
    if (!importFile || !importValidation?.valid) return;
    if (!importFechaExp) {
      toast.error('Selecciona una fecha de expiración para el lote');
      return;
    }
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      setImportando(true);
      await api.post(`/socios/importar?entidad_id=${user.entidad_id}&fecha_expiracion=${importFechaExp}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchSocios();
      toast.success('Importación completada');
      cerrarImportModal();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fallo en la importación');
    } finally {
      setImportando(false);
    }
  };

  const cerrarImportModal = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportValidation(null);
    setImportFechaExp('');
    setImportProgress({ actual: 0, total: 0, exitosos: 0, errores: 0 });
  };

  const addVehiculo = () => {
    setNuevoSocio({
      ...nuevoSocio,
      vehiculos: [...nuevoSocio.vehiculos, { placa: '', marca: '', modelo: '', color: '' }]
    });
  };

  const removeVehiculo = (index) => {
    const updated = [...nuevoSocio.vehiculos];
    updated.splice(index, 1);
    setNuevoSocio({ ...nuevoSocio, vehiculos: updated });
  };

  const updateVehiculo = (index, field, value) => {
    const updated = [...nuevoSocio.vehiculos];
    updated[index][field] = value.toUpperCase();
    setNuevoSocio({ ...nuevoSocio, vehiculos: updated });
  };

  const handleAction = async (type, payload) => {
    if (type === 'renovacion') {
      setSocioSeleccionado(payload);
      setIsRenovarModalOpen(true);
    } else if (type === 'estado') {
      const { socio, nuevoEstado } = payload;
      await socioService.cambiarEstado(socio.id, nuevoEstado);
      fetchSocios();
    } else if (type === 'eliminar') {
      setSocioSeleccionado(payload);
      setIsDeleteModalOpen(true);
    } else if (type === 'editar') {
      setEditSocio({
        id: payload.id,
        cedula: payload.cedula,
        nombre: payload.nombre,
        apellido: payload.apellido,
        email: payload.email || '',
        telefono: payload.telefono || '',
        puestos_asignados: payload.membresia?.puestos_asignados || 1,
        fecha_expiracion: payload.membresia?.fecha_fin || ''
      });
      setIsEditModalOpen(true);
    }
  };

  const ejecutarEliminacion = async () => {
    if (!socioSeleccionado) return;
    try {
      setEliminando(true);
      await socioService.eliminar(socioSeleccionado.id);
      toast.success(`${socioSeleccionado.nombre_completo} eliminado`);
      setIsDeleteModalOpen(false);
      setSocioSeleccionado(null);
      fetchSocios();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
    } finally {
      setEliminando(false);
    }
  };

  const confirmarRenovacion = async () => {
    try {
      await socioService.renovar(socioSeleccionado.id, mesesRenovacion);
      setIsRenovarModalOpen(false);
      setMesesRenovacion(1);
      fetchSocios();
      toast.success('Membresía renovada');
    } catch (err) {
      toast.error('Error en la renovación');
    }
  };

  const handleUpdateSocio = async (e) => {
    e.preventDefault();
    try {
      setCreando(true);
      await api.patch(`/socios/${editSocio.id}`, editSocio);
      setIsEditModalOpen(false);
      fetchSocios();
      toast.success('Miembro actualizado correctamente');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar miembro');
    } finally {
      setCreando(false);
    }
  };

  const stats = {
    total: socios.length,
    activos: socios.filter(s => s.membresia?.estado === 'activa' && !s.membresia?.progreso?.vencida).length,
    vencidos: socios.filter(s => s.membresia?.estado === 'vencida' || s.membresia?.progreso?.vencida).length,
    suspendidos: socios.filter(s => s.membresia?.estado === 'suspendida').length,
  };

  const sociosFiltrados = socios.filter(s => 
    s.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cedula.includes(searchTerm)
  );

  // Resetear a pág 1 al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Lógica de Paginación
  const totalPages = Math.ceil(sociosFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSocios = sociosFiltrados.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Fecha mínima para el selector (hoy)
  const hoyISO = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 space-y-6 pb-24 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-bg-card/30 p-4 rounded-3xl border border-white/5">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-primary/10 rounded-xl">
                <Users className="text-primary shrink-0" size={24} />
            </div>
            <span className="truncate uppercase">Gestión de Miembros</span>
          </h1>
          <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1 font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {user?.entidad_nombre || 'ADMINISTRACIÓN'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
           <Boton 
             size="lg" 
             onClick={() => setIsModalOpen(true)}
             className="gap-2 h-12 px-6 bg-primary text-bg-app font-black uppercase tracking-widest text-[11px] shadow-tactica hover:scale-[1.02] transition-transform"
           >
             <UserPlus size={18} />
             <span>Nuevo Miembro</span>
           </Boton>
        </div>
      </header>

      {/* KPIs - Cuadrícula 2x2 forzada en móvil/tablet */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Registrados', valor: stats.total, color: 'text-primary', icon: Users, sub: 'Padrón total' },
          { label: 'Activos', valor: stats.activos, color: 'text-success', icon: ShieldCheck, sub: 'Al día' },
          { label: 'Vencidos', valor: stats.vencidos, color: 'text-amber-500', icon: Clock, sub: 'Renovación' },
          { label: 'Suspendidos', valor: stats.suspendidos, color: 'text-danger', icon: Pause, sub: 'Restringidos' },
        ].map((s, i) => (
          <div key={i} className="p-3 bg-bg-card/40 border border-white/5 rounded-2xl flex items-center gap-3 group hover:bg-bg-high/80 transition-all border-b-2 border-b-transparent hover:border-b-primary/50">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-black/40 border border-white/5 shrink-0 ${s.color}`}>
              <s.icon size={20} />
            </div>
            <div className="min-w-0">
              <div className={`text-xl sm:text-2xl font-black leading-tight ${s.color}`}>{s.valor}</div>
              <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">{s.label}</div>
              <div className="text-[7px] text-text-muted opacity-30 uppercase font-bold">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <main className="space-y-4">
        {/* Barra de búsqueda + acciones */}
        <section className="bg-bg-card/40 border border-white/5 rounded-2xl p-3 backdrop-blur-md">
           <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
              <div className="w-full sm:max-w-md">
                 <Input 
                   placeholder="BUSCAR..."
                   icon={<Search size={18} className="text-primary" />}
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                   className="h-11 bg-bg-app border-white/10 text-xs font-bold"
                 />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                 <Boton 
                   variant="ghost" 
                   className="flex-1 sm:flex-none h-11 px-4 gap-2 border-white/5 text-text-muted hover:text-primary transition-all font-black uppercase tracking-widest text-[10px]"
                   onClick={() => setIsImportModalOpen(true)}
                 >
                    <FileSpreadsheet size={16} />
                    Importar
                 </Boton>
              </div>
           </div>
        </section>

        {/* Lista de socios */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {loading ? (
               Array(6).fill(0).map((_, i) => (
                 <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
               ))
            ) : (
              <>
                {paginatedSocios.map(socio => (
                  <div key={socio.id} className="animate-in zoom-in-95 duration-300">
                    <SocioCard socio={socio} onAction={handleAction} />
                  </div>
                ))}
                {sociosFiltrados.length === 0 && (
                  <div className="col-span-full py-16 text-center border border-dashed border-white/10 rounded-[32px] bg-bg-card/20">
                     <Users size={40} className="mx-auto text-white/5 mb-4 opacity-20" />
                     <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
                       {searchTerm ? 'Sin coincidencias' : 'Padrón vacío'}
                     </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controles de Paginación */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Boton 
                variant="ghost" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="h-9 w-9 p-0 border-white/5"
              >
                <ChevronLeft size={16} />
              </Boton>

              <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  // Mostrar solo algunas páginas si hay muchas (opcional, aquí simple)
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-7 min-w-[28px] px-2 rounded-lg text-[10px] font-black transition-all ${
                        currentPage === page 
                          ? 'bg-primary text-bg-app shadow-lg shadow-primary/20' 
                          : 'text-text-muted hover:bg-white/5'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <Boton 
                variant="ghost" 
                size="sm" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-9 w-9 p-0 border-white/5"
              >
                <ChevronRight size={16} />
              </Boton>
            </div>
          )}
          
          {/* Contador de resultados */}
          {!loading && sociosFiltrados.length > 0 && (
            <p className="text-center text-[9px] font-black text-text-muted/30 uppercase tracking-[0.2em]">
              Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sociosFiltrados.length)} de {sociosFiltrados.length} socios
            </p>
          )}
        </section>
      </main>

      {/* ═══════ MODAL: NUEVO MIEMBRO ═══════ */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="PROTOCOLO DE AFILIACIÓN">
        <form onSubmit={handleCrearSocio} className="space-y-5">
          <div className="space-y-4">
             <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <UserIcon size={14} className="text-primary" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Identidad</span>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <Input 
                   label="Cédula" required placeholder="V-000000"
                   value={nuevoSocio.cedula}
                   onChange={(e) => setNuevoSocio({...nuevoSocio, cedula: e.target.value.toUpperCase()})}
                />
                <Input 
                   label="Teléfono" placeholder="0412-0000000"
                   value={nuevoSocio.telefono}
                   onChange={(e) => setNuevoSocio({...nuevoSocio, telefono: e.target.value})}
                />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <Input 
                 label="Nombres" required placeholder="NOMBRE"
                 value={nuevoSocio.nombre}
                 onChange={(e) => setNuevoSocio({...nuevoSocio, nombre: e.target.value.toUpperCase()})}
               />
               <Input 
                 label="Apellidos" required placeholder="APELLIDO"
                 value={nuevoSocio.apellido}
                 onChange={(e) => setNuevoSocio({...nuevoSocio, apellido: e.target.value.toUpperCase()})}
               />
             </div>
             <Input 
               label="Correo Electrónico" type="email" placeholder="socio@entidad.com"
               value={nuevoSocio.email}
               onChange={(e) => setNuevoSocio({...nuevoSocio, email: e.target.value.toLowerCase()})}
             />

             {/* Fecha de expiración */}
             <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                   <Calendar size={14} className="text-amber-500" />
                   <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Vigencia de Membresía</span>
                </div>
                <Input 
                  label="Fecha de Expiración" type="date" required
                  min={hoyISO}
                  value={nuevoSocio.fecha_expiracion}
                  onChange={(e) => setNuevoSocio({...nuevoSocio, fecha_expiracion: e.target.value})}
                />
             </div>

             {/* Puestos de Estacionamiento */}
             <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                   <span className="text-emerald-400 text-sm">🅿️</span>
                   <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Puestos Asignados</span>
                   <span className="ml-auto text-[9px] text-text-muted">Vehículos simult. permitidos</span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setNuevoSocio({...nuevoSocio, puestos_asignados: Math.max(1, nuevoSocio.puestos_asignados - 1)})}
                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-lg transition-colors"
                  >−</button>
                  <span className="text-2xl font-black text-white w-10 text-center">{nuevoSocio.puestos_asignados}</span>
                  <button type="button"
                    onClick={() => setNuevoSocio({...nuevoSocio, puestos_asignados: Math.min(5, nuevoSocio.puestos_asignados + 1)})}
                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-lg transition-colors"
                  >+</button>
                  <span className="text-[10px] text-text-muted ml-1">máx. 5</span>
                </div>
             </div>

             {/* Vehículos */}
             <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                   <div className="flex items-center gap-2">
                      <CarIcon size={14} className="text-secondary" />
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Unidades</span>
                   </div>
                   <Boton type="button" variant="ghost" className="h-7 px-3 text-[9px] border-secondary/20 text-secondary font-black" onClick={addVehiculo}>
                      <Plus size={13} /> Adjuntar
                   </Boton>
                </div>
                <div className="space-y-2">
                  {nuevoSocio.vehiculos.map((v, i) => (
                    <div key={i} className="p-3 bg-bg-app border border-white/10 rounded-xl relative">
                      <button type="button" onClick={() => removeVehiculo(i)} className="absolute top-3 right-3 text-text-muted hover:text-danger transition-all">
                        <Trash2 size={14} />
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Placa" value={v.placa} onChange={(e) => updateVehiculo(i, 'placa', e.target.value)} />
                        <Input label="Marca" value={v.marca} onChange={(e) => updateVehiculo(i, 'marca', e.target.value)} />
                        <Input label="Modelo" value={v.modelo} onChange={(e) => updateVehiculo(i, 'modelo', e.target.value)} />
                        <Input label="Color" value={v.color} onChange={(e) => updateVehiculo(i, 'color', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
             <Boton type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Boton>
             <Boton type="submit" disabled={creando} className="flex-[2] bg-primary text-bg-app font-black uppercase tracking-[0.2em] h-12 shadow-tactica">
                {creando ? <RefreshCw className="animate-spin mr-2" size={16} /> : null}
                {creando ? 'Procesando...' : 'Registrar'}
             </Boton>
          </div>
        </form>
      </Modal>

      {/* ═══════ MODAL: EDITAR MIEMBRO ═══════ */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="ACTUALIZACIÓN DE REGISTRO">
        <form onSubmit={handleUpdateSocio} className="space-y-5">
          <div className="space-y-4">
             <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Edit2 size={14} className="text-primary" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Identidad y Contacto</span>
             </div>
             <div className="grid grid-cols-2 gap-3">
                <Input 
                   label="Cédula" required placeholder="V-000000"
                   value={editSocio.cedula}
                   onChange={(e) => setEditSocio({...editSocio, cedula: e.target.value.toUpperCase()})}
                />
                <Input 
                   label="Teléfono" placeholder="0412-0000000"
                   value={editSocio.telefono}
                   onChange={(e) => setEditSocio({...editSocio, telefono: e.target.value})}
                />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <Input 
                 label="Nombres" required placeholder="NOMBRE"
                 value={editSocio.nombre}
                 onChange={(e) => setEditSocio({...editSocio, nombre: e.target.value.toUpperCase()})}
               />
               <Input 
                 label="Apellidos" required placeholder="APELLIDO"
                 value={editSocio.apellido}
                 onChange={(e) => setEditSocio({...editSocio, apellido: e.target.value.toUpperCase()})}
               />
             </div>
             <Input 
               label="Correo Electrónico" type="email" placeholder="socio@entidad.com"
               value={editSocio.email}
               onChange={(e) => setEditSocio({...editSocio, email: e.target.value.toLowerCase()})}
             />

             {/* Fecha de expiración */}
             <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                   <Calendar size={14} className="text-amber-500" />
                   <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Vigencia de Membresía</span>
                </div>
                <Input 
                  label="Fecha de Expiración" type="date" required
                  value={editSocio.fecha_expiracion}
                  onChange={(e) => setEditSocio({...editSocio, fecha_expiracion: e.target.value})}
                />
             </div>

             {/* Puestos de Estacionamiento */}
             <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                   <span className="text-emerald-400 text-sm">🅿️</span>
                   <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Puestos Asignados</span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setEditSocio({...editSocio, puestos_asignados: Math.max(1, editSocio.puestos_asignados - 1)})}
                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-lg transition-colors"
                  >−</button>
                  <span className="text-2xl font-black text-white w-10 text-center">{editSocio.puestos_asignados}</span>
                  <button type="button"
                    onClick={() => setEditSocio({...editSocio, puestos_asignados: Math.min(5, editSocio.puestos_asignados + 1)})}
                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-lg transition-colors"
                  >+</button>
                </div>
             </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Boton 
              type="button" variant="ghost" className="flex-1"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancelar
            </Boton>
            <Boton 
              type="submit" disabled={creando} className="flex-[2] bg-primary text-bg-app font-black uppercase tracking-widest"
            >
              {creando ? <RefreshCw className="animate-spin" size={18} /> : 'Guardar Cambios'}
            </Boton>
          </div>
        </form>
      </Modal>

      {/* ═══════ MODAL: IMPORTACIÓN MASIVA ═══════ */}
      <Modal isOpen={isImportModalOpen} onClose={cerrarImportModal} title="IMPORTACIÓN MASIVA DE SOCIOS">
        <div className="space-y-5">
          {/* Paso 1: Descargar plantilla */}
          <div className="p-3 bg-bg-app rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={14} className="text-primary" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">1. Plantilla Base</span>
              </div>
              <Boton variant="ghost" className="h-8 px-3 text-[9px] border-primary/20 text-primary font-black" onClick={handleDownloadTemplate}>
                <Download size={13} className="mr-1" /> Descargar .xlsx
              </Boton>
            </div>
            <p className="text-[9px] text-text-muted/50 mt-2 italic font-bold">
              Protocolo Aegis v2.3: Se permite la carga de datos incompletos. Los campos faltantes podrán ser completados por el socio en su portal táctico.
            </p>
          </div>

          {/* Paso 2: Subir archivo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Upload size={14} className="text-secondary" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">2. Subir Archivo</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleImportFileSelect} />
            
            {!importFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-white/10 rounded-xl hover:border-primary/30 transition-all flex flex-col items-center gap-2 group"
              >
                <FileSpreadsheet size={28} className="text-text-muted/30 group-hover:text-primary/50 transition-colors" />
                <span className="text-[10px] font-black text-text-muted/40 uppercase tracking-widest group-hover:text-text-muted/60">Seleccionar archivo .xlsx</span>
              </button>
            ) : (
              <div className={`p-3 rounded-xl border ${importValidation?.valid ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {importValidation?.valid ? <CheckCircle2 size={14} className="text-success" /> : <AlertTriangle size={14} className="text-danger" />}
                    <span className="text-[10px] font-black text-text-main uppercase">{importFile.name}</span>
                    <span className="text-[8px] text-text-muted/40">{importValidation?.fileSize}</span>
                  </div>
                  <button onClick={() => { setImportFile(null); setImportValidation(null); }} className="text-text-muted hover:text-danger transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
                {importValidation?.errors?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {importValidation.errors.map((err, i) => (
                      <p key={i} className="text-[9px] text-danger font-bold">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paso 3: Fecha de expiración del lote */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-amber-500" />
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">3. Expiración del Lote</span>
            </div>
            <Input 
              type="date" required
              min={hoyISO}
              value={importFechaExp}
              onChange={(e) => setImportFechaExp(e.target.value)}
              label="Todos los socios de este lote expirarán en esta fecha"
            />
          </div>

          {/* Barra de Progreso Táctica (Aegis v2.6) */}
          {importando && (
            <div className="mt-4 p-4 bg-bg-app border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-primary animate-pulse flex items-center tracking-widest uppercase">
                  <RefreshCw size={12} className="mr-2 animate-spin" />
                  Cifrando Datos... {Math.round((importProgress.actual / importProgress.total) * 100) || 0}%
                </span>
                <span className="text-[10px] text-text-muted font-mono font-bold">
                  {importProgress.actual} / {importProgress.total}
                </span>
              </div>
              
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-primary/40 to-primary shadow-[0_0_10px_rgba(var(--color-primary),0.5)] transition-all duration-500 ease-out"
                  style={{ width: `${(importProgress.actual / importProgress.total) * 100}%` }}
                />
              </div>

              <div className="flex justify-between mt-3 text-[8px] font-black tracking-[0.2em] uppercase">
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 size={10} />
                  <span>Éxitos: {importProgress.exitosos}</span>
                </div>
                <div className="flex items-center gap-1.5 text-danger">
                  <AlertTriangle size={10} />
                  <span>Alertas: {importProgress.errores}</span>
                </div>
              </div>
            </div>
          )}

          {/* Botón de ejecutar */}
          <div className="pt-2 flex gap-3">
            <Boton 
              variant="ghost" 
              className="flex-1" 
              onClick={cerrarImportModal}
              disabled={importando}
            >
              Cancelar
            </Boton>
            <Boton 
              onClick={ejecutarImportacion}
              disabled={!importFile || !importFechaExp || importando}
              className="flex-[2] bg-primary text-bg-app font-black uppercase tracking-[0.2em] shadow-tactica"
            >
              {importando ? (
                <><RefreshCw size={16} className="mr-2 animate-spin" /> Procesando...</>
              ) : (
                <><FileUp size={16} className="mr-2" /> Ejecutar Importación</>
              )}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* ═══════ MODAL: RENOVACIÓN ═══════ */}
      <Modal isOpen={isRenovarModalOpen} onClose={() => setIsRenovarModalOpen(false)} title="RENOVACIÓN DE MEMBRESÍA">
        <div className="space-y-5">
          <div className="flex items-center gap-4 p-4 bg-bg-app border border-white/5 rounded-2xl">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <RefreshCw size={20} />
             </div>
             <div className="min-w-0">
                <p className="text-[9px] uppercase font-black text-primary tracking-[0.2em] mb-0.5">Renovación</p>
                <h4 className="text-base font-black text-text-main italic uppercase truncate">{socioSeleccionado?.nombre_completo}</h4>
             </div>
          </div>
          <div className="space-y-2">
             <label className="text-[10px] uppercase font-black text-text-muted tracking-[0.2em] px-1 opacity-60">Periodo</label>
             <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map(num => (
                  <button
                    key={num}
                    onClick={() => setMesesRenovacion(num)}
                    className={`h-14 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${
                      mesesRenovacion === num 
                      ? 'bg-primary/10 border-primary text-primary' 
                      : 'bg-black/20 border-white/5 text-text-muted hover:border-white/10'
                    }`}
                  >
                    <span className="text-lg font-black italic leading-none">{num}</span>
                    <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{num === 1 ? 'MES' : 'MESES'}</span>
                  </button>
                ))}
             </div>
          </div>
          <Boton onClick={confirmarRenovacion} className="w-full h-12 bg-primary text-bg-app font-black uppercase tracking-[0.2em] shadow-tactica">
            Confirmar
          </Boton>
        </div>
      </Modal>

      {/* ═══════ MODAL: CONFIRMACIÓN ELIMINAR ═══════ */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="CONFIRMAR ELIMINACIÓN">
        <div className="space-y-6">
          <div className="p-6 bg-danger/5 border border-danger/10 rounded-[32px] flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center text-danger mb-4 shadow-lg shadow-danger/20">
              <Trash2 size={32} />
            </div>
            <h3 className="text-lg font-black text-text-main uppercase tracking-tight mb-2">¿Eliminar miembro?</h3>
            <p className="text-sm text-text-muted leading-relaxed italic">
               Estás a punto de eliminar a <span className="text-text-main font-bold">"{socioSeleccionado?.nombre_completo}"</span>.
               Esta acción borrará de forma permanente todos sus vehículos, membresías y registros asociados.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Boton variant="ghost" className="flex-1" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Boton>
            <Boton onClick={ejecutarEliminacion} disabled={eliminando} className="flex-1 bg-danger text-white font-black uppercase tracking-[0.2em] h-12 shadow-tactica">
               {eliminando ? <RefreshCw className="animate-spin mr-2" size={16} /> : null}
               {eliminando ? 'Eliminando...' : 'Eliminar'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
