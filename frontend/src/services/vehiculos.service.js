import api from './api';

/**
 * Saneamiento del registro de vehículos.
 *
 * La misma placa quedó cargada varias veces con formatos distintos, y eso parte el
 * historial de un carro entre varias fichas.
 */
export const vehiculosService = {
  /** Grupos de fichas que comparten placa, con el detalle de uso de cada una. */
  async getDuplicados() {
    const { data } = await api.get('/vehiculos/duplicados');
    return data;
  },

  /**
   * Mueve el historial de una ficha a otra y elimina la sobrante.
   *
   * Es la única forma de eliminar un duplicado sin perder datos: la base impide
   * borrar una ficha con abastecimientos, accesos, infracciones, membresías o
   * códigos QR colgando de ella.
   */
  async fusionar(idAEliminar, idAConservar) {
    const { data } = await api.post(`/vehiculos/${idAEliminar}/fusionar-en/${idAConservar}`);
    return data;
  },
};
