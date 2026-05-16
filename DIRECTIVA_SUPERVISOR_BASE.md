# DIRECTIVA TÁCTICA: SENTINEL INTERFACE (SUPERVISOR DE BASE)

## 2. ARQUITECTURA DE NAVEGACIÓN (AEGIS V4)
Para maximizar la eficiencia operativa, las herramientas tácticas se han descentralizado del dashboard principal hacia el menú lateral:
- **Sentinel Interface (Dashboard):** Vista de mando unificada con KPIs, Mapa de Incidentes y Registro Maestro.
- **Censo Vehicular:** Monitoreo detallado de vehículos en base/estacionamiento.
- **Censo Personas:** Trazabilidad profunda de identidades y patrones.
- **Emisión de Pases:** Generación de autorizaciones excepcionales.

## 3. REGISTRO MAESTRO GLOBAL (MASTER REGISTRY)
El Dashboard integra un "Registro Maestro" que consolida:
- **Estado Operativo:** Indica si una entidad (Persona o Vehículo) está ACTIVA, EN BASE, SALIDA RECIENTE o INACTIVA.
- **Visibilidad Total:** Muestra todos los registros históricos, no solo los activos, para una supervisión reactiva y proactiva.
- **Búsqueda Táctica:** Filtro instantáneo por placa, nombre o documento.

## 4. MONITOREO GEOGRÁFICO...
La Sentinel Interface integra el **Mapa Base Real** con una capa dinámica de incidentes.
- **Iconografía:** Se utilizan pines rojos pulsantes (`AlertTriangle`) para infracciones activas.
- **Contexto:** Cada incidente muestra placa, descripción y reportero al ser seleccionado.
- **Filtros:** El Supervisor puede filtrar por gravedad (Leve, Moderada, Grave, Crítica).

## 4. CONTROL EXCEPCIONAL: PASES TEMPORALES DE SEGURIDAD
El Supervisor tiene la autoridad para emitir pases que eluden la validación administrativa estándar de las entidades.
- **Uso:** Exclusivo para emergencias médicas, interrogación en campo o visitas de alto mando.
- **Trazabilidad:** Estos pases se marcan como `EXCEPCIONALES` en la base de datos para auditoría posterior por el Comandante.

## 5. REVISIÓN DE ALCABALAS (BITÁCORA TÁCTICA)
El Supervisor monitorea el estado de todas las alcabalas activas:
- **Personal al Mando:** Identificación del sargento/oficial de guardia.
- **Volumen de Flujo:** Conteo total de entradas/salidas hoy.
- **Última Actividad:** Tiempo transcurrido desde el último escaneo para detectar inactividad en puestos de guardia.

## 6. ESTÁNDAR VISUAL (AEGIS TACTICAL V3)
- **Modo:** Dark Mode obligatorio (High Contrast).
- **Tipografía:** Inter/Roboto para legibilidad; JetBrains Mono para datos técnicos.
- **Componentes:** Card-based layout con micro-animaciones de pulso para alertas activas.
- **Responsividad:** 100% Mobile First (Uso en tabletas de patrulla).

## 7. PROTOCOLO DE ESTABILIDAD (ICON NAMESPACE)
Para evitar errores de referencia (`ReferenceError`) en la producción y asegurar la compatibilidad con objetos globales de JavaScript (como `Map`), se establece el siguiente estándar de importación para `lucide-react`:
- **Aliasing Obligatorio:** Todos los componentes con nombres genéricos deben importarse con el sufijo `Icon`.
- **Ejemplos:** `Car as CarIcon`, `User as UserIcon`, `Map as MapIcon`, `Search as SearchIcon`.
- **Alcance:** Este protocolo aplica a todas las páginas de la Sentinel Interface y el Mando de Base.

---
**ESTADO DE DOCUMENTO:** OPERATIVO (ESTABILIZADO)
**ÚLTIMA ACTUALIZACIÓN:** 2026-05-12 17:15
**APROBADO POR:** ANTIGRAVITY AEGIS COMMAND
