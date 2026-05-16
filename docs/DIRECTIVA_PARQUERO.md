# DIRECTIVA — MÓDULO PARQUERO Y SUPERVISOR (BAGFM v3.2)

> **Filosofía**: "PREPARARNOS PARA EL CAOS"  
> Los eventos masivos en vías de una sola dirección son el principal reto. Este módulo debe garantizar la entrada y salida ordenada de vehículos.

---

## 1. Estándares Visuales (Mapa de Puestos)

### 1.1 Estados de Ocupación (Prioridad Táctica)
La prioridad visual absoluta es el estado **OCUPADO**. Ningún otro indicador (reserva, entidad, base) debe ocultar el estado de ocupación.

*   **Libre (General)**: Icono verde suave.
*   **Reservado Entidad**: Icono naranja (Warning).
*   **Reservado BASE**: Icono Indigo (Base).
*   **OCUPADO (Cualquier tipo)**: 
    *   **Icono P**: Rojo brillante (`text-red-500`), tamaño estándar (20px), efecto de pulso (`animate-pulse`) y brillo exterior (`drop-shadow`).
    *   **Borde**: Rojo sólido con sombra interna.
    *   **Texto**: La placa del vehículo reemplaza el número del puesto o la etiqueta de entidad como información primaria.

### 1.2 Puestos de la BASE (Visibilidad Forzada)
Si una zona tiene cupos reservados para la **BASE** según el KPI, pero no existen puestos físicos registrados en el sistema, el Dashboard debe **inyectar virtualmente** estos puestos al inicio del mapa para que el parquero tenga siempre presente la capacidad reservada para el comando.

---

## 2. Operaciones de Zona

### 2.1 Flujo de Recepción
1.  El parquero registra la llegada vía **RECIBIR** (Placa o QR).
2.  El vehículo entra en estado **"APARCADO"** (en zona pero sin puesto).
3.  **IMPORTANTE**: Para que el mapa refleje la ocupación (P roja), el parquero DEBE asignar el vehículo a un puesto físico.

### 2.2 Asignación de Puesto (Control Táctico)
Desde el mapa, al hacer clic en un puesto `Libre` o `Reservado`:
1.  Se abre el **Modal de Información**.
2.  Sección **"Asignar Vehículo Aparcado"**: Muestra lista de vehículos en zona que aún no tienen puesto.
3.  Al confirmar, el puesto cambia inmediatamente a **ROJO** y muestra la placa vinculada.

---

## 3. Trazabilidad y Notificaciones

### 3.1 Especificidad de Datos
Todas las tarjetas de historial y notificaciones deben mostrar detalles extendidos:
- **Datos del Portador**: Nombre y apellido resaltados.
- **Detalles del Vehículo**: Marca, Modelo y Color (concatenados).
- **Indicadores de Estado**:
  - `PUESTO OK`: Vehículo con puesto físico asignado (verde).
  - `APARCADO`: Vehículo ingresado en zona pero sin puesto físico asignado aún (ámbar).

---

## 4. Arquitectura de Navegación

### Botones de Acción:
| Botón | Ruta | Color | Función |
|-------|------|-------|---------|
| **RECIBIR** | `/parquero/recibir` | Verde | Registro de entrada (QR/Placa) |
| **DESPACHAR** | `/parquero/despachar` | Ámbar | Registro de salida rápida |
| **NOTIFICACIONES** | `/parquero/notificaciones` | Indigo | Historial y trazabilidad |

### Actualizaciones:
- La zona se sincroniza cada **30 segundos**.
- El estado de los puestos debe ser coherente con los KPIs superiores.

---

*Última actualización: 2026-05-07 | v3.2*
