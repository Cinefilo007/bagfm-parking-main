# DIRECTIVA: CONFIGURACIÓN DE ZONA HORARIA
**Módulo:** Core / General
**Versión:** 1.0

## Propósito
Esta directiva documenta la configuración global de la zona horaria del sistema a `America/Caracas`. El propósito principal es garantizar que todos los cálculos de días ("hoy", "ayer"), agrupaciones en los KPIs, horas de cierres/aperturas de módulos como Combustible, y las tareas programadas (Crons) se ejecuten y muestren la información alineados con el tiempo local en Venezuela, independientemente de la hora del servidor físico o del contenedor (generalmente en UTC).

## Cambios Implementados

### 1. Variables de Entorno Globales (Docker y Docker-Compose)
Se ha inyectado la variable de entorno `TZ=America/Caracas` tanto en el entorno de desarrollo local (`docker-compose.yml`) como en el contenedor de producción (`backend/Dockerfile`).
- **Efecto:** Todas las librerías nativas de Python y de la terminal que consultan la hora del sistema (ej. `datetime.now()` sin zona) evaluarán al horario de Caracas de forma predeterminada en entornos Linux.

### 2. Sincronización de PostgreSQL (Supabase / SQLAlchemy)
Se ha añadido el parámetro `server_settings` a la conexión de base de datos en `backend/app/core/database.py`.
- **Código:** `connect_args={"server_settings": {"timezone": "America/Caracas"}}`
- **Efecto:** Las sentencias SQL que utilizan `func.now()`, los campos de base de datos `TIMESTAMP WITH TIME ZONE` que generan su valor por defecto con la hora de la DB, y las agrupaciones o casteos de fechas operarán transparentemente en horario local de Venezuela, evitando desfases de 4 horas en la inserción o al buscar rangos de fechas de inicio a fin de un día.

### 3. Cálculos Explícitos Seguros en Python (Combustible)
Se ha modificado el archivo `backend/app/services/abastecimiento_service.py` para utilizar un cálculo explícito y seguro independiente de la zona del sistema operativo.
- **Implementación:** Se reemplazó el uso inseguro de `datetime.now()` por `datetime.now(ZoneInfo("America/Caracas"))` al momento de evaluar los límites de `inicio` y `fin` de un día (para verificaciones de apertura y cierre de tanque, así como para agrupar reportes semanales).
- **Justificación:** Esto protege la lógica de negocio contra ejecuciones en Windows o servidores mal configurados que no respetan la variable `TZ`, garantizando que la "apertura del día" siempre cierre y rote a la media noche (12:00 AM) de Caracas, y no a las 8:00 PM (hora equivalente a UTC 0).

## Lineamientos para Futuros Desarrollos
- **Cálculo de "Ahora":** Evitar usar `datetime.utcnow()`. Utilizar siempre `datetime.now(timezone.utc)` para guardar en la base de datos o, si se requiere la fecha local para lógica de negocio (ej. "saber si es mañana localmente"), utilizar `datetime.now(ZoneInfo("America/Caracas"))`.
- **Rango de Días:** Al agrupar o generar rangos de "un día", asegurarse de extraer la fecha de un objeto Timezone-Aware (`astimezone(ZoneInfo("America/Caracas"))`).
