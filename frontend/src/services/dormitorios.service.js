import api from './api';

// baseURL ya incluye /api/v1, no duplicar.
//
// La ficha pública se pide con la misma instancia a propósito: el interceptor solo
// añade la cabecera Authorization si hay token en localStorage, así que desde el
// teléfono de quien escanea el QR de la puerta la petición sale limpia.
export const dormitoriosService = {
  listar: async (incluirInactivos = false) => {
    const res = await api.get('/dormitorios', { params: { incluir_inactivos: incluirInactivos } });
    return res.data;
  },

  detalle: async (id) => {
    const res = await api.get(`/dormitorios/${id}`);
    return res.data;
  },

  crear: async (datos) => {
    const res = await api.post('/dormitorios', datos);
    return res.data;
  },

  editar: async (id, datos) => {
    const res = await api.patch(`/dormitorios/${id}`, datos);
    return res.data;
  },

  desactivar: async (id) => {
    await api.delete(`/dormitorios/${id}`);
  },

  // ─── Habitaciones ──────────────────────────────────────────────────────────

  crearHabitacion: async (dormitorioId, datos) => {
    const res = await api.post(`/dormitorios/${dormitorioId}/habitaciones`, datos);
    return res.data;
  },

  editarHabitacion: async (habitacionId, datos) => {
    const res = await api.patch(`/dormitorios/habitaciones/${habitacionId}`, datos);
    return res.data;
  },

  desactivarHabitacion: async (habitacionId) => {
    await api.delete(`/dormitorios/habitaciones/${habitacionId}`);
  },

  // Devuelve el token en claro una sola vez: si se pierde, hay que rotarlo.
  generarQrHabitacion: async (habitacionId) => {
    const res = await api.post(`/dormitorios/habitaciones/${habitacionId}/qr`);
    return res.data;
  },

  revocarQrHabitacion: async (habitacionId) => {
    const res = await api.delete(`/dormitorios/habitaciones/${habitacionId}/qr`);
    return res.data;
  },

  // ─── Integrantes ───────────────────────────────────────────────────────────

  buscarIntegrantes: async (q = '', sinHabitacion = false) => {
    const res = await api.get('/dormitorios/integrantes/buscar', {
      params: { q, sin_habitacion: sinHabitacion },
    });
    return res.data;
  },

  crearIntegrante: async (datos) => {
    const res = await api.post('/dormitorios/integrantes', datos);
    return res.data;
  },

  editarIntegrante: async (usuarioId, datos) => {
    const res = await api.patch(`/dormitorios/integrantes/${usuarioId}`, datos);
    return res.data;
  },

  asignarHabitacion: async (habitacionId, usuarioId) => {
    const res = await api.post(`/dormitorios/habitaciones/${habitacionId}/integrantes/${usuarioId}`);
    return res.data;
  },

  desasignarHabitacion: async (usuarioId) => {
    const res = await api.delete(`/dormitorios/integrantes/${usuarioId}/habitacion`);
    return res.data;
  },

  generarQrPeatonal: async (usuarioId) => {
    const res = await api.post(`/dormitorios/integrantes/${usuarioId}/qr-peatonal`);
    return res.data;
  },

  // ─── Público (sin sesión) ──────────────────────────────────────────────────

  fichaPublica: async (token) => {
    const res = await api.get(`/dormitorios/publico/habitacion/${token}`);
    return res.data;
  },
};

export default dormitoriosService;
