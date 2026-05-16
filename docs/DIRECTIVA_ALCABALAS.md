# DIRECTIVA — MÓDULO ALCABALAS (BAGFM v2.0)

Este documento define el estándar de implementación para el módulo de control de acceso y el protocolo de relevo táctico en puntos de control (alcabalas). **Consultar obligatoriamente ante cualquier cambio estructural.**

---

## 1. Visión General
El módulo de Alcabala es la interfaz operativa del personal de guardia. Su función es validar el ingreso de socios y vehículos mediante el escaneo de códigos QR, verificando en tiempo real la vigencia de credenciales y la ausencia de infracciones bloqueantes.

**v2.0 — Cambio de paradigma**: El flujo del guardia de alcabala se **simplifica**. La verificación de identidad y el registro de datos del socio se delegan al **parquero** (ver DIRECTIVA_PARQUERO.md). El guardia:
- Escanea QR → recibe respuesta inmediata
- Si es válido: registra entrada + opcionalmente registra datos
- Notifica automáticamente al parquero vía WebSocket + Push

---

## 2. Gestión de Seguridad y Relevo (Protocolo Táctico)

### RT-01 — Cuentas Fijas y Claves Rotativas
- **Identidad Fija**: Cada alcabala física tiene una cuenta de usuario persistente.
- **Rotación Máxima**: La contraseña cambia automáticamente cada **24 horas**.
- **Sincronización**: A las **08:30 AM Caracas (VET)**.
- **Código de 6 dígitos**: Generado algorítmicamente basado en `secret_key` + fecha táctica.
- **Regeneración de Emergencia**: El Comandante puede invalidar la clave actual refrescando `key_salt`.

### RT-02 — Protocolo de Identificación Mandatorio
1. **Acceso Inicial**: Al loguearse, el sistema bloquea funciones de escaneo.
2. **Registro de Relevo**: El guardia debe suministrar:
   - Grado Militar
   - Nombres y Apellidos
   - Unidad de Adscripción
   - Teléfono de Contacto
3. **Validación de Turno**: Una vez registrado, se habilita el Dashboard Operativo.

---

## 3. Lógica de Validación (SOP) — v2.0

### FL-04 v2 — Flujo de Validación de Acceso (Simplificado)

```
1. ESCANEO: Captura del token JWT desde el QR

2. VALIDACIÓN del sistema:
   a. Firma JWT válida
   b. QR activo y no expirado
   c. Membresía activa (si aplica)
   d. Infracciones bloqueantes (solo para salida)

3. RESPUESTA al guardia:

   ✅ VÁLIDO CON DATOS:
   → Pantalla verde
   → Muestra: nombre, foto, entidad, vehículo, ZONA ASIGNADA
   → Botones:
     - "REGISTRAR ENTRADA" (acción principal)
     - "SEGUIR ESCANEANDO" (volver al escáner)

   ✅ VÁLIDO SIN DATOS (pase sin datos completos):
   → Pantalla verde con indicador "DATOS PENDIENTES"
   → Botones:
     - "REGISTRAR ENTRADA" (confirma sin datos — válido)
     - "REGISTRAR DATOS" (OPCIONAL — abre formulario de datos)
     - "SEGUIR ESCANEANDO"

   ❌ INVÁLIDO:
   → Pantalla roja
   → Motivo de rechazo
   → Opción de acceso manual (si tiene permiso)

4. Al confirmar ENTRADA:
   - Se registra acceso tipo "entrada" en tabla accesos
   - Se guarda hora_entrada_base en codigos_qr
   - Se emite WS: vehiculo_ingreso_base al parquero de la zona
   - Se envía Push Notification al parquero
   - Si socio solicita: botón "COMPARTIR UBICACIÓN"
     → Deep link a Google Maps/Waze con coords de la zona

5. IMPORTANTE:
   - El registro de datos es OPCIONAL en la alcabala
   - La verificación completa se delega al PARQUERO
   - El formulario de "REGISTRAR DATOS" es el mismo que existía antes
     pero ahora es un botón opcional, no obligatorio
```

---

## 4. Arquitectura Técnica

### Backend
- **Service**: `alcabala_service.py` — CRUD de alcabalas, regeneración de claves, registro de relevos
- **Service**: `acceso_service.py` — Validación de QR (evolución v2.0: incluye zona_asignada)
- **Security**: `password_rotativo.py` — Lógica criptográfica de claves de 6 dígitos
- **Models**: 
  - `PuntoAcceso`: Semillas de clave y usuario vinculado
  - `GuardiaTurno`: Historial de personal físico en el punto

### Frontend
- **Dashboard**: `Dashboard.jsx` (Alcabala) con bloqueo de identificación mandatoria
- **Scanner**: `Scanner.jsx` (Alcabala) — Simplificado v2.0:
  - Escaneo → respuesta inmediata
  - Botones: Registrar Entrada / Registrar Datos (opcional) / Seguir Escaneando
  - Botón compartir ubicación de estacionamiento
- **Mando**: `Alcabalas.jsx` (Comandante) con monitor de personal y gestión de claves

### WebSocket / Push
- Al confirmar entrada: emite `vehiculo_ingreso_base` al canal `zona:{zona_id}`
- Push Notification al parquero: "🚗 [PLACA] en camino a tu zona"

---

## 5. Convenciones de Seguridad
- Nunca almacenar el código de 6 dígitos en texto plano
- Toda acción de escaneo debe estar vinculada a un registro activo de `GuardiaTurno`
- El botón de contacto (Llamada/Copia) en el panel de mando es prioridad
- El formulario de datos (REGISTRAR DATOS) es OPCIONAL — no bloquea el acceso

---

## 6. Correcciones v2.1 (2026-04-23)

### BUG-01: Error 500 al registrar acceso de pase masivo sin usuario
**Causa**: El modelo `accesos.usuario_id` tiene `nullable=False` en BD. Cuando se registra un pase de tipo `evento_simple` sin socio vinculado, el `usuario_id` llegaba como `None` al INSERT.

**Corrección en `acceso_service.py`**:
- Si `final_usuario_id` es `None` después de toda la lógica de registro manual, se crea automáticamente un usuario anónimo temporal (`ANONIMO-XXXXXXXX`) para cumplir la restricción NOT NULL.
- Esto aplica a pases de visitantes sin cédula que el guardia confirma directamente.

**Corrección en `schemas/acceso.py`**:
- `AccesoSalida.usuario_id` cambió de `UUID` a `Optional[UUID]` para que el schema no rompa en la respuesta.

### MEJORA-01: Vista de datos del socio en modo lectura
El `Scanner.jsx` fue rediseñado con los siguientes principios:

1. **Colores adaptativos**: Todos los fondos usan `color-mix(in srgb, var(--COLOR) X%, var(--bg-app))` en lugar de clases hardcoded `bg-red-50/dark:...`. Esto garantiza coherencia en ambos modos.

2. **Layout centrado**: El scroll del resultado siempre vuelve al tope de pantalla (`window.scrollTo({ top: 0 })`) al recibir un resultado.

3. **FichaSocio (modo lectura)**: Cuando el QR es válido y tiene datos de socio/vehículo, se muestra una tarjeta de lectura con:
   - Foto + nombre + cédula + entidad
   - Teléfono de contacto
   - Vehículo con placa, color, marca, modelo
   - Si el socio tiene **múltiples vehículos**: lista de selección para que el guardia indique con cuál ingresa

4. **Modal de formulario oculto por defecto**: El formulario de datos manuales (`InputManual`) ahora se muestra ÚNICAMENTE cuando el guardia presiona "Registrar Datos (Opcional)". No aparece automáticamente al escanear.

5. **Badge de pase masivo**: Cuando el resultado es un pase masivo, se muestra un badge con nombre del evento, serial legible y accesos restantes.

### MEJORA-02: Multi-vehículo
El backend ahora retorna `vehiculos: List[VehiculoSalida]` en `ResultadoValidacion` con todos los vehículos activos del socio. El frontend muestra un selector cuando hay más de uno.

El `vehiculo_id` enviado al registrar se toma del vehículo seleccionado por el guardia.

---

### BUG-02: Error relation "push_subscriptions" does not exist (2026-04-24)
**Causa**: El modelo `PushSubscription` fue implementado pero no fue registrado en `app/models/base.py`, lo que causó que Alembic no detectara la tabla y el sistema fallara al intentar consultar suscripciones para notificaciones. Además, al fallar la consulta dentro de una transacción activa, se abortaba el registro del acceso (`InFailedSQLTransactionError`).

**Corrección**:
1. **Modelos**: Se registró `PushSubscription` en `app/models/base.py`.
2. **Base de Datos**: Se generó y aplicó migración `a128ff455a97` para crear la tabla faltante.
3. **Resiliencia (Post-Commit)**: Se refactorizó `acceso_service.py` para mover el bloque de notificaciones **después del commit** de la base de datos.
   - Esto garantiza que si el sistema de notificaciones falla (ya sea por BD o por el servicio externo de WebPush), el registro de entrada del vehículo **ya esté asegurado y persistido**.

---

*Última actualización: 2026-04-24 | v2.2 — Estabilización de notificaciones y resiliencia post-commit*
*Docs Relacionados: SCHEMA_BD.md, ROLES_Y_PERMISOS.md, DIRECTIVA_PARQUERO.md*
