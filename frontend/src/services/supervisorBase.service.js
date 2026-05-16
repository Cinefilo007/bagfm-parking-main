import api from './api';

/**
 * Servicio del Supervisor de Base (Sentinel Interface).
 * Cubre: censo vehicular, censo personas, pases temporales de seguridad, mapa de infracciones.
 */
export const supervisorBaseService = {

    /**
     * Censo vehicular en tiempo real.
     * @param {Object} params - { estado, zona_id }
     */
    async getCensoVehicular(params = {}) {
        const { data } = await api.get('/supervisor-base/censo-vehicular', { params });
        return data;
    },

    /**
     * Censo de personas consolidado por cédula.
     * @param {Object} params - { busqueda, tipo, alerta }
     */
    async getCensoPersonas(params = {}) {
        const { data } = await api.get('/supervisor-base/censo-personas', { params });
        return data;
    },

    /**
     * Perfil detallado de una persona por cédula.
     */
    async getPerfilPersona(cedula) {
        const { data } = await api.get(`/supervisor-base/censo-personas/${cedula}`);
        return data;
    },

    /**
     * Genera un pase temporal de seguridad (interrogación en campo).
     */
    async generarPaseTemporal(datos) {
        const { data } = await api.post('/supervisor-base/pase-temporal', datos);
        return data;
    },

    /**
     * Registro global de todas las entidades (Personas y Vehículos).
     */
    async getRegistroGlobal(params = {}) {
        const { data } = await api.get('/supervisor-base/registro-global', { params });
        return data;
    },

    /**
     * Infracciones geolocalizadas para el mapa táctico.
     */
    async getInfraccionesMapa(params = {}) {
        const { data } = await api.get('/mapa/infracciones', { params });
        return data;
    },

    /**
     * Obtiene situación táctica (KPIs globales).
     */
    async getSituacion() {
        const { data } = await api.get('/mapa/situacion');
        return data;
    }
};

export default supervisorBaseService;
