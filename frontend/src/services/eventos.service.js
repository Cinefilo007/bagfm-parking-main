/**
 * Servicio de Eventos y Pases Masivos.
 */
import api from './api';

export const eventosService = {
  async getSolicitudes() {
    const res = await api.get('/eventos/solicitudes');
    return res.data;
  },

  async getStats() {
    const res = await api.get('/eventos/stats');
    return res.data;
  },

  async crearSolicitud(datos) {
    /**
     * @param {Object} datos - { nombre_evento, fecha_evento, cantidad_solicitada, motivo, entidad_id }
     */
    const res = await api.post('/eventos/solicitudes', datos);
    return res.data;
  },

  async procesarSolicitud(solicitudId, datos) {
    /**
     * @param {Object} datos - { cantidad_aprobada, estado, motivo_rechazo }
     */
    const res = await api.post(`/eventos/solicitudes/${solicitudId}/procesar`, datos);
    return res.data;
  },

  async getQrsEvento(solicitudId) {
    const res = await api.get(`/eventos/solicitudes/${solicitudId}/qrs`);
    return res.data;
  }
};

export default eventosService;
