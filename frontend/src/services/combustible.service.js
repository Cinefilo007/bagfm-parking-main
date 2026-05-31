import api from './api';

/**
 * Servicio para gestión del módulo de combustible (Aegis Fuel).
 */
export const combustibleService = {
  /**
   * Consulta el estado de autorización de un vehículo para abastecer.
   */
  async consultarVehiculo(placa) {
    const { data } = await api.get(`/combustible/vehiculo/${placa}`);
    return data.data;
  },

  /**
   * Registra un suministro de combustible en litros.
   */
  async registrarAbastecimiento(datos) {
    const { data } = await api.post('/combustible/abastecer', datos);
    return data;
  },

  /**
   * Eleva una solicitud de abastecimiento de emergencia.
   */
  async registrarSolicitud(datos) {
    const { data } = await api.post('/combustible/solicitudes', datos);
    return data;
  },

  /**
   * Obtiene las solicitudes activas de emergencia creadas por el bombero actual.
   */
  async getSolicitudesBombero() {
    const { data } = await api.get('/combustible/solicitudes/bombero');
    return data.data;
  },

  /**
   * Obtiene las solicitudes de emergencia pendientes globales (Comandante/Admin Base).
   */
  async getSolicitudesPendientes() {
    const { data } = await api.get('/combustible/solicitudes/pendientes');
    return data.data;
  },

  /**
   * Resuelve una solicitud (Aprobar/Rechazar) con asignación opcional de entidad.
   */
  async resolverSolicitud(id, estado, entidadId = null) {
    const { data } = await api.post(`/combustible/solicitudes/${id}/resolver`, {
      estado,
      entidad_id: entidadId
    });
    return data;
  },

  /**
   * Consulta rápida del estado de una solicitud para el bombero.
   */
  async getEstadoSolicitud(id) {
    const { data } = await api.get(`/combustible/solicitudes/${id}/estado`);
    return data;
  },

  /**
   * Obtiene la lista de tanques y su inventario actual.
   */
  async getTanques() {
    const { data } = await api.get('/combustible/tanques');
    return data;
  },

  /**
   * Registra la lectura inicial declarada de un tanque.
   */
  async registrarLecturaInicial(datos) {
    const { data } = await api.post('/combustible/tanques/lectura-inicial', datos);
    return data;
  },

  /**
   * Sube la plantilla de Excel para importar el parque automotor.
   */
  async importarExcelParque(formData, entidadId) {
    const { data } = await api.post(`/combustible/importar-excel?entidad_id=${entidadId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return data;
  },

  /**
   * Obtiene los reportes consolidados de consumo.
   */
  async getReportes(params = {}) {
    const { data } = await api.get('/combustible/reportes', { params });
    return data.data;
  },

  /**
   * Obtiene los vehículos de la base vinculados a combustible.
   */
  async getVehiculosParque(params = {}) {
    const { data } = await api.get('/combustible/vehiculos', { params });
    return data.data;
  },

  /**
   * Actualiza los parámetros de combustible de un vehículo (autorización, cuota, tipo de uso, etc).
   */
  async actualizarVehiculoCombustible(id, datos) {
    const { data } = await api.patch(`/combustible/vehiculos/${id}`, datos);
    return data;
  },

  /**
   * Descarga la plantilla de Excel para importar la flota vehicular.
   */
  async descargarPlantilla() {
    const { data } = await api.get('/combustible/template', {
      responseType: 'blob'
    });
    return data;
  }
};
