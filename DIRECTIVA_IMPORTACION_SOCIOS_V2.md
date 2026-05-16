# DIRECTIVA TÁCTICA: IMPORTACIÓN MASIVA DE SOCIOS V2.2

## 1. OBJETIVO
Estandarizar el proceso de importación masiva de socios permanentes, permitiendo la vinculación simultánea de hasta **4 vehículos** por cada socio, alineando esta funcionalidad con el estándar táctico de pases masivos temporales.

## 2. ESTRUCTURA DEL ARCHIVO EXCEL (.XLSX)
La plantilla ahora cuenta con **21 columnas** divididas en dos secciones principales:

### A. Datos Personales (Columnas 1-5)
| Columna | Encabezado | Obligatorio | Descripción |
| :--- | :--- | :--- | :--- |
| A | CEDULA | SI | Identificador único del socio. |
| B | NOMBRE | SI | Nombre(s) del socio. |
| C | APELLIDO | SI | Apellido(s) del socio. |
| D | EMAIL | NO | Correo para envío de credenciales. |
| E | TELEFONO | NO | Número de contacto. |

### B. Flota Vehicular (Columnas 6-21)
Se permiten hasta 4 vehículos (V1 a V4). Cada vehículo requiere 4 campos:
- **PLACA**: Identificador del vehículo (Obligatorio para registrar el vehículo).
- **MARCA**: Marca del fabricante.
- **MODELO**: Modelo del vehículo.
- **COLOR**: Color predominante.

**Distribución de Columnas:**
- **V1**: F (Placa), G (Marca), H (Modelo), I (Color)
- **V2**: J (Placa), K (Marca), L (Modelo), M (Color)
- **V3**: N (Placa), O (Marca), P (Modelo), Q (Color)
- **V4**: R (Placa), S (Marca), T (Modelo), U (Color)

## 3. LÓGICA DE PROCESAMIENTO Y FLEXIBILIDAD (Protocolo Aegis v2.3)
El sistema ha sido diseñado para ser resiliente a datos incompletos, permitiendo la carga masiva incluso si faltan campos tradicionalmente obligatorios.

1.  **Manejo de Datos Faltantes**:
    -   **CÉDULA Faltante**: Si la fila no contiene cédula, el sistema generará un identificador temporal automático con el formato `TEMP-XXXXXXXX`. Este ID servirá como usuario y contraseña inicial.
    -   **NOMBRES Faltantes**: Si el nombre o apellido están vacíos, se usarán los placeholders `MIEMBRO` y `PENDIENTE` respectivamente.
    -   **VEHÍCULOS Faltantes**: El sistema ignorará los bloques de vehículos donde la `PLACA` esté vacía, pero procesará el resto de la fila.
2.  **Validación de Identidad**: Si la CÉDULA ya existe en el sistema, la fila se saltará para evitar colisiones de datos.
3.  **Registro de Usuario**: Se crea el perfil con `debe_cambiar_password = True`, forzando al socio a actualizar sus credenciales al primer ingreso.
4.  **Completitud en el Portal**: Una vez cargado el registro "incompleto", el socio podrá (y deberá) completar sus datos reales desde su portal personal.
5.  **Vinculación de Flota**:
    -   El sistema recorre los 4 bloques de vehículos.
    -   Si la `PLACA` ya existe como "Invitado", se transfiere automáticamente.
6.  **Notificación**: El envío de correos solo se ejecutará si el campo `EMAIL` es válido. Si está vacío, el administrador deberá proporcionar las credenciales temporales al socio manualmente.

## 4. CONSIDERACIONES TÁCTICAS
- **Estética de Plantilla**: La plantilla generada utiliza el esquema de colores "Aegis Dark" (Azul Pizarra y Gris Táctico) para coherencia visual con el resto del sistema.
- **Campos Opcionales**: Si no se especifica Marca, Modelo o Color, el sistema asignará valores por defecto ("S/M" o "S/C") para asegurar la trazabilidad en los puntos de control (Alcabala).
- **Límite de Vehículos**: Aunque la importación permite 4, la política del portal puede restringir la adición manual posterior según la configuración de la entidad.

---
**Documentación Generada por Antigravity v3.1**
*Fecha: 2026-05-12*
*Versión de Sistema: 2.2.0*
