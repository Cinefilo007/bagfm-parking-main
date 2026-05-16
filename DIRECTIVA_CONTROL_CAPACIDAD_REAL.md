# DIRECTIVA-016: CONTROL DE CAPACIDAD Y MONITOREO EN TIEMPO REAL

## 1. PROPÓSITO
Garantizar que la ocupación de los estacionamientos asignados a las entidades no supere su capacidad física/lógica, alertando al personal de alcabala y activando protocolos de contingencia cuando se alcance el límite.

## 2. LÓGICA DE VALIDACIÓN EN ALCABALA
### 2.1 Cálculo de Ocupación Real
La ocupación de una entidad en una zona se calcula sumando:
- Vehículos de socios permanentes de la entidad con estado "DENTRO" (Acceso entrada activo).
- Vehículos con pases masivos de la entidad con estado "DENTRO".
- Vehículos registrados manualmente asociados a la entidad con estado "DENTRO".

### 2.2 Alerta Roja (Bloqueo Sugerido)
Si un vehículo intenta ingresar y la ocupación actual de su entidad/zona es **>= cupo_asignado**:
1. El sistema debe retornar un estado `alerta_capacidad: CRÍTICA`.
2. El frontend de Alcabala mostrará un modal rojo con el mensaje: **"CAPACIDAD MÁXIMA ALCANZADA: [Nombre Entidad] - [Cupo]/[Capacidad]"**.
3. El guardia deberá consultar al Administrador de la Entidad o seguir el protocolo de "Excepción" si se le autoriza.

## 3. MONITOREO Y NOTIFICACIONES PUSH
### 3.1 Tarea de Fondo (Monitor de Saturación)
El sistema ejecutará un proceso en segundo plano cada 5 minutos que:
- Evaluará el % de ocupación de todas las asignaciones de zona activas.
- Si la ocupación es **>= 90%**: Envía notificación "Aviso de Saturación" a Parqueros.
- Si la ocupación es **>= 100%**: Envía notificación "CAPACIDAD ALCANZADA" a Admin Entidad y Parqueros.

### 3.2 Notificación Push de "Jornada Finalizada"
Si un vehículo ha superado el tiempo promedio de estancia (configurable o default 4h) y el estacionamiento está lleno, se enviará una alerta al parquero para verificar si el vehículo ya terminó su jornada y debe salir.

## 4. PROTOCOLO ANTI-FRAUDE (SALIDAS FALSAS)
Para evitar que los parqueros marquen salidas ficticias para "liberar cupo":
1. **Validación de GPS**: El parquero solo puede marcar la salida si su posición GPS está dentro del radio de la zona asignada.
    - **Algoritmo**: Haversine (Distancia entre dos puntos en una esfera).
    - **Radio de Cobertura**: Configurable por zona (campo `radio_cobertura`, default 100m).
    - **Validación**: Si la distancia calculada > radio, el sistema lanza `ValueError("ERROR ANTI-FRAUDE...")`.
2. **Registro de Evidencia (Opcional)**: En fases futuras, se podrá requerir captura fotográfica de la placa al momento de la salida.
3. **Log de Auditoría**: Se registrará un evento de "Salida Sincronizada" si `sync_parquero` está activo, permitiendo trazabilidad centralizada.

## 5. DETALLES DE IMPLEMENTACIÓN (SOP)
- `ZonaEstacionamientoService.obtener_ocupacion_real_entidad`: Calcula ocupación filtrando `Acceso` donde `tipo='entrada'` y no existe un `tipo='salida'` posterior para el mismo QR/Vehículo.
- `CronService.monitorear_saturacion_estacionamientos`: Tarea cíclica que recorre `AsignacionZona` y dispara alertas WebSocket (Comandancia) y Push (Parqueros/Admins).
- `ParqueroService._validar_proximidad_zona`: Método helper que encapsula la lógica matemática del GPS.

## 6. IMPACTO EN EL SISTEMA
- `AccesoService`: Actualizado `validar_qr` para inyectar `alerta_capacidad_critica` e `info_capacidad_zona`.
- `API v1/parqueros`: Endpoints `/salida-qr` y `/salida-placa` ahora requieren/aceptan parámetros `lat` y `lon` en el body.
- `NotificacionService`: Nuevo método `notificar_saturacion_zona` para despacho de alertas push dinámicas.
