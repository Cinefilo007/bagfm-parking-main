import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  MapPin, 
  Car, 
  User, 
  Phone, 
  Send, 
  Ticket,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Boton } from '../components/ui/Boton';
import { pasesService } from '../services/pasesService';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';

export default function PortalEvento() {
  const { serial } = useParams();
  const [lote, setLote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [qrBlob, setQrBlob] = useState(null);

  const [form, setForm] = useState({
    nombre: '',
    cedula: '',
    email: '',
    telefono: '',
    marca: '',
    modelo: '',
    placa: '',
    color: ''
  });

  useEffect(() => {
    const fetchLote = async () => {
      try {
        const data = await pasesService.obtenerLotePublico(serial);
        setLote(data);
      } catch (error) {
        toast.error('Enlace de seguridad inválido o expirado');
      } finally {
        setLoading(false);
      }
    };
    fetchLote();
  }, [serial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      // Registrar invitado y obtener QR
      const res = await pasesService.registrarInvitado(serial, form);
      // El backend debería retornar el QR en base64 o similar para mostrarlo
      setQrBlob(res.qr_base64);
      setCompletado(true);
      toast.success('Acceso Autorizado por BAGFM');
    } catch (error) {
       const msg = error.response?.data?.detail || 'Error en el registro táctico';
       toast.error(msg);
    } finally {
       setEnviando(false);
    }
  };

  if (loading) return (
     <div className="min-h-screen bg-bg-app flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
     </div>
  );

  if (!lote && !loading) return (
     <div className="min-h-screen bg-bg-app flex items-center justify-center p-6 text-center">
        <div className="space-y-4 max-w-sm">
           <AlertCircle className="text-danger mx-auto" size={64} />
           <h1 className="text-2xl font-black text-text-main uppercase">Enlace Inválido</h1>
           <p className="text-text-muted text-sm leading-relaxed">Este portal de registro ha sido desactivado por protocolos de seguridad o el evento ha finalizado.</p>
        </div>
     </div>
  );

  return (
    <div className="min-h-screen bg-bg-app selection:bg-primary/30 py-8 px-4 flex flex-col items-center">
      
      {/* Header Premium */}
      <div className="w-full max-w-md text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
         <div className="w-20 h-20 bg-primary/10 rounded-[2rem] border border-primary/20 flex items-center justify-center mx-auto mb-6 shadow-tactica">
            <ShieldCheck className="text-primary" size={40} />
         </div>
         <h1 className="text-[10px] font-black tracking-[0.3em] uppercase text-primary mb-2">Portal de Acceso Táctico</h1>
         <h2 className="text-3xl font-black text-text-main uppercase italic break-words leading-none tracking-tighter">
            {lote.nombre_evento}
         </h2>
         <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-text-muted font-black uppercase tracking-widest border-y border-white/5 py-3">
            <div className="flex items-center gap-2">
               <Calendar size={14} className="text-primary" />
               <span>{new Date(lote.fecha_inicio).toLocaleDateString()}</span>
            </div>
            <div className="w-1 h-1 bg-white/10 rounded-full" />
            <div className="flex items-center gap-2">
               <MapPin size={14} className="text-primary" />
               <span>BAGFM</span>
            </div>
         </div>
      </div>

      <div className="w-full max-w-md relative">
         {/* Background Glow */}
         <div className="absolute inset-0 bg-primary/5 blur-[100px] -z-10 rounded-full" />

         {!completado ? (
            <Card className="bg-bg-card/40 backdrop-blur-2xl border-white/5 p-6 md:p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-500">
               <form onSubmit={handleSubmit} className="space-y-8">
                  
                  {/* Datos Personales */}
                  <div className="space-y-4">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2 px-1">
                        <User size={14} className="text-primary" />
                        Identificación del Invitado
                     </h3>
                     <div className="grid grid-cols-2 gap-4">
                        <Input 
                           label="Nombres" 
                           placeholder="Juan" 
                           value={form.nombre}
                           onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
                           required 
                        />
                        <Input 
                           label="Apellidos" 
                           placeholder="Pérez" 
                           value={form.apellido}
                           onChange={e => setForm({...form, apellido: e.target.value.toUpperCase()})}
                           required 
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <Input 
                           label="Cédula" 
                           placeholder="V-12345678" 
                           value={form.cedula}
                           onChange={e => setForm({...form, cedula: e.target.value})}
                           required 
                        />
                        <Input 
                           label="Teléfono" 
                           placeholder="0412..." 
                           value={form.telefono}
                           onChange={e => setForm({...form, telefono: e.target.value})}
                           required 
                        />
                     </div>
                  </div>

                  {/* Datos del Vehículo */}
                  <div className="space-y-4">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center gap-2 px-1">
                        <Car size={14} className="text-primary" />
                        Información del Vehículo
                     </h3>
                     <div className="grid grid-cols-2 gap-4">
                        <Input 
                           label="Marca" 
                           placeholder="Toyota" 
                           value={form.marca}
                           onChange={e => setForm({...form, marca: e.target.value.toUpperCase()})}
                           required 
                        />
                        <Input 
                           label="Modelo" 
                           placeholder="Corolla" 
                           value={form.modelo}
                           onChange={e => setForm({...form, modelo: e.target.value.toUpperCase()})}
                           required 
                        />
                     </div>
                     <div className="grid grid-cols-3 gap-3">
                        <Input 
                           label="Placa" 
                           placeholder="ABC-123" 
                           value={form.placa}
                           onChange={e => setForm({...form, placa: e.target.value.toUpperCase()})}
                           required 
                        />
                        <Input 
                           label="Color" 
                           placeholder="Gris" 
                           value={form.color}
                           onChange={e => setForm({...form, color: e.target.value.toUpperCase()})}
                           required 
                        />
                        <Input 
                           label="Año" 
                           type="number"
                           placeholder="2024" 
                           value={form.anio}
                           onChange={e => setForm({...form, anio: e.target.value})}
                           required 
                        />
                     </div>
                  </div>

                  <div className="pt-2">
                     <p className="text-[9px] text-text-muted text-center uppercase font-bold italic mb-6 leading-relaxed opacity-60">
                        Al registrarse, usted acepta los protocolos de seguridad de la base y el uso de sus datos para control de acceso.
                     </p>
                     <Boton 
                        type="submit" 
                        isLoading={enviando}
                        className="w-full h-16 bg-primary text-on-primary text-sm font-black tracking-[0.2em] shadow-tactica rounded-2xl"
                     >
                        GENERAR PASE DIGITAL
                     </Boton>
                  </div>
               </form>
            </Card>
         ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-700">
               <Card className="bg-bg-card/40 backdrop-blur-2xl border-success/30 p-8 rounded-[2.5rem] shadow-2xl text-center">
                  <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 text-success">
                     <CheckCircle2 size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-text-main uppercase italic mb-2">¡REGISTRO EXITOSO!</h3>
                  <p className="text-text-muted text-xs uppercase font-black tracking-widest mb-8">Presente este código en la alcabala</p>
                  
                  <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl mb-8">
                     <img src={qrBlob} alt="QR de Acceso" className="w-64 h-64" />
                  </div>

                  <div className="space-y-4">
                     <Boton 
                        onClick={() => window.print()} 
                        variant="outline"
                        className="w-full gap-2 border-white/10"
                     >
                        <Ticket size={18} /> DESCARGAR COMPROBANTE
                     </Boton>
                     <p className="text-[10px] text-text-muted font-black uppercase tracking-tighter italic">
                         ESTE PASE ES PERSONAL E INTRANSFERIBLE
                     </p>
                  </div>
               </Card>
            </div>
         )}
      </div>

      <footer className="mt-12 text-[10px] font-black text-text-muted/40 uppercase tracking-[0.3em] flex items-center gap-3">
         <span>BAGFM SECURITY</span>
         <div className="w-1.5 h-1.5 bg-white/5 rounded-full" />
         <span>TERMINAL v3.2</span>
      </footer>
    </div>
  );
}
