# DIRECTIVA-016: ESTÁNDAR VISUAL Y REGLAS DE NEGOCIO PARA EL MÓDULO DE COMBUSTIBLE (AEGIS FUEL)

## 1. PROPÓSITO
Garantizar la consistencia estética táctica y la seguridad operativa en la administración de la bomba de combustible de la base BAGFM, regulando el acceso de vehículos protocolares y de servicio, previniendo fraudes y estableciendo un flujo de aprobación asíncrono robusto.

---

## 2. ESTÁNDAR VISUAL DE LA INTERFAZ (AEGIS TACTICAL UI)

Para evitar inconsistencias a lo largo del programa, todas las pantallas del módulo de combustible (Bombero, Parque Automotor y Aprobaciones) deben seguir estrictamente esta guía:

### 2.1 Colores y Contrastes (Modo Oscuro Obligatorio)
- **Fondo de la Aplicación (`--bg-app`):** `#0E1322` (Slate oscuro para maximizar contraste).
- **Tarjetas y Contenedores (`--bg-card`):** `#1A1F2F` con borde sutil de color `--bg-high` (`#25293A` al 50%).
- **Indicador de Estado del Tanque (Nivel de Combustible):**
  - **Óptimo (>50% de capacidad):** Verde esmeralda táctico (`--success` / `#4EDEA3`).
  - **Precaución (20% - 50%):** Amarillo ámbar (`--warning` / `#F59E0B`).
  - **Crítico (<20%):** Rojo de alerta (`--danger` / `#EF4444`) con animación de pulso sutil (`animate-pulse-slow`).
- **Estado de Autorización del Vehículo:**
  - **Autorizado:** Etiqueta verde militar (`bg-emerald-500/10 border-emerald-500/40 text-emerald-400`).
  - **Inhabilitado / Bloqueado:** Etiqueta de advertencia roja (`bg-red-500/10 border-red-500/40 text-red-400`).

### 2.2 Tipografía y Datos Numéricos
- **Textos de lectura general:** `Inter` (sans-serif) para descripciones y nombres de campos.
- **Visualización de Datos Técnicos:** `Space Grotesk` o `JetBrains Mono` (sans-serif) para números de placa, litros cargados, kilometraje/odómetro y porcentajes de tanques.

### 2.3 Estructura y Márgenes
- **Layout Móvil First:** La pantalla operativa del bombero debe estar optimizada para uso en mano (teléfonos y tabletas de campo).
- **Márgenes de Contenedor:** Padding constante de `p-4` (`16px`).
- **Espaciado entre Elementos:** `space-y-4` (`16px`) para asegurar áreas de toque amplias (mínimo de 48px de altura por botón interactivo).
- **Scroll Interno:** Las listas de la bandeja de solicitudes y reportes deben tener un límite de altura (`max-h-[350px]`) con scrollbar interno táctico (`scrollbar-tactical`).

### 2.4 Botones y Formularios
- **Botón Primario (`.btn-primario`):** Degradado de `#4EDEA3` a `#10B981`, texto en negro (`#003824`), fuente `Inter` en negrita (`font-semibold`), estilo condensado y micro-animación de escala activa (`active:scale-95`).
- **Inputs de Formulario (`.input-field`):** Fondo `--bg-low`, borde `--bg-high`. Al recibir foco, fondo `--bg-card` y borde inferior `--primary` con sombra táctica.
- **Campos de Captura de Cámara (Odómetro y Dispensador):** Inputs de tipo `file` estructurados con los atributos obligatorios `accept="image/*" capture="environment"` para deshabilitar de forma dura la carga de fotos desde la galería y forzar la cámara trasera en dispositivos móviles.

---

## 3. REGLAS DE NEGOCIO Y CONTROL DE SEGURIDAD

### 3.1 Unidad de Medida
- Toda cuantificación de volumen de combustible (inventarios, capacidad, cuotas, solicitudes, transacciones y reportes) se registrará y visualizará estrictamente en **Litros (L)**.

### 3.2 Registro de Inventario Inicial
- **Control de Turno:** Al iniciar la semana o ciclo de guardia, el bombero debe registrar la medición manual de litros disponibles de cada tanque en la bomba.
- El sistema bloqueará cualquier operación de despacho hasta que se registre la lectura inicial del ciclo.

### 3.3 Validación de Kilometraje y Alerta de Fraude
- **Regla Básica:** El kilometraje ingresado (`kilometraje_actual`) debe ser estrictamente mayor que el kilometraje anterior (`ultimo_kilometraje`).
- **Control de Rendimiento:** En cada suministro se calculará el rendimiento de la carga previa:
  $$\text{Rendimiento} = \frac{\text{Kilometraje Actual} - \text{Kilometraje Anterior}}{\text{Litros Suministrados en Carga Previa}}$$
- Si el rendimiento calculado es menor al estándar mínimo tolerado según el tipo y marca de vehículo (alertas de sospecha), el sistema registrará una **Alerta de Auditoría** y enviará una notificación push instantánea al Comandante de Base y Admin Base por sospecha de extracción de combustible ilegal (fraude).

### 3.4 Límites Semanales por Entidad y Vehículo
- **Límite de Entidad:** Cada entidad (civil o militar) tiene asignado un cupo de consumo máximo semanal en litros. Si se alcanza o excede este cupo, el suministro para toda su flota vehicular queda **trancado** de forma automática.
- **Asignación Sugerida:** El administrador puede configurar una cuota de consumo semanal sugerida para cada vehículo de la entidad. El bombero tiene la flexibilidad discrecional de surtir una cantidad distinta según las necesidades, siempre que la entidad no haya agotado su cupo semanal global.

### 3.5 Flujo Asíncrono de Aprobación de Emergencia
- Si el suministro de un vehículo es bloqueado (por límite de entidad excedido, vehículo no autorizado, o placa no registrada), el bombero puede registrar una **Solicitud de Emergencia**.
- **Registro Rápido para No Registrados:** Si la placa no existe en el sistema, el bombero capturará en la solicitud: Placa, Conductor (Nombre y Cédula), Marca, Modelo, Color y justificación detallando a qué entidad o dependencia externa pertenece.
- **Operatividad del Surtidor:** Tras enviar la solicitud, el bombero puede continuar operando su panel y atendiendo a otros vehículos. Sus solicitudes enviadas se almacenan en una bandeja en estado *En Espera*.
- **Aprobación Remota:** El Comandante o Admin Base recibe la alerta push y puede resolver la solicitud desde su panel.
  - Para vehículos no registrados, el administrador podrá asociar el vehículo a una Entidad real del sistema. Si no selecciona ninguna, el backend creará el vehículo bajo la entidad `"Tránsito / Externo"`.
  - El estatus de autorización del vehículo creado se mantendrá en `False`.
- **Notificación y Suministro Único:** Al ser aprobada la solicitud:
  - El bombero recibe una notificación push inmediata y la solicitud se traslada a la sección *Aprobadas para Surtir* en su bandeja táctica.
  - El suministro quedará habilitado de manera temporal y **única** vinculada a esa solicitud. Al finalizar la carga, la solicitud se marca como `consumida` en la base de datos y el vehículo vuelve a quedar bloqueado para cargas posteriores.

## 4. ESPECIFICACIÓN DE MÓDULOS FRONTEND IMPLEMENTADOS

### 4.1 Parque Automotor (`ParqueAutomotor.jsx`)
- **Gestión de Flotas:** Visualización de todos los vehículos activos agrupados/filtrados por entidad con paginación y búsqueda por placa.
- **Asignación de Combustible:** Toggle interactivo para habilitar/inhabilitar el suministro en bomba a vehículos particulares registrados, y campos para configurar límites y capacidades del tanque en litros.
- **Planificador de Abastecimiento Semanal (Asignación vs Capacidad):** Panel táctico reactivo en la parte superior que consolida la suma total de las cuotas semanales de combustible asignadas a los vehículos activos y autorizados de gasolina y diésel, contrastándolas contra la capacidad de almacenamiento total de los tanques correspondientes. Emite una alerta visual en color rojo y animación de pulso en caso de sobreasignación (>100% de la capacidad).
- **Límite Semanal de Entidad:** Panel integrado para ajustar el límite total de litros permitidos semanalmente por entidad civil/militar.
- **Importación Masiva:** Procesamiento de flotas a través de plantillas Excel (`.xlsx`) con un resumen de filas procesadas en tiempo real. Se mapean correctamente las respuestas de éxito y actualización del backend (`total`, `exitosos` y `actualizados`) en los indicadores visuales `Leídos`, `Creados` y `Actualizados`. Incluye bitácora de errores en tiempo real y descarga de la plantilla oficial.

### 4.2 Cola de Aprobaciones (`ColaAprobacionesCombustible.jsx`)
- **Resolución Remota Asíncrona:** Panel que refresca automáticamente cada 15 segundos y lista las solicitudes de emergencia pendientes.
- **Enlace de Entidades:** Permite al Comandante asociar vehículos no registrados a entidades de la base mediante un menú desplegable antes de su autorización remota (el vehículo se crea con `autorizado_combustible = False` para habilitar el suministro de uso único).
- **Acciones Tácticas:** Aprobación y rechazo remoto que disparan notificaciones push de retorno al bombero.

### 4.3 Reporte de Combustible (`ReporteCombustible.jsx`)
- **KPIs de Consumo:** Tarjetas con el total de litros consumidos (litros medidos), transacciones completadas y distribución porcentual de tipo de combustible.
- **Consumo por Entidad:** Barras de progreso de participación sobre el consumo total de combustible en la base.
- **Auditoría de Fraude:** Sección prioritaria de incidentes que lista las alertas de discrepancia en kilometraje y rendimiento sospechoso detectadas en las recargas.

---

### 4.4 Gestión de Tanques de Combustible (`GestionTanques.jsx`)
- **CRUD de Tanques:** Permite al Comandante y Admin Base registrar tanques, editar su capacidad máxima y darlos de baja (soft-delete, solo si no tienen consumos en la semana en curso).
- **Protección de Stock:** La `cantidad_actual` nunca es editable de forma directa. Solo se actualiza a través de las lecturas semanales del bombero y los descuentos automáticos al despachar combustible.

### 4.5 Monitor de Bomba y KPIs en Tiempo Real
- **Dashboard del Comandante:** Integra 5 KPIs tácticos de combustible (Litros Surtidos, Cargas, Stock de Combustible en Tanques, Solicitudes Pendientes y Alertas de Fraude) y un componente `FuelMonitor` con polling de 30 segundos.
- **Pestañas del Monitor:** Tanques (niveles con barra de color), Flujo (feed de últimas 15 cargas), y Solicitudes (resumen de pendientes con botón de acción rápido).

---

## 5. ROLES Y PRIVILEGIOS DE ADMINISTRACIÓN DE PERSONAL DE COMBUSTIBLE

### 5.1 Alta del Rol BOMBERO
- **Autorización de Registro:** Únicamente el Comandante de Base y el Administrador de Base tienen autorización para dar de alta nuevos usuarios con el rol de `BOMBERO` en la pantalla de Fuerza de Tareas.
- **Vínculo de Entidad:** Al dar de alta a un `BOMBERO`, no se le asociará a ninguna entidad externa, ya que es un operador de servicio directo de la propia bomba de la base.
- **Color de Identificación:** En los paneles y listados de Fuerza de Tareas, el rol de `BOMBERO` se identificará visualmente con la etiqueta naranja táctica (`text-orange-400 bg-orange-400/10 border-orange-400/20`).

### 5.2 Acceso al Menú del Parque Automotor y Tanques
- **Barra de Navegación (Sidebar):** Los roles de Comandante y Administrador de Base tienen visible de forma fija el acceso al módulo "Parque Automotor" y "Tanques Combustible" desde la barra de navegación lateral para la administración, carga de flotas e inventario.

---

*Última actualización: 2026-06-02 (Integración del Planificador Semanal de Abastecimiento y corrección de indicadores de carga masiva en ParqueAutomotor v10.0)*
*Aprobado por: Comandante de Base & Antigravity Aegis Command*
