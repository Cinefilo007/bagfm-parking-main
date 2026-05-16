# DIRECTIVA UI — GESTIÓN TÁCTICA DE PERSONAL (v2.3)

## 1. Visión
La interfaz de **Fuerza de Tareas** usa un sistema de listado simple con modal de gestión contextual según el rol del operativo. Esto permite ver todos los usuarios (parqueros, alcabalas, supervisores, administradores) sin mostrar opciones irrelevantes para cada uno.

## 2. Componentes de la Interfaz

### 2.1 KPIs Tácticos Globales
- Grid **2x2 en móvil**, **4 en línea en `xl`** (`grid-cols-2 xl:grid-cols-4`).
- Métricas: Operativos Totales, Activos Hoy, Parqueros en Campo, Zonas Cubiertas.

### 2.2 Buscador
- Placeholder: `BUSCAR POR NOMBRE O CÉDULA...` (sin placa).

### 2.3 Tarjeta de Operativo (`MiembroCard`) — v2.3
Tarjeta delgada **sin expansión inline**. Muestra:
- Barra lateral de color del rol.
- Avatar + Nombre + Badge de rol.
- Info secundaria contextual según rol:
  - `PARQUERO`: zona asignada o "Sin zona".
  - `SUPERVISOR_PARQUEROS`: zona supervisada.
  - `ALCABALA`: "Operador de acceso".
  - `SUPERVISOR`: "Supervisor de ronda".
  - `ADMIN_BASE` / `ADMIN_ENTIDAD`: su descripción de cargo.
- Cédula y teléfono (si existe).
- Acciones: **Gestionar** (abre modal), Toggle activo/pausa, Baja definitiva (solo COMANDANTE).

### 2.4 Modal de Gestión (`ModalGestion`) — NUEVO v2.3
Se abre al presionar "Gestionar". Las **tabs disponibles varían según el rol** del operativo gestionado:

| Rol              | Tabs disponibles                          |
|------------------|-------------------------------------------|
| PARQUERO         | KPIs, Zona, Incentivos, Sanciones, Editar |
| SUPERVISOR_PARQUEROS | KPIs, Zona, Incentivos, Sanciones, Editar |
| ALCABALA         | KPIs, Incentivos, Sanciones, Editar       |
| SUPERVISOR       | KPIs, Incentivos, Sanciones, Editar       |
| ADMIN_BASE       | Editar                                    |
| ADMIN_ENTIDAD    | Editar                                    |
| COMANDANTE       | Editar                                    |

- El tab de **KPIs** muestra "Asig. Manuales" solo para `PARQUERO` y `SUPERVISOR_PARQUEROS`.
- El tab de **Zona** solo aparece para roles con zona asignable.

## 3. Comportamiento y UX
- Las tarjetas no se expanden en el listado.
- El modal carga KPIs, incentivos y sanciones al abrirse.
- El buscador filtra por nombre o cédula únicamente.

---
*Fecha: 2026-05-04 | Versión 2.3 — Tarjetas simples con modal contextual por rol*


## 1. Visión
Evolucionar la interfaz de **Fuerza de Tareas** para alinearla con el estándar táctico de **Pases Masivos**. Se busca una gestión de alta densidad, eliminando modales intrusivos y utilizando componentes expandibles que mantengan el contexto operativo.

## 2. Componentes de la Interfaz

### 2.1 KPIs Tácticos Globales
Ubicados en la cabecera, proporcionan una visión inmediata del estado de la fuerza de tareas:
- **Operativos Totales**: Cantidad de personal registrado.
- **En Terminal**: Personal activo en el sistema.
- **Zonas Cubiertas**: Cantidad de zonas con personal asignado.
- **Sanciones Activas**: Alerta temprana sobre personal sancionado.

### 2.2 Tarjeta de Operativo (MiembroCard)
Estructura horizontal delgada con dos estados: **Contraída** y **Expandida**.

#### Estado Contraído (Vista de Lista)
- **Barra de Estado Lateral**: Color del rol (Verde: Parquero, Ámbar: Supervisor, Púrpura: Admin, Rojo: Inactivo).
- **Identidad**: Avatar, Nombre completo y Rol (Badge).
- **KPIs Individuales Rápidos**:
  - Días Activo.
  - Incentivos Totales.
  - Sanciones Activas (con indicador rojo si > 0).
- **Ubicación**: Zona asignada (Badge con icono).
- **Acciones Rápidas**: Expandir/Contraer, Toggle Activo/Pausa, Baja Definitiva.

#### Estado Expandido (Gestión Detallada)
Se expande verticalmente dentro de la misma tarjeta del operativo:
- **Dashboard Interno**: Pestañas integradas (no modales).
  - **KPIs**: Estadísticas detalladas de rendimiento.
  - **Zona**: Selector de asignación de zona.
  - **Incentivos**: Registro y listado de reconocimientos.
  - **Sanciones**: Aplicación de medidas disciplinarias y relevo inmediato.
  - **Editar**: Formulario de actualización de datos personales.

## 3. Comportamiento y UX
- **Contexto**: Al expandir una tarjeta, las demás pueden permanecer contraídas para facilitar la comparación o gestión múltiple.
- **Animaciones**: Transiciones suaves de altura (mínimo 300ms) para la expansión de la tarjeta.
- **Acceso Rápido**: El toggle de estado (Pausar/Reactivar) es accesible sin expandir la tarjeta.
- **Eliminación de Modales**: Se elimina el `PanelDetalle` flotante en favor de la expansión *in-place*.

## 4. Referencia Visual
Se toma como referencia `PasesMasivos.jsx` en su versión v2.0 (LoteCardV2), utilizando el layout `flex-col xl:flex-row` para adaptabilidad multidispositivo.

---
*Fecha: 2026-04-23 | Versión 2.2*  
*Basado en Aegis Tactical v3*
