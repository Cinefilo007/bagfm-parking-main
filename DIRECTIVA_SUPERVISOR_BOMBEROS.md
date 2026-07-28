# DIRECTIVA_SUPERVISOR_BOMBEROS.md
> **BAGFM ACCESS — Sistema Táctico v2.1**  
> Módulo: Aegis Fuel — Supervisión de Combustible  
> Versión: 1.0 | Fecha: 2026-06-01

---

## 1. Descripción del Rol

El **Supervisor de Bomberos** (`SUPERVISOR_BOMBEROS`) es el jefe operativo de la unidad de combustible. Actúa como enlace entre el Bombero en turno y el Mando (Comandante / Admin Base), teniendo autoridad para aprobar solicitudes excepcionales de suministro y controlar el inventario de forma diaria.

---

## 2. Accesos y Permisos

| Módulo | Acción | Permitido |
|---|---|---|
| Dashboard Supervisor | Ver KPIs, monitor, buzón | ✅ |
| Parque Automotor | Ver, crear, editar vehículos | ✅ |
| Parque Automotor | Toggle autorización combustible | ✅ |
| Gestión de Tanques | Ver estado, apertura/cierre | ✅ |
| Gestión de Tanques | Crear/eliminar tanques | ❌ (solo Comando) |
| Abastecimientos | Registrar suministro directo | ✅ (panel del bombero) |
| Abastecimientos | Preregistrar despachos en paralelo | ✅ |
| Abastecimientos | Ver su propia bandeja e historial de bombero | ✅ |
| Solicitudes Excepcionales | Aprobar / Rechazar | ✅ (con auditoría) |
| Reportes de Combustible | Ver | ✅ |
| Cola de Aprobaciones | Ver y resolver | ✅ |

---

## 3. Control Diario de Tanques (Apertura y Cierre)

**Regla de Negocio:** A partir de la versión 2.1, el control de inventario de tanques es **diario**. Se elimina la apertura semanal como operación obligatoria.

### 3.1 Apertura del Día
- **Quién:** Bombero o Supervisor de Bomberos.
- **Cuándo:** Inicio de cada jornada operativa.
- **Qué:** Declarar la cantidad real medida en cada tanque al inicio del día.
- **Restricción:** Solo se puede registrar **una apertura por tanque por día**. Si hay error, debe usarse `ajuste_auditoria`.

### 3.2 Cierre del Día
- **Quién:** Bombero o Supervisor de Bomberos.
- **Cuándo:** Al finalizar la jornada operativa.
- **Qué:** Declarar la cantidad real medida en cada tanque al cierre.
- **Propósito:** Permite detectar inconsistencias entre litros computados y reales.

### 3.3 Tipos de Lectura Válidos
| Tipo | Descripción | Quién puede registrar |
|---|---|---|
| `apertura_dia` | Inventario real al inicio del día | Bombero, Supervisor Bomberos |
| `cierre_dia` | Inventario real al cierre del día | Bombero, Supervisor Bomberos |
| `recarga_externa` | Entrada de combustible desde proveedor | Bombero, Supervisor Bomberos, Comando |
| `ajuste_auditoria` | Corrección autorizada de inventario | Bombero, Supervisor Bomberos, Comando |
| `inicial_semana` | **Legado** — Conservado por compatibilidad histórica | Desuso |

---

## 4. Flujo de Aprobación de Solicitudes Excepcionales

```
Bombero eleva solicitud
       ↓
Notificación push → [SUPERVISOR_BOMBEROS, COMANDANTE, ADMIN_BASE]
       ↓
Supervisor de Bomberos puede APROBAR o RECHAZAR
       ↓
Si APRUEBA → Notificación push de AUDITORÍA → [COMANDANTE, ADMIN_BASE]
Si RECHAZA → Notificación al Bombero
       ↓
Bombero recibe confirmación del estado final
```

**Nota de Auditoría:** Toda aprobación realizada por el Supervisor de Bomberos genera automáticamente una notificación push de auditoría al Comandante y Admin Base con:
- Nombre del supervisor aprobador
- Placa del vehículo beneficiado
- Litros aprobados
- Enlace directo al registro de aprobaciones

---

## 5. Dashboard Exclusivo del Supervisor

Ruta: `/combustible-supervisor/dashboard`

### Tabs del Dashboard

| Tab | Contenido |
|---|---|
| **Tanques** | Estado de cada tanque, nivel, apertura/cierre del día, botones de registro |
| **Monitor** | Feed en tiempo real (polling 30s) de vehículos abastecidos hoy |
| **Solicitudes** | Cola de aprobaciones pendientes con botones Aprobar/Rechazar integrados |

### KPIs Visibles
- Litros abastecidos hoy
- Cantidad de cargas realizadas hoy
- Solicitudes pendientes (con alerta roja si > 0)
- Stock total de todos los tanques

---

## 6. Navegación del Rol

| Sección | Ruta |
|---|---|
| Centro de Control | `/combustible-supervisor/dashboard` |
| Despacho de Combustible | `/combustible/dashboard` |
| Buzón de Aprobaciones | `/combustible/aprobaciones` |
| Parque Automotor | `/parque-automotor` |
| Tanques Combustible | `/combustible/tanques` |

---

## 7. Seguridad

- El rol `SUPERVISOR_BOMBEROS` **no puede** crear ni eliminar tanques.
- El rol `SUPERVISOR_BOMBEROS` **no puede** reasignar entidades a vehículos (solo editar parámetros de combustible).
- Toda aprobación queda registrada en la tabla `solicitudes_combustible` con `aprobado_por_id`.
- El campo `fecha_aprobacion` queda auditado automáticamente.

---

## 8. Migración de Base de Datos

Migración aplicada: `f1a2b3c4d5e6_add_supervisor_bomberos_and_daily_reads`

```sql
-- Nuevo rol
ALTER TYPE rol_tipo ADD VALUE IF NOT EXISTS 'SUPERVISOR_BOMBEROS';

-- Nuevos tipos de lectura diaria
ALTER TYPE tipo_lectura_tanque_enum ADD VALUE IF NOT EXISTS 'apertura_dia';
ALTER TYPE tipo_lectura_tanque_enum ADD VALUE IF NOT EXISTS 'cierre_dia';
```

> **Nota:** El valor `inicial_semana` se mantiene en el enum por compatibilidad con registros históricos. No debe usarse para nuevos registros.

---

## 9. Historial de Cambios y Correcciones

### [2026-06-01] Corrección de Error de Referencia (`Car is not defined`)
- **Problema:** El dashboard del supervisor fallaba al cargar con un error de ejecución `ReferenceError: Car is not defined`.
- **Causa:** El componente `DashboardSupervisorBomberos.jsx` utilizaba `<Car />` en el listado de vehículos abastecidos y solicitudes excepcionales de vehículos no registrados, pero el icono `Car` no estaba importado de `lucide-react` (se importaba `CarFront` en su lugar).
- **Solución:** Se reemplazaron todas las etiquetas `<Car />` por `<CarFront />` dentro de `DashboardSupervisorBomberos.jsx` para alinearse con los iconos importados y resolver la falla en tiempo de ejecución.

### [2026-06-01] Corrección de Error de Referencia en Navegación Móvil (`Car/Flame is not defined`)
- **Problema:** El error de referencia no definida continuaba apareciendo al cargar la ruta del supervisor en pantallas móviles o emuladas en el navegador.
- **Causa:** La barra de navegación inferior (`BottomNav.jsx`) definía accesos de combustible (`/parque-automotor` y `/combustible/tanques`) para el rol `SUPERVISOR_BOMBEROS` usando los iconos `Car` y `Flame`, pero omitía importarlos en `lucide-react`.
- **Solución:** Se agregaron `Car` y `Flame` a los iconos importados en `BottomNav.jsx`, solucionando definitivamente el ReferenceError en tiempo de ejecución móvil.

### [2026-06-01] Corrección de Permisos en la Carga Masiva e Individual del Parque Automotor
- **Problema:** El Supervisor de Bomberos recibía un error `403 Forbidden` al intentar descargar la plantilla de importación, procesar un archivo Excel de vehículos, o registrar un vehículo de forma individual.
- **Causa:** Los endpoints del backend (`GET /template`, `POST /importar-excel` y `POST /vehiculos` en `combustible.py`) estaban restringidos de forma rígida únicamente a los roles `COMANDANTE` y `ADMIN_BASE`.
- **Solución:** Se añadieron los roles `SUPERVISOR_BOMBEROS`, `SUPERVISOR` y `ADMIN_ENTIDAD` a la lista de permitidos en dichos endpoints del backend. Se incluyó además un control de seguridad para restringir a los usuarios con rol `ADMIN_ENTIDAD` para que solo importen o registren vehículos pertenecientes a su propia entidad civil.

### [2026-07-27] Habilitación del Despacho de Combustible para el Supervisor de Bomberos
- **Problema:** Cuando el Supervisor de Bomberos se encontraba solo en la bomba no tenía forma de despachar combustible: el panel operativo (`DashboardBombero.jsx`) no figuraba en ninguno de sus menús.
- **Causa:** Aunque la ruta `/combustible/dashboard` y el endpoint `POST /combustible/abastecer` ya admitían el rol, los endpoints auxiliares `GET /combustible/solicitudes/bombero` y `GET /combustible/abastecimientos/historial-bombero` estaban restringidos con una comparación estricta a `RolTipo.BOMBERO`, y ninguna barra de navegación exponía el acceso.
- **Solución:** Ambos endpoints pasaron a aceptar `[RolTipo.BOMBERO, RolTipo.SUPERVISOR_BOMBEROS]` (siguen filtrando por el usuario autenticado, así que cada operador ve sólo su bandeja e historial). Se añadió "Despacho de Combustible" al `Sidebar.jsx` y al `MobileMenuDrawer.jsx`, y el acceso directo "Surtir" al `BottomNav.jsx` — donde desplazó a "Tanques", que permanece disponible en el menú móvil extendido para respetar el límite de cuatro elementos de la barra inferior. Los tres usan el icono `Fuel` de `lucide-react`.
