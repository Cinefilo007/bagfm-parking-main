import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, Users, Menu, ClipboardList, Camera, UserCog, LogOut, ParkingSquare, Radio, Bell, ShieldAlert, QrCode, AlertTriangle, IdCard, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import { MobileMenuDrawer } from './MobileMenuDrawer';

export const BottomNav = () => {
  const { user, logout } = useAuthStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Dependiendo del rol, las rutas
  const navItems = [];
  
  if (user?.rol === 'COMANDANTE' || user?.rol === 'ADMIN_BASE') {
    navItems.push(
      { to: '/comando/dashboard', label: 'Centro', icon: ShieldCheck },
      { to: '/supervisor-base/dashboard', label: 'Sentinel', icon: Radio },
      { to: '/comando/entidades', label: 'Entidades', icon: Users },
      { to: '/comando/zonas', label: 'Zonas', icon: ParkingSquare },
      { label: 'Más', icon: Menu, isDrawerTrigger: true }
    );
  } else if (user?.rol === 'SUPERVISOR') {
    navItems.push(
      { to: '/supervisor-base/dashboard', label: 'Sentinel', icon: ShieldCheck },
      { to: '/comando/alcabalas', label: 'Alcabalas', icon: ClipboardList },
      { to: '/comando/infracciones', label: 'Infrac.', icon: AlertTriangle },
      { label: 'Más', icon: Menu, isDrawerTrigger: true }
    );
  } else if (user?.rol === 'ADMIN_ENTIDAD') {
    navItems.push(
       { to: '/entidad/dashboard', label: 'Panel', icon: ShieldCheck },
       { to: '/entidad/estacionamientos', label: 'Parking', icon: ParkingSquare },
       { to: '/entidad/pases-masivos', label: 'Pases', icon: ClipboardList },
       { to: '/entidad/socios', label: 'Socios', icon: Users },
       { label: 'Más', icon: Menu, isDrawerTrigger: true }
    );
  } else if (user?.rol === 'ALCABALA') {
    navItems.push(
      { to: '/alcabala/dashboard', label: 'Panel', icon: ShieldCheck },
      { to: '/alcabala/scanner', label: 'Scanner', icon: Camera },
      { label: 'Cerrar', icon: LogOut, action: 'logout' }
    );
  } else if (user?.rol === 'PARQUERO') {
    navItems.push(
      { to: '/parquero/dashboard', label: 'Mi Zona', icon: ParkingSquare },
      { to: '/parquero/perdidos', label: 'Perdidos', icon: ShieldAlert },
      { to: '/parquero/notificaciones', label: 'Notif.', icon: Bell },
      { label: 'Más', icon: Menu, isDrawerTrigger: true }
    );
  } else if (user?.rol === 'SUPERVISOR_PARQUEROS') {
    navItems.push(
      { to: '/supervisor/dashboard', label: 'Superv.', icon: Radio },
      { to: '/parquero/dashboard', label: 'Parqueo', icon: ParkingSquare },
      { label: 'Más', icon: Menu, isDrawerTrigger: true }
    );
  } else if (user?.rol === 'SOCIO') {
    navItems.push(
      { to: '/socio/portal',       label: 'Mi QR',        icon: QrCode },
      { to: '/socio/infracciones', label: 'Infracciones', icon: AlertTriangle },
      { to: '/socio/accesos',      label: 'Accesos',      icon: ArrowRightLeft },
      { to: '/ajustes',            label: 'Perfil',       icon: IdCard }
    );
  } else {
    navItems.push(
      { to: '/ajustes', label: 'Perfil', icon: IdCard }
    );
  }

  const handleAction = (item) => {
    if (item.action === 'logout') {
      logout();
    }
    if (item.isDrawerTrigger) {
      setIsDrawerOpen(true);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-bg-low h-16 flex items-center justify-around px-2 z-[100] pb-env-safe border-t border-white/5 lg:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const commonClass = "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors min-w-[64px]";
          
          if (item.action || item.isDrawerTrigger) {
             return (
               <button
                 key={item.label + idx}
                 onClick={() => handleAction(item)}
                 className={cn(commonClass, "text-text-muted hover:text-primary active:scale-95")}
               >
                 <Icon size={22} strokeWidth={2.5} />
                 <span className="text-[10px] font-medium tracking-wide uppercase">
                   {item.label}
                 </span>
               </button>
             );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  commonClass,
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-text-muted hover:text-text-sec"
                )
              }
            >
              <Icon size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-medium tracking-wide uppercase">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <MobileMenuDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />
    </>
  );
};
