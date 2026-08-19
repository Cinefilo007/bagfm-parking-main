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

  detalle: async (id, { pagina = 1, porPagina = 10, buscar = '' } = {}) => {
    const res = await api.get(`/dormitorios/${id}`, {
      params: { pagina, por_pagina: porPagina, buscar },
    });
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

  // Consultar NO cambia el QR: el adhesivo pegado en la puerta sigue valiendo. Solo
  // `regenerarQrHabitacion` emite uno nuevo y anula el impreso.
  qrHabitacion: async (habitacionId) => {
    const res = await api.get(`/dormitorios/habitaciones/${habitacionId}/qr`);
    return res.data;
  },

  regenerarQrHabitacion: async (habitacionId) => {
    const res = await api.post(`/dormitorios/habitaciones/${habitacionId}/qr/regenerar`);
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

  // Igual que el de la puerta: consultarlo devuelve el carnet que ya tiene la persona.
  qrPeatonal: async (usuarioId) => {
    const res = await api.get(`/dormitorios/integrantes/${usuarioId}/qr-peatonal`);
    return res.data;
  },

  regenerarQrPeatonal: async (usuarioId) => {
    const res = await api.post(`/dormitorios/integrantes/${usuarioId}/qr-peatonal/regenerar`);
    return res.data;
  },

  // ─── Búsquedas del formulario de alta ──────────────────────────────────────

  buscarPersonas: async (q) => {
    const res = await api.get('/dormitorios/personas/buscar', { params: { q } });
    return res.data;
  },

  buscarJefes: async (q) => {
    const res = await api.get('/dormitorios/jefes/buscar', { params: { q } });
    return res.data;
  },

  listarUnidades: async () => {
    const res = await api.get('/dormitorios/unidades');
    return res.data;
  },

  // `usuarioId` es la persona que se está dando de alta, cuando ya existe: sirve para
  // que su propio vehículo no salga marcado como placa ajena.
  buscarVehiculos: async (placa, usuarioId = null) => {
    const res = await api.get('/dormitorios/vehiculos/buscar', {
      params: usuarioId ? { placa, usuario_id: usuarioId } : { placa },
    });
    return res.data;
  },

  vincularVehiculo: async (usuarioId, datos) => {
    const res = await api.post(`/dormitorios/integrantes/${usuarioId}/vehiculo`, datos);
    return res.data;
  },

  // ─── Público (sin sesión) ──────────────────────────────────────────────────

  fichaPublica: async (token) => {
    const res = await api.get(`/dormitorios/publico/habitacion/${token}`);
    return res.data;
  },
};

export default dormitoriosService;
