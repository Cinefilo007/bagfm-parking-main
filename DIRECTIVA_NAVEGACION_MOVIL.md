# DIRECTIVA-015: ESTÁNDAR DE NAVEGACIÓN EN DISPOSITIVOS MÓVILES

## 1. PROPÓSITO
Garantizar que todas las funcionalidades críticas del sistema sean accesibles desde dispositivos móviles, optimizando el espacio limitado de la interfaz sin sacrificar la capacidad operativa.

## 2. BARRA DE NAVEGACIÓN INFERIOR (BottomNav)
- **Límite de Elementos**: La barra inferior debe contener un máximo de **5 elementos** para evitar el amontonamiento y errores de pulsación.
- **Jerarquía de Contenido**: Los primeros 4 elementos se reservan para las vistas de mayor frecuencia de uso según el rol del usuario.
- **Acceso Extendido**: El 5º elemento debe ser obligatoriamente el botón **"MÁS"** (etiquetado como "MÁS", "PERFIL" o "AJUSTES" según el contexto), que actuará como puerta de enlace al Centro de Control.

## 3. CENTRO DE CONTROL (Vista de Ajustes)
- **Ubicación**: Se implementa en la parte superior de la ruta `/ajustes`.
- **Visualización**: En móviles, debe mostrar una cuadrícula (Grid) de módulos operativos.
- **Componentes de Módulo**:
    - **Icono**: Representativo de la función (Lucide React).
    - **Etiqueta**: Nombre corto y en mayúsculas (estilo táctico).
    - **Indicador**: Opcionalmente, un punto de color para indicar estado o alertas pendientes.
- **Responsividad**:
    - Móviles: Cuadrícula de **2 columnas**.
    - Escritorio: Se oculta o se integra como navegación secundaria, priorizando la Sidebar.

## 4. ESTÉTICA TÁCTICA
- Las tarjetas de los módulos deben seguir el esquema de color del sistema:
    - Fondo: `bg-low/40` con `backdrop-blur`.
    - Borde: `white/5` o `bg-high/20`.
    - Efectos: Micro-animación de escala (`active:scale-95`) al pulsar.

---
*Ultima actualización: 2026-05-06 (Creación de estándar para navegación extendida)*
