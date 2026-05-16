import React, { useState, useEffect } from 'react';
import { 
  Shield, Plus, Trash2, MapPin, Key, 
  RefreshCw, Phone, Copy, Edit3, 
  ExternalLink, UserCheck, Clock, 
  AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { comandoService } from '../../services/comando.service';
import { toast } from 'react-hot-toast';

export default function Alcabalas() {
  const [puntos, setPuntos] = useState([]);
  const [personales, setPersonales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [showModalPunto, setShowModalPunto] = useState(false);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);

  const [formPunto, setFormPunto] = useState({ nombre: '', ubicacion: '' });

  const [expandedPuntos, setExpandedPuntos] = useState(new Set());
  
  const toggleExpansio = (id) => {
    setExpandedPuntos(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resPuntos, resPersonal] = await Promise.all([
        comandoService.getPuntosAcceso(),
        comandoService.getPersonalActivo()
      ]);
      setPuntos(resPuntos);
      setPersonales(resPersonal);
    } catch (error) {
      toast.error('Error al sincronizar datos tácticos');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearOEditarPunto = async (e) => {
    e.preventDefault();
    try {
      if (puntoSeleccionado) {
        await comandoService.actualizarPuntoAcceso(puntoSeleccionado.id, formPunto);
        toast.success('Alcabala actualizada');
      } else {
        await comandoService.crearPuntoAcceso(formPunto);
        toast.success('Punto de control desplegado');
      }
      setShowModalPunto(false);
      setPuntoSeleccionado(null);
      setFormPunto({ nombre: '', ubicacion: '' });
      fetchData();
    } catch (error) {
      toast.error('No se pudo procesar la solicitud');
    }
  };

  const handleEliminarPunto = async (id) => {
    try {
      await comandoService.eliminarPuntoAcceso(id);
      toast.success('Alcabala desarticulada del sistema');
      setShowConfirmDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Error al eliminar punto');
    }
  };

  const handleRegenerarClave = async (id) => {
    try {
      const res = await comandoService.regenerarClave(id);
      toast.success(`Nueva clave generada: ${res.nueva_clave}`, { duration: 5000 });
      fetchData();
    } catch (error) {
      toast.error('Error al regenerar clave');
    }
  };

  const copiarAlPortapapeles = (texto, mensaje) => {
    navigator.clipboard.writeText(texto);
    toast.success(mensaje || 'Copiado al portapapeles');
  };

  return (
    <div className="p-4 space-y-8 pb-24 max-w-[1400px] mx-auto">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-bg-card/30 p-4 rounded-3xl border border-white/5">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-primary/10 rounded-xl">
                <Shield className="text-primary shrink-0" size={24} />
            </div>
            <span className="truncate">Mando de Alcabalas</span>
          </h1>
          <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Control Directo y Relevo Táctico
          </p>
        </div>
        <Boton 
          size="lg" 
          onClick={() => {
            setPuntoSeleccionado(null);
            setFormPunto({ nombre: '', ubicacion: '' });
            setShowModalPunto(true);
          }}
          className="gap-2 h-12 px-8 w-full sm:w-fit shrink-0 whitespace-nowrap shadow-tactica hover:scale-[1.02] transition-transform"
        >
          <Plus size={20} />
          <span>Nueva Alcabala</span>
        </Boton>
      </header>

      {/* MONITOR DE ALCABALAS */}
      <section className="space-y-4">
        <div className="px-2">
            <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.3em]">Red de Control Activa</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 items-start">
            {puntos.map(p => {
              const isExpanded = expandedPuntos.has(p.id);
              return (
                <Card key={p.id} className={`bg-bg-card border-white/5 overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary/30 shadow-2xl' : 'hover:border-white/10'}`}>
                    <div className={`h-1.5 w-full ${p.activo ? 'bg-primary' : 'bg-error'} transition-all`} />
                    <CardContent className="p-0">
                    <div className="p-4 flex items-center justify-between">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpansio(p.id)}>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="text-xs font-black text-text-main uppercase tracking-widest truncate">{p.nombre}</h3>
                                {isExpanded ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-text-muted" />}
                            </div>
                            <p className="text-[9px] text-text-muted flex items-center gap-1.5 font-bold uppercase tracking-wider">
                                <MapPin size={9} className="text-primary shrink-0" />
                                <span className="truncate">{p.ubicacion || 'Sin ubicación específica'}</span>
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            <Boton 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 px-0 bg-white/5 border border-white/5 hover:bg-white/10"
                                onClick={() => {
                                    setPuntoSeleccionado(p);
                                    setFormPunto({ nombre: p.nombre, ubicacion: p.ubicacion });
                                    setShowModalPunto(true);
                                }}
                            >
                                <Edit3 size={14} />
                            </Boton>
                            <Boton 
                                variant="destructivo" 
                                size="sm" 
                                className="h-8 w-8 px-0 bg-error/10 text-error hover:bg-error hover:text-white border-0"
                                onClick={() => setShowConfirmDelete(p)}
                            >
                                <Trash2 size={14} />
                            </Boton>
                        </div>
                    </div>

                    {/* CONTENIDO DESPLEGABLE COMPACTO */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] border-t border-white/5' : 'max-h-0'}`}>
                        <div className="p-4 space-y-4 bg-bg-high/5">
                            {/* Identificador */}
                            <div className="group relative bg-black/40 rounded-xl p-3 border border-white/5 hover:border-primary/20 transition-colors">
                                <p className="text-[7px] font-black text-text-muted uppercase tracking-[0.25em] mb-1.5 px-0.5">Identificador de Acceso</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-mono font-black text-primary tracking-widest">{p.usuario_nombre}</p>
                                    <Boton 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 px-0 text-text-muted hover:text-white"
                                        onClick={() => copiarAlPortapapeles(p.usuario_nombre, 'Usuario copiado')}
                                    >
                                        <Copy size={14} />
                                    </Boton>
                                </div>
                            </div>

                            {/* Clave rotativa Compacta */}
                            <div className="space-y-1.5">
                                <p className="text-[7px] font-black text-text-muted uppercase tracking-[0.25em] mb-1 px-0.5">Clave Táctica <span className="text-primary">(24H)</span></p>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                        <p className="text-2xl font-mono font-black text-text-main tracking-[0.2em]">{p.clave_hoy}</p>
                                        <Boton 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 px-0 text-text-muted hover:text-primary transition-colors"
                                            onClick={() => copiarAlPortapapeles(p.clave_hoy, 'Clave copiada')}
                                        >
                                            <Copy size={16} />
                                        </Boton>
                                    </div>
                                    <Boton 
                                        className="h-14 w-14 px-0 bg-primary shadow-tactica hover:scale-[1.05] transition-all rounded-2xl flex-shrink-0"
                                        title="Renovar Clave Táctica"
                                        onClick={() => handleRegenerarClave(p.id)}
                                    >
                                        <RefreshCw size={24} />
                                    </Boton>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[9px] text-text-muted px-2 py-1 bg-white/5 rounded-full w-fit">
                                <Clock size={12} className="text-primary" />
                                <span className="font-bold uppercase tracking-wider">Relevo: 08:30 AM</span>
                            </div>
                        </div>
                    </div>
                    </CardContent>
                </Card>
              );
            })}
            {puntos.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-bg-card/20">
                <Shield size={64} className="mx-auto text-white/5 mb-6" />
                <h3 className="text-xl font-bold text-text-muted">Sin puntos de control</h3>
                <p className="text-text-muted/60 text-sm mt-2 max-w-xs mx-auto">No hay alcabalas activas desplegadas en el sistema táctico.</p>
            </div>
            )}
        </div>
      </section>

      {/* MONITOR DE PERSONAL EN VIVO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <UserCheck size={22} className="text-success" />
                Personal en Operación
            </h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-full border border-success/20">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">En Línea</span>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personales.map(g => (
                <Card key={g.alcabala_id} className="bg-bg-card border-bg-high/10 overflow-hidden hover:border-success/30 transition-all">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success border border-success/20">
                                <Shield size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-success uppercase bg-success/10 px-1.5 py-0.5 rounded border border-success/20">
                                        {g.grado || 'S/G'}
                                    </span>
                                    <h4 className="font-bold text-text-main">{g.nombre}</h4>
                                </div>
                                <p className="text-[10px] text-text-muted font-medium mt-0.5 uppercase tracking-wide">
                                    {g.alcabala} • {g.unidad || 'Unidad No Registrada'}
                                </p>
                            </div>
                        </div>

                        {/* ACCIONES DE CONTACTO */}
                        <div className="flex items-center gap-2">
                            {g.telefono && (
                                <a 
                                    href={`tel:${g.telefono}`} 
                                    className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all rounded-xl border border-primary/20"
                                    title="Llamar directamente"
                                >
                                    <Phone size={20} />
                                </a>
                            )}
                            <Boton 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 bg-white/5 text-text-muted hover:text-white rounded-xl"
                                onClick={() => copiarAlPortapapeles(g.telefono || '', 'Teléfono copiado')}
                                title="Copiar Teléfono"
                            >
                                <Copy size={18} />
                            </Boton>
                        </div>
                    </CardContent>
                    <div className="px-4 py-2 bg-bg-high/5 border-t border-bg-high/10 flex items-center justify-between text-[9px] text-text-muted italic">
                         <span>Turno iniciado: {new Date(g.inicio).toLocaleString()}</span>
                         <span className="flex items-center gap-1"><ExternalLink size={10} /> Logs de acceso</span>
                    </div>
                </Card>
            ))}
            {personales.length === 0 && (
                <div className="col-span-full p-10 bg-black/20 rounded-3xl border border-white/5 text-center">
                    <p className="text-text-muted italic text-sm">No hay reportes de guardias activos en los puntos de control</p>
                </div>
            )}
        </div>
      </section>

      {/* MODAL CREAR / EDITAR PUNTO */}
      <Modal 
        isOpen={showModalPunto} 
        onClose={() => setShowModalPunto(false)} 
        title={puntoSeleccionado ? "Modificar Alcabala" : "Nuevo Despliegue"}
      >
        <form onSubmit={handleCrearOEditarPunto} className="space-y-4">
          <Input 
            label="Nombre de Alcabala" 
            placeholder="Ej: Alcabala Principal (Paso Real)"
            value={formPunto.nombre}
            onChange={e => setFormPunto({...formPunto, nombre: e.target.value})}
            required
          />
          <Input 
            label="Ubicación / Referencia" 
            placeholder="Ej: Zona Norte, proximidad Hangares"
            value={formPunto.ubicacion}
            onChange={e => setFormPunto({...formPunto, ubicacion: e.target.value})}
          />
          <div className="pt-4 flex gap-2">
            <Boton variant="ghost" type="button" onClick={() => setShowModalPunto(false)} className="flex-1">Cancelar</Boton>
            <Boton type="submit" className="flex-1">{puntoSeleccionado ? 'Actualizar' : 'Desplegar'}</Boton>
          </div>
        </form>
      </Modal>

      {/* MODAL CONFIRMAR ELIMINAR */}
      <Modal 
        isOpen={!!showConfirmDelete} 
        onClose={() => setShowConfirmDelete(null)} 
        title="Desarticular Punto"
      >
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <p className="text-text-main font-medium">¿Está seguro de eliminar la alcabala "{showConfirmDelete?.nombre}"?</p>
          <p className="text-xs text-text-muted">
            Esta acción eliminará el punto de control y su usuario asociado permanentemente. 
            No podrá recuperar la trazabilidad directa de este punto.
          </p>
          <div className="flex gap-3 pt-4">
            <Boton variant="outline" onClick={() => setShowConfirmDelete(null)} className="flex-1">Mantener</Boton>
            <Boton variant="destructivo" onClick={() => handleEliminarPunto(showConfirmDelete?.id)} className="flex-1">Eliminar Definitivamente</Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
