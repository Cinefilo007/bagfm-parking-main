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
- **Campos de Captura de Evidencia Fotográfica (Odómetro y Dispensador):** Inputs de tipo `file` con el atributo `accept="image/*"`. El atributo `capture="environment"` ha sido **eliminado intencionalmente** para permitir que el operador elija entre usar la cámara en tiempo real o seleccionar una foto existente desde la galería del dispositivo. Esta flexibilidad aplica a ambos campos.

---

## 3. REGLAS DE NEGOCIO Y CONTROL DE SEGURIDAD

### 3.1 Unidad de Medida
- Toda cuantificación de volumen de combustible (inventarios, capacidad, cuotas, solicitudes, transacciones y reportes) se registrará y visualizará estrictamente en **Litros (L)**.

### 3.2 Registro de Inventario Inicial (Apertura del Día)
- **Control Diario:** Al iniciar la jornada, el bombero o supervisor debe registrar la medición manual de litros disponibles de cada tanque activo.
- **Coordinación Multi-Rol:** El sistema detecta dinámicamente si la apertura ya fue realizada por algún rol (Bombero o Supervisor) para ese día y tanque específico. Solo se bloquean y exigen declaraciones para los tanques activos que falten por aperturar hoy, previniendo cierres de turno redundantes o bloqueos innecesarios.
- El sistema bloqueará cualquier operación de despacho para un tanque específico hasta que se registre su correspondiente lectura inicial de apertura del día.

### 3.3 Validación de Kilometraje, Cálculo de Consumo y Alertas de Robo (Ordeño)
- **Regla Básica:** El kilometraje ingresado (`kilometraje_actual`) debe ser estrictamente mayor que el kilometraje anterior (`ultimo_kilometraje`).
- **Cálculo de Recorrido y Consumo:** En cada suministro se calcularán y persistirán de forma obligatoria en la tabla `abastecimientos` las siguientes variables del tramo:
  - **Kilómetros Recorridos:** $\text{Distancia} = \text{Kilometraje Actual} - \text{Kilometraje Anterior}$
  - **Rendimiento Real del Tramo:** $\text{Rendimiento} = \frac{\text{Distancia}}{\text{Litros Suministrados en Carga Previa}}$
- **Detección Dinámica de Fraude (Promedio Histórico):** Para evaluar si un vehículo presenta una caída inusual de combustible (ordeño de tanque), el sistema calcula el promedio de rendimiento histórico real del vehículo a partir de sus últimos 10 abastecimientos.
  - El umbral de sospecha se establece en el **70% del promedio histórico del vehículo**.
  - Si el rendimiento del tramo actual es inferior a este umbral, el sistema marcará automáticamente la transacción con una **Alerta de Auditoría** (`tiene_alerta = True`) y enviará una notificación push en tiempo real al Comandante de Base y Admin Base por sospecha de extracción/robo.
  - **Tolerancia y Fallback:** Si el vehículo tiene menos de 2 abastecimientos previos y no cuenta con historial suficiente para promediar, se aplicará el límite por defecto de uso: 8.0 km/L para vehículos particulares y 3.5 km/L para vehículos de servicio. El umbral de sospecha en este caso también será el 70% de dicho estándar (5.6 km/L y 2.45 km/L respectivamente).

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

### 3.6 Auditoría de Conductor en Suministro (Auditoría Obligatoria)
- **Campo de Conductor:** Todo registro de abastecimiento en bomba exige obligatoriamente la captura del nombre completo del **Conductor / Oficial Responsable** del vehículo.
- **Propósito:** Mantener la trazabilidad física y administrativa en caso de auditorías por discrepancias de kilometraje o consumo inusual. El nombre ingresado se asocia directamente a la fila de abastecimiento en base de datos.

## 4. ESPECIFICACIÓN DE MÓDULOS FRONTEND IMPLEMENTADOS

### 4.1 Parque Automotor (`ParqueAutomotor.jsx`)
- **Gestión de Flotas:** Visualización de todos los vehículos activos agrupados/filtrados por entidad con paginación y búsqueda por placa. El formulario de filtros utiliza una rejilla responsiva (`grid-cols-1` en móvil, `sm:grid-cols-2` en pantallas medianas y `xl:grid-cols-4` en pantallas grandes) y los elementos tienen un ancho adaptativo (`w-full` / `truncate`) para evitar desbordes visuales ante nombres de entidades extensos.
- **Asignación de Combustible y Cambio de Entidad:** Toggle interactivo para habilitar/inhabilitar el suministro en bomba a vehículos particulares registrados, y campos para configurar límites y capacidades del tanque en litros. Adicionalmente, los usuarios con rol de administrador (`ADMIN_BASE` y `COMANDANTE`) disponen de un selector de entidad en el modal de edición de vehículos para reasignar su pertenencia civil/militar (el historial previo no se altera para conservar la contabilidad contable pasada).
- **Planificador de Abastecimiento Semanal (Asignación vs Capacidad):** Panel táctico reactivo en la parte superior que consolida la suma total de las cuotas semanales de combustible asignadas a los vehículos activos y autorizados de gasolina y diésel, contrastándolas contra la capacidad de almacenamiento total de los tanques correspondientes. Emite una alerta visual en color rojo y animación de pulso en caso de sobreasignación (>100% de la capacidad).
- **Límite Semanal de Entidad:** Panel integrado para ajustar el límite total de litros permitidos semanalmente por entidad civil/militar.
- **Importación Masiva:** Procesamiento de flotas a través de plantillas Excel (`.xlsx`) con un resumen de filas procesadas en tiempo real. Se mapean correctamente las respuestas de éxito y actualización del backend (`total`, `exitosos` y `actualizados`) en los indicadores visuales `Leídos`, `Creados` y `Actualizados`. Incluye bitácora de errores en tiempo real (renderizados de forma segura extrayendo las propiedades `fila` y `error` para prevenir caídas de React al recibir objetos) y descarga de la plantilla oficial.

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
- **Historial General vs Cierres (Tabs):** Integra un sistema de pestañas para alternar entre el Historial General de abastecimientos y el Historial de Cierres Diarios.
  - **Optimización por Carga Perezosa (Lazy Loading):** Para garantizar tiempos de respuesta ultra-rápidos e impedir la transferencia de megabytes de datos innecesarios a través de la red, los listados de historial omiten las imágenes base64 de su payload JSON. Cuando el usuario hace clic sobre una fila, el frontend consulta un endpoint de detalle dedicado (`GET /abastecimientos/{id}`) para descargar las imágenes correspondientes a ese registro en específico, mostrando un indicador de carga reactivo.
- **Reportes PDF de Cierre Históricos:** En la pestaña de Cierres Diarios, se puede consultar y descargar en tiempo real un PDF del cierre histórico seleccionado llamando a la API de consolidación de datos y volviendo a renderizar el reporte formal.

### 4.5 Monitor de Bomba y KPIs en Tiempo Real
- **Dashboard del Comandante:** Integra 5 KPIs tácticos de combustible (Litros Surtidos, Cargas, Stock de Combustible en Tanques, Solicitudes Pendientes y Alertas de Fraude) y un componente `FuelMonitor` con polling de 30 segundos.
- **Pestañas del Monitor:** Tanques (niveles con barra de color), Flujo (feed de últimas 15 cargas), y Solicitudes (resumen de pendientes con botón de acción rápido).

### 4.6 Panel del Bombero (`DashboardBombero.jsx`)
- **Registro de Abastecimiento:** Flujo móvil-first optimizado para el bombero de turno. Exige declaración diaria obligatoria de apertura de tanques, captura del conductor responsable y foto obligatoria del dispensador/surtidor. La **foto del odómetro es opcional** — su ausencia no bloquea el guardado del formulario, pero su presencia activa el OCR de IA para autocompletar el kilometraje. Ambos campos de foto permiten seleccionar imagen desde la **galería del dispositivo** o capturar con la cámara directamente.
- **Autoselección de Tanque por Combustible:** Al cargar la ficha del vehículo en la interfaz, el sistema evalúa dinámicamente su propiedad `tipo_combustible` (por ejemplo, `gasolina` o `diesel`) y pre-selecciona automáticamente el tanque surtidor correspondiente en el menú desplegable para evitar suministros erróneos (por ejemplo, cargar gasolina en un vehículo diesel).
- **Lectura Inteligente con IA (OCR):** Integra el motor de IA Gemini 2.5 Flash a través del endpoint `/ia/extraer-datos`. Al capturar la foto del odómetro (tipo `odometro`) o del dispensador (tipo `surtidor`), la aplicación procesa la imagen de forma asíncrona, mostrando un indicador de estado "Leyendo con IA..." y rellenando automáticamente el campo numérico respectivo con los valores reconocidos (litros en formato decimal y kilometraje en formato entero).
- **Tolerancia a Fallos y Edición Manual:** En caso de que la lectura de la IA falle, devuelva un valor nulo/erróneo o tarde en responder, el flujo no se interrumpe en ningún momento. El bombero siempre puede modificar o ingresar manualmente tanto los litros cargados como el kilometraje actual. Además, el análisis de IA es **no bloqueante** para el guardado del formulario; si el bombero ingresa los datos manualmente y presiona "Completar Suministro", el formulario se guardará de inmediato y cualquier petición a la IA en curso será abortada para ahorrar recursos del servidor y cuota de API.
- **Navegación Fluida del Buscador (Acceso Denegado):** Se incluye un botón de "Volver" táctil (con área interactiva de 48px de altura) en la interfaz de "Acceso Denegado a Combustible". Esto le permite al bombero cancelar el flujo y regresar al buscador de placas en un solo toque, eliminando la necesidad de recargar la página del navegador ante vehículos bloqueados o no autorizados.
- **Sugerencias y Autocompletado de Placas:** Implementación de autocompletado en tiempo real a partir de 2 caracteres con un retardo (debounce) de 300ms para evitar sobrecarga. Muestra un listado flotante táctil (mínimo de 48px de altura por sugerencia) de hasta 5 coincidencias. Seleccionar una sugerencia rellena la placa y ejecuta la consulta del vehículo automáticamente.

---

## 5. ROLES Y PRIVILEGIOS DE ADMINISTRACIÓN DE PERSONAL DE COMBUSTIBLE

### 5.1 Alta del Rol BOMBERO
- **Autorización de Registro:** Únicamente el Comandante de Base y el Administrador de Base tienen autorización para dar de alta nuevos usuarios con el rol de `BOMBERO` en la pantalla de Fuerza de Tareas.
- **Vínculo de Entidad:** Al dar de alta a un `BOMBERO`, no se le asociará a ninguna entidad externa, ya que es un operador de servicio directo de la propia bomba de la base.
- **Color de Identificación:** En los paneles y listados de Fuerza de Tareas, el rol de `BOMBERO` se identificará visualmente con la etiqueta naranja táctica (`text-orange-400 bg-orange-400/10 border-orange-400/20`).

### 5.2 Acceso al Menú del Parque Automotor y Tanques
- **Barra de Navegación (Sidebar):** Los roles de Comandante y Administrador de Base tienen visible de forma fija el acceso al módulo "Parque Automotor" y "Tanques Combustible" desde la barra de navegación lateral para la administración, carga de flotas e inventario.

### 5.3 Abastecimientos Excepcionales y Edición de Litraje (Auditoría de Administrador)
- **Carga Excepcional:** Los roles de `ADMIN_BASE` y `COMANDANTE` pueden registrar abastecimientos excepcionales retroactivos. Estos registros se vinculan a la fecha del cierre diario seleccionado desde la pestaña de Cierres Diarios en el módulo de Tanques.
- **Bypass de Restricciones:** El registro excepcional elude las restricciones convencionales de cierre de día. Si el vehículo no se encuentra registrado en el censo, se creará automáticamente bajo la entidad `"Tránsito / Externo"`. La interfaz del modal excepcional provee selectores de archivos opcionales para capturar fotos de evidencia del odómetro y del surtidor (si no se suministran, el sistema completa el registro con marcadores vacíos sin bloquear la operación).
- **Edición de Registros:** Los administradores pueden editar la cantidad abastecida (litros), kilometraje y conductor de un abastecimiento existente desde el modal de Detalles Suministro en la pestaña de Abastecimientos.
- **Modificación de Entidades en Caliente:** Los administradores pueden alterar la entidad asignada a cualquier vehículo del Parque Automotor desde su modal de edición individual para corregir censos defectuosos. Esto afecta solo a los consumos y cuotas futuras del vehículo; los suministros pasados conservan su entidad de despacho original para no alterar reportes históricos.
- **Consistencia de Inventario:** Cualquier inserción excepcional o modificación de litraje reajusta de forma inmediata el nivel del tanque de combustible correspondiente en caliente (restando en inserciones y calculando la diferencia neta en ediciones).

---

## 6. CONFIGURACIÓN TÉCNICA Y ZONA HORARIA
Para asegurar la exactitud de los reportes, KPIs y los procesos de apertura/cierre diarios de los tanques de combustible, el sistema está configurado forzosamente para evaluar los cortes de fecha a la media noche (12:00 AM) de la hora local de **Venezuela (`America/Caracas`)**. No se utilizarán los horarios UTC del servidor de base de datos para cálculos de negocio (Ver detalles técnicos en `DIRECTIVA_ZONA_HORARIA.md`).

---

## 7. EVIDENCIA FOTOGRÁFICA EN REPORTES DE CIERRE (OPCIÓN D — JWT 72h)

### 7.1 Arquitectura
Las fotos del surtidor y del odómetro se almacenan como **Base64 en la columna `foto_maquina_url`** de la tabla `abastecimientos`. Para incluirlas en el reporte de cierre sin exponer el sistema ni hacer el PDF interminable, se implementa la **Opción D: hipervínculos firmados de corta duración (72 horas)**.

### 7.2 Flujo de Funcionamiento y Estándar del PDF
1. El Supervisor hace clic en **"PDF + Fotos"** en la tabla de cierres diarios.
2. El frontend llama a `GET /api/v1/combustible/cierres/{id}/reporte-con-fotos`.
3. El backend genera un **JWT firmado de 72h** por cada abastecimiento del día (usando la misma `SECRET_KEY` del sistema).
4. El PDF generado unifica el título a **"REPORTE DE CIERRE DIARIO"** (evitando redundancias) y formatea la alerta de expiración del enlace de forma dinámica mediante `splitTextToSize` para ajustarse a los márgenes y evitar desbordes horizontales o verticales.
5. La tabla de abastecimientos se ajusta al **100% del ancho útil** del documento (182mm libres de un A4 respetando 14mm de margen izquierdo y derecho) mediante columnas auto-ajustables para el conductor y la entidad.
6. La columna **"Evidencia Surtidor"** incluye la etiqueta explícita **"Ver Foto (Clic)"** en azul y negrita, evitando caracteres especiales (como flechas) que rompan la codificación de fuentes estándar (Helvetica/WinAnsi) de jsPDF.
7. Al hacer clic, el auditor es dirigido a `GET /api/v1/combustible/foto/{uuid}?token=JWT`.
8. El backend valida el token, decodifica el Base64 y devuelve la imagen directamente.
9. Después de 72 horas, el link expira automáticamente. Se debe descargar un nuevo PDF para obtener links frescos.

### 7.3 Seguridad del Endpoint de Foto
- **No requiere sesión:** El link funciona para auditores externos sin cuenta en el sistema.
- **Scope específico:** El campo `proposito=foto_auditoria` en el payload JWT evita que tokens de sesión normales sean reutilizados.
- **Un token por foto:** Cada abastecimiento tiene su propio token vinculado a su UUID.
- **Cabeceras de seguridad:** La respuesta incluye `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`.
- **Sin exposición del sistema:** El único endpoint nuevo es de solo-lectura para imágenes específicas.

### 7.4 Archivos Modificados
- `backend/app/core/security.py` → Funciones `crear_token_foto()` y `validar_token_foto()`
- `backend/app/api/v1/combustible.py` → Endpoints `GET /foto/{id}` y `GET /cierres/{id}/reporte-con-fotos`
- `frontend/src/utils/fuelReportGenerator.js` → Nueva función `generarReporteCierreConFotos()`
- `frontend/src/services/combustible.service.js` → Método `obtenerReporteCierreConFotos()`
- `frontend/src/pages/combustible/GestionTanques.jsx` → Botón "PDF + Fotos" en la tabla de cierres

---

*Última actualización: 2026-06-30 (Flexibilización del formulario de abastecimiento del Bombero: foto del odómetro ahora es opcional y ambas fotos permiten selección desde galería del dispositivo — se elimina `capture="environment"` de los inputs de archivo)*
*Aprobado por: Comandante de Base & Antigravity Aegis Command*
