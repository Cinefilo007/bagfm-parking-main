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

  /**
   * El guardia marca el destino y con eso queda registrado el acceso.
   *
   * En una salida no hay destino que marcar —el vehículo se va— y basta con
   * `sentidoCorregido` o con el sentido que ya trae la detección.
   */
  async resolver(eventoId, {
    destinoId = null,
    observaciones = null,
    placaCorregida = null,
    sentidoCorregido = null,
  }) {
    const { data } = await api.post(`/anpr/evento/${eventoId}/resolver`, {
      destino_entidad_id: destinoId,
      observaciones: observaciones,
      placa_corregida: placaCorregida,
      sentido_corregido: sentidoCorregido,
    });
    return data;
  },

  /** Cambia el tema del monitor de la garita desde el teléfono del guardia. */
  async cambiarTemaPantalla(tema) {
    const { data } = await api.post('/anpr/pantalla/tema', null, { params: { tema } });
    return data;
  },

  /** Asocia un conductor a la placa, alimentando el registro poco a poco. */
  async identificarConductor(eventoId, { nombre, apellido, cedula, telefono = null }) {
    const { data } = await api.post(`/anpr/evento/${eventoId}/identificar`, {
      nombre, apellido, cedula, telefono,
    });
    return data;
  },

  /** Lee una cédula con la IA y devuelve los datos que logró extraer. */
  async leerCedula(imagenBase64) {
    const { data } = await api.post('/ia/extraer-datos', {
      image_base64: imagenBase64,
      tipo: 'cedula',
    });
    return data;
  },

  /** Peatón, falso positivo o vehículo que se devolvió sin entrar. */
  async descartar(eventoId) {
    const { data } = await api.post(`/anpr/evento/${eventoId}/descartar`);
    return data;
  },

  async getHistorial({
    page = 1, size = 20, placa, estado, puntoAccesoId, camaraId, sinDuplicados,
  } = {}) {
    const { data } = await api.get('/anpr/eventos', {
      params: {
        page, size, placa, estado,
        punto_acceso_id: puntoAccesoId,
        camara_id: camaraId,
        sin_duplicados: sinDuplicados,
      },
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

  /**
   * Los POST de cámara que no llegaron a convertirse en una detección.
   *
   * Es lo que se mira al poner una cámara nueva a transmitir: separa "el token está
   * mal" de "la IP está bloqueada" de "el formato de subida no es el que esperamos".
   * Que salga vacío también dice algo, y es lo más importante: al servidor no le está
   * llegando nada, así que el problema está en la cámara o en el camino.
   */
  async getDiagnosticoIngesta(limite = 20) {
    const { data } = await api.get('/anpr/diagnostico-ingesta', { params: { limite } });
    return data;
  },

  /** Vacía la lista, para que lo que aparezca después sea de la prueba en curso. */
  async limpiarDiagnosticoIngesta() {
    const { data } = await api.delete('/anpr/diagnostico-ingesta');
    return data;
  },

  // ── Emparejamiento de pantallas (desde el teléfono del guardia) ───────────

  /** Qué código es y a qué alcabala iría, para mostrarlo antes de confirmar. */
  async consultarEmparejamiento(codigo) {
    const { data } = await api.get(`/anpr/emparejar/${codigo}`);
    return data;
  },

  /** Autoriza el televisor. La pantalla hereda la alcabala de quien confirma. */
  async confirmarEmparejamiento(codigo, nombre = null) {
    const { data } = await api.post(`/anpr/emparejar/${codigo}/confirmar`, { nombre });
    return data;
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
