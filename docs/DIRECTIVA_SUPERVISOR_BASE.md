# DIRECTIVA TÁCTICA — ROL: SUPERVISOR DE BASE
## Módulo: Sentinel Interface (Control Táctico Nivel 1)

> **ESTADO:** OPERATIVO  
> **CLASIFICACIÓN:** NIVEL DE SEGURIDAD ALTO  
> **OBJETIVO:** Centralizar la trazabilidad de identidades y vehículos para detectar anomalías en el perímetro de la base.

---

## 1. DEFINICIÓN DEL ROL
El **Supervisor de Base** actúa como el escudo de seguridad humano del sistema. Su función es supervisar proactivamente los registros automatizados de las alcabalas y parqueros, interviniendo en casos de patrones sospechosos o emergencias que requieran discrecionalidad.

## 2. HERRAMIENTAS TÁCTICAS (SENTINEL INTERFACE)

### 2.1 Censo Vehicular (Real-Time)
*   **Función:** Visualizar todos los vehículos físicamente presentes en la base.
*   **KPI Clave:** Tiempo de permanencia. Un vehículo con >12h sin salida reportada debe ser marcado para verificación en campo por una patrulla.
*   **Protocolo:** Si el parquero marca "Fuera de Base", el supervisor debe verificar aleatoriamente que el vehículo realmente haya abandonado el estacionamiento.

### 2.2 Censo de Personas (Trazabilidad Humana)
*   **Identificador Universal:** Número de Cédula.
*   **Niveles de Alerta IA:**
    *   🟢 **NINGUNA:** Patrón regular de acceso.
    *   🟡 **MEDIA:** >5 pases temporales en el último mes.
    *   🟠 **ALTA:** Uso de más de 3 vehículos distintos en 30 días.
    *   🔴 **CRÍTICA:** Accesos en horario nocturno (>22:00) con vehículos no registrados previamente.
*   **Acción:** Ante alerta Roja/Naranja, el supervisor debe contactar al administrador de la entidad vinculada o denegar futuros pases temporales.

### 2.3 Mapa de Incidentes (Infracciones)
*   Visualización de faltas geolocalizadas (obstrucción, estacionamiento indebido, conducta).
*   Permite identificar "Zonas Calientes" de conflicto para reasignar personal de seguridad.

### 2.4 Emisor de Pases de Emergencia
*   Generación de QR tácticos que eluden el flujo estándar de socios.
*   **Uso:** Solo para casos excepcionales (servicios de emergencia, visitas oficiales no programadas, interrogación en campo).
*   **Caducidad:** 24 horas máximo.

## 3. PROTOCOLO DE ACTUACIÓN

1.  **Detección de Anomalía:** El sistema Sentinel resalta en HUD (color rojo/naranja) a personas con patrones inusuales.
2.  **Investigación:** Consultar el perfil detallado de la persona (Censo de Personas) para ver historial de vehículos y accesos.
3.  **Intervención:** 
    *   Si el riesgo es bajo: Notificar al administrador de la entidad.
    *   Si el riesgo es alto: Bloqueo de ID y reporte a Seguridad de Base.

---

## 4. ESPECIFICACIONES TÉCNICAS (SOP)
*   **Frontend:** `DashboardSupervisorBase.jsx` utilizando tokens de diseño Aegis.
*   **Backend:** Router `/api/v1/supervisor-base`.
*   **Seguridad:** Requiere rol `SUPERVISOR` o superior.

---
*Versión: 1.0 | Fecha: 2026-05-12 | Autor: Antigravity*
