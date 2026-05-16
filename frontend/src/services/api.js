import axios from 'axios';

// API Service — Aegis Tactical v3 [Fix: Proxy Trust & Trailing Slash]
// Last Sync: 2026-04-18T23:33:00-04:00

// Axios Instance Configuration
const getBaseURL = () => {
  // 1. Obtener URL desde variables de entorno o fallback seguro
  let url = import.meta.env.VITE_API_URL || 'https://api.bagfm.app/api/v1';
  
  // 2. Normalización básica
  url = url.trim();

  // 3. AGRESSIVE HTTPS: Force HTTPS matches the current site protocol
  // Si entramos por HTTPS (Producción), forzamos que la API sea HTTPS.
  const isHttps = window.location.protocol === 'https:';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isHttps && !isLocal) {
    if (url.startsWith('http:')) {
      url = url.replace('http:', 'https:');
    } else if (!url.startsWith('https:')) {
      url = 'https://' + url.replace(/^\/+/, '');
    }
  }
  
  return url;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Inyectar token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Manejo global de expiración de sesión u otros errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el error es 401 Unauthorized y no estamos en la página de login
    if (error.response && error.response.status === 401) {
      // Intentar detectar si es la petición de login para NO refrescar
      const url = error.config.url || '';
      const isLoginRequest = url.includes('auth/login');
      
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
