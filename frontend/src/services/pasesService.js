/**
 * Servicio de Gestión de Lotes de Pases Masivos (v2).
 */
import api from './api';

export const pasesService = {
  async listarLotes() {
    const res = await api.get('/pases/lotes');
    return res.data;
  },

  async obtenerLote(loteId) {
    const res = await api.get(`/pases/lotes/${loteId}`);
    return res.data;
  },

  async listarPasesLote(loteId) {
    const res = await api.get(`/pases/lotes/${loteId}/pases`);
    return res.data;
  },

  async crearLote(datos) {
    /**
     * @param {Object} datos - { nombre_evento, tipo_pase, fecha_inicio, fecha_fin, cantidad_pases, max_accesos_por_pase }
     */
    const res = await api.post('/pases/lotes', datos);
    return res.data;
  },

  async generarZip(loteId) {
    const res = await api.post(`/pases/lotes/${loteId}/generar-zip`);
    return res.data;
  },

  async importarExcel(loteId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/pases/lotes/${loteId}/importar-excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async importarExcelJson(loteId, data) {
    const res = await api.post(`/pases/lotes/${loteId}/importar-json`, data);
    return res.data;
  },

  async descargarPlantilla() {
    const res = await api.get('/pases/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TEMPLATE_PASES_IDENTIFICADOS.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async registrarInvitado(serial, datos) {
    /**
     * @param {string} serial - Serial legible del lote
     * @param {Object} datos - Ficha del invitado (nombre, apellido, cedula, etc)
     */
    const res = await api.post(`/pases/portal/${serial}/registrar`, datos);
    return res.data;
  },

  async descargarArchivo(url, filename) {
    /**
     * Descarga robusta usando Blob para evitar problemas de CORS/Download attribute.
     */
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error en descarga táctica:', error);
      // Fallback: abrir en nueva pestaña
      window.open(url, '_blank');
    }
  },

  async eliminarLote(id) {
    const res = await api.delete(`/pases/lotes/${id}`);
    return res.data;
  },

  async obtenerLotePublico(serial) {
    const res = await api.get(`/pases/portal/lote/${serial}`);
    return res.data;
  },

  async obtenerPasePublico(token) {
    const res = await api.get(`/pases/portal/pase/${token}`);
    return res.data;
  },

  async completarPasePublico(token, datos) {
    const res = await api.patch(`/pases/portal/pase/${token}`, datos);
    return res.data;
  },

  async obtenerDisponibilidad(zonaId, inicio, fin) {
    const res = await api.get('/pases/lotes/disponibilidad', {
      params: { zona_id: zonaId, inicio, fin }
    });
    return res.data;
  },

  async sugerirDistribucion(cantidad, inicio, fin) {
    const res = await api.get('/pases/lotes/sugerir-distribucion', {
      params: { cantidad, inicio, fin }
    });
    return res.data;
  },

  async validarCapacidad({ zona_id, tipo_acceso, tipo_acceso_custom_id, cantidad, inicio, fin }) {
    const params = { cantidad, inicio, fin };
    if (zona_id) params.zona_id = zona_id;
    if (tipo_acceso) params.tipo_acceso = tipo_acceso;
    if (tipo_acceso_custom_id) params.tipo_acceso_custom_id = tipo_acceso_custom_id;
    const res = await api.get('/pases/lotes/validar-capacidad', { params });
    return res.data;
  },

  async descargarExcelLote(loteId) {
    const res = await api.get(`/pases/lotes/${loteId}/excel`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LISTADO_PASES.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export default pasesService;

