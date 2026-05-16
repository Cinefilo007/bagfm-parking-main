# DIRECTIVA DEL MAPA TÁCTICO — BAGFM
**Nivel de Clasificación: Uso Oficial — Seguridad de Base**  

---

## 1. Visión Situacional
El **Mapa Táctico** es la pieza central de la inteligencia operativa para el **Comandante** y el **Supervisor**. Proporciona una representación visual dinámica de los activos y puntos críticos dentro de la Base Aérea Generalísimo Francisco de Miranda.

### Objetivos:
- Visualizar en tiempo real la ubicación de las **Alcabalas**.
- Localizar las sedes de las **Entidades Civiles** vinculadas.
- Monitorear la **capacidad y ocupación** de las Zonas de Estacionamiento/Estacionamiento.
- Detectar anomalías (alertas) geolocalizadas.

---

## 2. Estética: The Sentinel Interface
El mapa debe seguir estrictamente el **Aegis Tactical Design System**:
- **Fondo:** `#0e1322` (Deep Space / Oceanic Void).
- **Proyección:** Estilo HUD con rejilla técnica sutil.
- **Iconografía:** 
  - **Alcabala:** Escudo táctico con halo pulsante esmeralda (`#10B981`) si está activa.
  - **Entidad:** Edificio simplificado o logotipo sutil.
  - **Zonas:** Contornos de cristal (`glassmorphism`) con indicador de barra de carga (Progress Bar) para capacidad.
- **Interacción:** Al tocar un marcador, se abre un **Tactical Briefing** (Popup) con detalles rápidos.

---

## 3. Capas de Datos (Data Layers)

### A. Capa de Infraestructura (Estática/Semi-estática)
- **Alcabalas:** Definidas por coordenadas fijas.
- **Puntos de Interés (POI):** Comandancia, Hangares, Entidades Civiles.

### B. Capa de Logística (Dinámica)
- **Zonas de Estacionamiento:**
  - `ocupacion_actual` / `capacidad_total`.
  - Color de alerta:
    - **< 80%:** Verde esmeralda.
    - **80% - 95%:** Naranja ámbar.
    - **> 95%:** Rojo táctico (Acrítico).
  - **v2.0 — Puestos individuales:**
    - Si `usa_puestos_identificados = true`: mostrar cada puesto con su estado (libre/ocupado/reservado).
    - Coordenadas `punto_acceso_lat/lon` para marcar la entrada a la zona.
    - Entidad asignada visible al hacer click en la zona (`asignaciones_zona`).
  - **v2.0 — Compartir ubicación:**
    - Botón en marcador de zona → deep link a Google Maps/Waze.

---

## 4. Implementación Técnica

### Backend (SOPs)
- **Service:** `mapa_service.py` -> `get_situacion_actual()`.
- **Schema:** 
  - Las entidades (`Alcabalas`, `Entidades`, `Zonas`) ahora incluyen campos `latitud` y `longitud` (NUMERIC).
- **Seguridad:** Los niveles de zoom y detalle están restringidos según el ROL. El Comandante ve la base completa; el Supervisor ve solo su sector.

### Frontend (HUD)
- **Tecnología:** SVG dinámico con sistema de proyección de coordenadas.
- **Componente:** `MapaBaseSVG.jsx` y `MapaTactico.jsx`.
- **Perímetro:** Basado en datos geográficos de La Carlota (BAGFM).
- **Control:** Zoom fijo con interacción táctica (onClick) sobre nodos.

---

## 5. Control de Cambios

| 2026-04-04 | 1.0.0 | Antigravity | Definición inicial del Módulo de Mapa Táctico |
| 2026-04-04 | 1.1.0 | Antigravity | Implementación de MapaTactico.jsx, mapa_service.py e integración en el dashboard |

---
*Referencia: DIRECTIVA_MAESTRA.md | Diseño Stitch: `4512440937494164528`*
