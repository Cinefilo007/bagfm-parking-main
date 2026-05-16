# API REFERENCE — BAGFM v2.0

Referencia completa de endpoints del sistema BAGFM.

---

## 🔐 Autenticación — `/api/v1/auth`

### `POST /login`
Login para todos los roles incluyendo PARQUERO y SUPERVISOR_PARQUEROS.
- **Body**: `username` (Cédula), `password`.
- **Respuesta**: JWT + info usuario (rol, entidad_id, zona_asignada_id).

---

## 🏛️ Entidades — `/api/v1/entidades`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| GET | / | Autenticado | Lista entidades |
| POST | / | CMD, ADM_B | Crear entidad |
| GET | /{id} | Autenticado | Detalle |
| PUT | /{id} | CMD, ADM_B | Editar |
| DELETE | /{id} | CMD, ADM_B | Desactivar |

---

## 👥 Socios — `/api/v1/socios`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | / | CMD, ADM_B, ADM_E | Registrar socio |
| GET | /entidad/{id} | CMD, ADM_B, ADM_E | Listar socios |
| POST | /importar | CMD, ADM_B, ADM_E | Importar Excel |

---

## 🛡️ Comando — `/api/v1/comando`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| GET | /alcabalas | CMD, ADM_B | Lista alcabalas |
| POST | /registrar-guardia | CMD, ADM_B | Crear cuenta alcabala |

---

## 🚗 Accesos — `/api/v1/accesos`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | /validar | ALC, PRQ | Validar QR (v2.0: incluye zona, puesto, datos_completos) |
| POST | /registrar | ALC | Registrar entrada/salida (emite WS+Push al parquero) |

---

## 🅿️ Zonas — `/api/v1/zonas`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | / | CMD, ADM_B | Crear zona |
| GET | / | CMD, ADM_B | Listar zonas |
| GET | /{id} | CMD, ADM_B, ADM_E, SUP_P, PRQ | Detalle + estado real |
| PUT | /{id} | CMD, ADM_B | Editar zona |
| POST | /{id}/puestos | CMD, ADM_B | Crear puestos |
| GET | /{id}/puestos | CMD, ADM_B, ADM_E, SUP_P, PRQ | Listar con estado |
| POST | /{id}/asignar | CMD | Asignar a entidad |
| POST | /{id}/reservar-puestos | ADM_E | Reservar puestos para entidad |
| POST | /{id}/apartar-base | CMD | Apartar puestos para personal base |
| GET | /{id}/compartir | Autenticado | Deep link ubicación |

---

## 🅿️ Parquero — `/api/v1/parquero`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | /recibir | PRQ | Recibir vehículo via QR |
| POST | /recibir-placa | PRQ | Recibir por placa (si no existe: registro IA) |
| POST | /registrar-datos | PRQ | Registrar datos socio + IA escaneo docs |
| POST | /salida-qr | PRQ | Salida via QR (opcional) |
| POST | /salida-placa | PRQ | Salida por placa (preferido) |
| GET | /mi-zona | PRQ | Estado zona asignada |
| GET | /mi-zona/vehiculos | PRQ | Vehículos con contacto |
| GET | /pendientes | PRQ | Vehículos en camino (con detalle datos) |
| GET | /mis-metricas | PRQ | Estadísticas |
| GET | /mensajes | PRQ | Mensajes broadcast recibidos |
| PUT | /mensajes/{id}/leido | PRQ | Marcar mensaje como leído |

---

## 👔 Supervisor Parqueros — `/api/v1/supervisor-parqueros`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| GET | /dashboard | SUP_P | Dashboard global (zonas, parqueros, métricas) |
| GET | /parqueros | SUP_P | Lista parqueros con métricas |
| POST | /reasignar | SUP_P | Reasignar parquero a otra zona |
| POST | /broadcast | SUP_P | Enviar instrucción (Push+WS) |
| GET | /log-alcabalas | SUP_P | Entradas/salidas por alcabalas (destino entidad) |
| GET | /log-zonas | SUP_P | Entradas/salidas por zonas |
| GET | /metricas | SUP_P | Métricas globales eficiencia |
| POST | /parqueros/{id}/incentivo | SUP_P, ADM_E | Crear incentivo |
| POST | /parqueros/{id}/sancion | SUP_P, ADM_E | Crear sanción |
| POST | /parqueros/{id}/relevar | SUP_P, ADM_E | Relevo inmediato |
| GET | /parqueros/{id}/historial | SUP_P, ADM_E | Historial completo |

---

## 🎟️ Eventos — `/api/v1/eventos`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | /solicitar | ADM_E | Solicitar evento (extra-cuota) |
| POST | /procesar/{id} | CMD | Aprobar/denegar |
| GET | /solicitudes | ADM_E, CMD | Historial |

---

## 🎟️ Pases — `/api/v1/pases`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | /autonomo | ADM_E | Generar lote sin aprobación |
| GET | /lotes | ADM_E, CMD | Listar lotes |
| GET | /lotes/{id}/pases | ADM_E | Lista pases individuales |
| PUT | /lotes/{id}/pases/{qr} | ADM_E | Editar pase (datos + zona/puesto) |
| POST | /{qr}/compartir | ADM_E | Link compartir |
| POST | /{qr}/enviar-email | ADM_E | Enviar pase por email |
| POST | /lotes/{id}/enviar-masivo | ADM_E | Email masivo a todo el lote |
| DELETE | /{qr} | ADM_E | Revocar pase |

---

## 🎨 Carnets — `/api/v1/carnets`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| GET | /plantillas | ADM_E | Listar plantillas |
| POST | /plantillas | ADM_E | Crear plantilla |
| PUT | /plantillas/{id} | ADM_E | Editar |
| POST | /generar | ADM_E | Generar carnet individual |
| POST | /generar-lote | ADM_E | Masivos → ZIP |
| GET | /preview/{id} | ADM_E | Preview |

---

## ⚙️ Tipos de Acceso — `/api/v1/tipos-acceso`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| GET | / | ADM_E | Listar tipos (base + custom de la entidad) |
| POST | / | ADM_E | Crear tipo personalizado |
| PUT | /{id} | ADM_E | Editar tipo personalizado |
| DELETE | /{id} | ADM_E | Desactivar tipo |

---

## ⚠️ Infracciones v2.0 — `/api/v1/infracciones`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | / | PRQ, SUP_P, SUP, ADM_B, CMD | Registrar (con gravedad + coords opcionales) |
| POST | /reporte-rapido | PRQ, SUP_P, SUP, ALC | Formulario rápido desde dashboard |
| GET | / | SUP_P, ADM_E, SUP, ADM_B, CMD | Lista (filtros: estado, tipo, gravedad, zona) |
| GET | /{id} | SUP_P, ADM_E, SUP, ADM_B, CMD | Detalle con evidencia y mapa |
| PUT | /{id}/resolver | * | Resolver (validación por gravedad: LEVE→entidad, MODERADA+→base) |
| PUT | /{id}/escalar | SUP_P, ADM_E, SUP | Escalar a superior |
| GET | /vehiculo/{id}/historial | Autenticado | Historial + reincidencia |
| GET | /lista-negra | CMD, ADM_B | Usuarios en lista negra |
| DELETE | /lista-negra/{id} | CMD | Retirar de lista negra |
| GET | /estadisticas | CMD, ADM_B, ADM_E | Dashboard (inc. mapa calor con coords) |
| GET | /fantasmas | SUP_P, ADM_E, SUP, ADM_B, CMD | Vehículos fantasma con nivel escalamiento |
| POST | /fantasmas/{id}/orden-busqueda | CMD, ADM_B | Emitir orden de búsqueda a supervisores ronda |

> *Resolver: LEVE=ADM_E,SUP_P,SUP,ADM_B,CMD | MODERADA=SUP,ADM_B,CMD | GRAVE=ADM_B,CMD | CRÍTICA=CMD

---

## 🚗 Vehículos por Pase — `/api/v1/pases/{qr_id}/vehiculos`

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | / | ADM_E | Agregar vehículo al pase |
| GET | / | ADM_E, ALC, PRQ | Listar vehículos del pase |
| DELETE | /{vehiculo_pase_id} | ADM_E | Quitar vehículo del pase |

---

## 🔌 WebSocket — `/api/v1/ws`

### `WS /ws?token=JWT`

**Canales:**
| Canal | Destinatario |
|-------|-------------|
| `comando` | Comandante |
| `entidad:{id}` | Admin Entidad |
| `supervisor:{id}` | Supervisor Parqueros |
| `zona:{id}` | Parquero |
| `parquero:{id}` | Parquero individual |

**Eventos:**
| Evento | Data incluida |
|--------|---------------|
| `vehiculo_ingreso_base` | placa, marca, modelo, color, datos_completos, alcabala |
| `vehiculo_llegada_zona` | socio, puesto, método |
| `vehiculo_salida_zona` | puesto liberado |
| `puesto_actualizado` | estado, vehículo |
| `zona_ocupacion_cambio` | % ocupación |
| `parquero_sancionado` | tipo sanción |
| `parquero_relevado` | cierre forzoso |
| `parquero_reasignado` | nueva zona |
| `broadcast` | mensaje del supervisor |
| `pase_generado` | lote info |
| `infraccion_registrada` | tipo, gravedad, placa, zona, coords |
| `infraccion_grave` | alerta prioritaria, placa, detalles |
| `infraccion_resuelta` | desbloqueo |
| `vehiculo_fantasma_nivel_1` | placa, tiempo, zona → supervisor_parqueros |
| `vehiculo_fantasma_nivel_2` | + admin_entidad |
| `vehiculo_fantasma_nivel_3` | + supervisor_ronda |
| `vehiculo_fantasma_nivel_4` | + admin_base |
| `vehiculo_fantasma_nivel_5` | + comandante (alerta máxima) |
| `orden_busqueda` | placa, datos vehiculo → supervisores ronda |
| `lista_negra_actualizada` | usuario agregado/retirado |

---

## 📧 Email Service

| Tipo | Librería | Endpoint |
|------|----------|----------|
| Transaccional | `fastapi-mail` + SMTP | POST `/pases/{qr}/enviar-email` |
| Masivo | Resend SDK / AWS SES | POST `/pases/lotes/{id}/enviar-masivo` |

---

*Última actualización: 2026-04-18 | v2.0*
