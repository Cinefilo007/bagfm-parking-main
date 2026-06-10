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
  },

  /**
   * Crea un vehículo individual en el parque automotor (placa + entidad obligatorios).
   */
  async crearVehiculo(datos) {
    const { data } = await api.post('/combustible/vehiculos', datos);
    return data;
  },

  /**
   * Obtiene los KPIs compactos del módulo de combustible para el Dashboard del Comandante.
   */
  async getDashboardKpis() {
    const { data } = await api.get('/combustible/dashboard-kpis');
    return data.data;
  },

  /**
   * Crea un nuevo tanque de combustible.
   */
  async crearTanque(datos) {
    const { data } = await api.post('/combustible/tanques', datos);
    return data;
  },

  /**
   * Edita nombre y/o capacidad máxima de un tanque (cantidad_actual NO editable).
   */
  async editarTanque(id, datos) {
    const { data } = await api.patch(`/combustible/tanques/${id}`, datos);
    return data;
  },

  /**
   * Desactiva un tanque de combustible (soft-delete).
   */
  async eliminarTanque(id) {
    const { data } = await api.delete(`/combustible/tanques/${id}`);
    return data;
  },

  /**
   * Obtiene el historial general de abastecimientos (paginado)
   */
  async obtenerHistorialAbastecimientos(skip = 0, limit = 50) {
    const { data } = await api.get(`/combustible/abastecimientos`, { params: { skip, limit } });
    return data;
  },

  /**
   * Obtiene el historial de los últimos abastecimientos realizados por el bombero
   */
  async obtenerHistorialBombero(limit = 15) {
    const { data } = await api.get(`/combustible/abastecimientos/historial-bombero`, { params: { limit } });
    return data;
  },

  /**
   * Obtiene el estado de apertura y cierre del día para cada tanque.
   */
  async getEstadoDia() {
    const { data } = await api.get('/combustible/tanques/estado-dia');
    return data;
  },

  /**
   * Registra una lectura de apertura o cierre del día para un tanque.
   * tipo_lectura: 'apertura_dia' | 'cierre_dia' | 'recarga_externa' | 'ajuste_auditoria'
   */
  async registrarLecturaDiaria(datos) {
    const { data } = await api.post('/combustible/tanques/lectura-inicial', datos);
    return data;
  },

  /**
   * Obtiene los KPIs del dashboard exclusivo del Supervisor de Bomberos.
   */
  async getDashboardKpisSupervisorBomberos(fecha = null) {
    const params = fecha ? { fecha } : {};
    const { data } = await api.get('/combustible/dashboard-kpis-supervisor', { params });
    return data.data;
  },

  /**
   * Obtiene el historial de cierres diarios.
   */
  async obtenerHistorialCierres(skip = 0, limit = 10) {
    const { data } = await api.get('/combustible/cierres', { params: { skip, limit } });
    return data;
  },

  /**
   * Obtiene la información histórica de un cierre para volver a generar el PDF.
   */
  async obtenerReporteCierreData(id) {
    const { data } = await api.get(`/combustible/cierres/${id}/reporte-data`);
    return data.data;
  },

  /**
   * Obtiene datos de cierre enriquecidos con URLs firmadas (JWT 72h) de foto de surtidor
   * por cada abastecimiento del día. Usado para generar el PDF con hipervínculos de auditoría.
   */
  async obtenerReporteCierreConFotos(id) {
    const { data } = await api.get(`/combustible/cierres/${id}/reporte-con-fotos`);
    return data.data;
  },

  /**
   * Obtiene el detalle completo de un abastecimiento por su ID (incluye fotos base64)
   */
  async obtenerDetalleAbastecimiento(id) {
    const { data } = await api.get(`/combustible/abastecimientos/${id}`);
    return data.data;
  },

  /**
   * Registra un abastecimiento excepcional retroactivo vinculándolo a la fecha de un cierre.
   */
  async registrarAbastecimientoExcepcional(datos) {
    const { data } = await api.post('/combustible/abastecer-excepcional', datos);
    return data;
  },

  /**
   * Edita la cantidad abastecida (litros) y otros datos de un suministro existente.
   */
  async editarAbastecimientoLitraje(id, datos) {
    const { data } = await api.patch(`/combustible/abastecimientos/${id}/editar-litraje`, datos);
    return data;
  },
};
