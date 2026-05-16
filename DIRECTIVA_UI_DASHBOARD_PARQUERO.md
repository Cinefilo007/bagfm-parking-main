# DIRECTIVA-014: ESTÁNDARES VISUALES DEL DASHBOARD PARQUERO

## 1. PROPÓSITO
Establecer las reglas de visualización táctica para el mapa de puestos de estacionamiento, permitiendo una identificación inmediata del estado de ocupación y el tipo de reserva.

## 2. CODIFICACIÓN DE COLORES (MAPA DE PUESTOS)
### 2.1 Por Tipo de Reserva
- **BASE (Comando)**: Color **Azul** (`indigo-400`). Indica puestos reservados para personal militar o de la base.
- **ENTIDAD / VIP**: Color **Amarillo** (`warning/orange`). Indica puestos asignados a entidades civiles, socios o eventos específicos.
- **GENERAL / LIBRE**: Color **Verde** (`success`). Indica puestos de uso general disponibles.

### 2.2 Por Estado de Ocupación
- **LIBRE**: El icono de estacionamiento (P) mantiene el color del tipo de reserva.
- **OCUPADO**: 
    - El icono de estacionamiento (**P**) debe cambiar obligatoriamente a **ROJO** (`danger`), independientemente del tipo de reserva.
    - El indicador de punto (dot) superior también debe ser **ROJO**.
- **MANTENIMIENTO**: Color **Gris** (`text-muted`).

## 3. IDENTIFICACIÓN DE VEHÍCULOS
- Todo puesto en estado **OCUPADO** debe mostrar la **PLACA** del vehículo vinculado como identificador principal.
- El código del puesto se relega a un segundo plano (texto pequeño debajo de la placa).
- **Estilo de Placa**: Fuente condensada, color rojo (`danger`), con una micro-animación de pulsación sutil.

## 4. OPERACIONES RÁPIDAS (ACCESIBILIDAD)
- **Salida desde Lista**: Se implementa un acceso directo de "Salida Rápida" en la lista de vehículos en zona.
- **Entrada desde Notificaciones**: Los eventos de "Alcabala" permiten registrar el ingreso directo a zona mediante un botón de "Recibir".
- **Completar Datos (Modal)**: Si el vehículo requiere datos adicionales (falta portador, cédula, teléfono o detalles del vehículo), se abrirá un modal táctico. 
    - El sistema identifica automáticamente si el vehículo es un **SOCIO FIJO** o un **PASE TEMPORAL**.
    - Los datos de portador (Nombre, Cédula, Teléfono) se sincronizan con la tabla `usuarios` para socios y con `codigos_qr` para temporales, garantizando la integridad del censo.
    - Se incluyen campos específicos para **Cédula** y **Teléfono** con formato validado.

## 5. VEHÍCULOS PERDIDOS (ALERTAS CRÍTICAS)
- **Definición**: Un vehículo se marca como perdido si excede el `tiempo_limite_llegada_min` configurado en la zona tras su paso por la alcabala.
- **Visualización**: Se utiliza el color **ROJO CRÍTICO** (`danger`) y el icono `ShieldAlert`.
- **Procedimiento**: El parquero debe ver la lista de perdidos y decidir si notifica al centro de mando o inicia un rastreo manual.
- **Frecuencia de Actualización**: La trazabilidad debe refrescarse cada 20 segundos automáticamente.

## 6. RELACIÓN DE DATOS (FRONTEND)
- La información del vehículo debe obtenerse cruzando el `id` del puesto o su `numero_puesto` con la lista de `vehiculosEnZona` enviada por el backend.
- En caso de no existir datos del vehículo para un puesto marcado como ocupado, se mostrará el texto "S/D" (Sin Datos) o se mantendrá la etiqueta de estado por defecto "Ocup.".

## 7. CONTROL DE CAPAS (VISUALIZACIÓN)
- **Botón de Capas (Layers)**: Permite alternar la visibilidad de los elementos geométricos del mapa.
- **Vinculación Táctica**: Al ocultar los polígonos de las zonas, el sistema debe ocultar automáticamente:
    - Los perímetros de las zonas de estacionamiento.
    - Las **grillas tácticas guardadas** (líneas de puestos, divisores y vías).
    - Las **sugerencias generadas por la IA** (puestos numerados y trazados propuestos).
- **Persistencia**: El estado de visualización se mantiene durante la sesión activa del componente para facilitar el análisis visual sin ruido.

## 8. ADAPTABILIDAD Y NAVEGACIÓN (UX TÁCTICA)
- **KPIs en Móvil**: En dispositivos móviles, los indicadores clave se muestran en una cuadrícula de **2x2** para maximizar el área de interacción.
- **Control de Scroll**:
    - El **Mapa de Puestos** y la lista de **Vehículos en Zona** deben tener un límite de altura máximo (`max-height`) para evitar el desplazamiento excesivo de la interfaz general.
    - Se debe utilizar scroll interno para navegar dentro de estos contenedores.
- **Paginación de Eventos**:
    - Las vistas de historial y trazabilidad utilizan **paginación desde el servidor** (`limit` y `skip`) para garantizar el rendimiento en zonas con alta densidad de operaciones.
    - Se implementa un botón de "Cargar más" para expandir el historial cronológicamente.
- **Agrupamiento Cronológico**: La línea de tiempo agrupa los eventos por fecha (HOY, AYER, FECHA) para facilitar la auditoría visual rápida de sucesos.

## 9. VALIDACIONES DE ACCESO (SOP CONTROL DE DESTINO)
- **Zona Incorrecta (QR y Placa)**: Si un vehículo tiene pase asignado a una zona diferente a la del parquero:
    - **Por QR**: `registrar_llegada_qr` ya valida `qr.zona_asignada_id != zona_id` y lanza `ValueError` con el nombre de la zona correcta.
    - **Por Placa**: `registrar_llegada_placa` (paso 4, búsqueda en `codigos_qr`) aplica la **misma validación** antes de crear el `VehiculoPase`.
    - **Frontend (`VistaRecibir.jsx`)**: El `catch` de `buscarPlaca` detecta mensajes con "pase inválido" o "zona" y muestra un `toast.error` diferenciado (fondo rojo oscuro, duración 6s, icono ⛔) en lugar del toast estándar.
- **Criterio de detección en frontend**: `mensaje.toLowerCase().includes('pase inválido') || mensaje.toLowerCase().includes('zona')`.

---
*Ultima actualización: 2026-05-12 (Validación zona incorrecta en búsqueda por placa — paridad con flujo QR)*
