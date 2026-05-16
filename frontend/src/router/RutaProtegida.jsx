import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { CambiarPasswordModal } from '../components/auth/CambiarPasswordModal';

/**
 * RutaProtegida: Solo maneja autenticación, roles y obligatoriedad de cambio de contraseña.
 * EL DISEÑO/LAYOUT se maneja en un componente separado para evitar duplicados.
 */
export const RutaProtegida = ({ rolesPermitidos = [] }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-app">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Validación de roles
  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(user.rol)) {
    if (user.rol === 'COMANDANTE' || user.rol === 'ADMIN_BASE' || user.rol === 'SUPERVISOR') return <Navigate to="/comando/dashboard" replace />;
    if (user.rol === 'ADMIN_ENTIDAD') return <Navigate to="/entidad/dashboard" replace />;
    if (user.rol === 'ALCABALA') return <Navigate to="/alcabala/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  // Cambio de Contraseña Obligatorio
  if (user?.debe_cambiar_password) {
    return (
      <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center">
        <CambiarPasswordModal />
        <div className="filter blur-md pointer-events-none select-none opacity-20">
          <Outlet />
        </div>
      </div>
    );
  }

  return <Outlet />;
};
