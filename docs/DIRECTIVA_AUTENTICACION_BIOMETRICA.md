# DIRECTIVA — AUTENTICACIÓN BIOMÉTRICA (WebAuthn / Passkeys)

> **Filosofía**: "SEGURIDAD INVISIBLE Y ACCESO INSTANTÁNEO"  
> Eliminar la fricción del inicio de sesión manual para operadores en campo (parqueros, supervisores) y personal administrativo. La biometría garantiza que quien opera el sistema es efectivamente el titular de la cuenta.

---

## 1. Visión General

La implementación de autenticación biométrica en BAGFM se basa en el estándar **WebAuthn (FIDO2)**. Esto permite que una aplicación web interactúe directamente con el hardware de seguridad del dispositivo (sensor de huellas, reconocimiento facial o Windows Hello) sin que los datos biométricos salgan del dispositivo del usuario.

### Beneficios Tácticos:
1.  **Velocidad**: Acceso al dashboard en < 2 segundos.
2.  **Seguridad**: Inmune a ataques de phishing y robo de contraseñas.
3.  **Higiene**: Menos interacción con el teclado en dispositivos de uso compartido (si el dispositivo lo permite).

---

## 2. Flujo de Registro (Enrollment)

Para habilitar la biometría, el usuario debe haber iniciado sesión previamente con su método tradicional (cédula + contraseña).

```
1.  Usuario accede a "Ajustes de Perfil" -> "Configurar Acceso Biométrico".
2.  Frontend solicita al Backend opciones de creación (Challenge).
3.  Backend genera un challenge aleatorio y lo envía con el ID de usuario.
4.  Frontend llama a `navigator.credentials.create()` (API WebAuthn).
5.  El sistema operativo solicita la huella/rostro al usuario.
6.  Si es exitoso, el frontend recibe una "Attestation Object" (Clave Pública).
7.  Frontend envía la Clave Pública al Backend.
8.  Backend verifica la firma y almacena la Credencial vinculada al usuario.
```

---

## 3. Flujo de Inicio de Sesión (Login)

```
1.  En la pantalla de Login, el usuario presiona "Entrar con Biometría".
2.  El sistema solicita al usuario su Cédula (opcional, si se desea "multilocalización").
3.  Frontend solicita al Backend opciones de autenticación para ese usuario.
4.  Backend envía el ID de la credencial registrada y un nuevo Challenge.
5.  Frontend llama a `navigator.credentials.get()`.
6.  El usuario pone su huella/rostro.
7.  El dispositivo firma el challenge con la Clave Privada (que nunca sale del hardware).
8.  Frontend envía la firma al Backend.
9.  Backend verifica la firma con la Clave Pública almacenada.
10. Si es correcta, el Backend emite el JWT de acceso.
```

---

## 4. Requerimientos Técnicos

### Backend (FastAPI)
- **Librería**: `pywebauthn`.
- **Base de Datos**: Nueva tabla `credenciales_biometricas`.
- **Campos críticos**:
    - `user_id` (FK a usuarios)
    - `credential_id` (Binario/String único)
    - `public_key` (Binario)
    - `sign_count` (Contador para prevenir clones)
    - `transports` (USB, NFC, Ble, Internal)

### Frontend (React + Vite)
- **Librería**: `@simplewebauthn/browser`.
- **Seguridad**: El sitio **DEBE** servirse obligatoriamente por **HTTPS**. Localhost es la única excepción permitida por los navegadores.

---

## 5. Casos de Uso y Restricciones

- **Dispositivos Soportados**: Teléfonos modernos (Android/iOS), Laptops con lector de huellas o cámaras compatibles con Windows Hello/FaceID.
- **Backup**: La biometría nunca reemplaza totalmente la contraseña. Siempre debe existir la opción de "Entrar con contraseña" en caso de falla técnica del sensor.
- **Multidispositivo**: Un usuario puede registrar múltiples credenciales (ej: su teléfono personal y su tablet de trabajo).

---

## 6. Arquitectura de Datos

### Nueva Tabla: `credenciales_biometricas`
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `usuario_id` | UUID | FK -> usuarios |
| `credential_id` | String | Identificador único de la llave |
| `public_key` | ByteA | Clave pública para verificación |
| `sign_count` | Int | Contador de uso |
| `created_at` | DateTime | Fecha de registro |
| `last_used_at` | DateTime | Último acceso |

---

*Última actualización: 2026-04-22 | v1.0*
*Docs Relacionados: DIRECTIVA_PARQUERO.md, ROLES_Y_PERMISOS.md*
