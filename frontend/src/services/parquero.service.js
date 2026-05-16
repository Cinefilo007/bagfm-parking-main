import api from './api';

/**
 * Servicio para operaciones del Parquero.
 */
export const parqueroService = {

    /**
     * Obtiene la zona asignada al parquero con KPIs reales.
     * @returns {{ id, nombre, capacidad_total, usa_puestos_identificados, kpis: { libres, ocupados, reservados, total } }}
     */
    async getMiZona() {
        const { data } = await api.get('/parqueros/mi-zona');
        return data;
    },

    /**
     * Obtiene los puestos físicos de una zona.
     * @param {string} zonaId UUID de la zona.
     */
    async getPuestosZona(zonaId) {
        const { data } = await api.get(`/zonas/${zonaId}/puestos`);
        return data;
    },

    /**
     * Obtiene los vehículos actualmente dentro de la zona.
     * @param {string} zonaId UUID de la zona.
     */
    async getVehiculosEnZona(zonaId) {
        const { data } = await api.get(`/parqueros/zona/${zonaId}/activos`);
        return data;
    },

    /**
     * Registra la llegada de un vehículo a la zona mediante QR.
     * @param {string} qrId UUID del QR escaneado.
     * @param {string} zonaId UUID de la zona del parquero.
     */
    async registrarLlegadaQR(qrId, zonaId, confirmar = true) {
        const { data } = await api.post(`/parqueros/llegada-qr/${qrId}/zona/${zonaId}?confirmar=${confirmar}`);
        return data;
    },

    /**
     * Registra la llegada de un vehículo ingresando la placa manualmente.
     * @param {string} placa Placa del vehículo.
     * @param {string} zonaId UUID de la zona del parquero.
     * @param {object} extras Datos adicionales opcionales (nombre, cedula, telefono, marca, modelo, color)
     * @returns {{ sin_datos: boolean, placa, vehiculo_pase_id?, marca?, modelo?, color? }}
     */
    async registrarLlegadaPlaca(placa, zonaId, extras = {}, confirmar = true) {
        const { data } = await api.post('/parqueros/llegada-placa', { placa, zona_id: zonaId, confirmar, ...extras });
        return data;
    },
    
    /**
     * Confirma el ingreso de un vehículo previamente consultado.
     * @param {string} vehiculoPaseId UUID del VehiculoPase
     * @param {string} zonaId UUID de la zona
     */
    async confirmarIngreso(vehiculoPaseId, zonaId) {
        const { data } = await api.post('/parqueros/confirmar-ingreso', { vehiculo_pase_id: vehiculoPaseId, zona_id: zonaId });
        return data;
    },

    /**
     * Registra la salida de un vehículo mediante escaneo de QR.
     * @param {string} qrId UUID del QR del vehículo.
     */
    async registrarSalidaQR(qrId) {
        const { data } = await api.post(`/parqueros/salida-qr/${qrId}`);
        return data;
    },

    /**
     * Registra la salida de un vehículo ingresando la placa manualmente.
     * @param {string} placa Placa del vehículo.
     * @param {string} zonaId UUID de la zona del parquero.
     */
    async registrarSalidaPlaca(placa, zonaId) {
        const { data } = await api.post('/parqueros/salida-placa', { placa, zona_id: zonaId });
        return data;
    },

    /**
     * Asigna un puesto físico específico al vehículo ya ingresado en la zona.
     * @param {string} vehiculoPaseId UUID del registro de VehiculoPase.
     * @param {string} puestoId UUID del puesto destino.
     */
    async asignarPuesto(vehiculoPaseId, puestoId) {
        const { data } = await api.post(`/parqueros/vehiculo-pase/${vehiculoPaseId}/puesto/${puestoId}`);
        return data;
    },

    /**
     * Obtiene el historial temporal de vehículos de la zona (trazabilidad).
     * @param {string} zonaId UUID de la zona.
     * @param {number} limite Cantidad de elementos a traer.
     * @param {number} skip Elementos a saltar.
     */
    async getTrazabilidadZona(zonaId, limite = 20, skip = 0) {
        const { data } = await api.get(`/parqueros/zona/${zonaId}/trazabilidad`, {
            params: { limite, skip }
        });
        return data;
    },

    /**
     * Guarda los datos faltantes en el CodigoQR (persona y/o vehículo).
     * Se llama cuando el vehículo tiene QR pero le faltan datos.
     * @param {string} qrId UUID del CodigoQR a actualizar.
     * @param {string} vehiculoPaseId UUID del VehiculoPase ya creado.
     * @param {object} datos Datos del portador y del vehículo.
     */
    async completarDatosPortador(qrId, vehiculoPaseId, datos) {
        const { data } = await api.post('/parqueros/completar-datos-portador', {
            qr_id: qrId,
            vehiculo_pase_id: vehiculoPaseId,
            nombre: datos.nombre || null,
            cedula: datos.cedula || null,
            telefono: datos.telefono || null,
            zona_id: datos.zona_id || null,
            placa: datos.placa || null,
            marca: datos.marca || null,
            modelo: datos.modelo || null,
            color: datos.color || null,
        });
        return data;
    },


    /**
     * Actualiza el estado de un puesto físico.
     * @param {string} puestoId UUID del puesto.
     * @param {object} datos { estado, reservado_base, etc. }
     */
    async actualizarPuesto(puestoId, datos) {
        const { data } = await api.patch(`/zonas/puestos/${puestoId}`, datos);
        return data;
    },

    /**
     * Obtiene los vehículos que pasaron por alcabala hace tiempo pero no llegaron a la zona.
     */
    async getVehiculosPerdidos() {
        const { data } = await api.get('/parqueros/perdidos');
        return data;
    },

    /**
     * Envía una foto de placa para análisis IA en background.
     */
    async analizarPlacaAsync(imageBase64, zonaId) {
        const { data } = await api.post('/ia/analizar-placa-async', {
            image_base64: imageBase64,
            zona_id: zonaId,
            tipo_operador: 'parquero'
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

