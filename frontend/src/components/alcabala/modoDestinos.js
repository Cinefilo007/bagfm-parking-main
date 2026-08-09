/**
 * Preferencia de cómo se muestran los destinos en la pantalla de Puerta.
 *
 * Vive en su propio archivo y no junto al selector porque mezclar funciones sueltas
 * con componentes en el mismo módulo rompe la recarga en caliente del desarrollo — el
 * mismo motivo por el que `useTour` está separado de `TourGuiado`.
 *
 * Se guarda en el teléfono y no en la cuenta: la misma cuenta de alcabala la usan
 * guardias distintos en cada relevo, pero el aparato de la garita suele ser el mismo.
 */

export const MODO_BOTONERA = 'botonera';
export const MODO_LISTA = 'lista';
export const CLAVE_MODO = 'alcabala_modo_destinos';

export const leerModoDestinos = () => {
  try {
    return localStorage.getItem(CLAVE_MODO) === MODO_LISTA ? MODO_LISTA : MODO_BOTONERA;
  } catch {
    // Navegador con el almacenamiento bloqueado: se trabaja con el modo por defecto.
    return MODO_BOTONERA;
  }
};

export const guardarModoDestinos = (modo) => {
  try {
    localStorage.setItem(CLAVE_MODO, modo);
  } catch {
    /* Sin almacenamiento el modo dura lo que la sesión; no es motivo para fallar. */
  }
};
