import React from 'react';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ModalConfirmacion = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "CONFIRMACIÓN REQUERIDA", 
  message, 
  confirmText = "CONFIRMAR ACCIÓN", 
  cancelText = "CANCELAR",
  type = "danger", // danger, warning, info
  loading = false,
  balanced = true
}) => {
  const config = {
    danger: {
      icon: AlertOctagon,
      color: 'text-danger',
      bg: 'bg-danger/10',
      border: 'border-danger/20',
      btn: 'bg-danger text-white hover:bg-danger/90'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      btn: 'bg-warning text-bg-app hover:bg-warning/90'
    },
    info: {
      icon: Info,
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
      btn: 'bg-primary text-bg-app hover:bg-primary/90'
    }
  };

  const { icon: Icon, color, bg, border, btn } = config[type] || config.danger;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} balanced={balanced} className="max-w-sm">
      <div className="space-y-6 text-center">
        <div className={cn("mx-auto w-16 h-16 rounded-2xl flex items-center justify-center border animate-pulse", bg, border)}>
          <Icon className={color} size={32} />
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-bold text-text-main leading-relaxed">
            {message}
          </p>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest opacity-60">
            Esta acción podría tener consecuencias permanentes.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Boton 
            onClick={onConfirm} 
            disabled={loading}
            className={cn("h-12 font-black uppercase tracking-widest text-[11px] rounded-xl shadow-lg", btn)}
          >
            {loading ? "PROCESANDO..." : confirmText}
          </Boton>
          <Boton 
            variant="ghost" 
            onClick={onClose}
            disabled={loading}
            className="h-10 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main"
          >
            {cancelText}
          </Boton>
        </div>
      </div>
    </Modal>
  );
};
