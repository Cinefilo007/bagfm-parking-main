# DIRECTIVA-013: GESTIÓN DE ZONAS TÁCTICAS Y ESTACIONAMIENTOS

## 1. PROPÓSITO
Estandarizar la creación, configuración y georreferenciación de las zonas de estacionamiento en la Base Aérea, asegurando la integridad de los datos de capacidad y tiempos de respuesta.

## 2. ESPECIFICACIONES TÉCNICAS
### 2.1 Campos Obligatorios
- **Nombre**: Identificador único de la zona (ej: "ZONA VIP SUR").
- **Capacidad Total**: Número máximo de vehículos permitidos (lógico y físico).
- **Tiempo Límite Llegada**: Minutos máximos para que un vehículo llegue tras el escaneo en alcabala (Default: 15min).

### 2.2 Georreferenciación
- Cada zona debe tener coordenadas (Lat/Lon) centrales.
- Los puestos individuales pueden heredar la posición de la zona o tener una captura GPS específica mediante el dispositivo móvil del parquero o supervisor.

## 3. ASIGNACIÓN DE CUPOS (COPO)
- Las zonas pertenecen a la Base (Comando).
- El Comando asigna "Asignaciones de Zona" a Entidades Civiles.
- **Protocolo de Integridad (v3.1)**: La asignación de cupos sigue una lógica de *Upsert*. Si una entidad ya tiene una asignación activa en una zona, cualquier nueva asignación sobre la misma zona actualizará los valores existentes (cupo, notas, etc.) en lugar de duplicar el registro.
- Cada asignación puede subdividirse en cupos para la entidad y "Cupos Reservados Base" (uso exclusivo del Comando dentro de esa zona).

## 4. PROTOCOLO DE ERROR (PAYLOAD)
- Los errores de validación (422) deben ser capturados y formateados en el frontend para mostrar la ubicación exacta del fallo (campo y razón) al usuario administrador.
- No se permiten valores `NaN` en las peticiones de actualización de capacidad o coordenadas.

## 5. SEGURIDAD Y ROLES
- Solo **COMANDANTE** y **ADMIN_BASE** pueden crear o eliminar zonas físicamente.
- Los **ADMIN_ENTIDAD** solo pueden visualizar la disponibilidad y gestionar sus propios cupos asignados.
