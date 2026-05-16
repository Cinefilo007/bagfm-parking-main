# DIRECTIVA TÁCTICA: Gestión de Fuerza de Tareas (v2.2)

## 1. Visión General
El módulo de **Fuerza de Tareas** es el núcleo de control humano del sistema Aegis Tactical. Su diseño prioriza la eficiencia espacial, la velocidad de respuesta y el monitoreo de integridad operativa para prevenir la corrupción en los puntos de acceso.

## 2. Arquitectura de Interfaz (UX/UI)
Siguiendo los estándares de **Aegis Tactical v2.2**, la interfaz utiliza un sistema de **Tarjetas Delgadas Expandibles**:

- **Fila Principal (Header de Tarjeta):** Muestra KPIs críticos (Días Activo, Asignaciones Manuales, Incentivos, Sanciones) y acciones rápidas (Pausa/Reactivación, Baja).
- **Expansión In-Place:** Elimina los modales obstructivos, permitiendo la gestión de Zonas, Incentivos y Sanciones dentro del flujo natural del listado.
- **Distribución Horizontal:** Los formularios de entrada de datos están distribuidos horizontalmente para maximizar el uso de pantalla en dispositivos tácticos (tablets/desktops).

## 3. Control de Integridad: Asignaciones Manuales
Como medida anti-corrupción, el sistema monitorea proactivamente el comportamiento de los parqueros:

- **Mecanismo:** Se contabilizan los registros de `Acceso` donde `es_manual = True` y el auditor (`registrado_por`) coincide con el parquero.
- **Protocolo de Alerta:**
    - Si un parquero supera las **10 asignaciones manuales**, se activa una alerta visual (rojo/pulso/icono de peligro) en el dashboard de supervisión.
    - **Razón:** El exceso de registros manuales sugiere que el parquero podría estar permitiendo el acceso a vehículos sin QR válido a cambio de beneficios externos.
- **Acción Sugerida:** El supervisor debe auditar la zona del parquero ante la activación de esta alerta.

## 4. Gestión de Zonas Tácticas
La asignación de zonas es dinámica y permite el despliegue rápido de personal:
- **Patrullaje:** Un parquero sin zona asignada se considera en estado de patrullaje general.
- **Asignación Fija:** Vincula al parquero con una zona específica para recibir notificaciones en tiempo real cuando un vehículo autorizado ingresa a su sector.

## 5. Protocolos Disciplinarios
- **Incentivos:** Utilizados para premiar la eficiencia en el manejo de flujos vehiculares complejos.
- **Sanciones:**
    - **Amonestación:** Falta leve.
    - **Relevo Inmediato:** Desactiva automáticamente al operativo del sistema, revocando todos sus permisos de acceso y escaneo.

## 6. Mantenimiento y Soporte
- **Backend Service:** `app.services.personal_service.py`
- **Frontend Page:** `pages/Personal.jsx`
- **Modelos:** `Usuario`, `Acceso`, `IncentivoParquero`, `SancionParquero`.

> [!IMPORTANT]
> Nunca intente escribir directamente en la propiedad `zona_nombre` del modelo `Usuario`, ya que es una propiedad calculada dinámicamente desde la relación de zona asignada.
