# Directiva: Gestión de Salidas de Base (Aegis Tactical v2.3)

## 1. Propósito
Optimizar el flujo de tráfico en las alcabalas de salida permitiendo métodos alternativos y automatizados para registrar el egreso de vehículos de la base, sin necesidad obligatoria de escaneo manual de QR en contingencias o saturación.

## 2. Métodos de Salida Soportados

| Método | Descripción | Activación |
| :--- | :--- | :--- |
| **Escaneo en Alcabala** | Registro manual por el guardia escaneando el QR de salida o buscando por placa. | **Siempre Activo (Mandatorio)** |
| **Auto-Cierre por Re-entrada** | Si un vehículo intenta entrar y tiene una entrada previa sin salida, se cierra la anterior automáticamente. | **Siempre Activo (Integridad)** |
| **Sincronización Parquero** | Al marcar la salida de la zona de estacionamiento, el sistema marca automáticamente la salida de la base. | Opcional (Ajustes Comandante) |
| **Expulsión Masiva** | A una hora predefinida (ej. 23:00), todos los vehículos activos en base se marcan como egresados. | Opcional (Ajustes Comandante) |


## 3. Lógica de Implementación (Backend)

### 3.1 Configuraciones Globales
Se utilizará la tabla `configuracion` para almacenar las preferencias del comandante:
- `BASE_EXIT_SYNC_PARKING`: (bool) `true`/`false`.
- `BASE_EXIT_MASS_TIME`: (string) `HH:MM` o `null`.
- `BASE_EXIT_AUTO_REENTRY`: (bool) `true`/`false`.

### 3.2 Tareas Programadas (Cron)
El `CronService` ejecutará un ciclo cada minuto/hora para verificar `BASE_EXIT_MASS_TIME`.
Si la hora actual coincide, se identificarán todos los registros de `Acceso` tipo `entrada` que no tengan un registro correlacionado de `salida` posterior y se crearán los registros de salida automáticos.

### 3.3 Sincronización en Tiempo Real
El `ParqueroService` consultará `BASE_EXIT_SYNC_PARKING` antes de finalizar un `VehiculoPase`. Si está activo, invocará internamente al `AccesoService` para registrar el evento de salida de base.

## 4. Interfaz de Usuario (Frontend)
El panel de **Ajustes** (sección exclusiva para Comandantes) permitirá:
- Alternar interruptores (switches) para los métodos opcionales.
- Configurar la hora de la expulsión masiva.
- Visualizar el estado actual de los métodos.

## 5. SOPs (Standard Operating Procedures)
- Ante fallas de red en alcabala, se debe priorizar la **Sincronización Parquero**.
- El **Auto-Cierre por Re-entrada** garantiza la integridad de las estadísticas de ocupación diaria.
- La **Expulsión Masiva** debe usarse principalmente para "limpiar" la base al final del día operativo.
