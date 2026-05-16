# DIRECTIVA DE CONFIGURACIÓN DE DOMINIO Y CORREO (Porkbun + Railway + Resend)

## 1. Objetivo
Guía paso a paso para configurar el dominio `bagfm.app` en la infraestructura actual, asegurando la correcta exposición de los servicios (Frontend/Backend) y la alta entregabilidad de correos electrónicos.

## 2. Configuración en Railway (Infraestructura)

### 2.1. Frontend (Servicio principal)
- **Dominio deseado:** `bagfm.app` y `www.bagfm.app`
- **Pasos:**
  1. Ve a tu proyecto en Railway.
  2. Selecciona el servicio **frontend**.
  3. Ve a la pestaña **Settings** > **Domains**.
  4. Haz clic en **Custom Domain** e ingresa `bagfm.app`.
  5. Repite para `www.bagfm.app`.
   railway te proporcionará los registros DNS necesarios.

### 2.2. Backend (API)
- **Dominio deseado:** `api.bagfm.app`
- **Pasos:**
  1. Selecciona el servicio **backend**.
  2. Ve a la pestaña **Settings** > **Domains**.
  3. Haz clic en **Custom Domain** e ingresa `api.bagfm.app`.

## 3. Configuración en Resend (Envío de Correos)

### 3.1. Validación del Dominio
- **Pasos:**
  1. Inicia sesión en [Resend](https://resend.com).
  2. Ve a **Domains** > **Add New Domain**.
  3. Ingresa `bagfm.app` y selecciona tu región (ej. `us-east-1`).
  4. Resend generará una lista de registros DNS (SPF, DKIM, DMARC).

## 4. Configuración en Porkbun (DNS)

Debes ingresar a tu panel de Porkbun y añadir los siguientes registros (los valores específicos los obtendrás de Railway y Resend):

| Tipo | Host | Valor | Propósito |
| :--- | :--- | :--- | :--- |
| **ALIAS/ANAME** | `@` (o vacío) | [Valor de Railway para Apex] | Apuntar el dominio principal al Frontend |
| **CNAME** | `www` | [Valor de Railway para www] | Apuntar www al Frontend |
| **CNAME** | `api` | [Valor de Railway para API] | Apuntar el subdominio al Backend |
| **TXT** | `_resend` | [Valor de Resend] | Validación de propiedad (Resend) |
| **TXT** | `@` | `v=spf1 include:amazonses.com ~all` (Confirmar con Resend) | SPF (Entregabilidad) |
| **CNAME** | `resend._domainkey` | [Valor de Resend] | DKIM (Firma de correo) |

## 5. Actualización de Variables de Entorno

Una vez configurados los dominios, DEBES actualizar las variables de entorno en Railway para que los servicios se comuniquen correctamente:

### 5.1. En el Frontend:
- `VITE_API_URL`: Cambiar a `https://api.bagfm.app`

### 5.2. En el Backend:
- `CORS_ALLOWED_ORIGINS`: Incluir `https://bagfm.app` y `https://www.bagfm.app`
- `RESEND_API_KEY`: Ingresar la llave generada en Resend.
- `MAIL_FROM`: `no-reply@bagfm.app` o `notificaciones@bagfm.app`
