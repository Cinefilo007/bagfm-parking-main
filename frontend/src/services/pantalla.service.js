import axios from 'axios';

/**
 * Cliente de la pantalla de garita.
 *
 * Va aparte del `api` normal a propósito: aquel inyecta el JWT de la persona que
 * inició sesión, y la pantalla no tiene persona detrás. Usa su propio token de
 * dispositivo, que solo sirve para leer el monitor de su alcabala.
 *
 * El token se guarda en una clave distinta de la sesión de usuario para que abrir
 * el monitor en un navegador donde alguien está logueado no pise su sesión.
 */
const CLAVE_TOKEN = 'pantalla_token';

const baseURL = () => {
  const url = import.meta.env.VITE_API_URL || 'https://api.bagfm.app/api/v1';
  return url.trim();
};

export const pantallaToken = {
  /**
   * El token llega la primera vez en la URL (?t=...) y de ahí queda guardado, para
   * que el televisor siga funcionando tras un corte de luz aunque arranque en la
   * página sin parámetros.
   */
  capturarDeUrl() {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('t');
    if (t) {
      localStorage.setItem(CLAVE_TOKEN, t);
      // Se limpia de la barra de direcciones para que el token no quede a la vista
      // ni en el historial del navegador del televisor.
      window.history.replaceState({}, '', window.location.pathname);
      return t;
    }
    return localStorage.getItem(CLAVE_TOKEN);
  },

  obtener() {
    return localStorage.getItem(CLAVE_TOKEN);
  },

  /** Guarda la credencial recién obtenida por emparejamiento. */
  guardar(token) {
    localStorage.setItem(CLAVE_TOKEN, token);
  },

  borrar() {
    localStorage.removeItem(CLAVE_TOKEN);
  },
};

export const pantallaService = {
  /**
   * El televisor pide un código para que lo autoricen. No necesita sesión: todavía
   * no tiene ninguna.
   */
  async iniciarEmparejamiento() {
    const { data } = await axios.post(`${baseURL()}/anpr/pantalla/emparejar`);
    return data;
  },

  /** Pregunta si el guardia ya confirmó. Devuelve el token cuando pasa a confirmado. */
  async estadoEmparejamiento(secreto) {
    const { data } = await axios.get(`${baseURL()}/anpr/pantalla/emparejar/estado`, {
      params: { secreto },
    });
    return data;
  },

  /** Últimas detecciones de la alcabala de esta pantalla. */
  async getMonitor(token, limite = 4) {
    const { data } = await axios.get(`${baseURL()}/anpr/pantalla/monitor`, {
      params: { limite },
      headers: { 'X-Pantalla-Token': token },
    });
    return data;
  },

  /**
   * URL de una foto. Lleva el token en la query porque un <img> no puede mandar
   * cabeceras; quien la use debe descargarla con fetch y liberar el object URL.
   */
  urlFoto(eventoId, cual, token) {
    return `${baseURL()}/anpr/pantalla/foto/${eventoId}/${cual}?token=${encodeURIComponent(token)}`;
  },

  /** WebSocket de la alcabala de esta pantalla. */
  urlWebSocket(token) {
    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = baseURL().replace(/^https?:\/\//, '').split('/')[0];
    return `${protocolo}//${host}/api/v1/ws?pantalla=${encodeURIComponent(token)}`;
  },
};
