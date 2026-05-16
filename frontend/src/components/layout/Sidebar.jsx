import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LogOut, Settings, ShieldCheck, Bell,
  LayoutDashboard, UserCircle, Map as MapIcon,
  Camera, Sun, Moon, UserCog, ParkingCircle, Activity, Radio, AlertTriangle, Palette,
  ClipboardList, CalendarRange, Building2, Users, ParkingSquare, ShieldAlert,
  QrCode, ArrowRightLeft, Car as CarIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import { useUIStore } from '../../store/ui.store';

export const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { tacticalIdentity } = useUIStore();
  
  const navItems = [];
  
  if (user?.rol === 'COMANDANTE' || user?.rol === 'ADMIN_BASE') {
    navItems.push(
      { to: '/comando/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/supervisor-base/dashboard', label: 'Sentinel Interface', icon: ShieldCheck },
      { to: '/comando/zonas', label: 'Zonas Estacionamiento', icon: ParkingCircle },
      { to: '/comando/entidades', label: 'Entidades Alojadas', icon: Building2 },
      { to: '/comando/alcabalas', label: 'Gestión Alcabalas', icon: ClipboardList },
      { to: '/comando/eventos', label: 'Eventos Masivos', icon: CalendarRange },
      { to: '/comando/infracciones', label: 'Infracciones', icon: AlertTriangle },
      { to: '/comando/personal', label: 'Gestión Personal', icon: UserCog },
      { to: '/comando/carnets', label: 'Editor de carnets', icon: Palette },
    );
  } else if (user?.rol === 'SUPERVISOR') {
    navItems.push(
      { to: '/supervisor-base/dashboard', label: 'Sentinel Interface', icon: ShieldCheck },
      { to: '/supervisor-base/censo-vehicular', label: 'Censo Vehicular', icon: CarIcon },
      { to: '/supervisor-base/censo-personas', label: 'Censo Personas', icon: Users },
      { to: '/supervisor-base/pases', label: 'Emisión de Pases', icon: QrCode },
      { to: '/comando/alcabalas', label: 'Control Alcabalas', icon: ClipboardList },
      { to: '/comando/infracciones', label: 'Gestión Infracciones', icon: AlertTriangle },
      { to: '/comando/personal', label: 'Fuerza de Tareas', icon: UserCog },
    );
  } else if (user?.rol === 'ADMIN_ENTIDAD') {
    navItems.push(
      { to: '/entidad/dashboard', label: 'Panel Control', icon: LayoutDashboard },
      { to: '/entidad/estacionamientos', label: 'Estacionamientos', icon: ParkingSquare },
      { to: '/entidad/pases-masivos', label: 'Pases Masivos', icon: CalendarRange },
      { to: '/entidad/socios', label: 'Socios Permanentes', icon: Users },
      { to: '/entidad/personal', label: 'Personal Interno', icon: UserCog },
      { to: '/entidad/carnets', label: 'Editor de carnets', icon: Palette },
    );
  } else if (user?.rol === 'ALCABALA') {
    navItems.push(
      { to: '/alcabala/dashboard', label: 'Resumen Turno', icon: ShieldCheck },
      { to: '/alcabala/scanner', label: 'Escanear QR', icon: Camera },
    );
  } else if (user?.rol === 'PARQUERO') {
    navItems.push(
      { to: '/parquero/dashboard', label: 'Mi Zona', icon: ParkingSquare },
      { to: '/parquero/perdidos', label: 'Vehículos Perdidos', icon: ShieldAlert },
      { to: '/parquero/notificaciones', label: 'Historial / Notif.', icon: Bell },
    );
  } else if (user?.rol === 'SUPERVISOR_PARQUEROS') {
    navItems.push(
      { to: '/supervisor/dashboard', label: 'Supervisión', icon: Radio },
      { to: '/parquero/dashboard', label: 'Vista Parquero', icon: ParkingSquare },
      { to: '/parquero/perdidos', label: 'Vehículos Perdidos', icon: ShieldAlert },
      { to: '/parquero/notificaciones', label: 'Historial / Notif.', icon: Bell },
    );
  } else if (user?.rol === 'SOCIO') {
    navItems.push(
      { to: '/socio/portal', label: 'Mi QR', icon: QrCode },
      { to: '/socio/infracciones', label: 'Infracciones', icon: AlertTriangle },
      { to: '/socio/accesos', label: 'Historial de Accesos', icon: ArrowRightLeft },
    );
  }

  // Identidad dinámica para Alcabala
  const displayNombre = (user?.rol === 'ALCABALA' && tacticalIdentity) 
    ? `${tacticalIdentity.grado} ${tacticalIdentity.nombre} ${tacticalIdentity.apellido}`
    : `${user?.nombre} ${user?.apellido}`;
  
  const displaySub = (user?.rol === 'ALCABALA' && tacticalIdentity)
    ? tacticalIdentity.punto
    : (user?.rol || '').replace('_', ' ');

  return (
    <aside className="w-72 bg-bg-low h-screen sticky top-0 hidden lg:flex flex-col border-r border-bg-high/20 shadow-2xl z-[1000]">
      {/* Brand Header */}
      <div className="p-8 border-b border-bg-high/10 bg-bg-app/40 backdrop-blur-sm">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(78,222,163,0.3)]">
              <ShieldCheck className="text-on-primary" size={24} strokeWidth={2.5} />
           </div>
           <div className="flex flex-col">
              <span className="text-sm font-display font-black text-text-main tracking-widest uppercase">BAGFM ACCESS</span>
              <span className="text-[9px] font-mono text-primary font-bold tracking-[0.2em]">SISTEMA TÁCTICO</span>
           </div>
        </div>
      </div>

      {/* User Info Brief */}
      <div className="px-4 py-3 flex items-center gap-3 border border-bg-high/10 mx-2 my-2 rounded-xl bg-bg-high/20">
         <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-bg-high/20 shrink-0">
            <UserCircle size={24} className="text-text-muted" />
         </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[11px] font-black text-text-main truncate uppercase leading-tight">{displayNombre}</span>
            <span className="text-[9px] text-primary font-black tracking-widest uppercase opacity-80 mt-0.5 truncate">{displaySub}</span>
          </div>
      </div>

      {/* Navigation Space */}
      <nav className="flex-1 px-4 py-4 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
         <span className="px-3 text-[9px] font-black uppercase text-text-muted tracking-[0.2em] mb-2 opacity-50">Navegación Principal</span>
         {navItems.map((item) => {
            const Icon = item.icon;
            return (
               <NavLink
                 key={item.to}
                 to={item.to}
                 className={({ isActive }) =>
                   cn(
                     "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group",
                     isActive 
                       ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(78,222,163,0.15)] shadow-tactica/10" 
                       : "text-text-muted hover:bg-bg-high/20 hover:text-text-sec"
                   )
                 }
               >
                 {({ isActive }) => (
                    <>
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={cn("transition-transform group-hover:scale-110", isActive && "scale-110")} />
                      <span className="text-xs font-bold tracking-wide uppercase">
                        {item.label}
                      </span>
                      {isActive && (
                         <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#4EDEA3]" />
                      )}
                    </>
                 )}
               </NavLink>
            );
         })}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto p-2 flex flex-col gap-0.5 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
          <div className="px-4 py-0.5 border-t border-bg-high/5 mb-1" />
          <button 
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-text-muted hover:bg-bg-high/20 hover:text-text-sec transition-all group"
          >
             {isDarkMode ? (
               <Sun size={18} className="group-hover:rotate-12 transition-transform duration-500" />
             ) : (
               <Moon size={18} className="group-hover:-rotate-12 transition-transform duration-500" />
             )}
             <span className="text-xs font-bold uppercase tracking-tight">
               Modo {isDarkMode ? 'Claro' : 'Oscuro'}
             </span>
          </button>

         <NavLink to="/ajustes" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-text-muted hover:bg-bg-high/20 hover:text-text-sec transition-all group">
            <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-xs font-bold uppercase tracking-tight">Ajustes</span>
         </NavLink>
         <button 
           onClick={logout}
           className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-danger/70 hover:bg-danger/10 hover:text-danger transition-all text-left group"
         >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-tight">Cerrar Sesión</span>
         </button>
      </div>
    </aside>
  );
};
