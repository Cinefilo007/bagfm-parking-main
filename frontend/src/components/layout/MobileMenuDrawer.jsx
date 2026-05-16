import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  X, CalendarRange, AlertTriangle, UserCog, Palette, 
  ShieldAlert, Bell, Settings, LogOut, ShieldCheck,
  User, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';

export const MobileMenuDrawer = ({ isOpen, onClose }) => {
  const { user, logout } = useAuthStore();

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

  // Definición de módulos operativos por rol (solo los que NO están en la BottomNav principal)
  const extendedNavItems = [];
  if (user?.rol === 'COMANDANTE' || user?.rol === 'ADMIN_BASE') {
    extendedNavItems.push(
      { to: '/comando/eventos', label: 'Eventos Masivos', icon: CalendarRange, color: 'text-orange-400' },
      { to: '/comando/infracciones', label: 'Infracciones', icon: AlertTriangle, color: 'text-danger' },
      { to: '/comando/personal', label: 'Gestión Personal', icon: UserCog, color: 'text-primary' },
      { to: '/comando/carnets', label: 'Editor de Carnets', icon: Palette, color: 'text-indigo-400' },
    );
  } else if (user?.rol === 'SUPERVISOR') {
    extendedNavItems.push(
      { to: '/comando/personal', label: 'Fuerza de Tareas', icon: UserCog, color: 'text-primary' },
      { to: '/comando/eventos', label: 'Eventos Masivos', icon: CalendarRange, color: 'text-orange-400' },
      { to: '/comando/carnets', label: 'Editor de Carnets', icon: Palette, color: 'text-indigo-400' },
    );
  } else if (user?.rol === 'ADMIN_ENTIDAD') {
    extendedNavItems.push(
      { to: '/entidad/personal', label: 'Personal Interno', icon: UserCog, color: 'text-primary' },
      { to: '/entidad/carnets', label: 'Editor de Carnets', icon: Palette, color: 'text-indigo-400' },
    );
  } else if (user?.rol === 'SUPERVISOR_PARQUEROS') {
    extendedNavItems.push(
      { to: '/parquero/perdidos', label: 'Vehículos Perdidos', icon: ShieldAlert, color: 'text-danger' },
      { to: '/parquero/notificaciones', label: 'Historial / Notif.', icon: Bell, color: 'text-primary' },
    );
  }

  return (
    <div className="fixed inset-0 z-[10001] lg:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-bg-low border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-out flex flex-col max-h-[85vh]",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle de arrastre (Visual) */}
        <div className="w-12 h-1.5 bg-text-muted/20 rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-white/5">
          <div>
            <h3 className="text-lg font-black text-text-main uppercase italic tracking-tight">Centro de Control</h3>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Panel Operativo Extendido</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-muted active:scale-90 transition-transform"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8 pb-12">
          
          {/* Grid de Módulos Operativos */}
          {extendedNavItems.length > 0 && (
            <section className="space-y-4">
              <p className="text-[10px] text-text-muted uppercase font-black tracking-[0.3em] opacity-40 ml-2">Módulos de Sistema</p>
              <div className="grid grid-cols-2 gap-3">
                {extendedNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink 
                      key={item.to} 
                      to={item.to}
                      onClick={onClose}
                      className="flex flex-col items-center justify-center p-5 rounded-2xl bg-bg-app border border-white/5 active:scale-95 transition-all group"
                    >
                      <div className={cn("mb-3 p-3 rounded-xl bg-white/[0.03] group-hover:bg-white/[0.08] transition-colors", item.color)}>
                        <Icon size={24} strokeWidth={2.5} />
                      </div>
                      <span className="text-[10px] font-black text-text-main uppercase tracking-tight text-center leading-tight">
                        {item.label}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </section>
          )}

          {/* Sección de Perfil y Ajustes */}
          <section className="space-y-4">
            <p className="text-[10px] text-text-muted uppercase font-black tracking-[0.3em] opacity-40 ml-2">Cuenta y Seguridad</p>
            <div className="space-y-2">
              <NavLink 
                to="/ajustes" 
                onClick={onClose}
                className="flex items-center gap-4 p-4 rounded-2xl bg-bg-app border border-white/5 active:scale-95 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <User size={24} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-xs font-black text-text-main uppercase tracking-tight italic">Mi Expediente</p>
                  <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">Perfil, Clave y Biometría</p>
                </div>
                <ChevronRight size={16} className="text-text-muted opacity-20" />
              </NavLink>

              <button 
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-danger/10 border border-danger/10 text-danger active:scale-95 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-danger/20 flex items-center justify-center">
                  <LogOut size={24} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-xs font-black uppercase tracking-tight italic">Finalizar Sesión</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Cerrar Enlace Táctico</p>
                </div>
              </button>
            </div>
          </section>

          {/* Footer Informativo */}
          <div className="pt-4 text-center">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-text-muted/10 border border-text-muted/10">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#4EDEA3]" />
                <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.2em]">BAGFM ACCESS v2.0 · MODO TÁCTICO</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
