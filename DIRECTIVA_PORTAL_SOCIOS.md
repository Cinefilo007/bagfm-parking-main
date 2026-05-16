# DIRECTIVA-009: PORTAL DE SOCIOS Y GESTIÓN DE MEMBRESÍAS

## 1. PROPÓSITO
Esta directiva establece los estándares para el funcionamiento del Portal de Socios, la lógica de renovación de membresías y la validación de acceso táctico en BAGFM.

## 2. ARQUITECTURA DEL SISTEMA DE MEMBRESÍA
El sistema sigue el principio de **SOPs vs Ejecución**.

### 2.1 Lógica de Negocio (Backend)
- **`MembresiaService`**: Única fuente de verdad para cálculos de tiempo, estados (Activa, Suspendida, Vencida, Exonerada) y renovaciones.
- **Renovación**: Se utiliza `relativedelta` para asegurar que el día de vencimiento se mantenga constante (ej. si vence el 15, la renovación será hasta el 15 del mes siguiente).
- **Refresco de QR**: Cada renovación o cambio de estado administrativo invalida el token QR previo y genera uno nuevo por seguridad.
- **Exoneración**: Estado especial para personal que no requiere pago pero necesita acceso controlado.

### 2.2 Componentes Frontend (Aegis Tactical)
- **`SocioCard.jsx`**: Visualización administrativa con barra de progreso circular/lineal del tiempo de membresía. Colores dinámicos:
  - **Verde**: > 10 días.
  - **Naranja**: < 10 días.
  - **Rojo**: Vencida o < 3 días.
- **`PortalSocio.jsx`**: Vista del usuario final optimizada para móviles con QR centralizado y estados de acceso claros.

## 3. GESTIÓN DE ACCESO (ALCABALAS)
- El escáner valida no solo la autenticidad del token, sino el estado actual de la membresía en tiempo real.
- **Mensajería**: El guardia recibe alertas específicas si la membresía está suspendida o vencida, permitiendo informar al socio.

## 4. PROCEDIMIENTOS OPERATIVOS (SOP)
- **Creación de Socio**: Todo socio nuevo inicia con 1 mes de membresía activa por defecto.
- **Suspensión**: Un socio suspendido no puede generar QR válidos y el sistema de alcabala rebotará su acceso.
- **Renovación Múltiple**: El administrador puede sumar N meses por adelantado.

## 5. SEGURIDAD Y TOKENIZACIÓN
- Los tokens QR son JWT firmados que contienen el `usuario_id` y `vehiculo_id`.
- La revocación es inmediata al cambiar el flag `activo = False` en la tabla `codigo_qr`.
