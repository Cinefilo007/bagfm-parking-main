import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Boton } from '../ui/Boton';
import { 
  Ticket, 
  UserCheck, 
  ExternalLink, 
  ShieldCheck,
  AlertTriangle,
  FileDown,
  Infinity,
  Hash
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { pasesService } from '../../services/pasesService';
import { toast } from 'react-hot-toast';

export default function ModalNuevoLote({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [sinLimite, setSinLimite] = useState(false);
  const [form, setForm] = useState({
    nombre_evento: '',
    tipo_pase: 'simple',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '',
    cantidad_pases: 10,
    max_accesos_por_pase: 1
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };

      // Sin límite = enviar null al backend
      if (sinLimite) {
        payload.max_accesos_por_pase = null;
      }

      // Para pases identificados, la cantidad la define el Excel
      if (form.tipo_pase === 'identificado') {
        payload.cantidad_pases = 0;
      }

      await pasesService.crearLote(payload);
      toast.success('Lote táctico inicializado');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Error al configurar el lote de pases');
    } finally {
      setLoading(false);
    }
  };

  const tipoOpciones = [
    { 
      id: 'simple', 
      label: 'Pase Simple', 
      desc: 'QRs genéricos (Sin registro de persona)', 
      icon: Ticket,
      color: 'text-primary'
    },
    { 
      id: 'identificado', 
      label: 'Identificado', 
      desc: 'Base de datos oficial (Nombre/Cédula)', 
      icon: UserCheck,
      color: 'text-success'
    },
    { 
      id: 'portal', 
      label: 'Auto-Registro', 
      desc: 'Invitados se registran en portal web', 
      icon: ExternalLink,
      color: 'text-warning'
    }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NUEVO LOTE DE PASES" className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6 pt-2">
         {/* Selección de Tipo */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tipoOpciones.map(opt => {
               const Icon = opt.icon;
               const selected = form.tipo_pase === opt.id;
               return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm({...form, tipo_pase: opt.id})}
                    className={cn(
                       "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group",
                       selected ? "bg-primary/5 border-primary" : "bg-black/20 border-white/5 hover:border-white/10"
                    )}
                  >
                     <div className={cn("p-3 rounded-xl transition-colors", selected ? "bg-primary/20" : "bg-white/5 group-hover:bg-white/10")}>
                        <Icon size={20} className={cn(selected ? opt.color : "text-text-muted")} />
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className={cn("text-[10px] font-black uppercase tracking-widest leading-none mb-1", selected ? opt.color : "text-text-muted")}>
                           {opt.label}
                        </p>
                        <p className="text-xs text-text-sec truncate">{opt.desc}</p>
                     </div>
                     {selected && <ShieldCheck className="text-primary shrink-0" size={20} />}
                  </button>
               );
            })}
         </div>

         <div className="space-y-4 bg-bg-app/30 p-4 rounded-3xl border border-white/5">
            <Input 
               label="Nombre del Evento / Operativo"
               placeholder="EJ: CONCIERTO MILITAR 2024"
               value={form.nombre_evento}
               onChange={e => setForm({...form, nombre_evento: e.target.value.toUpperCase()})}
               required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Input 
                  label="Fecha Inicio"
                  type="date"
                  value={form.fecha_inicio}
                  onChange={e => setForm({...form, fecha_inicio: e.target.value})}
                  required
               />
               <Input 
                  label="Fecha Fin"
                  type="date"
                  value={form.fecha_fin}
                  onChange={e => setForm({...form, fecha_fin: e.target.value})}
                  required
               />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
               {form.tipo_pase !== 'identificado' ? (
                  <Input 
                     label="Cantidad de Pases"
                     type="number"
                     min={1}
                     value={form.cantidad_pases}
                     onChange={e => setForm({...form, cantidad_pases: parseInt(e.target.value)})}
                     required
                  />
               ) : (
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[10px] font-black uppercase text-text-muted tracking-widest pl-1">Plantilla Datos</label>
                     <button 
                        type="button"
                        onClick={() => pasesService.descargarPlantilla()}
                        className="h-12 bg-success/10 text-success border border-success/20 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-success/20 transition-all"
                     >
                        <FileDown size={16} /> Descargar
                     </button>
                  </div>
               )}

               {/* Accesos por Pase + Toggle Sin Límite */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-text-muted tracking-widest pl-1 flex items-center justify-between">
                     <span>Accesos por Pase</span>
                     <button
                        type="button"
                        onClick={() => setSinLimite(!sinLimite)}
                        className={cn("flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full border border-white/5 hover:border-white/20 transition-all", sinLimite ? "text-primary" : "text-text-muted")}
                     >
                        {sinLimite ? <Infinity size={10} /> : <Hash size={10} />}
                        {sinLimite ? "SIN LÍMITE" : "MODO LÍMITE"}
                     </button>
                  </label>

                  {!sinLimite ? (
                     <Input 
                        type="number"
                        min={1}
                        placeholder="Ej: 3"
                        value={form.max_accesos_por_pase}
                        onChange={e => setForm({...form, max_accesos_por_pase: parseInt(e.target.value)})}
                        className="animate-in fade-in slide-in-from-top-2"
                     />
                  ) : (
                     <div className="h-12 bg-black/20 border border-white/5 rounded-2xl flex items-center justify-center text-text-muted text-[10px] font-bold uppercase tracking-widest italic animate-in fade-in slide-in-from-top-2">
                        Ilimitado (Accesos Infinitos)
                     </div>
                  )}
               </div>
            </div>
         </div>

         {form.tipo_pase === 'identificado' && (
            <div className="p-4 bg-warning/5 border border-warning/20 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-bottom-2">
               <AlertTriangle className="text-warning shrink-0" size={20} />
               <p className="text-[10px] text-warning/80 font-bold uppercase leading-relaxed">
                  Al crear un lote identificado, deberá cargar el archivo Excel con los datos nominativos antes de generar los QRs.
               </p>
            </div>
         )}

         <div className="pt-2">
            <Boton 
               type="submit" 
               className="w-full h-14 text-sm font-black tracking-[0.2em] shadow-tactica bg-primary text-on-primary"
               isLoading={loading}
            >
               INICIALIZAR LOTE
            </Boton>
         </div>
      </form>
    </Modal>
  );
}
