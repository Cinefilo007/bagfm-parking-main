# BAGFM v2.0 — DOCUMENTO INTEGRAL DEL SISTEMA
## Sistema de Control de Acceso Vehicular y Gestión Inteligente de Estacionamientos
### Base Aérea Generalísimo Francisco de Miranda (La Carlota)

**Versión**: 2.0.0  
**Fecha**: 18 de abril de 2026  
**Filosofía del sistema**: "PREPARARNOS PARA EL CAOS"

---

# PARTE 1 — CONTEXTO Y VISIÓN

## 1.1 ¿Qué es BAGFM?

BAGFM es una plataforma web progresiva (PWA) que gestiona el control de acceso vehicular y la administración inteligente de estacionamientos en la Base Aérea Generalísimo Francisco de Miranda, ubicada en La Carlota, Caracas, Venezuela.

La base alberga múltiples entidades civiles (empresas, organizaciones culturales, deportivas) que realizan eventos masivos con alta concurrencia vehicular. El principal desafío operativo es que las vías dentro de la base son de **una sola dirección** (ida y vuelta), lo que genera cuellos de botella cuando miles de vehículos intentan entrar o salir simultáneamente.

## 1.2 Problema que Resuelve

Sin BAGFM, la operación depende de listas en papel, radios y coordinación informal. En un evento masivo con más de 500 vehículos, esto genera:

- Colas kilométricas en las alcabalas (puntos de control)
- Vehículos estacionados en zonas no autorizadas
- Imposibilidad de saber cuántos puestos quedan libres
- Falta de trazabilidad: no se sabe quién entró, a qué hora, ni a dónde fue
- Corrupción: parqueros asignando puestos VIP de forma irregular
- Infracciones sin registro: choques, estacionamiento ilegal, daños

## 1.3 Visión v2.0

La versión 2.0 evoluciona el sistema de un simple control de acceso a una **plataforma integral de gestión logística táctica**, incorporando:

1. **Gestión inteligente de estacionamientos** con puestos identificados y coordenadas GPS
2. **Roles especializados** para operaciones de campo (parquero, supervisor)
3. **Comunicación en tiempo real** (WebSocket + Push Notifications)
4. **Sistema de sanciones vehiculares** con gravedad escalonada
5. **Detección automática de vehículos fantasma** con escalamiento progresivo
6. **Pases autónomos** con tipos de acceso personalizables
7. **Anti-corrupción** con auditoría automática y métricas de eficiencia

---

# PARTE 2 — ROLES DEL SISTEMA

## 2.1 Jerarquía de Roles

El sistema tiene 8 roles organizados jerárquicamente:

### Nivel 1 — Comando de la Base
- **COMANDANTE**: Máxima autoridad. Crea entidades, asigna zonas, gestiona lista negra, resuelve infracciones críticas, aparta puestos para personal de la base, emite órdenes de búsqueda.
- **ADMIN_BASE**: Administrador operativo de la base. Gestiona alcabalas, guardias, resuelve infracciones graves.
- **SUPERVISOR**: Supervisor de ronda. Patrulla la base, reporta infracciones, resuelve infracciones moderadas, ubica vehículos fantasma en el campo.
- **ALCABALA**: Guardia de punto de control. Escanea QR, registra entradas/salidas, reporta infracciones.

### Nivel 2 — Entidades Civiles
- **ADMIN_ENTIDAD**: Administrador de una entidad civil. Gestiona socios, pases, parqueros, reserva puestos, resuelve infracciones leves de su entidad, crea tipos de acceso personalizados.
- **SUPERVISOR_PARQUEROS** *(NUEVO v2.0)*: "Director de orquesta" de las operaciones de estacionamiento de su entidad. Dashboard global, reasignación de parqueros, comunicación broadcast, resuelve infracciones leves.

### Nivel 3 — Operaciones de Campo
- **PARQUERO**: Operador de campo en zona de estacionamiento. Recibe vehículos, asigna puestos, registra datos con IA, reporta infracciones.

### Nivel 4 — Usuarios Finales
- **SOCIO**: Persona que ingresa a la base con su vehículo. Puede tener membresía permanente o pase temporal.

## 2.2 Autenticación por Rol

| Rol | Método de Login | Persistencia |
|-----|----------------|-------------|
| Comandante, Admin Base | Cédula + contraseña | Permanente |
| Supervisor de Ronda | Cédula + contraseña | Permanente |
| Alcabala (Guardia) | Código de alcabala + contraseña diaria | Sesión temporal |
| Admin Entidad | Cédula + contraseña (Default: Cédula) | Permanente |
| Supervisor Parqueros | Cédula + contraseña (Default: Cédula) | Permanente |
| Parquero | Cédula + contraseña (Default: Cédula) | Permanente |
| Socio | Cédula + contraseña (Default: Cédula) | Según tipo de acceso |

---

# PARTE 3 — ZONAS DE ESTACIONAMIENTO

## 3.1 Estructura

La base se divide en **zonas de estacionamiento** que el Comandante crea y asigna a las entidades civiles.

Cada zona puede ser:
- **Con puestos identificados**: Cada puesto tiene un código (ej: "A-01", "A-02"), opcionalmente con coordenadas GPS para ubicarlos en el mapa.
- **Sin puestos identificados**: Solo se define una capacidad total (ej: "50 vehículos") y se controla por número.

### Tipos de zona:
- Abierta (al aire libre)
- Techada
- Subterránea

## 3.2 Asignación de Zonas

```
1. Comandante crea la zona con nombre, capacidad, tipo, coordenadas
2. Comandante asigna la zona a una entidad con un cupo (ej: 100 puestos de 150 totales)
3. OPCIONALMENTE, aparta X puestos para "personal de la base" (reservado_base)
   → Estos NO cuentan en la cuota de la entidad
   → Uso: oficiales, personal militar, vehículos institucionales
4. La suma de cupos asignados define la cuota_pases_autonoma de la entidad
```

## 3.3 Reserva de Puestos

### Por el Admin de la Entidad:
El admin puede reservar puestos específicos dentro de su cupo para asignarlos a socios VIP, productores o invitados especiales. Los puestos reservados no se asignan automáticamente por el sistema; el admin los vincula manualmente a pases.

### Por el Comandante (Personal de Base):
El comandante puede apartar puestos de cualquier zona para uso exclusivo del personal de la base. Estos puestos tienen estado "reservado_base" y están fuera de la cuota de la entidad.

## 3.4 Compartir Ubicación

Cada zona y puesto puede tener coordenadas GPS. El sistema genera un botón "Compartir ubicación" que:
- En Google Maps: abre navegación directa al punto de acceso de la zona
- En la PWA: muestra el puesto en el mapa táctico integrado (Leaflet)

## 3.5 Tiempo Límite de Llegada (Configurable)

Cada zona tiene un campo `tiempo_limite_llegada_min` que define cuánto puede tardar un vehículo en llegar desde la alcabala. Este valor:
- Es **configurable por zona** (zona lejana: 25 min, zona cercana: 10 min)
- Puede ser **ajustado en tiempo real** por el supervisor de parqueros o admin de la entidad (en eventos masivos con colas: subir a 30-45 min)
- Tiene un valor por defecto global de 15 minutos

---

# PARTE 4 — FLUJOS OPERATIVOS

## 4.1 Onboarding de una Entidad (FL-01)

```
1. Comandante crea la Entidad Civil (nombre, código, descripción)
   → La capacidad se calcula dinámicamente según puestos asignados.
2. Comandante crea Zona(s) de Estacionamiento
3. Comandante asigna Zona(s) a la Entidad con cupo + opcionalmente aparta para base
4. Comandante crea Admin Entidad (email + password por defecto: cédula)
5. Admin Entidad ingresa, cambia contraseña, completa perfil
6. Admin Entidad registra Supervisor de Parqueros
7. Admin Entidad registra Parqueros y asigna zonas
8. Admin Entidad carga socios (manual o Excel)
9. Entidad operativa ✅
```

## 4.2 Acceso por Alcabala — Flujo Simplificado v2.0 (FL-04)

```
1. Vehículo llega a la alcabala
2. Guardia escanea QR con la cámara del teléfono
3. Sistema valida:
   → ¿Está en lista negra? → DENEGAR y mostrar razón
   → ¿Está suspendido? → DENEGAR y mostrar fecha de fin
   → ¿Código válido? → CONTINUAR

4. SI el código es VÁLIDO:
   El guardia ve 3 botones:
   a. [✅ Registrar Entrada] → registra acceso + emite notificación al parquero
   b. [📋 Registrar Datos] → OPCIONAL: formulario con IA para registro del portador
   c. [📷 Seguir Escaneando] → vuelve al escáner

5. SI el pase tiene datos completos:
   → Muestra nombre, cédula, tipo de acceso, zona asignada
   → Notificación al parquero incluye: marca, modelo, color, placa, nombre

6. SI NO tiene datos:
   → Notificación al parquero: "⚠️ VEHÍCULO — DATOS PENDIENTES"
   → El parquero se prepara para registrar al socio cuando llegue

7. El guardia NO está obligado a verificar identidad (eso se delega al parquero)
```

**Notificaciones al parquero** (vía WebSocket + Push):
- CON datos: "🚗 ABC-123 (Toyota Corolla Blanco) en camino a tu zona — Juan Pérez"
- SIN datos: "🚗 Vehículo en camino — ⚠️ DATOS PENDIENTES, preparar registro"

## 4.3 Recepción en Zona — Portal del Parquero (FL-05)

El parquero tiene 3 métodos para recibir un vehículo:

### Método A — Escáner QR (flujo completo):
```
1. Escanea QR del socio
2. SI tiene datos: muestra ficha (nombre, vehículo, membresía)
   → SI tiene puesto pre-asignado (VIP): lo indica
   → SI no: sugiere puesto disponible automáticamente
   → Parquero confirma
3. SI NO tiene datos:
   → Formulario de registro CON ESCÁNER IA DE DOCUMENTOS
   → Botón "Escanear Cédula" → cámara → IA extrae datos
   → Parquero completa datos del vehículo
   → Confirma → datos registrados + puesto asignado
```

### Método B — Registro por placa (agilización masiva):
```
1. Ingresa placa manualmente
2. SI existe en BD: muestra datos → asigna puesto
3. SI NO: formulario con IA → registra datos completos
```

### Método C — Asignación rápida (máxima velocidad):
```
1. Selecciona puesto en el dashboard
2. Ingresa solo placa
3. Confirma → ocupado
```

### Registro de Salida:
- **Por placa** (recomendado): ingresa placa → libera puesto → no detiene al socio
- **Por QR** (opcional): escanea → libera
- **Por puesto** (desde dashboard): toca puesto → confirma salida

## 4.4 Supervisor de Parqueros — "Director de Orquesta" (FL-16)

```
1. Dashboard global:
   - Todas las zonas de la entidad con ocupación en vivo
   - Parqueros con semáforo: 🟢 Normal, 🟡 Atención, 🔴 Crítico
   - Feed de actividad en tiempo real
   - Flujo vehicular (vehículos/hora), puestos libres vs ocupados

2. Comunicación broadcast (complemento de radios):
   a. Instrucción general → todos los parqueros
   b. Instrucción por zona → parqueros de zona X
   c. Instrucción individual → parquero específico
   → Cada instrucción genera Push + WS
   → El supervisor ve quiénes han leído

3. Gestión operativa:
   - Reasignar parquero a otra zona según demanda
   - Relevar parquero inmediatamente (desactiva cuenta + cierre forzoso)
   - Registrar incentivos/sanciones
   - Ajustar tiempo límite de zona en tiempo real

4. Log de operaciones:
   - Entradas/salidas por alcabala con destino a zonas de la entidad
   - Operaciones por zona (quién registró, método, hora)
   - Búsqueda por placa, nombre, puesto
```

## 4.5 Pases Masivos con Autonomía (FL-08)

```
1. Admin accede a "Generar Pases"
2. Ve indicador: "Cuota disponible: 55/100 puestos"
3. Configura el lote:
   - Tipo de acceso (base: logística/prensa/VIP/general/staff/artista + personalizados)
   - Tipo de pase (simple/identificado/portal)
   - Cantidad, fechas, evento, max accesos
   - Asignación de estacionamiento (VIP, logística, productores):
     → Seleccionar zona destino (opcional)
     → Seleccionar puestos específicos si la zona los tiene
     → Puestos quedan en estado "reservado" → vinculados a los pases

4a. Cantidad ≤ cuota → genera lote DIRECTO (sin aprobación)
4b. Cantidad > cuota → solicitud automática al comandante

TIPOS DE PASE:
- Simple: QR genérico, datos se registran al llegar
- Identificado: pre-cargado desde Excel o manual
- Portal: el portador accede a un portal y completa sus datos
```

### Tipos de Acceso Personalizables
El admin de cada entidad puede crear tipos de acceso adicionales a los 6 base:
- Ejemplos: "Proveedor Externo", "Instructor", "Catering", "Patrocinador", "Fotógrafo"
- Cada tipo tiene: nombre, etiqueta legible, color identificador, icono opcional
- Sistema híbrido: si tipo_acceso = 'custom' → consultar tabla tipos_acceso_custom

### Múltiples Vehículos por Pase
Un productor/staff/logístico puede necesitar acceso para varios vehículos:
- Tabla junction: vehiculos_pase (1 pase → N vehículos)
- Vehículo principal + adicionales
- Pases tipo portal: el portador auto-registra vehículos desde su portal
- En alcabala/parquero: se muestran TODOS los vehículos del pase

## 4.6 Reserva y Apartado de Puestos (FL-17)

**Apartado para personal de base** (Comandante):
- Define cupo_reservado_base en la asignación de zona
- Si la zona tiene puestos: selecciona cuáles
- Estado "reservado_base" → no disponibles para la entidad

**Reserva para clientes** (Admin Entidad):
- Selecciona puestos individuales o cantidad
- Marca como "reservado" para su entidad
- Opcionalmente asigna a un socio específico
- Los vincula a pases VIP/logística

---

# PARTE 5 — SANCIONES VEHICULARES v2.0

## 5.1 Problema

En el caos de un evento masivo pueden ocurrir:
- Colisiones entre vehículos
- Estacionamiento en zonas prohibidas o no asignadas
- Acceso sin autorización a áreas restringidas
- Daños a infraestructura de la base
- Abandono de vehículos post-evento
- Ruido excesivo (alarmas, música)
- Vehículos fantasma (entraron pero no se registraron en ninguna zona)

## 5.2 Tipos de Infracción (12)

| Tipo | Descripción | Gravedad Sugerida |
|------|-------------|:-----------------:|
| mal_estacionado | Estacionado fuera de su puesto asignado | LEVE |
| ruido_excesivo | Alarma de auto, música excesiva | LEVE |
| vehiculo_fantasma | Detectado por sistema automático | MODERADA |
| exceso_velocidad | Velocidad excesiva dentro de la base | MODERADA |
| zona_prohibida | Estacionado en zona no autorizada | MODERADA |
| conducta_indebida | Comportamiento inapropiado del conductor | MODERADA |
| documentos_vencidos | Documentos del vehículo vencidos | MODERADA |
| acceso_no_autorizado | Entró a zona sin pase válido | GRAVE |
| colision | Choque con otro vehículo o infraestructura | GRAVE |
| abandono_vehiculo | Vehículo abandonado post-evento | GRAVE |
| daño_propiedad | Daño a infraestructura de la base | CRÍTICA |
| otro | Cualquier otra infracción | Variable |

La gravedad es **sugerida por el sistema** pero **sobrescribible** por quien reporta.

## 5.3 Escala de Gravedad y Consecuencias

| Gravedad | Consecuencia Automática | Quién Resuelve |
|----------|------------------------|:---------------|
| **LEVE** | Amonestación registrada. No bloquea nada. | Admin Entidad, Supervisor Parqueros, Supervisor Base |
| **MODERADA** | **Bloquea salida** del vehículo hasta resolución. | Supervisor Base, Admin Base, Comandante |
| **GRAVE** | Bloquea salida + **suspensión temporal** de acceso (X días). | Admin Base, Comandante |
| **CRÍTICA** | Bloquea salida + **lista negra permanente** + reporte a autoridades. | Solo Comandante |

**Regla fundamental**: Las infracciones MODERADA, GRAVE y CRÍTICA son competencia **exclusiva** del personal de la base. La entidad solo resuelve LEVES.

## 5.4 Reporte de Infracciones

### Reporte Rápido (desde dashboard):
```
1. Botón flotante "⚠️ Reportar" (siempre visible en dashboards del parquero, supervisor, alcabala)
2. Seleccionar vehículo (de la lista en zona o ingresando placa)
3. Tipo de infracción (selector visual con iconos)
4. Gravedad (sugerida automáticamente, sobrescribible)
5. Foto de evidencia con cámara del teléfono (OBLIGATORIA para ≥ MODERADA)
6. [📍 Registrar ubicación] → OPCIONAL — captura coordenadas GPS exactas del incidente
7. Descripción breve → Confirma
```

### Infracción del Sistema (automática):
Cuando el sistema detecta un vehículo fantasma, crea automáticamente una infracción tipo=vehiculo_fantasma, gravedad=moderada.

## 5.5 Geolocalización de Infracciones

Las infracciones pueden tener coordenadas geográficas opcionales (latitud + longitud):
- El reportante presiona "📍 Registrar ubicación" en el formulario
- El dispositivo captura las coordenadas exactas
- En el dashboard de infracciones se muestran como pines en el mapa táctico
- Permite generar un "mapa de calor" de infracciones: identificar puntos problemáticos de la base
- Útil para enviar supervisores de ronda a la ubicación exacta

## 5.6 Resolución

```
OPCIONES DE RESOLUCIÓN:
a. RESOLVER → Desbloquea salida, reactiva acceso si aplica
b. PERDONAR → Desbloquea + registra como perdonada + observaciones
c. ESCALAR → Envía a un rol superior (estado: en_revision)
d. APELAR → El socio solicita revisión (estado: apelada)

**SOP de Credenciales**: Por seguridad y simplicidad táctica, toda alta de personal nuevo (Operativos o Admins) utiliza el número de cédula como contraseña inicial. Se insta al usuario a cambiarla tras el primer ingreso exitoso.
```

## 5.7 Reincidencia

```
2da infracción del mismo tipo → gravedad sube 1 nivel automáticamente
3+ infracciones de cualquier tipo → se sugiere GRAVE
Lista negra → QR rechazado en TODAS las alcabalas permanentemente
Solo el Comandante puede retirar de la lista negra
```

## 5.8 Integración con el Ecosistema

- **Alcabala**: al escanear QR muestra si tiene infracciones activas, si está suspendido, o si está en lista negra
- **Parquero**: alerta visual si el vehículo tiene historial de infracciones
- **Supervisor Parqueros**: panel de infracciones activas en su dashboard
- **Comandante**: dashboard global de infracciones con estadísticas y mapa de calor

---

# PARTE 6 — DETECCIÓN DE VEHÍCULOS FANTASMA

## 6.1 Definición

Un **vehículo fantasma** es aquel que entró por una alcabala (tiene hora_entrada_base) pero NO se registró en ninguna zona de estacionamiento con un parquero dentro del tiempo límite configurado para esa zona.

## 6.2 Detección

Un **job periódico** se ejecuta cada 5 minutos y consulta:
```sql
SELECT * FROM codigos_qr
WHERE hora_entrada_base IS NOT NULL
  AND hora_llegada_zona IS NULL
  AND hora_entrada_base < now() - zona.tiempo_limite_llegada_min
  AND activo = true
  AND NO existe registro de salida posterior;
```

El tiempo límite es **configurable por zona** y **ajustable en tiempo real**.

## 6.3 Escalamiento Progresivo

Cuando se detecta un vehículo fantasma, las alertas escalan con el tiempo:

| Nivel | Tiempo Excedido | Se Notifica a | Color | Acción Disponible |
|:-----:|:---------------:|:-------------|:-----:|:-----------------|
| 1 | T (límite zona) | Supervisor Parqueros | 🟡 | Llamar al socio, marcar como llegado |
| 2 | T + 15 min | + Admin Entidad | 🟠 | Escalar, contactar |
| 3 | T + 30 min | + Supervisor de Ronda | 🔴 | Ubicar vehículo en campo |
| 4 | T + 45 min | + Admin Base | 🔴 | Coordinar búsqueda |
| 5 | T + 60 min | + Comandante | ⚫ | Orden de Búsqueda + infracción automática |

## 6.4 Orden de Búsqueda

Cuando la alerta llega al Comandante o Admin Base (niveles 4-5), pueden:

1. **Emitir Orden de Búsqueda**: Push Notification a TODOS los supervisores de ronda con: placa, marca, modelo, color, último punto (alcabala). La orden aparece como PRIORITARIA en el dashboard del supervisor.
2. **Reportar Infracción**: Crear infracción manual tipo=vehiculo_fantasma.
3. **Contactar Socio**: Si tiene datos, muestra teléfono para llamar.

---

# PARTE 7 — COMUNICACIÓN EN TIEMPO REAL

## 7.1 WebSocket

El sistema utiliza WebSocket nativo de FastAPI para mantener todas las interfaces actualizadas en tiempo real, sin necesidad de recargar la página.

### Canales:
| Canal | Destinatario |
|-------|-------------|
| `comando` | Comandante y Admin Base |
| `entidad:{id}` | Admin de la Entidad |
| `supervisor:{id}` | Supervisor de Parqueros |
| `zona:{id}` | Parqueros de esa zona |
| `parquero:{id}` | Parquero individual |

### Eventos principales:
- `vehiculo_ingreso_base` → Vehículo pasó la alcabala (con datos si los tiene)
- `vehiculo_llegada_zona` → Parquero registró la llegada
- `vehiculo_salida_zona` → Puesto liberado
- `puesto_actualizado` → Cambio de estado de un puesto
- `zona_ocupacion_cambio` → Porcentaje de ocupación actualizado
- `broadcast` → Mensaje del supervisor a parqueros
- `infraccion_registrada` → Nueva infracción (con gravedad y coords)
- `vehiculo_fantasma_nivel_X` → Alerta escalonada (niveles 1-5)
- `orden_busqueda` → Orden del comandante a supervisores de ronda
- `parquero_reasignado` → Cambio de zona del parquero
- `parquero_relevado` → Cierre forzoso de sesión

## 7.2 Push Notifications

La PWA implementa notificaciones Push vía Web Push API (VAPID) para que los usuarios reciban alertas incluso cuando no tienen la aplicación abierta.

Personalizadas por rol y situación:
- Parquero: "🚗 ABC-123 (Toyota Corolla Blanco) en camino a tu zona"
- Parquero: "📢 Instrucción del supervisor: [mensaje]"
- Supervisor: "⚠️ Zona B al 90%, parquero X inactivo"
- Supervisor: "🟡 Vehículo ABC-123 no ha llegado a Zona B"
- Comandante: "⚫ ALERTA MÁXIMA: Vehículo ABC-123 no localizado en 60+ min"
- Supervisores de ronda: "🔍 ORDEN DE BÚSQUEDA: Localizar ABC-123 — Toyota Hilux Blanco"

## 7.3 Broadcast (Supervisor)

El supervisor de parqueros puede enviar instrucciones complementarias a las radios:
- A todos los parqueros de la entidad
- A una zona específica
- A un parquero individual

Cada instrucción se envía vía Push + WebSocket, se registra en tabla mensajes_broadcast, y el supervisor puede ver quiénes han leído cada mensaje.

---

# PARTE 8 — SISTEMA ANTI-CORRUPCIÓN

## 8.1 Asignación Inteligente

- Los pases VIP/logística tienen puesto **pre-asignado** → el parquero no puede cambiarlo
- Para pases generales, el sistema **sugiere** un puesto automáticamente
- Si el parquero reasigna manualmente → queda registrado y auditable
- Si más del 30% de las asignaciones son manuales → alerta automática al supervisor

## 8.2 Incentivos para Parqueros

| Tipo | Descripción |
|------|-------------|
| bono_eficiencia | Recompensa por alto rendimiento |
| reconocimiento | Mención pública de buen desempeño |
| dia_libre | Día libre compensatorio |
| ascenso | Promoción de rol |

## 8.3 Sanciones para Parqueros

| Tipo | Descripción |
|------|-------------|
| amonestacion | Advertencia formal registrada |
| suspension_temporal | Suspensión por X días |
| relevo_inmediato | Desactiva cuenta + cierre forzoso de sesión vía WebSocket |
| reportar_autoridades | Escalamiento a la autoridad competente |

## 8.4 Relevo Inmediato

Si un parquero es relevado inmediatamente:
1. Su cuenta se desactiva
2. Su sesión se cierra forzosamente vía WebSocket
3. Se registra la sanción tipo "relevo_inmediato" con motivo
4. El supervisor puede reasignar la zona a otro parquero

---

# PARTE 9 — CARNETS DE ACCESO (PLUS)

## 9.1 Prioridades
1. **Siempre disponible**: Descarga del QR simple (imagen PNG)
2. **Opcional PLUS**: Generación de carnets visuales profesionales

## 9.2 Tipos de Carnet

| Tipo | Formato | Uso |
|------|---------|-----|
| Colgante | Vertical grande (~3.5" x 5.5") | Para colgar del cuello con lanyard |
| Cartera | Horizontal pequeño (~3.4" x 2.1") | Para billetera |
| Ticket | Horizontal alargado (~8" x 3") | Tipo entrada de concierto |
| Credencial | Horizontal estándar (~5.5" x 3.5") | Badge de evento |

## 9.3 Editor Visual

El admin tiene un editor visual en el frontend para crear y personalizar plantillas:
- Preview en tiempo real
- Selector de tipo, colores (primario, secundario, texto), fondo, logo
- Toggle: mostrar foto / vehículo / QR
- Generación individual o masiva (ZIP con todos los carnets del lote)

---

# PARTE 10 — EMAIL SERVICE

## 10.1 Arquitectura

| Tipo | Librería | Uso |
|------|----------|-----|
| Transaccional (1-50 emails) | `fastapi-mail` + SMTP | Compartir pase individual, bienvenida |
| Masivo (50+ emails) | Resend SDK ó AWS SES | Envío de lote completo por email |
| Templates | Jinja2 | HTML con branding de la entidad |

## 10.2 Envío Masivo

```
1. Admin va al lote → "Enviar por Email"
2. Sistema filtra pases que tienen email registrado
3. Muestra: "35 de 50 pases tienen email"
4. Admin confirma
5. Sistema envía con proveedor dedicado
6. Cada email incluye:
   - Template HTML con branding
   - QR del pase embebido
   - Datos: evento, fechas, zona asignada
   - Link con instrucciones de acceso
7. Admin ve progreso: "Enviados: 35/35 ✅"
```

---

# PARTE 11 — STACK TECNOLÓGICO

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite (PWA) |
| Estilos | Tailwind CSS |
| Estado | Zustand |
| Backend | Python — FastAPI |
| ORM | SQLAlchemy + Alembic |
| Base de datos | Supabase (PostgreSQL 15+) |
| Auth | JWT (HS256) |
| Tiempo real | WebSocket nativo (FastAPI) |
| Push | Web Push API (VAPID) |
| QR generación | qrcode + Pillow (Python) |
| QR escaneo | jsQR (JS) |
| Excel import | openpyxl (Python) |
| Mapas | Leaflet (JS) / Deep links |
| Email transaccional | fastapi-mail + SMTP |
| Email masivo | Resend SDK / AWS SES |
| Deploy | Railway |

### Principios Arquitectónicos
- **SOPs vs Ejecución**: La lógica vive en services/ (SOPs). Los endpoints solo orquestan.
- **Mobile-first**: PWA instalable en iOS/Android. Base de diseño: 375px de ancho.
- **Ningún campo se elimina**: Se depreca con documentación.
- **Configuración > Hardcoding**: Variables van en .env o tabla configuracion.

---

# PARTE 12 — BASE DE DATOS (RESUMEN)

## 12.1 Tablas Existentes (v1.x)
- `usuarios` — Todos los usuarios del sistema (con rol)
- `vehiculos` — Vehículos registrados
- `entidades_civiles` — Entidades que operan en la base
- `membresias` — Relación socio↔entidad
- `codigos_qr` — QR permanentes y temporales
- `accesos` — Log de entradas/salidas por alcabala
- `infracciones` — Infracciones vehiculares (EVOLUCIONADA en v2.0)
- `solicitudes_evento` — Solicitudes de pases extra-cuota
- `lotes_pase_masivo` — Lotes de pases generados
- `alcabalas` — Puntos de control de la base
- `zonas_estacionamiento` — Zonas de parking
- `accesos_zona` — Log de entradas/salidas por zona
- `configuracion` — Parámetros del sistema

## 12.2 Tablas Nuevas (v2.0) — 8 tablas
- `tipos_acceso_custom` — Tipos de acceso personalizados por entidad
- `puestos_estacionamiento` — Puestos individuales dentro de zonas
- `asignaciones_zona` — Entidad↔Zona con cupo y reserva base
- `incentivos_parquero` — Incentivos otorgados
- `sanciones_parquero` — Sanciones aplicadas
- `plantillas_carnet` — Plantillas de diseño para carnets
- `mensajes_broadcast` — Instrucciones del supervisor
- `vehiculos_pase` — Múltiples vehículos por pase

## 12.3 Evoluciones a Tablas Existentes
- `infracciones`: +12 columnas (gravedad, coordenadas geográficas, zona, puesto, fotos evidencia múltiples, bloqueo acceso futuro, suspensión, escalamiento, notas internas)
- `codigos_qr`: +12 columnas (tipo_acceso, tipo_acceso_custom_id, zona/puesto asignado, datos portador, multi_vehiculo, hora_entrada/llegada)
- `usuarios`: +zona_asignada_id para parqueros
- `zonas_estacionamiento`: +tiempo_limite_llegada_min configurable

## 12.4 Enums del Sistema
- `rol_tipo`: COMANDANTE, ADMIN_BASE, SUPERVISOR, ALCABALA, ADMIN_ENTIDAD, SUPERVISOR_PARQUEROS, PARQUERO, SOCIO
- `tipo_acceso_pase`: logistica, prensa, vip, general, staff, artista, **custom**
- `estado_puesto`: libre, ocupado, reservado, reservado_base, mantenimiento
- `infraccion_tipo`: 12 tipos (mal_estacionado, colision, zona_prohibida, etc.)
- `gravedad_infraccion`: leve, moderada, grave, critica
- `infraccion_estado`: activa, resuelta, perdonada, en_revision, apelada

---

# PARTE 13 — PLAN DE IMPLEMENTACIÓN

## Sprint 1 — Fundamentos (Backend + BD)
- Migraciones BD: todas las tablas y columnas nuevas
- Limpieza de datos de pruebas (conservar comandante)
- zona_service.py — CRUD zonas, puestos, reserva, apartado base
- parquero_service.py — Recepción, salida, registro con IA
- Evolución acceso_service.py — Flujo simplificado + notificaciones
- Evolución infraccion_service.py — Sanciones v2.0
- vehiculo_fantasma_service.py — Detección + escalamiento
- WebSocket por canales
- Push Notifications PWA (VAPID)
- fastapi-mail configuración

## Sprint 2 — Portales Operativos (Frontend)
- Portal Parquero completo (Dashboard, Scanner, IA, Salida, Métricas)
- Portal Supervisor de Parqueros (Dashboard, broadcast, reasignación)
- Dashboard Entidad v2 con tiempo real
- Simplificación Alcabala + reporte rápido
- Gestión de Zonas (Comandante)
- UI de infracciones y vehículos fantasma

## Sprint 3 — Pases, Carnets y Refinamiento
- Pases autónomos con zona/puesto + tipos custom + multi-vehículo
- Vista drill-down lotes → pases individuales
- Editor visual de carnets
- Envío masivo de email
- Dashboard de infracciones (estadísticas, mapa de calor, lista negra)

---

# PARTE 14 — GLOSARIO

| Término | Definición |
|---------|-----------|
| Alcabala | Punto de control de acceso a la base (garita) |
| Parquero | Operador de campo que gestiona la zona de estacionamiento |
| Supervisor de Parqueros | Coordinador que supervisa a todos los parqueros de una entidad |
| Puesto | Espacio individual de estacionamiento dentro de una zona |
| Pase | Código QR que autoriza el acceso de un vehículo a la base |
| Lote | Conjunto de pases generados simultáneamente |
| Cuota | Cantidad de pases que una entidad puede generar sin aprobación |
| Vehículo fantasma | Vehículo que entró por alcabala pero no se registró en ninguna zona |
| Lista negra | Registro de usuarios con acceso permanentemente denegado |
| Relevo inmediato | Desactivación forzosa de un parquero por el supervisor |
| Broadcast | Instrucción enviada por el supervisor a uno o más parqueros |
| Orden de búsqueda | Instrucción prioritaria del comandante para localizar un vehículo |
| SOPs | Standard Operating Procedures — lógica de negocio en los services |
| Tipo custom | Tipo de acceso personalizado creado por el admin de la entidad |

---

# PARTE 15 — TABLA DE DECISIONES DEL SISTEMA

| # | Decisión | Resolución |
|---|----------|------------|
| 1 | Verificación identidad en alcabala | OPCIONAL — delegada al parquero |
| 2 | Notificaciones Push | Personalizadas por rol y zona |
| 3 | Lista vehículos del parquero | Con datos de contacto del socio |
| 4 | Registro rápido por placa | Si no existe, registro completo con IA |
| 5 | Salida preferida | Por placa (QR opcional) |
| 6 | Carnets | Feature PLUS opcional |
| 7 | Auth parquero | Login personalizado |
| 8 | Asignación puestos en pases | Admin asigna zona/puesto al crear pases VIP |
| 9 | Reserva de puestos | Admin puede reservar y luego asignar |
| 10 | Puestos personal de base | Comandante aparta puestos (reservado_base) |
| 11 | Supervisor de Parqueros | Nuevo rol "Director de orquesta" |
| 12 | Notificación detallada | Push con marca/modelo/color/placa si tiene datos |
| 13 | Email masivo | fastapi-mail (transaccional) + Resend/SES (masivo) |
| 14 | IA para parquero | Mismo escáner de documentos que la alcabala |
| 15 | Múltiples vehículos | Tabla junction vehiculos_pase |
| 16 | Vehículos fantasma | Detección automática + escalamiento progresivo 5 niveles |
| 17 | Sanciones vehiculares | Gravedad escalonada + geolocalización + reincidencia |
| 18 | Tipos acceso custom | Admin de entidad crea tipos adicionales |
| 19 | Resolución infracciones | Entidad solo resuelve LEVES. MODERADA+ = personal base |
| 20 | Tiempo fantasma | Configurable por zona + ajustable en tiempo real |
| 21 | Escalamiento fantasma | Progresivo hasta comandante con orden de búsqueda |
| 22 | Geolocalización infracciones | Coordenadas opcionales + mapa de calor |

---

# PARTE 16 — ESTÁNDARES DE UI/UX (AEGIS TACTICAL v3)

Para mantener la estética premium y la eficiencia operativa del sistema, todos los desarrollos de frontend deben seguir estas directivas:

## 16.1 Modales Balanceados (Ajuste Táctico)
Debido a la presencia permanente del menú lateral en pantallas grandes (`lg:pl-72`), los modales deben configurarse para centrarse visualmente en el **área de contenido útil** y no en el centro absoluto de la pantalla.
- **Implementación**: Utilizar el componente `Modal` con la propiedad `balanced={true}` (activa por defecto).
- **Comportamiento**: 
  - El fondo oscuro (*backdrop*) debe cubrir el 100% de la pantalla (incluyendo el sidebar).
  - El contenedor de contenido del modal debe aplicar un desplazamiento izquierdo compensatorio (`lg:ml-72`) antes de centrar sus elementos internos.
  - En dispositivos móviles, el modal se centra automáticamente al 100% del viewport.

## 16.2 Tipografía y Colores
- **Fuentes**: `Inter` para cuerpo y datos; `Space Grotesk` para títulos técnicos y encabezados tácticos.
- **Micro-animaciones**: Todos los modales deben usar `animate-in fade-in zoom-in-95` con una duración de 300ms.
- **Empty States**: Cuando no existen datos (ej: Entidades, Infracciones), se debe mostrar una silueta del objeto con una descripción táctica en lugar de una pantalla en blanco.

# PARTE 17 — DIRECTIVAS DEL DASHBOARD DE ENTIDAD

Para el administrador de entidad (ADMIN_ENTIDAD), el dashboard actúa como una **Terminal de Gestión Administrativa** optimizada para la toma de decisiones rápidas sobre su concesión.

## 17.1 Estructura Visual y Jerarquía
- **Encabezado**: Debe priorizar el nombre de la entidad en fuente `Space Grotesk` (Mayúsculas) para reforzar la identidad corporativa/administrativa.
- **KPI Row (Métricas)**: Uso de tarjetas con iconos "Ghost" (grandes y semitransparentes al fondo) para representar:
  - **Socios**: Volumen total de membresías activas.
  - **Flota**: Cantidad de vehículos con autorización de acceso.
  - **Eventos**: Contador de solicitudes pendientes de aprobación ante el Comando.

## 17.2 Monitoreo Táctico
- El dashboard debe incluir una sección de **"Estado de la Concesión"** que agrupe alertas preventivas sobre vencimiento de carnets, membresías a punto de expirar o alertas de cupos de estacionamiento críticos.

## 17.3 Monitor de Capacidad Táctica (Parking)
- Se debe implementar una fila de métricas secundarias que segregue:
  - **Asignados**: Cuota total concedida por el Comando.
  - **Ocupados**: Vehículos validados por parqueros dentro de la zona.
  - **Libres**: Remanente real para asignaciones inmediatas.
  - **Eficiencia %**: Relación de uso para optimizar la logística de eventos.

## 17.4 Log Táctico y Fuerza Operativa
- **Monitor de Eventos**: Feed en tiempo real con código de colores según severidad (Ingreso=Verde, Salida=Azul, Alerta=Rojo).
- **Fuerza Operativa**: Ranking de eficiencia de parqueros para detectar cuellos de botella en sectores específicos de la base.
- **QR Security**: Panel de control de integridad de pases para prevenir el uso de códigos expirados o revocados.

## 17.5 Protocolos Operativos (Navegación)
En lugar de un menú convencional, se deben usar **Cards de Acción Rápida** que incluyan:
1. **Gestión de Socios**: Control de afiliaciones.
2. **Eventos Masivos**: Gestión de formularios FL-08.
3. **Personal Operativo**: Administración de parqueros y supervisores de la entidad.
4. **Estacionamientos**: Vista de puestos asignados y reglas de acceso.

## 17.4 Estética Premium
- **Gradients**: Uso de gradientes sutiles (ej: `bg-primary/5` con `border-primary/20`) para diferenciar las zonas de importancia.
- **Interactividad**: Implementar `group-hover:rotate-6` en iconos y `active:scale-95` en accesos directos.

---

*Documento actualizado: 19 de abril de 2026*  
*Sistema: BAGFM v2.0 — Gestión Inteligente de Estacionamientos*  
*Base Aérea Generalísimo Francisco de Miranda*
