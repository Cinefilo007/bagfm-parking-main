import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { BottomNav } from '../../components/layout/BottomNav';
import { Boton } from '../../components/ui/Boton';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { SocioCard } from '../../components/entidades/SocioCard';
import { 
  Users as UsersIcon, 
  ArrowLeft, 
  UserPlus, 
  Hash, 
  User as UserIcon, 
  Car as CarIcon,
  Mail, 
  Phone,
  BarChart3
} from 'lucide-react';
import api from '../../services/api';

export default function EntidadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entidad, setEntidad] = useState(null);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [nuevoSocio, setNuevoSocio] = useState({
    cedula: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    entidad_id: id
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entRes, sociosRes] = await Promise.all([
        api.get(`/entidades/${id}`),
        api.get(`/socios/entidad/${id}`)
      ]);
      setEntidad(entRes.data);
      setSocios(sociosRes.data);
    } catch (err) {
      console.error("Error cargando datos de entidad", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCrearSocio = async (e) => {
    e.preventDefault();
    try {
      await api.post('/socios/', {
        ...nuevoSocio,
        entidad_id: id
      });
      setIsModalOpen(false);
      setNuevoSocio({ cedula: '', nombre: '', apellido: '', email: '', telefono: '', entidad_id: id });
      fetchData();
    } catch (err) {
      console.error("Error creando socio", err);
    }
  };
  
  const handleActionSocio = async (tipo, payload) => {
    try {
      if (tipo === 'renovacion') {
        const socio = payload;
        await api.post(`/socios/${socio.id}/renovar?meses=1`);
      } else if (tipo === 'estado') {
        const { socio, nuevoEstado } = payload;
        await api.post(`/socios/${socio.id}/estado?estado=${nuevoEstado}`);
      }
      fetchData(); // Refrescar lista tras acción exitosa
    } catch (err) {
      console.error(`Error en acción ${tipo}:`, err);
      alert("Error al procesar la acción operativa");
    }
  };

  if (loading && !entidad) {
    return (
      <div className="min-h-screen bg-bg-app flex items-center justify-center">
         <p className="text-primary text-xs tracking-widest animate-pulse uppercase">Analizando Concesión...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-app">
      <Header 
        titulo={entidad?.nombre || 'Detalle Entidad'} 
        subtitle={`ID: ${entidad?.codigo_slug?.toUpperCase()}`}
        actionElement={
          <button 
            onClick={() => navigate('/comando/entidades')}
            className="h-10 w-10 bg-bg-high/20 rounded-full flex items-center justify-center border border-bg-high/10 text-text-muted active:scale-95 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
        }
      />

      <main className="px-4 py-6 max-w-4xl mx-auto pb-24">
        {/* Estadísticas Rápidas de la Entidad */}
        <div className="grid grid-cols-2 gap-4 mb-8">
           <Card className="flex flex-col p-4">
              <div className="flex justify-between mb-4">
                <UsersIcon size={20} className="text-primary/60" />
                <Badge variant="comando">ACTIVOS</Badge>
              </div>
              <div className="text-2xl font-display font-bold text-text-main">{socios.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Total Socios</div>
           </Card>
           
           <Card className="flex flex-col p-4">
              <div className="flex justify-between mb-4">
                <BarChart3 size={20} className="text-primary/60" />
                <span className="text-[10px] text-text-muted font-bold tracking-widest font-mono">
                  {Math.round((socios.length / (entidad?.capacidad_vehiculos || 1)) * 100)}%
                </span>
              </div>
              <div className="text-2xl font-display font-bold text-text-main">
                {entidad?.capacidad_vehiculos || 0}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Capacidad Max</div>
           </Card>
        </div>

        {/* Sección de Socios */}
        <div className="flex justify-between items-center mb-6 border-b border-bg-high/10 pb-2">
           <h3 className="text-text-main font-display font-bold uppercase tracking-widest text-sm">
             Personal Registrado
           </h3>
           <Boton 
             variant="ghost" 
             className="h-8 px-3 text-[10px] gap-1.5 border-primary/20 text-primary"
             onClick={() => setIsModalOpen(true)}
           >
             <UserPlus size={14} />
             VINCULAR
           </Boton>
        </div>

        <div className="space-y-4">
          {socios.map(socio => (
            <SocioCard key={socio.id} socio={socio} onAction={handleActionSocio} />
          ))}

          {socios.length === 0 && (
            <div className="text-center p-12 border border-dashed border-bg-high/20 rounded-2xl">
               <UsersIcon size={32} className="mx-auto text-text-muted/30 mb-4" />
               <p className="text-text-muted text-xs uppercase tracking-widest font-medium">
                 No hay socios vinculados a esta entidad
               </p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      {/* Modal Vincular Socio */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Vincular Nuevo Miembro"
      >
        <form onSubmit={handleCrearSocio} className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Cédula"
                icon={<Hash size={16} />}
                required
                placeholder="V12345678"
                value={nuevoSocio.cedula}
                onChange={(e) => setNuevoSocio({...nuevoSocio, cedula: e.target.value.toUpperCase()})}
              />
              <Input 
                label="Teléfono"
                icon={<Phone size={16} />}
                placeholder="0412..."
                value={nuevoSocio.telefono}
                onChange={(e) => setNuevoSocio({...nuevoSocio, telefono: e.target.value})}
              />
           </div>
           
           <Input 
             label="Nombre"
             icon={<UserIcon size={16} />}
             required
             placeholder="Ej: JUAN"
             value={nuevoSocio.nombre}
             onChange={(e) => setNuevoSocio({...nuevoSocio, nombre: e.target.value.toUpperCase()})}
           />
           
           <Input 
             label="Apellido"
             icon={<UserIcon size={16} />}
             required
             placeholder="Ej: PÉREZ"
             value={nuevoSocio.apellido}
             onChange={(e) => setNuevoSocio({...nuevoSocio, apellido: e.target.value.toUpperCase()})}
           />
           
           <Input 
             label="Correo Electrónico"
             type="email"
             icon={<Mail size={16} />}
             placeholder="juan@ejemplo.com"
             value={nuevoSocio.email}
             onChange={(e) => setNuevoSocio({...nuevoSocio, email: e.target.value.toLowerCase()})}
           />

           <div className="pt-4">
             <Boton type="submit" className="w-full">
                CONFIRMAR REGISTRO
             </Boton>
           </div>
        </form>
      </Modal>
    </div>
  );
}
