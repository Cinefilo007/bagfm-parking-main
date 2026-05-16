import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useUIStore } from '../../store/ui.store';

import { useNotifications } from '../../hooks/useNotifications';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuthStore } from '../../store/auth.store';

export const MainLayout = ({ hideNav: forceHideNav = false }) => {
  const { hideSidebar, hideBottomNav } = useUIStore();
  const { user } = useAuthStore();
  
  // Inicializar sistemas de comunicación táctica
  useNotifications(); // WebSocket
  const { subscribeUser } = usePushNotifications();

  useEffect(() => {
    // Suscribir a Push si el rol lo amerita (Parqueros y Supervisores)
    if (user && ['PARQUERO', 'SUPERVISOR_PARQUEROS', 'ADMIN_BASE'].includes(user.rol)) {
      subscribeUser();
    }
  }, [user, subscribeUser]);
  
  const finalHideSidebar = forceHideNav || hideSidebar;
  const finalHideBottom = forceHideNav || hideBottomNav;

  return (
    <div className="min-h-screen bg-bg-app flex">
       <ThemeToggle />
       
       {/* Sidebar para Escritorio (Desktop) */}
       {!finalHideSidebar && <Sidebar />}

       {/* Contenedor Principal Adaptativo */}
       <main className={`flex-1 flex flex-col ${!finalHideBottom ? 'pb-20 lg:pb-0' : ''} h-screen overflow-hidden`}>
          <div className="flex-1 overflow-y-auto w-full no-scrollbar bg-bg-app relative">
             {/* Renderizado de la Página */}
             <Outlet />
          </div>

          {/* Menú de Navegación Inferior (Móvil) */}
          {!finalHideBottom && <BottomNav />}
       </main>
    </div>
  );
};
