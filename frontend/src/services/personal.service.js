/**
 * personal.service.js — Servicio frontend para el módulo de Fuerza de Tareas.
 * Gestiona personal operativo: listado, edición, zonas, KPIs, incentivos y sanciones.
 */
import api from './api';

const personalService = {

  // ─── OPERATIVOS ─────────────────────────────────────────────────────────────

  listar: async ({ skip = 0, limit = 10, search = '' } = {}) => {
    const { data } = await api.get(`/personal/lista?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search)}`);
    return data;
  },

  crear: async (payload) => {
    const { data } = await api.post('/personal/', payload);
    return data;
  },

  actualizar: async (id, payload) => {
    const { data } = await api.patch(`/personal/${id}`, payload);
    return data;
  },

  toggleActivo: async (id) => {
    const { data } = await api.post(`/personal/${id}/toggle`);
    return data;
  },

  eliminar: async (id) => {
    const { data } = await api.delete(`/personal/${id}`);
    return data;
  },

  // ─── ZONA ────────────────────────────────────────────────────────────────────

  asignarZona: async (parqueroId, zonaId) => {
    // zonaId puede ser null para desasignar
    const params = zonaId ? `?zona_id=${zonaId}` : '';
    const { data } = await api.post(`/personal/${parqueroId}/zona${params}`);
    return data;
  },

  // ─── KPIs ────────────────────────────────────────────────────────────────────

  obtenerKpis: async (id) => {
    const { data } = await api.get(`/personal/${id}/kpis`);
    return data;
  },

  // ─── INCENTIVOS ──────────────────────────────────────────────────────────────

  listarIncentivos: async (parqueroId) => {
    const { data } = await api.get(`/personal/${parqueroId}/incentivos`);
    return data;
  },

  agregarIncentivo: async (parqueroId, payload) => {
    const { data } = await api.post(`/personal/${parqueroId}/incentivos`, payload);
    return data;
  },

  eliminarIncentivo: async (incentivoId) => {
    await api.delete(`/personal/incentivos/${incentivoId}`);
  },

  // ─── SANCIONES ───────────────────────────────────────────────────────────────

  listarSanciones: async (parqueroId) => {
    const { data } = await api.get(`/personal/${parqueroId}/sanciones`);
    return data;
  },

  agregarSancion: async (parqueroId, payload) => {
    const { data } = await api.post(`/personal/${parqueroId}/sanciones`, payload);
    return data;
  },

  actualizarSancion: async (sancionId, payload) => {
    const { data } = await api.patch(`/personal/sanciones/${sancionId}`, payload);
    return data;
  },

  eliminarSancion: async (sancionId) => {
    await api.delete(`/personal/sanciones/${sancionId}`);
  },
};

export default personalService;
