import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Modal = ({ isOpen, onClose, title, children, className, balanced = true }) => {
  // Cerrar al presionar Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={cn("fixed inset-0 z-[9999] flex transition-all duration-300", balanced && "lg:left-72")}>
      {/* Backdrop: Cubre toda la pantalla */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Container que balancea respecto al Sidebar si balanced=true */}
      <div className="relative flex-1 flex items-center justify-center p-4 min-h-screen">
        {/* Modal Content */}
        <div 
          className={cn(
            "relative w-full bg-bg-card border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in duration-300",
            className || "max-w-md"
          )}
        >
          {/* Header Táctico */}
          <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-text-main/10 bg-text-main/5">
            <h3 className="font-display font-bold text-sm tracking-widest text-text-main uppercase">
              {title}
            </h3>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-text-muted"
            >
              <X size={18} />
            </button>
          </div>
          
          {/* Body */}
          <div className="px-6 py-6 overflow-y-auto min-h-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
