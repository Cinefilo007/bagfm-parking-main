/**
 * Utilidades de geometría táctica para BAGFM
 */

/**
 * Calcula el área de un polígono en metros cuadrados.
 * Implementa la fórmula Shoelace proyectada para pequeñas distancias.
 * @param {Array} coordinates - Array de pares [lat, lng]
 * @returns {number} Área en m²
 */
export const calculatePolygonArea = (coordinates) => {
    if (!coordinates || coordinates.length < 3) return 0;

    const radius = 6378137; // Radio de la Tierra en metros
    let area = 0;

    for (let i = 0; i < coordinates.length; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[(i + 1) % coordinates.length];

        // Convertir grados a radianes
        const lat1 = p1[0] * Math.PI / 180;
        const lon1 = p1[1] * Math.PI / 180;
        const lat2 = p2[0] * Math.PI / 180;
        const lon2 = p2[1] * Math.PI / 180;

        // Proyección simple para áreas pequeñas
        area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    area = Math.abs(area * radius * radius / 2.0);
    return area;
};

export const STANDARDS = {
    SPOT_WIDTH: 2.5,   // metros
    SPOT_DEPTH: 5.0,   // metros
    AISLE_WIDTH: 6.0,  // metros (circulación doble sentido)
    MIN_EFFICIENCY: 0.65
};

/**
 * Calcula la distancia entre dos puntos en metros (Haversine).
 */
export const getDistanceMeters = (p1, p2) => {
    const R = 6371e3; // Radio de la Tierra
    const phi1 = p1[0] * Math.PI / 180;
    const phi2 = p2[0] * Math.PI / 180;
    const deltaPhi = (p2[0] - p1[0]) * Math.PI / 180;
    const deltaLambda = (p2[1] - p1[1]) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Estima la capacidad de vehículos considerando áreas de circulación.
 */
export const estimateCapacity = (areaM2, efficiencyFactor = STANDARDS.MIN_EFFICIENCY, spacePerVehicle = 12.5) => {
    if (!areaM2 || areaM2 <= 0) return 0;
    const usableArea = areaM2 * efficiencyFactor;
    return Math.floor(usableArea / spacePerVehicle);
};

/**
 * Calcula el ángulo del borde más largo del polígono para alinear la grilla.
 */
export const getPolygonOrientation = (points) => {
    if (!points || points.length < 2) return 0;
    let maxDist = 0;
    let angle = 0;

    // Usamos el primer punto como referencia para la proyección local
    const origin = points[0];
    const latRad = origin[0] * Math.PI / 180;
    const METERS_PER_DEG_LAT = 111320;
    const METERS_PER_DEG_LNG = 111320 * Math.cos(latRad);

    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        // Proyectar a metros
        const dy = (p2[0] - p1[0]) * METERS_PER_DEG_LAT;
        const dx = (p2[1] - p1[1]) * METERS_PER_DEG_LNG;
        
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDist) {
            maxDist = d;
            angle = Math.atan2(dy, dx); // Ángulo en espacio métrico
        }
    }
    return angle;
};

/**
 * Rotar un punto en espacio de grados, pero respetando la proporción métrica.
 */
export const rotatePoint = (point, origin, angle) => {
    const latRad = origin[0] * Math.PI / 180;
    const METERS_PER_DEG_LAT = 111320;
    const METERS_PER_DEG_LNG = 111320 * Math.cos(latRad);

    // 1. Proyectar a metros relativos al origen
    const y = (point[0] - origin[0]) * METERS_PER_DEG_LAT;
    const x = (point[1] - origin[1]) * METERS_PER_DEG_LNG;

    // 2. Rotar en espacio métrico (Cartesiano estándar)
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const nx = x * cos - y * sin;
    const ny = x * sin + y * cos;

    // 3. Desproyectar a grados
    return [
        origin[0] + (ny / METERS_PER_DEG_LAT),
        origin[1] + (nx / METERS_PER_DEG_LNG)
    ];
};

/**
 * Verifica si un punto está dentro de un polígono (Ray Casting Algorithm).
 */
export const isPointInPolygon = (point, polygon) => {
    const x = point[1], y = point[0]; // [lat, lng] -> y=lat, x=lng
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][1], yi = polygon[i][0];
        const xj = polygon[j][1], yj = polygon[j][0];
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};
