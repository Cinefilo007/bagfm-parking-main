# FLUJOS DE NEGOCIO — BAGFM v2.0

> Consultar `DIRECTIVA_MAESTRA.md` antes de modificar este documento.
> **v2.0**: Flujos actualizados para gestión inteligente de estacionamientos.

---

## FL-01 — Onboarding de Entidad Civil

**Actor principal**: Comandante  
**Resultado**: La entidad puede operar y gestionar sus socios.

```
1. Comandante crea Entidad Civil
   - Nombre, código, descripción
   - Capacidad máxima de vehículos

2. Comandante crea Zona(s) de Estacionamiento (v2.0)
   - Nombre, capacidad, coordenadas
   - Tipo: abierto / techado / subterráneo
   - Con o sin puestos identificados

3. Comandante asigna Zona(s) a la Entidad (v2.0)
   - Selecciona zona(s) → asigna cupo por zona
   - OPCIONALMENTE aparta puestos para personal de la base (reservado_base)
   - Esto define automáticamente la cuota_pases_autonoma

4. Comandante crea Admin Entidad
   - Email + contraseña temporal

5. Admin Entidad ingresa por primera vez
   - Cambia contraseña
   - Completa perfil de la entidad

6. Admin Entidad registra Supervisor de Parqueros (v2.0)
   - Login personalizado — rol: SUPERVISOR_PARQUEROS
   - "Director de orquesta" de las operaciones de estacionamiento

7. Admin Entidad registra Parqueros (v2.0)
   - Login personalizado por parquero
   - Asigna zona de operación

8. Admin Entidad carga socios
   - Manual o importación Excel

9. ✅ Entidad operativa
```

---

## FL-02 — Registro de Socio (Manual)

**Actor principal**: Admin Entidad  
**Resultado**: Socio con QR activo puede ingresar a la base.

```
1. Admin Entidad crea usuario Socio
   - Cédula, nombre, apellido, teléfono, email (opcional)

2. Admin Entidad crea membresía para el socio
   - Selecciona vehículo(s) del socio
   - Estado: activa
   - Fecha inicio
   - Cupo (OPCIONAL)

3. Admin Entidad genera QR
   - Sistema crea JWT firmado (tipo: permanente)
   - QR descargable

4. Socio recibe credenciales
   - Puede ingresar al portal con su cédula
   - Descarga su propio QR

5. ✅ Socio listo para acceder a la base
```

---

## FL-03 — Importación Masiva de Socios (Excel)

**Actor principal**: Admin Entidad  
**Resultado**: Múltiples socios cargados de una vez.

```
1. Admin Entidad descarga plantilla Excel (.xlsx)
   - Columnas: cedula | nombre | apellido | telefono | email | placa | marca | modelo | color | año

2. Admin Entidad llena la plantilla

3. Admin Entidad sube el archivo al sistema

4. Backend (excel_service.py) procesa el archivo:
   a. Valida formato y columnas
   b. Valida cédulas únicas
   c. Valida placas únicas
   d. Reporta errores por fila si los hay

5. Vista previa con filas OK y filas con error

6. Admin confirma importación de filas válidas

7. Sistema crea usuarios, vehículos y membresías activas

8. ✅ Socios importados
```

---

## FL-04 v2 — Acceso a la Base (Alcabala) — SIMPLIFICADO *(Actualizado v2.0)*

**Actor principal**: Guardia de Alcabala  
**Resultado**: El vehículo entra y el parquero es notificado.

```
1. Socio llega a la alcabala y presenta QR

2. Guardia escanea QR con su teléfono (PWA)

3. Sistema verifica:
   a. ¿El token es válido? (firma JWT)
   b. ¿El QR está activo?
   c. ¿No ha expirado?
   d. ¿El socio tiene membresía activa? (si aplica)
   e. ¿El vehículo tiene infracción bloqueante? (si es salida)

4a. Si VÁLIDO CON DATOS completos:
    - Pantalla verde ✅
    - Muestra: nombre, foto, entidad, vehículo, ZONA ASIGNADA
    - Botones:
      → "REGISTRAR ENTRADA" (confirma acceso)
      → "SEGUIR ESCANEANDO" (volver al escáner)

4b. Si VÁLIDO SIN DATOS (pase sin registrar):
    - Pantalla verde ✅ con indicador "DATOS PENDIENTES"
    - Botones:
      → "REGISTRAR ENTRADA" (confirma acceso sin datos)
      → "REGISTRAR DATOS" (OPCIONAL — formulario de cédula/nombre/vehículo)
      → "SEGUIR ESCANEANDO"

4c. Si INVÁLIDO:
    - Pantalla roja ❌
    - Muestra motivo de rechazo
    - Guardia puede confirmar acceso manual (si tiene permiso)

5. Al confirmar entrada:
   - Sistema registra acceso tipo "entrada"
   - Registra hora_entrada_base en el QR
   - Emite WS: vehiculo_ingreso_base al parquero de la zona
   - Envía Push Notification al parquero: "🚗 [PLACA] en camino a tu zona"

6. Si socio lo solicita:
   - Botón "COMPARTIR UBICACIÓN DEL ESTACIONAMIENTO"
   - Genera deep link a Google Maps/Waze con coordenadas de la zona

NOTA: El registro de datos del socio/vehículo es OPCIONAL en la alcabala.
La verificación completa de identidad se delega al PARQUERO (FL-05 v2).
```

---

## FL-05 v2 — Verificación en Zona (Parquero) *(Actualizado v2.0)*

**Actor principal**: Parquero de la entidad civil  
**Resultado**: Vehículo registrado en puesto, sistema actualizado en tiempo real.

```
1. Parquero recibe Push Notification: "🚗 Vehículo ABC-123 en camino"
   - En su dashboard aparece en lista "VEHÍCULOS EN CAMINO"
   - Puede ver datos y preparar recepción

2. Socio llega a la zona. Parquero tiene 3 métodos de recepción:

   MÉTODO A — ESCÁNER QR (preferido con flujo completo):
   a. Parquero escanea QR del socio
   b. Sistema muestra ficha:
      - Si TIENE datos: nombre, foto, vehículo, membresía
        → Parquero verifica identidad visualmente
        → Sistema sugiere puesto disponible
        → Parquero confirma o reasigna puesto
      - Si NO TIENE datos: formulario de registro
        → Cédula, nombre, apellido, teléfono
        → Datos del vehículo (placa, marca, modelo, color)
        → (Este formulario era del guardia de alcabala en v1)
   c. Confirma → puesto marcado como ocupado

   MÉTODO B — REGISTRO POR PLACA (agilización en eventos masivos):
   a. Parquero ingresa placa del vehículo manualmente
   b. Sistema busca el vehículo en BD:
      - Si EXISTE: muestra datos del socio → asigna puesto
      - Si NO EXISTE: crea registro ligero (placa + datos mínimos)
   c. Confirma → puesto marcado como ocupado
   
   MÉTODO C — ASIGNACIÓN RÁPIDA (máxima velocidad):
   a. Parquero selecciona puesto en su dashboard
   b. Ingresa solo la placa
   c. Confirma → puesto marcado

3. Para cada registro:
   - Puesto → estado "ocupado"
   - Se registra hora_llegada_zona en el QR
   - verifica_por_parquero = true
   - Emite WS: puesto_actualizado al dashboard del admin
   - Emite WS: zona_ocupacion_cambio al dashboard del admin
   - Tiempo de atención registrado para métricas

4. Dashboard del parquero muestra:
   - Lista de TODOS los vehículos en su zona
   - Datos de contacto del socio (teléfono)
   - Estado de cada puesto
   - Métricas personales en tiempo real
```

---

## FL-05.1 — Salida de Zona (Parquero) *(NUEVO v2.0)*

**Actor principal**: Parquero  
**Resultado**: Puesto liberado, dashboard actualizado instantáneamente.

```
1. Socio avisa al parquero que se va

2. Parquero tiene 3 métodos de registro de salida:

   MÉTODO A — ESCÁNER QR (opcional):
   - Escanea QR → identifica puesto automáticamente → marca libre

   MÉTODO B — POR PLACA (recomendado para agilizar):
   - Ingresa placa del vehículo
   - Sistema busca el vehículo en la zona → marca puesto libre
   
   MÉTODO C — POR PUESTO (desde dashboard):
   - Toca el puesto ocupado en su dashboard
   - Confirma salida → puesto libre

3. Al confirmar salida:
   - Puesto → estado "libre"
   - vehiculo_actual_id → NULL
   - Emite WS: puesto_liberado + zona_ocupacion_cambio
   - Registro en tabla accesos_zona (tipo: "salida")
   - Dashboard admin se actualiza instantáneamente
```

---

## FL-06 — Registro de Infracción

**Actor principal**: Supervisor  
**Resultado**: Vehículo marcado, socio notificado, salida bloqueada si aplica.

```
OPCIÓN A — Por placa:
1. Supervisor abre Buscador Maestro
2. Escribe la placa del vehículo
3. Sistema muestra socio asociado, membresía, historial
4. Supervisor presiona "Registrar Infracción"
5. Formulario: tipo | descripción | foto (opcional) | bloquea_salida
6. Confirma → infracción creada

OPCIÓN B — Con QR:
1. Supervisor escanea QR
2. Sistema muestra ficha del socio
3. Supervisor presiona "Registrar Infracción"
4. Mismo formulario

Resultado:
- Infracción registrada con estado: activa
- Si bloquea_salida = true:
  → Al próximo escaneo en alcabala, pantalla muestra alerta
  → Guardia no puede confirmar salida
- El socio ve la infracción en su portal
- Push Notification al admin de la entidad del socio
```

---

## FL-07 — Resolución de Infracción

**Actor principal**: Comandante o Admin Base  
**Resultado**: Vehículo puede salir nuevamente.

```
1. Comandante abre lista de infracciones activas
2. Ve: descripción, foto, socio, vehículo, supervisor
3. Opciones:
   a. "Resolver" → infracción pasa a estado: resuelta
   b. "Perdonar" → infracción pasa a estado: perdonada
4. Si bloquea_salida era true → bloqueo se levanta
5. ✅ Vehículo puede salir
```

---

## FL-08 v2 — Pases Masivos (Admin Entidad) — CON AUTONOMÍA *(Actualizado v2.0)*

**Actor principal**: Admin Entidad  
**Resultado**: Pases generados autónomamente o solicitud creada automáticamente.

```
1. Admin Entidad accede a "Generar Pases"

2. Sistema muestra cuota: "Cuota disponible: 55/100 puestos"

3. Admin selecciona:
   - Tipo de acceso: logística | prensa | VIP | general | staff | artista
   - Tipo de pase: simple (Tipo A) | identificado (Tipo B) | portal (Tipo C)
   - Cantidad de pases
   - Fecha inicio / fin
   - Nombre del evento
   - Máximo de accesos por pase (opcional)

4a. Si cantidad ≤ cuota disponible:
    → Sistema genera lote DIRECTAMENTE sin aprobación del comandante
    → requiere_aprobacion = false
    → Descuenta de la cuota_pases_autonoma

4b. Si cantidad > cuota disponible:
    → Sistema crea solicitud automática al comandante
    → Estado: pendiente
    → requiere_aprobacion = true
    → Admin puede seguir operando, será notificado cuando se apruebe

5. Admin entra al lote generado y puede:
   → Ver lista de TODOS los pases individuales
   → Editar datos de cada pase (nombre, cédula, vehículo)
   → Compartir pases individuales (WhatsApp, email, link)
   → Descargar QR individual
   → PLUS: Generar carnet con plantilla seleccionada
   → Descargar ZIP (QRs o carnets)
   → Revocar/desactivar pases individuales

6. Clasificación por tipo_acceso:
   - LOGÍSTICA: Personal de montaje, producción (ANTES del evento)
   - PRENSA: Medios de comunicación
   - VIP: Invitados especiales
   - GENERAL: Público del evento
   - STAFF: Personal de apoyo
   - ARTISTA: Performers / Artistas
```

---

## FL-09 — Buscador Maestro (Multi-Rol)

**Actores**: Comandante, Admin Base, Supervisor, Alcabala  
**Resultado**: Ficha completa del socio/vehículo.

```
1. Usuario ingresa al Buscador Maestro
2. Busca por: placa, cédula, nombre/apellido
3. Sistema retorna resultados paginados
4. Ficha completa:
   - Datos del socio
   - Vehículo(s), Entidad, Membresía
   - Zona de estacionamiento asignada (v2.0)
   - Últimos 10 accesos
   - Infracciones activas/historial
5. Acciones según rol:
   - SUPERVISOR: "Registrar Infracción"
   - ALCABALA: "Confirmar Acceso Manual"
   - COMANDANTE / ADMIN_BASE: Todo + "Ver perfil completo"
```

---

## FL-10 — Membresía y Control de Cupos

**Actor principal**: Admin Entidad  

```
Estado de membresía:
- activa: puede acceder
- suspendida: NO puede acceder (QR bloqueado)
- vencida: NO puede acceder
- exonerada: puede acceder sin restricciones

Cupo de estacionamiento (OPCIONAL):
- Se asigna al crear/editar membresía
- El parquero ve el cupo al escanear
- El admin ve mapa de cupos en dashboard v2.0
```

---

## FL-11 — Gestión de Alcabalas y Guardias

**Actor principal**: Comandante

```
1. Comandante registra Punto de Acceso
2. Crea usuario fijo para ese punto
3. Genera clave rotativa (24h)
4. Guardia accede con clave → se identifica (mandatorio)
5. Guardia escanea → flujo FL-04 v2
```

---

## FL-12 — Notificación de Infracción en Red

**Actor principal**: Supervisor → Sistema

```
1. Supervisor registra infracción
2. Sistema detecta 'bloquea_salida' o gravedad
3. Emisión de notificaciones:
   - Push Notification al Comandante
   - WS alerta en todas las Alcabalas activas
   - Push Notification al Admin de la entidad del socio
4. Vehículo interceptado en próxima alcabala
```

---

## FL-13 — Gestión de Parqueros *(NUEVO v2.0)*

**Actor principal**: Admin Entidad  
**Resultado**: Parqueros monitoreados, incentivados o sancionados.

```
1. Admin Entidad registra parquero:
   - Cédula, nombre, apellido, teléfono
   - Login personalizado (cédula + contraseña)
   - Asigna zona de operación

2. Monitoreo en tiempo real (Dashboard v2):
   - Estado: activo/inactivo
   - Métricas:
     → Vehículos atendidos hoy
     → Tiempo promedio de atención
     → % de escaneos vs registros por placa
     → Reasignaciones manuales

3. Incentivos:
   - Admin otorga incentivo: bono_eficiencia, reconocimiento, día_libre, ascenso
   - Visible en métricas del parquero y dashboard

4. Sanciones:
   - Admin registra sanción: amonestación, suspensión temporal, relevo inmediato
   - Si relevo inmediato:
     → Sistema desactiva cuenta del parquero
     → Cierra sesión forzosamente vía WebSocket
     → Push Notification al parquero
   - Historial visible para auditoría

5. Relevo:
   - Botón "RELEVAR INMEDIATAMENTE"
   - Efecto inmediato sin necesidad de aprobación del comandante
```

---

## FL-14 — Gestión de Zonas de Estacionamiento *(NUEVO v2.0)*

**Actor principal**: Comandante / Admin Base  
**Resultado**: Zonas creadas y asignadas a entidades.

```
1. Comandante crea Zona de Estacionamiento:
   - Nombre, tipo (abierto/techado/subterráneo)
   - Capacidad total
   - Coordenadas (centro + punto de acceso)
   - ¿Usa puestos identificados? (Sí/No)
   - Tiempo límite de llegada (minutos)

2. Si usa puestos identificados:
   - Crear puestos individuales con código (A-01, A-02...)
   - Opcionalmente registrar coordenadas de cada puesto

3. Asignar zona a entidad:
   - Selecciona entidad → selecciona zona → define cupo
   - Una entidad puede tener múltiples zonas
   - El cupo total define la cuota_pases_autonoma

4. Zonas sin puestos identificados:
   - Se registra solo la capacidad y coordenadas del punto de acceso
   - Los puestos se manejan como contadores (libre/ocupado)
```

---

## FL-15 — Carnets de Acceso *(NUEVO v2.0)*

**Actor principal**: Admin Entidad  
**Resultado**: Carnets personalizados generados para los pases.

```
1. QR solo (predeterminado):
   - Siempre disponible → descarga directa del QR
   - Es la opción principal y más rápida

2. Carnet como PLUS (opcional):
   a. Admin selecciona tipo de carnet:
      - Colgante (vertical grande, para cuello)
      - Cartera (horizontal pequeño, tipo tarjeta)
      - Ticket (horizontal alargado, tipo entrada de concierto)
      - Credencial (badge horizontal estándar)
   b. Admin selecciona/crea plantilla:
      - Editor visual con preview en tiempo real
      - Colores: primario, secundario, texto
      - Fondo: imagen personalizada o predeterminado
      - Logo de la entidad
      - Datos a mostrar: foto, vehículo, QR
   c. Genera carnets:
      - Individual o masivo (para todo un lote)
      - Descarga individual o ZIP
```

---

## FL-16 — Supervisor de Parqueros *(NUEVO v2.0)*

**Actor principal**: Supervisor de Parqueros  
**Resultado**: Operación de estacionamiento coordinada en tiempo real.

```
1. Supervisor accede a su dashboard global:
   - Ve todas las zonas de la entidad con ocupación en vivo
   - Ve todos los parqueros con semáforo de eficiencia (🟢🟡🔴)
   - Feed de actividad en tiempo real (alcabala + zonas)

2. Monitoreo continuo:
   - Detecta zona con alta ocupación → envía refuerzo
   - Detecta parquero inactivo → alerta o reasigna
   - Ve flujo vehicular (entradas/salidas por hora)

3. Comunicación (complemento de radios):
   a. Instrucción general: broadcast a todos los parqueros
   b. Instrucción por zona: broadcast a parqueros de zona X
   c. Instrucción individual: mensaje a parquero específico
   → Cada instrucción genera Push + WS
   → Supervisor ve quiénes han leído

4. Gestión operativa:
   - Reasignar parquero a otra zona según demanda
   - Relevar parquero inmediatamente si es necesario
   - Registrar incentivos/sanciones

5. Log de operaciones:
   - Todas las entradas/salidas por alcabala con destino a zonas de la entidad
   - Operaciones por zona (quién registró, método, hora)
   - Búsqueda por placa, nombre, puesto

CONTEXTO OPERATIVO:
En eventos masivos con vías de una sola dirección,
el supervisor decide:
→ Qué zona priorizar para evitar colas
→ Dónde enviar refuerzos de parqueros
→ Cuándo cambiar la estrategia de asignación
```

---

## FL-17 — Reserva y Apartado de Puestos *(NUEVO v2.0)*

**Actores**: Comandante (apartado base), Admin Entidad (reserva)  
**Resultado**: Puestos pre-asignados antes de la llegada de vehículos.

```
FLUJO A — APARTADO PARA PERSONAL DE BASE (Comandante):
1. Comandante accede a gestión de zona
2. Define cupo_reservado_base (ej: 10 puestos)
3. Si zona tiene puestos identificados: selecciona cuáles
4. Puestos → estado "reservado_base"
5. Estos NO cuentan en la cuota de la entidad
6. Uso: oficiales, personal militar, vehículos institucionales

FLUJO B — RESERVA PARA CLIENTES (Admin Entidad):
1. Admin accede a gestión de puestos de su zona
2. Selecciona puestos individuales o cantidad
3. Marca como "reservado" → reservado_para_entidad_id = su entidad
4. OPCIONALMENTE asigna a un socio/cliente específico:
   → reservado_para_usuario_id = socio
5. Los puestos reservados NO se asignan automáticamente
6. Admin puede vincular el puesto reservado a un pase (VIP, logística)
7. Cuando el socio llega:
   → Parquero escanea → sistema indica "PUESTO RESERVADO: A-01"
   → Parquero dirige al socio al puesto correcto
```

---

## FL-18 — Sanciones Vehiculares *(NUEVO v2.0)*

**Actores**: Parquero (reporta), Supervisor (reporta/resuelve), Comandante (resuelve todo)  
**Resultado**: Infracción registrada con consecuencias automáticas según gravedad.

```
REPORTE RÁPIDO (desde dashboard del parquero/supervisor):
1. Presiona "⚠️ Reportar Infracción"
2. Selecciona vehículo (de lista en zona o placa manual)
3. Tipo de infracción (selector con iconos)
4. Gravedad sugerida por sistema (sobrescribible)
5. Foto de evidencia (OBLIGATORIA para ≥ MODERADA)
6. Descripción breve → Confirma

CONSECUENCIAS AUTOMÁTICAS:
LEVE     → Amonestación registrada. Sin bloqueos.
MODERADA → Bloquea salida hasta resolución.
GRAVE    → Bloquea salida + suspensión temporal (X días).
CRÍTICA  → Bloquea salida + lista negra + reporte autoridades.

RESOLUCIÓN:
a. RESOLVER   → Desbloquea salida, reactiva acceso
b. PERDONAR   → Desbloquea + registra como perdonada
c. ESCALAR    → Envía a rol superior (estado: en_revision)
d. APELAR     → Socio solicita revisión (estado: apelada)

REINCIDENCIA:
- 2da infracción mismo tipo → gravedad sube 1 nivel automáticamente
- 3+ infracciones cualquier tipo → se sugiere GRAVE
- Lista negra → rechazado en todas las alcabalas permanentemente
```

---

## FL-19 — Detección de Vehículos Fantasma *(NUEVO v2.0)*

**Actor**: Sistema (automático)  
**Resultado**: Alertas escalonadas progresivas cuando un vehículo entra por alcabala pero no llega a su zona.

```
TIEMPO LÍMITE CONFIGURABLE:
→ Por zona: zonas_estacionamiento.tiempo_limite_llegada_min (default: 15)
→ Zona lejana: 25 min / Zona cercana: 10 min
→ Ajustable en tiempo real por supervisor/admin (eventos masivos: 30-45 min)

DETECCIÓN (Job cada 5 minutos):
1. Vehículo pasa por alcabala → hora_entrada_base = now()
2. Sistema busca por ZONA DE DESTINO:
   WHERE hora_entrada_base IS NOT NULL
     AND hora_llegada_zona IS NULL
     AND hora_entrada_base < now() - zona.tiempo_limite_llegada_min
     AND no tiene registro de salida posterior

ESCALAMIENTO PROGRESIVO (T = tiempo límite de la zona):

NIVEL 1 — Excede T:
  → 🟡 Notifica a SUPERVISOR_PARQUEROS de la entidad
  → "ABC-123 no ha llegado a Zona B"
  → Supervisor puede llamar al socio / marcar como llegado

NIVEL 2 — Excede T+15 min:
  → 🟠 Escala a ADMIN_ENTIDAD
  → Push: "ABC-123 — 15min adicionales sin llegar"

NIVEL 3 — Excede T+30 min:
  → 🔴 Escala a SUPERVISOR de ronda (personal de base)
  → Push: "Vehículo no localizado. ABC-123 entró hace T+30min"
  → Supervisor de ronda puede ubicar en campo

NIVEL 4 — Excede T+45 min:
  → 🔴 Escala a ADMIN_BASE
  → Push: "URGENTE: Vehículo no localizado. ABC-123"

NIVEL 5 — Excede T+60 min:
  → ⚫ Escala a COMANDANTE
  → Push: "ALERTA MÁXIMA: ABC-123 no localizado en 60+ min"
  → Se crea INFRACCIÓN AUTOMÁTICA tipo=vehiculo_fantasma

ACCIÓN DEL COMANDANTE / ADMIN BASE (Nivel 4-5):
  [🔍 Emitir Orden de Búsqueda]
  → Push Notification a TODOS los supervisores de ronda:
    "🔍 ORDEN DE BÚSQUEDA: Localizar ABC-123
     Toyota Hilux Blanco | Último punto: Alcabala Norte"
  → Aparece como PRIORITARIA en dashboard del supervisor

DASHBOARD: Panel con código de color por nivel:
  🟡 Nivel 1 | 🟠 Nivel 2 | 🔴 Nivel 3-4 | ⚫ Nivel 5
  Cada vehículo con: [📞 Llamar] [✅ Llegó] [⚠️ Infracción]
```

---

## FL-20 — Pases con Múltiples Vehículos *(NUEVO v2.0)*

**Actor**: Admin Entidad (crea), Portador (auto-registro en portal)  
**Resultado**: Un pase puede autorizar el acceso de varios vehículos.

```
CREACIÓN (Admin / Excel):
1. Admin crea pase tipo identificado
2. Registra vehículo principal (obligatorio)
3. [+ Agregar vehículo] → registra vehículos adicionales
4. Se crean registros en tabla vehiculos_pase
5. codigos_qr.multi_vehiculo = true

AUTO-REGISTRO (Portal del Socio):
1. Portador accede al portal con su pase tipo "portal"
2. En "Mis Vehículos" registra:
   - Vehículo principal (obligatorio)
   - [+ Agregar otro] → vehículos adicionales
3. Se actualiza vehiculos_pase

VALIDACIÓN EN ALCABALA/PARQUERO:
1. Al escanear QR multi_vehiculo:
   - Sistema muestra TODOS los vehículos vinculados
   - Guardia/Parquero identifica cuál llegó
   - Cada ingreso de cualquier vehículo cuenta como 1 acceso
   - El pase se "agota" cuando max_accesos se alcanza
```

---

*Última actualización: 2026-04-18 | v2.0 — Gestión Inteligente de Estacionamientos*
