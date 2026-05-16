import { create } from 'zustand';
import api from '../services/api';
import { 
  startRegistration, 
  startAuthentication 
} from '@simplewebauthn/browser';

export const RolTipo = {
  COMANDANTE: "COMANDANTE",
  ADMIN_BASE: "ADMIN_BASE",
  SUPERVISOR: "SUPERVISOR",
  ALCABALA: "ALCABALA",
  ADMIN_ENTIDAD: "ADMIN_ENTIDAD",
  SUPERVISOR_PARQUEROS: "SUPERVISOR_PARQUEROS",
  PARQUERO: "PARQUERO",
  SOCIO: "SOCIO"
};

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Para el loader inicial
  
  // Acciones
  login: async (cedula, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', cedula);
      formData.append('password', password);

      const response = await api.post('auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      if (!access_token) throw new Error("No se recibió un token de acceso del servidor");
      
      localStorage.setItem('token', access_token);
      
      // Decodificar token manual o hacer request a /me
      // Por brevedad, el backend asume JWT, aqui lo desencriptamos (base64url)
      const tokenParts = access_token.split('.');
      if (tokenParts.length < 2) throw new Error("Token de acceso malformado");

      const base64Url = tokenParts[1];
      if (!base64Url) throw new Error("Payload del token no encontrado");

      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const sessionUser = JSON.parse(jsonPayload);
      
      localStorage.setItem('user', JSON.stringify(sessionUser));

      set({ 
        token: access_token, 
        user: sessionUser, 
        isAuthenticated: true 
      });
      return true;
    } catch (error) {
      console.error("Error en login", error);
      throw error;
    }
  },

  loginBiometrico: async (cedula) => {
    try {
      // 1. Obtener opciones del backend
      const optionsRes = await api.post('biometrico/login-options', { cedula });
      const options = optionsRes.data;

      // 2. Iniciar autenticación en el navegador
      let asseResp;
      try {
        console.log("BAGFM: Intentando autenticación formato v10+");
        asseResp = await startAuthentication({ optionsJSON: options });
      } catch (e) {
        console.warn("BAGFM: Fallo formato v10+, intentando v9-", e);
        asseResp = await startAuthentication(options);
      }

      // 3. Verificar en el backend
      const verifyRes = await api.post('biometrico/login-verify', {
        cedula,
        authentication_response: asseResp
      });

      const { access_token } = verifyRes.data;
      if (!access_token) throw new Error("No se recibió un token de acceso tras verificación");
      
      localStorage.setItem('token', access_token);
      
      const tokenParts = access_token.split('.');
      if (tokenParts.length < 2) throw new Error("Token de acceso biométrico malformado");

      const base64Url = tokenParts[1];
      if (!base64Url) throw new Error("Payload del token biométrico no encontrado");

      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const sessionUser = JSON.parse(jsonPayload);
      localStorage.setItem('user', JSON.stringify(sessionUser));

      set({ 
        token: access_token, 
        user: sessionUser, 
        isAuthenticated: true 
      });
      return true;
    } catch (error) {
      // Manejo silencioso de cancelaciones
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
        console.warn("BAGFM: Operación biométrica cancelada por el usuario");
        return { cancelado: true };
      }

      console.error("Error en login biométrico", error);
      throw error;
    }
  },

  verificarBiometria: async (cedula) => {
    try {
      const response = await api.get(`biometrico/check-usuario/${cedula}`);
      return response.data.disponible;
    } catch (error) {
      console.error("Error al verificar disponibilidad biométrica", error);
      return false;
    }
  },

  registrarDispositivoBiometrico: async (nombreDispositivo) => {
    try {
      // 1. Obtener opciones de registro
      const optionsRes = await api.get('biometrico/registro-options');
      const options = optionsRes.data;
      if (!options || typeof options !== 'object') {
        throw new Error("Las opciones de registro recibidas no son válidas");
      }

      // 2. Iniciar registro en el navegador
      console.log("WebAuthn Registro Options:", options);
      
      // Validación profunda
      if (!options.challenge || !options.user || !options.user.id) {
        throw new Error("Datos incompletos para el registro biométrico");
      }

      let attResp;
      try {
        console.log("BAGFM: Intentando registro formato v10+");
        attResp = await startRegistration({ optionsJSON: options });
      } catch (e) {
        console.warn("BAGFM: Fallo formato v10+, intentando v9-", e);
        // Fallback para versiones antiguas
        attResp = await startRegistration(options);
      }

      // 3. Verificar en el backend
      await api.post('biometrico/registro-verify', {
        registration_response: attResp,
        nombre_dispositivo: nombreDispositivo
      });

      return true;
    } catch (error) {
      console.error("Error al registrar dispositivo", error);
      throw error;
    }
  },

  getCredenciales: async () => {
    try {
      const response = await api.get('biometrico/credenciales');
      return response.data;
    } catch (error) {
      console.error("Error al obtener credenciales", error);
      throw error;
    }
  },

  eliminarDispositivo: async (id) => {
    try {
      await api.delete(`biometrico/credenciales/${id}`);
      return true;
    } catch (error) {
      console.error("Error al eliminar dispositivo", error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  updatePerfil: async (datos) => {
    try {
      const response = await api.patch('auth/perfil', datos);
      const updatedUser = response.data;
      
      // Actualizar localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Actualizar estado global
      set({ user: updatedUser });
      return updatedUser;
    } catch (error) {
      console.error("Error al actualizar perfil", error);
      throw error;
    }
  },

  cambiarPassword: async (nueva_password) => {
    try {
      await api.patch('auth/cambiar-password', { nueva_password });
      
      // Si tuvo éxito, quitamos el flag de debe_cambiar_password si lo tenía
      const userString = localStorage.getItem('user');
      if (userString) {
        const user = JSON.parse(userString);
        user.debe_cambiar_password = false;
        localStorage.setItem('user', JSON.stringify(user));
        set({ user });
      }
      return true;
    } catch (error) {
      console.error("Error al cambiar contraseña", error);
      throw error;
    }
  },

  setDebeCambiarPassword: (valor) => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      user.debe_cambiar_password = valor;
      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
    }
  },

  checkSession: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      // 1. Iniciar con datos oxidados rápidos para no bloquear UI
      set({ token, user: JSON.parse(user), isAuthenticated: true, isLoading: false });
      
      // 2. Refrescar silenciosamente en background
      api.get('auth/me').then(res => {
        const freshUser = res.data;
        localStorage.setItem('user', JSON.stringify(freshUser));
        set({ user: freshUser });
      }).catch(err => {
        console.warn("No se pudo refrescar la sesión silente:", err);
      });
    } else {
      set({ isAuthenticated: false, isLoading: false });
    }
  }
}));
