import api from './api';

const ConfiguracionCorreoService = {
  obtenerMiConfiguracion: async () => {
    try {
      const response = await api.get('/configuracion-correo');
      return response.data;
    } catch (error) {
      console.error('Error obteniendo configuración de correo:', error);
      throw error;
    }
  },

  actualizarMiConfiguracion: async (datos) => {
    try {
      const response = await api.post('/configuracion-correo', datos);
      return response.data;
    } catch (error) {
      console.error('Error actualizando configuración de correo:', error);
      throw error;
    }
  }
};

export default ConfiguracionCorreoService;
