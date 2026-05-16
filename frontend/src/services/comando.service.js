/**
 * Servicio de Comando y Alcabalas.
 * Maneja la gestión de puntos de acceso y el monitoreo de personal.
 */
import api from './api';

export const comandoService = {
  // Puntos de Acceso (Alcabalas)
  async getPuntosAcceso() {
    const res = await api.get('/comando/puntos-acceso');
    return res.data;
  },

  async crearPuntoAcceso(datos) {
    const res = await api.post('/comando/puntos-acceso', datos);
    return res.data;
  },

  async actualizarPuntoAcceso(id, datos) {
    const res = await api.patch(`/comando/puntos-acceso/${id}`, datos);
    return res.data;
  },

  async eliminarPuntoAcceso(id) {
    const res = await api.delete(`/comando/puntos-acceso/${id}`);
    return res.data;
  },

  async regenerarClave(id) {
    const res = await api.post(`/comando/puntos-acceso/${id}/regenerar-clave`);
    return res.data;
  },

  // Monitoreo de Personal (Mando Directo)
  async getPersonalActivo() {
    const res = await api.get('/comando/personal-activo');
    return res.data;
  },

  async getMiSituacion() {
    const res = await api.get('/comando/mi-situacion');
    return res.data;
  },

  // Protocolo de Identificación (Para el Guardia)
  async identificarGuardia(datos) {
    /**
     * @param {Object} datos - { punto_id, grado, nombre, apellido, telefono, unidad }
     */
    const res = await api.post('/comando/identificar-guardia', datos);
    return res.data;
  },

  // Gestión de Salidas (Aegis v2.3)
  async getConfigSalidas() {
    const res = await api.get('/comando/configuracion-salidas');
    return res.data;
  },

  async updateConfigSalidas(datos) {
    const res = await api.patch('/comando/configuracion-salidas', datos);
    return res.data;
  }
};

export default comandoService;
