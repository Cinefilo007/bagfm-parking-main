# SCHEMA BASE DE DATOS — BAGFM v2.0

> Consultar `DIRECTIVA_MAESTRA.md` antes de modificar este documento.
> Todo cambio al schema debe reflejarse aquí.

---

## Convenciones

- Todos los IDs: `UUID` (`gen_random_uuid()`)
- Todos los timestamps: `TIMESTAMPTZ` en **UTC**
- Campos eliminados: **nunca**, se marcan `deprecated`
- FK siempre con `ON DELETE RESTRICT` salvo excepción documentada

---

## Enums

### Existentes
```sql
-- rol_tipo: COMANDANTE, ADMIN_BASE, SUPERVISOR, ALCABALA, ADMIN_ENTIDAD, SUPERVISOR_PARQUEROS, PARQUERO, SOCIO
-- membresia_estado: activa, suspendida, vencida, exonerada
-- passe_tipo: simple, identificado, portal
-- qr_tipo: permanente, temporal, evento_simple, evento_identificado, evento_portal
-- acceso_tipo: entrada, salida
-- infraccion_tipo: mal_estacionado, exceso_velocidad, conducta_indebida, documentos_vencidos, otro
-- infraccion_estado: activa, resuelta, perdonada
-- solicitud_estado: pendiente, aprobada, aprobada_parcial, denegada
```

### Nuevos (v2.0)
```sql
-- tipo_acceso_pase: logistica, prensa, vip, general, staff, artista, custom  ← 'custom' para tipos personalizados
-- estado_puesto: libre, ocupado, reservado, reservado_base, mantenimiento
-- tipo_incentivo: bono_eficiencia, reconocimiento, dia_libre, ascenso
-- tipo_sancion: amonestacion, suspension_temporal, relevo_inmediato, reportar_autoridades
-- estado_sancion: activa, cumplida, apelada
-- tipo_carnet: colgante, cartera, ticket, credencial
-- gravedad_infraccion: leve, moderada, grave, critica
```

### Actualizados (v2.0)
```sql
-- infraccion_tipo: mal_estacionado, exceso_velocidad, conducta_indebida, documentos_vencidos, otro,
--                  colision, zona_prohibida, acceso_no_autorizado, daño_propiedad,
--                  abandono_vehiculo, ruido_excesivo, vehiculo_fantasma   ← 7 NUEVOS
-- infraccion_estado: activa, resuelta, perdonada, en_revision, apelada    ← 2 NUEVOS
```

---

## Tablas

---

### `tipos_acceso_custom` *(NUEVO v2.0 — Tipos personalizados por entidad)*

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `entidad_id` | UUID | FK → entidades, NOT NULL | Solo para esta entidad |
| `nombre` | VARCHAR(50) | NOT NULL | Slug: "proveedor" |
| `etiqueta` | VARCHAR(100) | NOT NULL | Legible: "Proveedor Externo" |
| `color` | VARCHAR(7) | DEFAULT '#666666' | Para identificación visual |
| `icono` | VARCHAR(50) | NULL | Nombre de icono (opcional) |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_by` | UUID | FK → usuarios | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

> Si `codigos_qr.tipo_acceso = 'custom'`, el tipo real está en `tipo_acceso_custom_id` → esta tabla.

---

### `usuarios`

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `cedula` | VARCHAR(20) | UNIQUE, NOT NULL | — |
| `nombre` | VARCHAR(100) | NOT NULL | — |
| `apellido` | VARCHAR(100) | NOT NULL | — |
| `email` | VARCHAR(255) | UNIQUE, NULL | — |
| `telefono` | VARCHAR(20) | NULL | — |
| `rol` | ENUM `rol_tipo` | NOT NULL | Incluye SUPERVISOR_PARQUEROS (v2.0) |
| `entidad_id` | UUID | FK → entidades, NULL | Para ADMIN_ENTIDAD, SUPERVISOR_PARQUEROS, PARQUERO, SOCIO |
| `zona_asignada_id` | UUID | FK → zonas, NULL | **v2.0**: Zona de operación para PARQUERO |
| `activo` | BOOLEAN | DEFAULT true | Soft delete / Relevo |
| `foto_url` | TEXT | NULL | — |
| `password_hash` | TEXT | NOT NULL | — |
| `debe_cambiar_password` | BOOLEAN | DEFAULT false | — |
| `expira_at` | TIMESTAMPTZ | NULL | Para guardias temporales |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `entidades_civiles`

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `nombre` | VARCHAR(200) | NOT NULL | — |
| `codigo_slug` | VARCHAR(50) | UNIQUE, NOT NULL | — |
| `zona_id` | UUID | FK → zonas, NULL | **DEPRECATED v2.0**: usar asignaciones_zona |
| `capacidad_vehiculos` | INTEGER | NOT NULL | — |
| `cuota_pases_autonoma` | INTEGER | DEFAULT 0 | **v2.0** |
| `descripcion` | TEXT | NULL | — |
| `activo` | BOOLEAN | DEFAULT true | — |
| `latitud` | NUMERIC | NULL | — |
| `longitud` | NUMERIC | NULL | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `created_by` | UUID | FK → usuarios | — |

---

### `zonas_estacionamiento`

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `nombre` | VARCHAR(200) | NOT NULL | — |
| `capacidad_total` | INTEGER | NOT NULL | — |
| `ocupacion_actual` | INTEGER | DEFAULT 0 | — |
| `usa_puestos_identificados` | BOOLEAN | DEFAULT false | **v2.0** |
| `tipo` | VARCHAR(50) | NULL | **v2.0**: abierto/techado/subterraneo |
| `descripcion_ubicacion` | TEXT | NULL | — |
| `latitud` | NUMERIC | NULL | — |
| `longitud` | NUMERIC | NULL | — |
| `punto_acceso_lat` | NUMERIC(10,8) | NULL | **v2.0** |
| `punto_acceso_lon` | NUMERIC(11,8) | NULL | **v2.0** |
| `radio_cobertura` | INTEGER | DEFAULT 50 | — |
| `tiempo_limite_llegada_min` | INTEGER | DEFAULT 15 | **v2.0** |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `created_by` | UUID | FK → usuarios, NULL | **v2.0** |

---

### `puestos_estacionamiento` *(NUEVO v2.0)*

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `zona_id` | UUID | FK → zonas, NOT NULL | — |
| `codigo` | VARCHAR(20) | NOT NULL | Ej: "A-15" |
| `estado` | ENUM `estado_puesto` | DEFAULT 'libre' | libre/ocupado/reservado/reservado_base/mantenimiento |
| `reservado_para_entidad_id` | UUID | FK → entidades, NULL | Reservado para esta entidad |
| `reservado_para_usuario_id` | UUID | FK → usuarios, NULL | Reservado para este socio/cliente |
| `reservado_por` | UUID | FK → usuarios, NULL | Admin/Comandante que reservó |
| `latitud` | NUMERIC(10,8) | NULL | — |
| `longitud` | NUMERIC(11,8) | NULL | — |
| `vehiculo_actual_id` | UUID | FK → vehiculos, NULL | — |
| `usuario_actual_id` | UUID | FK → usuarios, NULL | — |
| `ocupado_at` | TIMESTAMPTZ | NULL | — |
| `registrado_por` | UUID | FK → usuarios, NULL | Parquero |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `asignaciones_zona` *(NUEVO v2.0)*

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `entidad_id` | UUID | FK → entidades, NULL | NULL = asignación para personal de base |
| `zona_id` | UUID | FK → zonas, NOT NULL | — |
| `cupo_asignado` | INTEGER | NOT NULL | Puestos para la entidad |
| `cupo_reservado_base` | INTEGER | DEFAULT 0 | Puestos apartados para personal de base |
| `activo` | BOOLEAN | DEFAULT true | — |
| `asignado_por` | UUID | FK → usuarios, NOT NULL | Comandante |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `notas` | TEXT | NULL | — |

---

### `vehiculos`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `placa` | VARCHAR(20) | UNIQUE, NOT NULL |
| `marca` | VARCHAR(100) | NOT NULL |
| `modelo` | VARCHAR(100) | NOT NULL |
| `color` | VARCHAR(50) | NOT NULL |
| `año` | INTEGER | NULL |
| `tipo` | VARCHAR(50) | NULL |
| `socio_id` | UUID | FK → usuarios, NOT NULL |
| `activo` | BOOLEAN | DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

---

### `membresias`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `socio_id` | UUID | FK → usuarios |
| `entidad_id` | UUID | FK → entidades |
| `vehiculo_id` | UUID | FK → vehiculos, NULL |
| `cupo_numero` | INTEGER | NULL |
| `puestos_asignados` | INTEGER | DEFAULT 1 |
| `zona_id` | UUID | FK → zonas, NULL | **v2.4**: Override de zona por socio. NULL = resuelve automáticamente desde entidad |
| `estado` | ENUM `membresia_estado` | NOT NULL |
| `fecha_inicio` | DATE | NOT NULL |
| `fecha_fin` | DATE | NULL |
| `observaciones` | TEXT | NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `created_by` | UUID | FK → usuarios |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() |

---

### `codigos_qr`

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `usuario_id` | UUID | FK → usuarios, NULL | — |
| `vehiculo_id` | UUID | FK → vehiculos, NULL | — |
| `membresia_id` | UUID | FK → membresias, NULL | — |
| `tipo` | ENUM `qr_tipo` | NOT NULL | — |
| `token` | TEXT | UNIQUE, NOT NULL | JWT |
| `solicitud_id` | UUID | FK → solicitudes, NULL | — |
| `lote_id` | UUID | FK → lotes, NULL | — |
| `serial_legible` | VARCHAR(50) | NULL | — |
| `tipo_acceso` | ENUM `tipo_acceso_pase` | DEFAULT 'general' | **v2.0**: inc. 'custom' |
| `tipo_acceso_custom_id` | UUID | FK → tipos_acceso_custom, NULL | **v2.0**: Si tipo_acceso='custom' |
| `zona_asignada_id` | UUID | FK → zonas, NULL | **v2.0** |
| `puesto_asignado_id` | UUID | FK → puestos, NULL | **v2.0**: VIP/logística |
| `nombre_portador` | VARCHAR(200) | NULL | **v2.0** |
| `cedula_portador` | VARCHAR(20) | NULL | **v2.0** |
| `vehiculo_placa` | VARCHAR(20) | NULL | **v2.0**: Placa principal |
| `multi_vehiculo` | BOOLEAN | DEFAULT false | **v2.0**: >1 vehículo? Ver vehiculos_pase |
| `datos_completos` | BOOLEAN | DEFAULT false | **v2.0** |
| `verificado_por_parquero` | BOOLEAN | DEFAULT false | **v2.0** |
| `hora_entrada_base` | TIMESTAMPTZ | NULL | **v2.0** |
| `hora_llegada_zona` | TIMESTAMPTZ | NULL | **v2.0** |
| `accesos_usados` | INTEGER | DEFAULT 0 | — |
| `max_accesos` | INTEGER | NULL | — |
| `fecha_expiracion` | TIMESTAMPTZ | NULL | — |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `created_by` | UUID | FK → usuarios | — |

---

### `accesos`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `qr_id` | UUID | FK → codigos_qr, NULL |
| `usuario_id` | UUID | FK → usuarios |
| `vehiculo_id` | UUID | FK → vehiculos, NULL |
| `tipo` | ENUM `acceso_tipo` | NOT NULL |
| `punto_acceso` | VARCHAR(100) | NOT NULL |
| `registrado_por` | UUID | FK → usuarios |
| `es_manual` | BOOLEAN | DEFAULT false |
| `timestamp` | TIMESTAMPTZ | DEFAULT now() |
| `zona_id` | UUID | FK → zonas, NULL | **v2.4**: Zona de destino persistida al momento del acceso. Permite historial estable por zona. |

---

### `accesos_zona`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `qr_id` | UUID | FK → codigos_qr, NULL |
| `usuario_id` | UUID | FK → usuarios |
| `vehiculo_id` | UUID | FK → vehiculos, NULL |
| `zona_id` | UUID | FK → zonas |
| `puesto_id` | UUID | FK → puestos, NULL |
| `cupo_numero` | INTEGER | NULL |
| `tipo` | ENUM `acceso_tipo` | NOT NULL |
| `metodo_registro` | VARCHAR(20) | DEFAULT 'qr' — 'qr', 'placa', 'rapido' |
| `registrado_por` | UUID | FK → usuarios |
| `timestamp` | TIMESTAMPTZ | DEFAULT now() |

---

### `infracciones`

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `vehiculo_id` | UUID | FK → vehiculos | — |
| `usuario_id` | UUID | FK → usuarios | — |
| `reportado_por` | UUID | FK → usuarios | — |
| `tipo` | ENUM `infraccion_tipo` | NOT NULL | 12 tipos (v2.0) |
| `gravedad` | ENUM `gravedad_infraccion` | DEFAULT 'moderada' | **v2.0** |
| `descripcion` | TEXT | NOT NULL | — |
| `foto_url` | TEXT | NULL | Foto principal (legacy) |
| `fotos_evidencia` | JSONB | DEFAULT '[]' | **v2.0**: Múltiples fotos |
| `bloquea_salida` | BOOLEAN | DEFAULT true | — |
| `bloquea_acceso_futuro` | BOOLEAN | DEFAULT false | **v2.0** |
| `suspendido_hasta` | TIMESTAMPTZ | NULL | **v2.0**: Fecha fin suspensión |
| `zona_id` | UUID | FK → zonas, NULL | **v2.0**: Dónde ocurrió |
| `puesto_id` | UUID | FK → puestos, NULL | **v2.0**: En qué puesto |
| `entidad_id` | UUID | FK → entidades, NULL | **v2.0**: Entidad involucrada |
| `latitud_infraccion` | NUMERIC(10,8) | NULL | **v2.0**: Coord. exacta (OPCIONAL) |
| `longitud_infraccion` | NUMERIC(11,8) | NULL | **v2.0**: Coord. exacta (OPCIONAL) |
| `estado` | ENUM `infraccion_estado` | NOT NULL | 5 estados (v2.0) |
| `notas_internas` | TEXT | NULL | **v2.0**: No visible al socio |
| `escalada_a` | UUID | FK → usuarios, NULL | **v2.0**: A quién se escaló |
| `notificado_socio` | BOOLEAN | DEFAULT false | **v2.0** |
| `resuelta_por` | UUID | FK → usuarios, NULL | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `resuelta_at` | TIMESTAMPTZ | NULL | — |
| `observaciones_resolucion` | TEXT | NULL | — |

---

### `solicitudes_evento`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `entidad_id` | UUID | FK → entidades, NULL |
| `solicitado_por` | UUID | FK → usuarios |
| `nombre_evento` | VARCHAR(200) | NOT NULL |
| `fecha_evento` | DATE | NOT NULL |
| `hora_inicio` | TIME | NULL |
| `hora_fin` | TIME | NULL |
| `cantidad_solicitada` | INTEGER | NOT NULL |
| `cantidad_aprobada` | INTEGER | NULL |
| `motivo` | TEXT | NOT NULL |
| `tipo_pase` | ENUM `passe_tipo` | DEFAULT 'simple' |
| `lote_id` | UUID | FK → lotes, NULL |
| `estado` | ENUM `solicitud_estado` | NOT NULL |
| `revisado_por` | UUID | FK → usuarios, NULL |
| `motivo_rechazo` | TEXT | NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `revisado_at` | TIMESTAMPTZ | NULL |

---

### `lotes_pase_masivo`

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `codigo_serial` | VARCHAR(50) | UNIQUE, INDEX | — |
| `nombre_evento` | VARCHAR(200) | NOT NULL | — |
| `tipo_pase` | ENUM `passe_tipo` | NOT NULL | — |
| `entidad_id` | UUID | FK → entidades, NULL | **v2.0** |
| `tipo_acceso` | ENUM `tipo_acceso_pase` | DEFAULT 'general' | **v2.0** |
| `requiere_aprobacion` | BOOLEAN | DEFAULT false | **v2.0** |
| `aprobado_por` | UUID | FK → usuarios, NULL | **v2.0** |
| `zona_estacionamiento_id` | UUID | FK → zonas, NULL | **v2.0** |
| `plantilla_carnet_id` | UUID | FK → plantillas, NULL | **v2.0** |
| `fecha_inicio` | DATE | NOT NULL | — |
| `fecha_fin` | DATE | NOT NULL | — |
| `max_accesos_por_pase` | INTEGER | NULL | — |
| `cantidad_pases` | INTEGER | NOT NULL | — |
| `creado_por` | UUID | FK → usuarios | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `zip_generado` | BOOLEAN | DEFAULT false | — |
| `zip_url` | TEXT | NULL | — |
| `zip_listo_at` | TIMESTAMPTZ | NULL | — |

---

### `puntos_acceso`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `nombre` | VARCHAR(200) | NOT NULL |
| `ubicacion` | VARCHAR(500) | NULL |
| `usuario_id` | UUID | FK → usuarios, UNIQUE, NULL |
| `secret_key` | VARCHAR(100) | NULL |
| `key_salt` | VARCHAR(100) | NULL |
| `latitud` | NUMERIC(10,8) | NULL |
| `longitud` | NUMERIC(11,8) | NULL |
| `activo` | BOOLEAN | DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

---

### `guardias_turno`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `punto_id` | UUID | FK → puntos_acceso |
| `usuario_id` | UUID | FK → usuarios |
| `grado` | VARCHAR(100) | NULL |
| `nombre` | VARCHAR(200) | NOT NULL |
| `apellido` | VARCHAR(200) | NOT NULL |
| `telefono` | VARCHAR(50) | NULL |
| `unidad` | VARCHAR(200) | NULL |
| `activo` | BOOLEAN | DEFAULT true |
| `inicio_turno` | TIMESTAMPTZ | DEFAULT now() |
| `key_version` | VARCHAR(50) | NULL |

---

### `incentivos_parquero` *(NUEVO v2.0)*

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `parquero_id` | UUID | FK → usuarios |
| `tipo` | ENUM `tipo_incentivo` | NOT NULL |
| `descripcion` | TEXT | NOT NULL |
| `otorgado_por` | UUID | FK → usuarios |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

---

### `sanciones_parquero` *(NUEVO v2.0)*

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `parquero_id` | UUID | FK → usuarios |
| `tipo` | ENUM `tipo_sancion` | NOT NULL |
| `motivo` | TEXT | NOT NULL |
| `estado` | ENUM `estado_sancion` | DEFAULT 'activa' |
| `ejecutar_inmediato` | BOOLEAN | DEFAULT false |
| `sancionado_por` | UUID | FK → usuarios |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `resuelto_at` | TIMESTAMPTZ | NULL |

---

### `plantillas_carnet` *(NUEVO v2.0)*

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `nombre` | VARCHAR(100) | NOT NULL |
| `tipo_carnet` | ENUM `tipo_carnet` | NOT NULL |
| `tipo_pase` | ENUM `passe_tipo` | NULL |
| `entidad_id` | UUID | FK → entidades, NULL |
| `color_primario` | VARCHAR(7) | DEFAULT '#4EDEA3' |
| `color_secundario` | VARCHAR(7) | DEFAULT '#0E1322' |
| `color_texto` | VARCHAR(7) | DEFAULT '#FFFFFF' |
| `fondo_url` | TEXT | NULL |
| `logo_url` | TEXT | NULL |
| `mostrar_foto` | BOOLEAN | DEFAULT true |
| `mostrar_vehiculo` | BOOLEAN | DEFAULT true |
| `mostrar_qr` | BOOLEAN | DEFAULT true |
| `activo` | BOOLEAN | DEFAULT true |
| `created_by` | UUID | FK → usuarios |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

---

### `mensajes_broadcast` *(NUEVO v2.0)*

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `entidad_id` | UUID | FK → entidades | — |
| `enviado_por` | UUID | FK → usuarios | Supervisor de Parqueros |
| `mensaje` | TEXT | NOT NULL | Instrucción o comunicado |
| `destinatarios` | VARCHAR(50) | DEFAULT 'todos' | 'todos', 'zona:{id}', 'parquero:{id}' |
| `leido_por` | JSONB | DEFAULT '[]' | Lista de IDs que leyeron |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `vehiculos_pase` *(NUEVO v2.0 — Múltiples vehículos por pase)*

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `qr_id` | UUID | FK → codigos_qr, NOT NULL | El pase |
| `placa` | VARCHAR(20) | NOT NULL | — |
| `marca` | VARCHAR(100) | NULL | — |
| `modelo` | VARCHAR(100) | NULL | — |
| `color` | VARCHAR(50) | NULL | — |
| `vehiculo_id` | UUID | FK → vehiculos, NULL | Si existe en BD |
| `es_principal` | BOOLEAN | DEFAULT false | Vehículo principal |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `solicitud_id` | UUID | FK → solicitudes |
| `qr_id` | UUID | FK → codigos_qr |
| `nombre_visitante` | VARCHAR(200) | NULL |
| `placa_visitante` | VARCHAR(20) | NULL |
| `usado` | BOOLEAN | DEFAULT false |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

---

### `push_subscriptions`

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `id` | UUID | PK |
| `usuario_id` | UUID | FK → usuarios |
| `endpoint` | TEXT | NOT NULL |
| `p256dh` | TEXT | NOT NULL |
| `auth` | TEXT | NOT NULL |
| `dispositivo` | VARCHAR(100) | NULL |
| `activo` | BOOLEAN | DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

---

### `configuracion`

| Clave | Valor default | Descripción |
|-------|--------------|-------------|
| `salida_requerida` | `false` | — |
| `max_vehiculos_por_evento` | `50` | — |
| `qr_expiracion_temporal_horas` | `24` | — |
| `bloquear_salida_por_infraccion` | `true` | — |
| `tiempo_limite_llegada_zona_min` | `15` | **v2.0** |
| `alerta_reasignacion_manual_pct` | `30` | **v2.0** |

---

## Índices

```sql
-- Existentes
CREATE INDEX idx_vehiculos_placa ON vehiculos(placa);
CREATE INDEX idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX idx_accesos_timestamp ON accesos(timestamp DESC);
CREATE INDEX idx_infracciones_vehiculo ON infracciones(vehiculo_id) WHERE estado = 'activa';
CREATE INDEX idx_membresias_socio ON membresias(socio_id) WHERE estado = 'activa';
CREATE INDEX idx_codigos_qr_token ON codigos_qr(token) WHERE activo = true;

-- Nuevos v2.0
CREATE INDEX idx_puestos_zona ON puestos_estacionamiento(zona_id) WHERE activo = true;
CREATE INDEX idx_puestos_estado ON puestos_estacionamiento(zona_id, estado) WHERE activo = true;
CREATE INDEX idx_puestos_vehiculo ON puestos_estacionamiento(vehiculo_actual_id) WHERE vehiculo_actual_id IS NOT NULL;
CREATE INDEX idx_puestos_reservado ON puestos_estacionamiento(reservado_para_entidad_id) WHERE estado = 'reservado';
CREATE INDEX idx_asignaciones_entidad ON asignaciones_zona(entidad_id) WHERE activo = true;
CREATE INDEX idx_asignaciones_zona ON asignaciones_zona(zona_id) WHERE activo = true;
CREATE INDEX idx_incentivos_parquero ON incentivos_parquero(parquero_id);
CREATE INDEX idx_sanciones_parquero ON sanciones_parquero(parquero_id) WHERE estado = 'activa';
CREATE INDEX idx_accesos_zona_ts ON accesos_zona(timestamp DESC);
CREATE INDEX idx_accesos_zona_zona ON accesos_zona(zona_id, tipo);
CREATE INDEX idx_lotes_entidad ON lotes_pase_masivo(entidad_id);
CREATE INDEX idx_qr_zona ON codigos_qr(zona_asignada_id) WHERE zona_asignada_id IS NOT NULL;
CREATE INDEX idx_qr_puesto ON codigos_qr(puesto_asignado_id) WHERE puesto_asignado_id IS NOT NULL;
CREATE INDEX idx_usuarios_zona ON usuarios(zona_asignada_id) WHERE zona_asignada_id IS NOT NULL;
CREATE INDEX idx_broadcast_entidad ON mensajes_broadcast(entidad_id, created_at DESC);
CREATE INDEX idx_vehiculos_pase_qr ON vehiculos_pase(qr_id) WHERE activo = true;
CREATE INDEX idx_vehiculos_pase_placa ON vehiculos_pase(placa);
CREATE INDEX idx_infracciones_gravedad ON infracciones(gravedad) WHERE estado = 'activa';
CREATE INDEX idx_infracciones_zona ON infracciones(zona_id) WHERE estado = 'activa';
CREATE INDEX idx_infracciones_entidad ON infracciones(entidad_id) WHERE estado = 'activa';
CREATE INDEX idx_qr_fantasma ON codigos_qr(hora_entrada_base) WHERE hora_entrada_base IS NOT NULL AND hora_llegada_zona IS NULL AND activo = true;
```

---

## Historial de Cambios

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 0.1.0 | 2026-03-30 | Schema inicial |
| 0.6.1 | 2026-04-03 | Geoposicionamiento |
| 0.7.0 | 2026-04-05 | Alcabalas fijas |
| 2.0.0 | 2026-04-18 | **Evolución v2.0** completa |
| 2.4.0 | 2026-05-04 | **Zona socio permanente**: `membresias.zona_id` (override por socio), `accesos.zona_id` (destino persistido). Resuelve historial del parquero y asignación de zona al socio permanente en alcabala. |

### Detalle v2.0:
- **8 tablas nuevas**: `tipos_acceso_custom`, `puestos_estacionamiento`, `asignaciones_zona`, `incentivos_parquero`, `sanciones_parquero`, `plantillas_carnet`, `mensajes_broadcast`, `vehiculos_pase`
- **7 enums nuevos** + SUPERVISOR_PARQUEROS + actualizaciones infracciones + 'custom' en tipo_acceso
- **`tipos_acceso_custom`**: Tipos de acceso personalizables por entidad
- **`infracciones`**: +12 columnas (gravedad, zona, puesto, fotos, coords, bloqueo acceso, suspensión, escalamiento)
- **`codigos_qr`**: +12 columnas (inc. `multi_vehiculo`, `tipo_acceso_custom_id`)
- **`puestos_estacionamiento`**: campos de reserva (entidad, usuario, base)
- **`asignaciones_zona`**: `cupo_reservado_base` para personal militar
- **`vehiculos_pase`**: Múltiples vehículos por pase
- **`usuarios`**: +`zona_asignada_id` para parqueros
- **Campo deprecated**: `entidades_civiles.zona_id` → usar `asignaciones_zona`

---

*Última actualización: 2026-04-18 | v2.0*
