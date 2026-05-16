import api from './api';

/**
 * Servicio del Supervisor de Parqueros.
 * Cubre: dashboard, broadcast, reasignación, fantasmas, infracciones leves.
 */
export const supervisorParquerosService = {

    /**
     * Dashboard completo del supervisor: zonas a cargo, vehículos, métricas.
     */
    async getDashboard() {
        const { data } = await api.get('/supervisor-parqueros/dashboard');
        return data;
    },

    /**
     * Lista de vehículos fantasma con nivel de escalamiento para las zonas.
     */
    async getFantasmas() {
        const { data } = await api.get('/infracciones/fantasmas');
        return data;
    },

    /**
     * Marca un vehículo fantasma como "llegó" (resuelto manualmente).
     */
    async resolverFantasma(vehiculoPaseId) {
        const { data } = await api.post(`/parqueros/vehiculo-pase/${vehiculoPaseId}/confirmar-llegada`);
        return data;
    },

    /**
     * Emite una orden de búsqueda (Comandante / Admin Base).
     */
    async emitirOrdenBusqueda(vehiculoId, datos) {
        const { data } = await api.post(`/infracciones/fantasmas/${vehiculoId}/orden-busqueda`, datos);
        return data;
    },

    /**
     * Reasigna a un parquero a una zona diferente.
     */
    async reasignarParquero(parqueroId, nuevaZonaId) {
        const { data } = await api.post(`/supervisor-parqueros/reasignar`, {
            parquero_id: parqueroId,
            zona_id: nuevaZonaId,
        });
        return data;
    },

    /**
     * Envía un mensaje broadcast a todos los parqueros activos.
     */
    async enviarBroadcast(mensaje, prioridad = 'normal') {
        const { data } = await api.post('/supervisor-parqueros/broadcast', { mensaje, prioridad });
        return data;
    },

    /**
     * Lista los parqueros activos en turno.
     */
    async getParquerosActivos() {
        const { data } = await api.get('/supervisor-parqueros/parqueros-activos');
        return data;
    },

    /**
     * Lista infracciones leves pendientes de resolver (del ámbito del supervisor).
     */
    async getInfraccionesLeves() {
        const { data } = await api.get('/infracciones/?gravedad=leve&estado=activa');
        return data;
    },

    /**
     * Resuelve una infracción leve.
     */
    async resolverInfraccion(infraccionId, accion = 'resolver', notas = '') {
        const { data } = await api.put(`/infracciones/${infraccionId}/resolver`, {
            accion,
            notas_resolucion: notas,
        });
        return data;
    },
};

export default supervisorParquerosService;
