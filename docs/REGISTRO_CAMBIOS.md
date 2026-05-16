# REGISTRO DE CAMBIOS — BAGFM

> Este documento registra todos los cambios significativos al sistema.  
> Sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [2.3.0] — 2026-05-04

### Modificado — Interfaz de Socio
- **Sidebar Táctico**: Sincronización del menú lateral con el menú móvil para el rol de `SOCIO`.
- **Nuevos accesos directos**: "Mi QR", "Infracciones" e "Historial de Accesos" añadidos a la navegación principal del Sidebar.
- **Iconografía**: Integración de `QrCode` y `ArrowRightLeft` en el Sidebar.

### Corregido — Sistema de Socios
- **Eliminación en Cascada**: Se corrigió el bloqueo que impedía borrar socios con historial de accesos o infracciones. Ahora el sistema limpia recursivamente todos los registros vinculados para permitir la eliminación completa.

## [2.2.0] — 2026-04-23

### Añadido — Rediseño Táctico de Personal
- **Fuerza de Tareas v2.2** (`/pages/Personal.jsx`): Reescrito completamente siguiendo el estándar de Pases Masivos.
- **KPIs Tácticos Globales**: Resumen de personal (Totales, Activos, Parqueros, Zonas) en la parte superior.
- **Tarjetas Expandibles (*In-Place Expansion*)**: Se elimina el modal lateral (PanelDetalle) en favor de una expansión vertical dentro de la misma lista.
- **KPIs Individuales de Alta Densidad**: Días activo, incentivos y sanciones visibles sin expandir la tarjeta.
- **Gestión Unificada**: Pestañas de KPIs, Zona, Incentivos, Sanciones y Editar integradas en el área expandible.
- **Modo Pánico Operativo**: Botón de toggle (Activo/Pausa) y Baja Definitiva accesibles desde la vista contraída.
- **Directiva nueva**: `DIRECTIVA_UI_PERSONAL_V22.md`.

### Modificado
- **Personal.jsx**: Implementación de `MiembroCard` y `TacticalKPIs`. Se eliminó el subcomonente `PanelDetalle` por redundancia con el nuevo sistema de expansión.

---

## [2.0.1] — 2026-04-18

### Añadido — Sprints 2, 3 y 4 Frontend

#### Sprint 2 — Portales Operativos
- **Portal Parquero** (`/parquero/dashboard`): Scanner QR, mapa de puestos, KPIs, asignación manual, compartir ubicación via Web Share API
- **Portal Supervisor de Parqueros** (`/supervisor/dashboard`): 4 tabs (Monitor, Fantasmas, Infracciones Leves, Personal), broadcast a parqueros
- **Gestión Zonas** (`/comando/zonas`): CRUD zonas, gestión puestos con GPS, cuotas por entidad, reserva para base, ajuste temporal tiempo límite
- **ReporteRapido** (`components/infracciones/`): Componente flotante ⚠️ reutilizable con gravedad, GPS, tipo de infracción

#### Sprint 3 — Pases, Infracciones, Compartir
- **Eventos/Pases v2** (`/entidad/eventos`): Reescrito con LoteCardV2, PaseRow drill-down, ModalNuevoLote (zona/puesto, multi-vehículo, tipos custom), compartir nativo, envío email
- **Dashboard Infracciones** (`/comando/infracciones`): KPIs, filtros por gravedad/estado, resolución con permisos estrictos por rol, lista negra, apertura GPS en Google Maps
- **Compartir Ubicación** (Portal Parquero): Web Share API + geolocation fallback

#### Sprint 4 — Editor de Carnets
- **PlantillaPreview** (`components/carnets/`): 4 plantillas visuales (colgante, cartera, ticket, credencial) con colores configurables
- **EditorCarnets** (`/entidad/carnets`): 7 presets de color, 4 color pickers manuales, vista previa en vivo, secciones plegables, guardar/restaurar en localStorage, impresión directa

### Modificado
- **Router**: +6 rutas protegidas por rol (comando/infracciones, entidad/carnets, parquero, supervisor)
- **Sidebar**: +Infracciones (Comandante), +Editor Carnets (Entidad), +Supervisor Parqueros
- **BottomNav**: Actualizado con navegación por rol para los nuevos portales
- **DIRECTIVA_MAESTRA.md**: Sección 8 reescrita con estado real completo del sistema
- **DIRECTIVA_PASES_MASIVOS.md**: Sección Editor Visual actualizada con implementación real

---

## [2.0.0] — 2026-04-18

### Añadido — Evolución: Gestión Inteligente de Estacionamientos

> **Filosofía**: "PREPARARNOS PARA EL CAOS" — eventos masivos en vías de una sola dirección.

#### Base de Datos
- **8 tablas nuevas**: `tipos_acceso_custom`, `puestos_estacionamiento`, `asignaciones_zona`, `incentivos_parquero`, `sanciones_parquero`, `plantillas_carnet`, `mensajes_broadcast`, `vehiculos_pase`
- **7 enums nuevos** + `custom` en `tipo_acceso_pase` + `gravedad_infraccion` + actualizaciones infracción
- **Nuevo rol**: `SUPERVISOR_PARQUEROS` añadido a `rol_tipo`
- **Tabla `tipos_acceso_custom`**: Tipos de acceso personalizables por entidad
- **Tabla `vehiculos_pase`**: Múltiples vehículos por pase (junction table)
- **Tabla `infracciones`**: +12 columnas (gravedad, coords geográficas, zona, puesto, fotos, bloqueos, escalamiento)
- **Tabla `codigos_qr`**: +12 columnas (inc. `multi_vehiculo`, `tipo_acceso_custom_id`)
- **Tabla `zonas_estacionamiento`**: +5 columnas (inc. `tiempo_limite_llegada_min` configurable por zona)
- **Tabla `lotes_pase_masivo`**: +7 columnas (entidad_id, tipo_acceso, tipo_acceso_custom_id, aprobación, zona, plantilla)
- **Tabla `entidades_civiles`**: +1 columna (cuota_pases_autonoma)
- **Tabla `accesos_zona`**: +1 columna (metodo_registro)

#### Módulo Parquero (NUEVO)
- **Login personalizado**: Cédula + contraseña propia
- **3 métodos de recepción**: QR, por placa, asignación rápida
- **3 métodos de salida**: QR (opcional), por placa (recomendado), por puesto
- **Verificación de identidad**: Delegada desde alcabala + escáner IA de documentos
- **Dashboard con lista de vehículos**: Con datos de contacto del socio
- **Notificaciones detalladas**: Push con marca/modelo/color/placa si tiene datos
- **Directiva nueva**: `DIRECTIVA_PARQUERO.md`

#### Módulo Supervisor de Parqueros (NUEVO)
- **Rol SUPERVISOR_PARQUEROS**: "Director de orquesta" por entidad
- **Dashboard global**: Todas las zonas, parqueros con semáforo, flujo vehicular
- **Comunicación broadcast**: Instrucciones Push+WS a todos o zona específica
- **Reasignación dinámica**: Mover parqueros entre zonas según demanda
- **Log de operaciones**: Alcabalas + zonas + búsqueda

#### Pases Masivos con Autonomía
- **Generación autónoma** dentro de cuota
- **Clasificación por tipo de acceso**: 6 tipos
- **Asignación de zona/puesto**: VIP, logística, productores pueden tener puesto pre-asignado
- **Gestión individual**: Editar, compartir, enviar email, revocar
- **Email masivo**: Enviar pases por email a todo un lote
- **Directiva nueva**: `DIRECTIVA_PASES_MASIVOS.md`

#### Carnets de Acceso (PLUS)
- **4 tipos**: Colgante (cuello), cartera (billetera), ticket (concierto), credencial (badge)
- **Editor visual**: Colores, fondo, logo, preview en tiempo real
- **Generación masiva**: Individual o ZIP para lote completo
- QR solo sigue siendo la opción principal de descarga

#### Sistema Anti-Corrupción
- **Asignación sugerida**: Solo cuando el pase NO tiene puesto pre-asignado
- **Reserva de puestos**: Admin reserva puestos y asigna a socios
- **Apartado para base**: Comandante aparta puestos para personal militar
- **Auditoría automática**: Alerta si >30% reasignaciones manuales
- **Incentivos/Sanciones**: bono_eficiencia, reconocimiento, relevo_inmediato
- **Relevo inmediato**: Desactiva cuenta + cierre forzoso WS

#### Email Service
- **Transaccional**: `fastapi-mail` + SMTP (pases individuales, bienvenida)
- **Masivo**: Resend SDK / AWS SES (lotes completos con email)
- **Templates**: Jinja2 para emails HTML con branding

#### Tiempo Real
- **WebSocket por canales**: entidad, zona, parquero, supervisor, comando
- **7+ tipos de eventos**: ingreso, llegada, salida, puesto, ocupación, sanción, broadcast, reasignación
- **Push Notifications PWA**: Personalizadas por rol, zona y nivel de detalle de datos

### Modificado
- **FL-04 (Alcabala)**: Simplificado — registro de datos OPCIONAL, verificación delegada al parquero
- **FL-05 (Parquero)**: Ampliado — 3 métodos de recepción, lista de vehículos, métricas
- **FL-08 (Pases)**: Autonomía dentro de cuota, solicitud automática si excede
- **Roles**: PARQUERO con responsabilidades ampliadas, ADMIN_ENTIDAD con pases autónomos y carnets
- **DIRECTIVA_MAESTRA.md**: Actualizada a v2.0
- **SCHEMA_BD.md**: Actualizado con todas las tablas y campos nuevos
- **ROLES_Y_PERMISOS.md**: Matriz actualizada con nuevos permisos
- **FLUJOS_DE_NEGOCIO.md**: Flujos actualizados + 3 nuevos (FL-13, FL-14, FL-15)
- **API_REFERENCE.md**: ~25 endpoints nuevos documentados
- **DIRECTIVA_ALCABALAS.md**: Flujo simplificado

### Deprecado
- **`entidades_civiles.zona_id`**: Usar `asignaciones_zona` (relación N:N)

---

## [0.7.0] — 2026-04-05

### Añadido
- **Relevo Táctico Mandatorio**: Flujo de identificación obligatorio para personal de guardia.
- **Seguridad Rotativa**: Contraseñas de 6 dígitos que cambian cada 24h.
- **Mando Directo**: Panel de supervisión con monitor de personal activo.
- **Regeneración de Emergencia**: Invalidar claves y forzar cambio inmediato.
- **Auto-Gestión del Punto**: Endpoint `/mi-situacion`.

### Modificado
- **Arquitectura de Alcabalas**: Migración a cuentas fijas vinculadas a puntos físicos.
- **Servicio de Autenticación**: Validación dual Hash/OTP para `ALCABALA`.

### Seguridad
- Motor criptográfico de semillas (`secret_key` + `key_salt`).

---

## [0.6.0] — 2026-04-02

### Añadido
- **PWA (Mobile First)**: Aplicación Web Progresiva instalable.
- **Iconografía Táctica**: Iconos 192/512 adaptativos.
- **Service Worker**: Caché para carga inmediata.
- **Guía de Usuario**: Directiva de instalación PWA.

### Modificado
- **Navegación**: Layout Global en `RutaProtegida`.
- **HomeRedirect**: Redirección inteligente por rol.

### Corregido
- Bucle de login Alcabala.
- Navegación discreta con `hideNav`.
- Error `ERESOLVE` en Railway.

---

## [0.5.1] — 2026-04-02

### Añadido
- Dashboard del Comandante.
- Módulo de Alcabalas con guardias temporales.
- Pases Masivos FL-08.
- Validación de tokens `pase_evento`.

---

## [0.4.0] — 2026-04-02

### Añadido
- Milestone de producción en Railway.

### Corregido
- Error 502 por mapeo de puerto.
- Limpieza de logs de diagnóstico.
- CORS restrictivo restaurado.

---

## [0.3.0] — 2026-04-02

### Corregido
- Parche de estabilidad Railway.

---

## [0.2.0] — 2026-03-31

### Agregado
- Módulo de Socios (backend, esquemas, endpoints).
- Modelos de Membresía e Infracción.

### Corregido
- Migración a Tailwind CSS v4.
- CORS normalizado para desarrollo.

---

## [0.1.0] — 2026-03-30

### Agregado
- Directiva Maestra, Roles, Schema BD, Flujos de Negocio.
- Plan de implementación.
- Stack: FastAPI + React/Vite + Supabase + Railway.

---

*Formato: `## [versión] — fecha`*
*Categorías: Agregado | Modificado | Deprecado | Eliminado | Corregido | Seguridad*
