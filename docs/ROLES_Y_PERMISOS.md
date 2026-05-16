# ROLES Y PERMISOS — BAGFM v2.0

> Consultar `DIRECTIVA_MAESTRA.md` antes de modificar este documento.
> **v2.0**: Roles actualizados para gestión inteligente de estacionamientos.

---

## Definición de Roles

### `COMANDANTE`
Superadministrador de la base. Acceso total al sistema.  
- Crea y administra entidades civiles.
- **v2.0**: Crea y administra zonas de estacionamiento.
- **v2.0**: Asigna zonas a entidades con cupo definido.
- **v2.0**: Aparta puestos dentro de zonas para uso de personal de la base.
- Crea usuarios de la base (Admin Base, Supervisores, Alcabalas).
- Aprueba solicitudes de acceso que excedan cuota de la entidad.
- Visibilidad total de todos los socios de todas las entidades.
- Buscar por placa, cédula o nombre.
- Crear y gestionar infracciones.

### `ADMIN_BASE`
Personal administrativo que apoya al Comandante.  
- Mismos permisos de visualización que el Comandante.
- Puede gestionar entidades civiles, zonas y usuarios de la base.
- Puede crear puestos e infracciones.
- **No puede** aprobar solicitudes ni apartar puestos para base.

### `SUPERVISOR`
Personal de ronda que recorre la base.  
- Acceso al **buscador maestro** (busca por placa, cédula, nombre).
- **Puede crear infracciones**.
- No gestiona socios ni entidades.

### `ALCABALA`
Personal operacional en los puntos de entrada de la base.  
- **Cuenta Fija** con clave rotativa de 6 dígitos (24h).
- **Identificación mandatoria** al iniciar turno.
- **v2.0 — Flujo Simplificado**: Escanea QR → respuesta inmediata. Registro de datos OPCIONAL.
- Acceso al **buscador maestro** para confirmación manual.
- **No puede** crear infracciones ni gestionar socios.

### `ADMIN_ENTIDAD`
Administrador de una entidad civil. Solo puede operar su propia entidad.
- CRUD de socios + importación Excel.
- Gestión de membresías.
- **v2.0 — Nuevas capacidades**:
  - CRUD de parqueros y supervisores de parqueros (login personalizado).
  - **Dashboard en tiempo real** (WebSocket).
  - **Pases masivos autónomos** dentro de cuota.
  - Asignar zona/puesto específico a pases VIP, logística, productores.
  - **Reservar puestos** de estacionamiento y luego asignarlos a socios/clientes.
  - Clasificar pases por tipo de acceso.
  - Gestionar pases individuales (editar, compartir, enviar email, revocar).
  - Editor visual de carnets.
  - Monitorear parqueros: métricas, incentivos, sanciones, relevo.

### `SUPERVISOR_PARQUEROS` *(NUEVO v2.0)*
**"Director de orquesta"** — Coordinador operativo de los parqueros de una entidad.
- **Dashboard completo** con visión global de todas las zonas de la entidad.
- **Comunicación**:
  - Enviar instrucciones broadcast a todos los parqueros o a zona específica.
  - Push + WS para comunicación inmediata.
  - Los parqueros normalmente usan radios; el sistema COMPLEMENTA la comunicación.
- **Supervisión en tiempo real**:
  - Métricas de cada parquero (eficiencia, tiempos, escaneos).
  - Log de entradas/salidas por alcabala (filtrado por destino de la entidad).
  - Log de operaciones por zona.
  - Alertas de ocupación y anomalías.
- **Gestión operativa**:
  - Reasignar parqueros entre zonas según demanda del momento.
  - Relevar parqueros inmediatamente.
  - Aplicar incentivos y sanciones.
- **Contexto operativo**: En eventos masivos con vías de una sola dirección, el supervisor es quien decide dónde enviar refuerzos, qué zonas priorizar, y cómo evitar colas.
- **Solo puede** operar dentro de las zonas de su entidad.

### `PARQUERO`
Operador de campo en zona de estacionamiento.
- **Login personalizado** con cédula + contraseña.
- **Verificación de identidad** delegada desde la alcabala.
- **3 métodos de recepción**: QR, por placa, asignación rápida.
- **3 métodos de salida**: QR (opcional), por placa, por puesto.
- **Registro de datos**: Si el socio no tiene datos → registro completo con IA (escaneo documentos).
- Lista de vehículos en su zona con datos de contacto.
- Recibe Push Notifications detalladas (marca/modelo/color/placa si los tiene).
- Recibe mensajes broadcast del supervisor.
- Ve métricas personales.
- **Solo puede** operar en la zona asignada.

### `SOCIO`
Miembro de una entidad civil.  
- Ve su QR, membresía, historial, infracciones.
- **v2.0**: Ve zona y puesto asignados (si aplica).

### `VISITANTE_TEMP`
Acceso temporal para evento.  
- Solo existe como QR temporal.
- **v2.0**: Clasificado por tipo_acceso + puede tener zona/puesto pre-asignado.

---

## Matriz Completa de Permisos

| Acción | CMD | ADM_B | SUP | ALC | ADM_E | SUP_P | PRQ | SOC |
|--------|:---:|:-----:|:---:|:---:|:-----:|:-----:|:---:|:---:|
| **PANEL GENERAL** |
| Dashboard base | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dashboard entidad (tiempo real) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Dashboard supervisor parqueros | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Dashboard parquero | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **ENTIDADES** |
| CRUD entidad civil | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ZONAS DE ESTACIONAMIENTO** |
| Crear/editar zona | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear puestos | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Asignar zona a entidad | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Apartar puestos para base | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reservar puestos (para asignar) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Ver zonas globales | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver zona propia (estado real) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **USUARIOS** |
| Crear Admin Base | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear Supervisor ronda | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear Alcabala | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear Supervisor Parqueros | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Crear Parquero | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Relevar parquero | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Reasignar parquero de zona | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **BUSCADOR MAESTRO** |
| Buscar por placa/cédula/nombre | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **SOCIOS** |
| Ver socios de todas las entidades | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CRUD socio entidad propia | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Importar socios Excel | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **ACCESOS (ALCABALA)** |
| Escanear QR + registrar entrada | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Registrar datos (OPCIONAL) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **ZONA ESTACIONAMIENTO (PARQUERO)** |
| Recibir vehículo (QR/placa) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Registrar salida (QR/placa/puesto) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Registrar datos socio + IA | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ver vehículos en zona + contacto | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **SUPERVISOR PARQUEROS** |
| Dashboard global zonas+parqueros | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Enviar broadcast a parqueros | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Reasignar parquero | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Ver log alcabalas/zonas | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **PASES MASIVOS** |
| Generar pases (dentro de cuota) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Asignar zona/puesto a pases | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Aprobar solicitud extra-cuota | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enviar pases por email | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **CARNETS (PLUS)** |
| CRUD plantillas + generar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **INCENTIVOS/SANCIONES** |
| Crear incentivo/sanción | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Ver historial parqueros | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **INFRACCIONES v2.0** |
| Reportar infracción (reporte rápido) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Resolver/perdonar (LEVE) | ✅ | ✅ | ✅ | ❌ | ✅* | ✅ | ❌ | ❌ |
| Resolver/perdonar (MODERADA) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Resolver/perdonar (GRAVE) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Resolver/perdonar (CRÍTICA) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Escalar a superior | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Emitir orden de búsqueda | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gestionar lista negra | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver estadísticas infracciones | ✅ | ✅ | ❌ | ❌ | ✅* | ❌ | ❌ | ❌ |
| Ver vehículos fantasma | ✅ | ✅ | ✅ | ❌ | ✅* | ✅ | ❌ | ❌ |
| **TIPOS DE ACCESO** |
| Crear tipo personalizado | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Editar/desactivar tipo custom | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **CONFIGURACIÓN ZONA** |
| Ajustar tiempo límite zona | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

> *ADM_E: solo infracciones de su entidad  
> **Regla**: Infracciones MODERADA, GRAVE y CRÍTICA son competencia exclusiva del personal de la base (SUP, ADM_B, CMD). La entidad solo resuelve LEVES.

---

## Implementación

### Enum de Roles
```python
class Rol(str, Enum):
    COMANDANTE = "COMANDANTE"
    ADMIN_BASE = "ADMIN_BASE"
    SUPERVISOR = "SUPERVISOR"
    ALCABALA = "ALCABALA"
    ADMIN_ENTIDAD = "ADMIN_ENTIDAD"
    SUPERVISOR_PARQUEROS = "SUPERVISOR_PARQUEROS"  # v2.0
    PARQUERO = "PARQUERO"
    SOCIO = "SOCIO"
```

---

*Última actualización: 2026-04-18 | v2.0 — Gestión Inteligente de Estacionamientos*
