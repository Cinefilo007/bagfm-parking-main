# Directiva: Vista Mapa Táctica para Entidades

## Objetivo
Proporcionar a los administradores de entidad una vista georreferenciada de sus activos (zonas de estacionamiento) asignados, similar a la visualización centralizada del Comandante de Base, pero limitada a su jurisdicción.

## Componentes Utilizados
- **Frontend**: `frontend/src/pages/entidad/Estacionamientos.jsx`
- **Componente Reutilizable**: `frontend/src/components/MapaTactico.jsx`
- **Servicio**: `frontend/src/services/mapaService.js`
- **Backend**: `backend/app/services/mapa_service.py`

## Lógica de Implementación (SOP)
1. **Segregación de Datos**: La vista de entidad debe filtrar los datos del mapa táctico global. Se utiliza el prop `idsZonasPermitidas` en `MapaTactico` para garantizar que solo se rendericen los pines correspondientes a las zonas asignadas a la entidad.
2. **Sincronización (Link Satelital)**: 
   - El mapa cuenta con un mecanismo de polling (actualización automática cada 30s).
   - Se ha implementado un botón de refresco manual que incrementa un `mapaReloadKey` para forzar actualizaciones inmediatas del link satelital.
3. **Interfaz Táctica**:
   - Se utiliza una pestaña dedicada en el panel de Estacionamientos.
   - El diseño sigue la estética *Aegis Tactical*, incluyendo capas de satélite y vista táctica militar.
   - Incluye indicadores de carga animados ("Sincronizando Radar") para mejorar el feedback de usuario.

## Guía para Futuras Mejoras
- **Geocercas (Geofencing)**: Se podrían añadir perímetros visuales alrededor de las zonas asignadas.
- **Estado de Puestos en Mapa**: Al hacer clic en una zona, se podría desplegar un mini-dashboard con la ocupación gráfica de los puestos internos sin salir del mapa.
- **Alertas en Tiempo Real**: Integrar disparadores visuales (pines parpadeantes) cuando un vehículo no autorizado ingrese a una zona de la entidad.

## Mantenimiento
Antes de modificar la lógica del mapa:
1. Verificar que `mapaService.getSituacion()` retorne el array `zonas_estacionamiento` con los IDs correctos.
2. Asegurar que las coordenadas (latitud/longitud) estén correctamente establecidas en la base de datos para que los activos aparezcan en el radar.
