import api from './api';

/**
 * Servicio de control de acceso por lectura de placas (ANPR).
 *
 * La ingesta de la cámara no vive aquí: la cámara postea directo al backend sin
 * pasar por el navegador. Esto es solo la parte que opera el guardia.
 */
export const anprService = {
  /** Catálogo de destinos que el guardia ve como botones. */
  async getDestinos() {
    const { data } = await api.get('/anpr/destinos');
    return data;
  },

  /**
   * Detecciones sin resolver del punto de acceso del guardia.
   * El camino normal es el WebSocket; esto repuebla la pantalla tras una recarga
   * o una caída de conexión.
   */
  async getPendientes(limite = 20) {
    const { data } = await api.get('/anpr/pendientes', { params: { limite } });
    return data;
  },

  /** El guardia marca el destino y con eso queda registrado el acceso. */
  async resolver(eventoId, { destinoId, observaciones = null, placaCorregida = null }) {
    const { data } = await api.post(`/anpr/evento/${eventoId}/resolver`, {
      destino_id: destinoId,
      observaciones: observaciones,
      placa_corregida: placaCorregida,
    });
    return data;
  },

  /** Peatón, falso positivo o vehículo que se devolvió sin entrar. */
  async descartar(eventoId) {
    const { data } = await api.post(`/anpr/evento/${eventoId}/descartar`);
    return data;
  },

  async getHistorial({ page = 1, size = 20, placa, estado, puntoAccesoId } = {}) {
    const { data } = await api.get('/anpr/eventos', {
      params: { page, size, placa, estado, punto_acceso_id: puntoAccesoId },
    });
    return data;
  },

  /** Últimas detecciones con ficha completa, para el TV de la alcabala. */
  async getMonitor(limite = 4) {
    const { data } = await api.get('/anpr/monitor', { params: { limite } });
    return data;
  },

  // ── Administración de cámaras (Comandante) ────────────────────────────────

  async getCamaras() {
    const { data } = await api.get('/anpr/camaras');
    return data;
  },

  async getPuntosAcceso() {
    const { data } = await api.get('/anpr/puntos-acceso');
    return data;
  },

  /** Devuelve { camara, token, url_ingesta }. El token solo viaja en claro aquí. */
  async crearCamara(datos) {
    const { data } = await api.post('/anpr/camaras', datos);
    return data;
  },

  async editarCamara(camaraId, cambios) {
    const { data } = await api.patch(`/anpr/camaras/${camaraId}`, cambios);
    return data;
  },

  /** Token nuevo; el anterior deja de servir en el acto. */
  async rotarToken(camaraId) {
    const { data } = await api.post(`/anpr/camaras/${camaraId}/rotar-token`);
    return data;
  },

  async revocarToken(camaraId) {
    const { data } = await api.delete(`/anpr/camaras/${camaraId}/token`);
    return data;
  },

  async eliminarCamara(camaraId) {
    await api.delete(`/anpr/camaras/${camaraId}`);
  },

  // ── Pantallas de garita (TV) ──────────────────────────────────────────────

  async getPantallas() {
    const { data } = await api.get('/anpr/pantallas');
    return data;
  },

  /** Devuelve { pantalla, token, url_monitor }. El token solo viaja en claro aquí. */
  async crearPantalla(datos) {
    const { data } = await api.post('/anpr/pantallas', datos);
    return data;
  },

  async editarPantalla(pantallaId, cambios) {
    const { data } = await api.patch(`/anpr/pantallas/${pantallaId}`, cambios);
    return data;
  },

  async rotarTokenPantalla(pantallaId) {
    const { data } = await api.post(`/anpr/pantallas/${pantallaId}/rotar-token`);
    return data;
  },

  async eliminarPantalla(pantallaId) {
    await api.delete(`/anpr/pantallas/${pantallaId}`);
  },

  /**
   * Descarga una foto de la detección como object URL.
   *
   * No se puede usar la URL directa en un <img>: las fotos se sirven desde un
   * endpoint que exige el JWT en la cabecera, precisamente por ser imágenes de
   * civiles. Quien llame es responsable de hacer URL.revokeObjectURL() al soltarla.
   */
  async getFotoUrl(eventoId, cual = 'placa') {
    const { data } = await api.get(`/anpr/evento/${eventoId}/foto/${cual}`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  },
};
