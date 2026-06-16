import api from './api';

/**
 * Servicio para gestión de accesos y alcabalas.
 */
export const alcabalaService = {
  /**
   * Envía el token del QR al backend para su validación.
   * @param {string} qrToken Token JWT del código QR.
   * @param {string} tipo 'entrada' o 'salida'.
   */
  async validarQR(qrToken, tipo) {
    const { data } = await api.post('/accesos/validar', {
      qr_token: qrToken,
      tipo: tipo
    });
    return data;
  },

  /**
   * Busca un vehículo por placa exacta.
   * @param {string} placa Placa a buscar.
   * @param {string} tipo 'entrada' o 'salida'.
   */
  async buscarPorPlaca(placa, tipo) {
    const { data } = await api.get('/accesos/buscar-placa', {
      params: { placa, tipo }
    });
    return data;
  },

  /**
   * Confirma el registro del acceso tras la validación manual del guardia.
   * @param {object} datos Datos para el registro (usuario_id, vehiculo_id, tipo, etc).
   */
  async registrarAcceso(datos) {
    const { data } = await api.post('/accesos/registrar', datos);
    return data;
  },

  /**
   * Obtiene la bitácora de eventos paginada y en tiempo real.
   */
  async getHistorialTactico(page = 1, size = 20, puntoNombre = null) {
    const params = new URLSearchParams({ page, size });
    if (puntoNombre) params.append('punto_nombre', puntoNombre);
    const { data } = await api.get(`/accesos/historial/tactico?${params.toString()}`);
    return data;
  },

  /**
   * Obtiene la situación actual del guardia (Punto asignado, identificación, stats).
   */
  async getMiSituacion() {
    const { data } = await api.get('/comando/mi-situacion');
    return data;
  },

  /**
   * Envía una imagen para extracción de datos vía IA.
   * @param {string} imageBase64 Imagen en base64.
   * @param {string} tipo 'cedula' o 'vehiculo'.
   * @param {object} config Configuración opcional de axios (ej. signal).
   */
  async extraerDatosIA(imageBase64, tipo, config = {}) {
    const { data } = await api.post('/ia/extraer-datos', {
      image_base64: imageBase64,
      tipo: tipo
    }, config);
    return data;
  },

  /**
   * Envía una foto de placa para análisis IA en background.
   */
  async analizarPlacaAsync(imageBase64, zonaId = null, tipoOperador = 'alcabala') {
    const { data } = await api.post('/ia/analizar-placa-async', {
      image_base64: imageBase64,
      zona_id: zonaId,
      tipo_operador: tipoOperador
    });
    return data;
  },

  /**
   * Consulta el resultado de un job de análisis de placa.
   */
  async consultarResultadoPlaca(jobId) {
    const { data } = await api.get(`/ia/resultado-placa/${jobId}`);
    return data;
  }
};

export const infraccionService = {
    /**
     * Obtiene infracciones activas.
     */
    async obtenerActivas() {
        const { data } = await api.get('/infracciones/activas');
        return data;
    },

    /**
     * Registra una nueva infracción (Supervisor/Comando).
     */
    async crear(datos) {
        const { data } = await api.post('/infracciones', datos);
        return data;
    }
}
