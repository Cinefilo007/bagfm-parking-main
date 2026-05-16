import React, { useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Boton } from '../ui/Boton';
import { 
  Ticket, 
  Calendar, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Clock,
  Users
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { pasesService } from '../../services/pasesService';
import ModalExportarLote from './ModalExportarLote';

export default function LoteCard({ lote, onRefresh }) {
  const [generando, setGenerando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [modalExportOpen, setModalExportOpen] = useState(false);

  const handleGenerarZip = async () => {
    setGenerando(true);
    try {
      await pasesService.generarZip(lote.id);
      toast.success('Protocolo de generación de QRs iniciado');
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Error al iniciar la generación masiva');
    } finally {
      setGenerando(false);
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportando(true);
    try {
      await pasesService.importarExcel(lote.id, file);
      toast.success('Base de datos de invitados cargada con éxito');
      if (onRefresh) onRefresh();
    } catch (error) {
       toast.error('Error en la integración del archivo Excel');
    } finally {
       setImportando(false);
       e.target.value = '';
    }
  };

  const handleDescargar = () => {
    if (lote.zip_generado) {
      setModalExportOpen(true);
    }
  };

  const getTipoInfo = (tipo) => {
    switch(tipo) {
       case 'simple': return { label: 'Pase Simple', icon: Ticket, color: 'text-primary', bg: 'bg-primary/10' };
       case 'identificado': return { label: 'Pase Identificado', icon: UserCheck, color: 'text-success', bg: 'bg-success/10' };
       case 'portal': return { label: 'Auto-Registro', icon: ExternalLink, color: 'text-warning', bg: 'bg-warning/10' };
       default: return { label: tipo, icon: Ticket, color: 'text-muted', bg: 'bg-white/5' };
    }
  };

  const info = getTipoInfo(lote.tipo_pase);
  const Icono = info.icon;

  return (
    <Card className="bg-bg-card/40 border-white/5 overflow-hidden group hover:bg-bg-high transition-all">
      <CardContent className="p-0">
        <div className="p-5 space-y-4">
           {/* Header */}
           <div className="flex justify-between items-start">
              <div className="space-y-1">
                 <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border border-white/5", info.color, info.bg)}>
                       {info.label}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted opacity-50">{lote.codigo_serial}</span>
                 </div>
                 <h3 className="text-lg font-black text-text-main group-hover:text-primary transition-colors uppercase leading-tight">
                    {lote.nombre_evento}
                 </h3>
              </div>
              <div className="p-2 bg-black/20 rounded-xl border border-white/5">
                 <Icono className={info.color} size={18} />
              </div>
           </div>

           {/* Stats Grid */}
           <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-1">
                 <p className="text-[8px] text-text-muted uppercase font-black tracking-tighter">Vigencia Hasta</p>
                 <div className="flex items-center gap-2 text-text-main">
                    <Calendar size={12} className="opacity-50" />
                    <span className="text-xs font-bold font-mono">{new Date(lote.fecha_fin).toLocaleDateString()}</span>
                 </div>
              </div>
              <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-1 text-right">
                 <p className="text-[8px] text-text-muted uppercase font-black tracking-tighter">Dotación Total</p>
                 <div className="flex items-center gap-2 justify-end text-primary">
                    <Users size={12} className="opacity-50" />
                    <span className="text-xl font-display font-black tracking-tighter">{lote.cantidad_pases}</span>
                 </div>
              </div>
           </div>

           {/* Progress / Status */}
           <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-1">
                 <span className="text-text-muted">Estado del Paquete</span>
                 <span className={lote.zip_generado ? 'text-success' : 'text-warning'}>
                    {lote.zip_generado ? 'DISPONIBLE' : 'EN ESPERA'}
                 </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                 <div 
                    className={cn("h-full transition-all duration-1000", lote.zip_generado ? 'bg-success w-full' : 'bg-warning w-1/3 animate-pulse')}
                 />
              </div>
           </div>
        </div>

        {/* Footer Actions */}
        <div className="grid grid-cols-2 border-t border-white/5 bg-black/10">
           {lote.tipo_pase === 'identificado' && !lote.zip_generado ? (
              <label className="flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/5 cursor-pointer transition-all border-r border-white/5">
                 <input type="file" className="hidden" accept=".xlsx" onChange={handleImportExcel} disabled={importando} />
                 {importando ? <RefreshCw className="animate-spin" size={14} /> : <Upload size={14} />}
                 Cargar Excel
              </label>
           ) : (
              <button 
                 onClick={handleGenerarZip}
                 disabled={generando || lote.zip_generado}
                 className="flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-primary/10 hover:text-primary transition-all border-r border-white/5"
              >
                 {generando ? <RefreshCw className="animate-spin" size={14} /> : (lote.zip_generado ? <CheckCircle2 className="text-success" size={14} /> : <Ticket size={14} />)}
                 {lote.zip_generado ? 'Procesado' : 'Generar QRs'}
              </button>
           )}

           <button 
              onClick={handleDescargar}
              disabled={!lote.zip_generado}
              className={cn(
                "flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest transition-all",
                lote.zip_generado ? "text-primary hover:bg-primary/10" : "text-text-muted/30 cursor-not-allowed"
              )}
           >
              <Download size={14} /> Descargar ZIP
           </button>
        </div>
      </CardContent>

      {modalExportOpen && (
         <ModalExportarLote 
            isOpen={modalExportOpen} 
            onClose={() => setModalExportOpen(false)} 
            lote={lote} 
         />
      )}
    </Card>
  );
}
