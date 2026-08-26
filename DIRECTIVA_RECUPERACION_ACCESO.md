# DIRECTIVA DE RECUPERACIÓN Y RESTABLECIMIENTO DE ACCESO (BAGFM)

## 1. Objetivo
Establecer el procedimiento seguro para el restablecimiento de contraseñas de usuarios con privilegios críticos (como el Comandante o Personal Administrativo) en caso de olvido o bloqueo de credenciales, sin comprometer la seguridad del sistema ni exponer endpoints públicos vulnerables.

---

## 2. Política de Seguridad
1. **Sin Endpoints Públicos Desprotegidos:** Para cuentas con roles de alto mando (`COMANDANTE`, `SUPERVISOR_BASE`), el restablecimiento de emergencia debe realizarse exclusivamente a nivel de infraestructura/servidor (SSH o Consola Coolify).
2. **Contraseña Estándar de Contingencia:** Se restablece la clave a la **cédula de identidad** del usuario.
3. **Forzado de Cambio Inmediato:** Se establece la bandera `debe_cambiar_password = True` y `activo = True`.
4. **No Reutilización:** El sistema de autenticación rechaza que la nueva contraseña configurada por el usuario sea idéntica a su cédula.

---

## 3. Ejecución en Servidor (Coolify / VPS Contabo)

### Opción A: Desde la Terminal Web de Coolify
1. Iniciar sesión en el panel de **Coolify**.
2. Ir a la aplicación **Backend**.
3. Acceder a la pestaña **Terminal / Exec**.
4. Ejecutar el comando:
   ```bash
   python reset_password.py <CEDULA>
   ```
   *(Si no se especifica la cédula, el script buscará automáticamente al usuario con rol `COMANDANTE`).*
5. Confirmar la operación escribiendo `s` y presionando `Enter`.

---

### Opción B: Vía SSH en el VPS
1. Conectarse al servidor por SSH:
   ```bash
   ssh root@<IP_DEL_VPS>
   ```
2. Listar los contenedores activos para identificar el ID o nombre del contenedor backend:
   ```bash
   docker ps | grep backend
   ```
3. Ejecutar el script dentro del contenedor:
   ```bash
   docker exec -it <NOMBRE_O_ID_DEL_CONTENEDOR> python reset_password.py <CEDULA>
   ```
4. Confirmar con `s`.

---

## 4. Flujo Posterior del Usuario
1. El Comandante accede a la URL del sistema e inicia sesión:
   - **Usuario (Cédula):** `V12345678` (su cédula)
   - **Contraseña:** `V12345678` (su cédula)
2. El sistema autentica y redirige inmediatamente al modal/pantalla de **"Cambio Obligatorio de Contraseña"**.
3. El Comandante ingresa su nueva contraseña personal y retoma el control del sistema de forma segura.
