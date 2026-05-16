# DIRECTIVA — GESTIÓN DE RESERVAS DEL COMANDO (v1.0)

Esta directiva define el procedimiento para que el `COMANDANTE` y el `ADMIN_BASE` gestionen los puestos de estacionamiento apartados para uso de la base.

## 1. Definición de Cupos de Base

De acuerdo a la `DIRECTIVA_ESTACIONAMIENTOS.md`, cada asignación de zona a una entidad civil puede incluir un `cupo_reservado_base`.
- Estos puestos son de uso exclusivo del personal de la base o invitados VIP del comando.
- El comando tiene la potestad de convertir estos cupos en pases identificados (QR) en cualquier momento.

## 2. Gestión de Pases del Comando

El Comandante puede generar dos tipos de pases para sus puestos reservados:

### 2.1 Pase Temporal (Invitado)
- **Uso**: Visitas protocolares, proveedores temporales de la base, prensa oficial.
- **Vigencia**: De 24 horas a 7 días (configurable).
- **Registro**: Requiere cédula, nombre y placa del vehículo.

### 2.2 Pase Permanente (Socio Base)
- **Uso**: Personal militar o civil adscrito permanentemente a la base.
- **Vigencia**: Permanente mientras dure la comisión.
- **Registro**: Vinculado a un registro de `Socio` en la entidad virtual "SOPORTE BASE".

## 3. Flujo de Emisión

1. El usuario selecciona una zona con cupos de base libres.
2. Selecciona "Generar Pase de Comando".
3. Completa los datos del portador y vehículo.
4. El sistema genera un `CodigoQR` con `tipo_acceso = 'base'`.
5. Si la zona usa **Puestos Identificados**, se vincula a un puesto con `estado = 'reservado_base'`.
6. Si la zona usa **Contadores**, se descuenta del número total de puestos reservados base disponibles en esa zona.

## 4. Control de Ocupación

- Todo pase con `tipo_acceso = 'base'` debe ser contabilizado en la `ocupacion_actual` de la zona al ingresar.
- Los reportes de ocupación deben desglosar: Libres, Ocupados (Entidad), Ocupados (Base), Ocupados (General).
