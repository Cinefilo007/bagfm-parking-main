import api from './api';

/**
 * Servicio para la gestión de Entidades Civiles.
 */
export const entidadService = {
    /**
     * Obtiene los detalles de una entidad por su ID.
     */
    async obtenerEntidad(id) {
        const { data } = await api.get(`/entidades/${id}`);
        return data;
    },

    /**
     * Lista todas las entidades.
     */
    async listarEntidades(params = {}) {
        const { data } = await api.get('/entidades', { params });
        return data;
    },

    /**
     * Actualiza los datos de una entidad.
     */
    async actualizarEntidad(id, datos) {
        const { data } = await api.put(`/entidades/${id}`, datos);
        return data;
    },

    /**
     * Actualiza la configuración de marca (branding) de una entidad.
     * @param {string} id - UUID de la entidad
     * @param {Object} branding - Objeto JSON con la configuración de presets (general, staff, etc.)
     */
    async actualizarBranding(id, branding) {
        const { data } = await api.patch(`/entidades/${id}/branding`, branding);
        return data;
    }
};

export default entidadService;
