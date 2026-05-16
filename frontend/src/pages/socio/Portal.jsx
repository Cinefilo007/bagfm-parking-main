import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/auth.store';
import socioService from '../../services/socioService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Boton } from '../../components/ui/Boton';
import { toast } from 'react-hot-toast';
import QRCodeLib from "react-qr-code";
const QRCode = QRCodeLib.default || QRCodeLib;
import { 
  User, 
  Car, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Clock,
  Phone,
  LogOut,
  Download,
  Plus,
  Edit3
} from 'lucide-react';

// Componentes Tácticos Locales
const LayoutHeader = ({ titulo, subtitle }) => (
  <header className="sticky top-0 z-[50] bg-bg-app/90 backdrop-blur-md pb-4 pt-6 px-4 border-b border-white/5 flex items-center justify-between">
    <div>
      <p className="text-primary font-sans font-medium uppercase tracking-[0.1em] text-[10px] mb-1 text-primary">{subtitle}</p>
      <h1 className="font-display font-bold text-2xl tracking-tight text-white leading-none uppercase">{titulo}</h1>
    </div>
  </header>
);

const TacticalCard = ({ children, className }) => (
  <div className={`rounded-2xl p-4 bg-bg-card border border-white/5 shadow-xl ${className}`}>
    {children}
  </div>
);

const TacticalBadge = ({ children, variant }) => {
  const styles = variant === 'activa' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-danger/10 text-danger border-danger/20';
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border ${styles}`}>
      {children}
    </span>
  );
};

export default function PortalSocio() {
  const { logout, user, updatePerfil } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const qrRef = useRef();

  // Estado para nuevo vehículo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVehiculo, setNewVehiculo] = useState({
    placa: '',
    marca: '',
    modelo: '',
    color: '',
    tipo: 'sedan'
  });
  const [submitting, setSubmitting] = useState(false);

  // Estado para edición de perfil
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [perfilForm, setPerfilForm] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    telefono: '',
    email: ''
  });
  const [submittingProfile, setSubmittingProfile] = useState(false);

  const fetchPortal = async () => {
    try {
      const res = await socioService.obtenerPortal();
      setData(res);
    } catch (err) {
      console.error("Error sincronizando", err);
      toast.error("Error al sincronizar credencial táctica");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortal();
  }, []);

  const handleDownloadQR = () => {
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    
    img.onload = () => {
      // Resolución forzada 800x800 según directiva táctica
      canvas.width = 800;
      canvas.height = 800;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Dibujar escalado con margen de 40px (800 - 80 = 720)
      ctx.drawImage(img, 40, 40, 720, 720);
      
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_BAGFM_${data?.perfil?.cedula}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      URL.revokeObjectURL(url);
      toast.success("Credencial HQ descargada (800x800)");
    };

    img.src = url;
  };

  const openProfileModal = () => {
    const p = data?.perfil || user;
    setPerfilForm({
      nombre: p?.nombre?.startsWith('INVITADO') ? '' : (p?.nombre || ''),
      apellido: p?.apellido || '',
      cedula: p?.cedula?.startsWith('BAGFM-') ? '' : (p?.cedula || ''),
      telefono: p?.telefono || '',
      email: p?.email || ''
    });
    setIsProfileModalOpen(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSubmittingProfile(true);
    try {
      await updatePerfil(perfilForm);
      toast.success("Perfil actualizado tácticamente");
      setIsProfileModalOpen(false);
      fetchPortal();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar perfil");
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleCreateVehiculo = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await socioService.vincularVehiculo(newVehiculo);
      toast.success("Vehículo vinculado con éxito");
      setIsModalOpen(false);
      setNewVehiculo({ placa: '', marca: '', modelo: '', color: '', tipo: 'sedan' });
      fetchPortal(); // Recargar datos
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al registrar vehículo");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-app flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <RefreshCw className="text-primary animate-spin" size={32} />
           <p className="text-[10px] tracking-[0.3em] text-white/40 uppercase font-black">Sincronizando Sistema...</p>
        </div>
      </div>
    );
  }

  const p = data?.perfil || {};
  const m = p?.membresia || {};
  const esActivo = String(m?.estado) === 'activa' || String(m?.estado) === 'exonerada';
  const vehiculos = p?.vehiculos || [];
  const isInvitado = p?.cedula?.startsWith('BAGFM-');

  return (
    <div className="min-h-screen bg-bg-app pb-24 flex flex-col font-sans text-text-main">
      <LayoutHeader titulo="Mi Credencial" subtitle={String(data?.nombre_entidad || 'SISTEMA BAGFM')} />

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Columna Izquierda/Superior: Credencial Táctica */}
          <div className="lg:col-span-5 space-y-6">
            <TacticalCard className="text-center py-10 relative overflow-hidden shadow-2xl">
               {/* Decoración Táctica */}
               <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full -mr-24 -mt-24 blur-[80px] opacity-40" />
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full -ml-16 -mb-16 blur-3xl opacity-30" />

               <div className="mb-8 flex flex-col items-center gap-4 relative z-10">
                  <TacticalBadge variant={esActivo ? 'activa' : 'suspendida'}>
                    {esActivo ? 'ACCESO AUTORIZADO' : 'ACCESO DENEGADO'}
                  </TacticalBadge>
                  <button 
                    onClick={handleDownloadQR}
                    className="flex items-center gap-2 text-[9px] font-black tracking-widest text-primary uppercase hover:bg-primary/10 px-4 py-2 rounded-full transition-all border border-primary/20 backdrop-blur-sm"
                  >
                    <Download size={12} /> Descargar Credencial
                  </button>
               </div>

               {/* QR Code Container — Fluido para móvil, no se corta */}
               <div ref={qrRef} className="p-4 sm:p-6 bg-white rounded-[2rem] w-full max-w-xs sm:max-w-sm mx-auto aspect-square flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(255,255,255,0.08)] border-4 sm:border-8 border-white/10 relative z-10 transition-transform hover:scale-[1.01] duration-500">
                  <div className="w-full h-full p-1 bg-white flex items-center justify-center">
                    {data?.qr_token ? (
                      <QRCode 
                        value={String(data.qr_token)} 
                        level="H"
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      />
                    ) : (
                      <div className="text-black/20 italic text-sm font-black">SINCRO ERROR</div>
                    )}
                  </div>
               </div>

               <div className="space-y-2 relative z-10">
                  <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight uppercase text-white px-4 break-words leading-tight">
                    {String(p?.nombre_completo || user?.nombre || 'SOCIO')}
                  </h2>
                  <p className="text-[11px] font-mono text-text-muted tracking-[0.4em] font-bold pb-4 opacity-70">
                    ID-CARD: {String(p?.cedula || user?.cedula || 'N/A')}
                  </p>
                  <button 
                    onClick={openProfileModal}
                    className="inline-flex items-center gap-2 text-[10px] font-black text-white/80 hover:text-white uppercase tracking-widest bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-full transition-all border border-white/10 hover:border-primary/30"
                  >
                    <Edit3 size={12} /> Completar Datos
                  </button>
               </div>

               <div className="mt-10 grid grid-cols-2 border-t border-white/5 pt-0 bg-black/20 -mx-4 -mb-4 divide-x divide-white/5">
                  <div className="py-6">
                     <p className="text-[9px] text-text-muted uppercase font-black tracking-[0.2em] mb-2 opacity-50">Estatus Operativo</p>
                     <div className="flex items-center justify-center gap-2">
                        {esActivo ? <ShieldCheck size={14} className="text-primary" /> : <ShieldAlert size={14} className="text-danger" />}
                        <p className={`text-[12px] font-black uppercase tracking-widest ${esActivo ? 'text-primary' : 'text-danger'}`}>{String(m?.estado || 'DESCONOCIDO')}</p>
                     </div>
                  </div>
                  <div className="py-6">
                     <p className="text-[9px] text-text-muted uppercase font-black tracking-[0.2em] mb-2 opacity-50">Vencimiento</p>
                     <div className="flex items-center justify-center gap-2">
                        <Clock size={14} className="text-text-muted opacity-60" />
                        <p className="text-[12px] font-black text-text-main uppercase font-mono tracking-tight">{m?.fecha_fin ? new Date(m.fecha_fin).toLocaleDateString() : 'SIN FECHA'}</p>
                     </div>
                  </div>
               </div>
            </TacticalCard>
          </div>

          {/* Columna Derecha: Flota y Acciones */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[11px] uppercase font-black text-text-muted tracking-[0.4em] flex items-center gap-3">
                    <Car size={14} className="text-primary" /> Flota Autorizada
                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-md font-mono text-white/40">
                      {vehiculos.length}/{isInvitado ? '1' : '3'}
                    </span>
                  </h3>
                  {((isInvitado && vehiculos.length < 1) || (!isInvitado && vehiculos.length < 3)) && (
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-2 text-[10px] font-black text-primary hover:text-primary/80 uppercase tracking-widest transition-colors bg-primary/5 px-4 py-2 rounded-xl border border-primary/10"
                    >
                      <Plus size={16} /> Vincular Vehículo
                    </button>
                  )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                  {vehiculos.map((v, i) => (
                    <div key={i} className="p-5 bg-bg-card border border-white/5 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all shadow-lg hover:shadow-primary/5">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center text-text-muted border border-white/5 group-hover:text-primary group-hover:border-primary/20 transition-all">
                          <Car size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mb-2 opacity-60">{String(v.marca)} {String(v.modelo)}</p>
                          <p className="text-2xl font-mono font-black text-white leading-none tracking-tight">{String(v.placa)}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 uppercase tracking-widest">ACTIVO</span>
                        <p className="text-[8px] font-bold text-text-muted uppercase tracking-tighter opacity-30">Verificado</p>
                      </div>
                    </div>
                  ))}
                  {vehiculos.length === 0 && (
                    <div className="text-center py-12 bg-white/2 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center gap-4 group hover:bg-white/[0.03] transition-all">
                      <div className="p-4 bg-white/5 rounded-full text-text-muted/30 group-hover:scale-110 transition-transform">
                        <Car size={40} />
                      </div>
                      <p className="text-text-muted text-[11px] font-black uppercase tracking-[0.3em] italic opacity-40">
                        No hay vehículos en tu flota operativa
                      </p>
                      <Boton onClick={() => setIsModalOpen(true)} variant="ghost" className="text-[9px] font-black tracking-widest border-white/10 h-10 px-8">VINCULAR PRIMER VEHÍCULO</Boton>
                    </div>
                  )}
               </div>
            </div>

            {/* Panel de Ayuda / Info */}
            <TacticalCard className="bg-gradient-to-br from-primary/10 to-transparent border-primary/10 p-6">
               <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                  <ShieldCheck size={14} /> Protocolo de Acceso
               </h4>
               <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-[11px] font-medium text-white/70 leading-relaxed">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                     Muestra el código QR al personal de alcabala para validar tu identidad.
                  </li>
                  <li className="flex items-start gap-3 text-[11px] font-medium text-white/70 leading-relaxed">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                     Asegúrate de que la placa del vehículo que conduces esté vinculada a tu perfil.
                  </li>
                  <li className="flex items-start gap-3 text-[11px] font-medium text-white/70 leading-relaxed">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                     Mantén tu membresía activa para garantizar el acceso ininterrumpido.
                  </li>
               </ul>
            </TacticalCard>
          </div>
        </div>
      </main>

      {/* Modal para Vincular Vehículo */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Vincular Vehículo">
        <form onSubmit={handleCreateVehiculo} className="space-y-4 pt-2">
           <Input 
              label="Placa de Vehículo"
              placeholder="ABC-123"
              value={newVehiculo.placa}
              onChange={(e) => setNewVehiculo({...newVehiculo, placa: e.target.value.toUpperCase()})}
              required
           />
           <div className="grid grid-cols-2 gap-4">
              <Input 
                 label="Marca"
                 placeholder="TOYOTA"
                 value={newVehiculo.marca}
                 onChange={(e) => setNewVehiculo({...newVehiculo, marca: e.target.value.toUpperCase()})}
                 required
              />
              <Input 
                 label="Modelo"
                 placeholder="COROLLA"
                 value={newVehiculo.modelo}
                 onChange={(e) => setNewVehiculo({...newVehiculo, modelo: e.target.value.toUpperCase()})}
                 required
              />
           </div>
           <Input 
              label="Color"
              placeholder="BLANCO"
              value={newVehiculo.color}
              onChange={(e) => setNewVehiculo({...newVehiculo, color: e.target.value.toUpperCase()})}
              required
           />
           <div className="pt-4">
              <Boton type="submit" className="w-full" isLoading={submitting}>
                 REGISTRAR EN FLOTA
              </Boton>
           </div>
        </form>
      </Modal>

      {/* Modal para Editar Perfil */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Completar Perfil">
        <form onSubmit={handleUpdateProfile} className="space-y-4 pt-2">
           <div className="bg-primary/10 p-3 rounded-lg border border-primary/20 flex gap-3 text-primary text-xs relative overflow-hidden mb-2">
              <div className="relative z-10 w-full font-mono text-[9px] uppercase font-bold tracking-widest">
                Importante: Se requiere información real para validar el acceso al evento. {isInvitado && 'Invitados solo pueden registrar 1 vehículo.'}
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <Input 
                 label="Nombre"
                 placeholder="JUAN"
                 value={perfilForm.nombre}
                 onChange={(e) => setPerfilForm({...perfilForm, nombre: e.target.value.toUpperCase()})}
                 required
              />
              <Input 
                 label="Apellido"
                 placeholder="PEREZ"
                 value={perfilForm.apellido}
                 onChange={(e) => setPerfilForm({...perfilForm, apellido: e.target.value.toUpperCase()})}
                 required
              />
           </div>
           <Input 
              label="Cédula de Identidad"
              placeholder="V-12345678"
              value={perfilForm.cedula}
              onChange={(e) => setPerfilForm({...perfilForm, cedula: e.target.value.toUpperCase()})}
              required
           />
           <Input 
              label="Teléfono Móvil"
              placeholder="0414-XXXXXXX"
              value={perfilForm.telefono}
              onChange={(e) => setPerfilForm({...perfilForm, telefono: e.target.value})}
              required
           />
           <Input 
              label="Correo Electrónico (Opcional)"
              type="email"
              placeholder="ejemplo@correo.com"
              value={perfilForm.email}
              onChange={(e) => setPerfilForm({...perfilForm, email: e.target.value})}
           />
           <div className="pt-4">
              <Boton type="submit" className="w-full" isLoading={submittingProfile}>
                 GUARDAR PERFIL
              </Boton>
           </div>
        </form>
      </Modal>
    </div>
  );
}
