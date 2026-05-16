# DIRECTIVA DE SISTEMA DE CORREOS AUTOMATIZADO

## 1. Objetivo del Sistema
Establecer un estándar para el envío automatizado de credenciales, carnets y pases QR a usuarios masivos, garantizando alta entregabilidad, facilidad de configuración y monitoreo del estado (trazabilidad).

## 2. Decisiones Arquitectónicas
### 2.1. Proveedor vs Servidor Propio
- **Fuerte Recomendación:** **No** levantar un servidor SMTP propio (Postfix/Exim). Gestionar la reputación de la IP, registros SPF, DKIM y DMARC es costoso y propenso a caer en SPAM.
- **Alternativa Recomendada:** Utilizar un servicio *Relay* moderno (API o SMTP provisto por Resend, SendGrid, Mailersend) o credenciales SMTP de un correo corporativo existente (ej. Google Workspace, cPanel de tu dominio). Muchos servicios como Resend tienen capas gratuitas iniciales excelentes.

### 2.2. Backend (FastAPI)
- Librería para el envío: `smtplib` nativa de Python. Si se requiere más robustez asíncrona, migrar a `fastapi-mail`. 
- **Gestión de Plantillas:** Uso estandarizado de `Jinja2` o reemplazo por string nativo (`replace`) usando variables de entorno `{{variable}}`. Variables mínimas requeridas: `{{nombre_usuario}}`, `{{enlace_qr}}`, `{{nombre_lote}}`.
- **Tareas en Segundo Plano (Background Tasks):** Los correos masivos NUNCA deben enviarse dentro del ciclo de solicitud/respuesta principal de FastAPI (esto bloqueará el hilo y causará un *Timeout*). Se utilizará `BackgroundTasks` de FastAPI o `Celery` para procesar la cola de correos asíncronamente.

### 2.3. Base de Datos (PostgreSQL)
Requeriremos entidades nuevas para desacoplar las configuraciones y mantener historial:
- `ConfiguracionCorreo`: Almacenará SMTP Host, Port, Usuario, Password (encriptado), Remitente por defecto y nombre del Remitente.
- `ControlEnviosCorreo`: Estructura para registrar los correos enviados. Tendrá Estado (`PENDIENTE`, `ENVIADO`, `ERROR_SMTP`, `REBOTADO`).

## 3. Trazabilidad y Manejo de Errores
El monitoreo de entregabilidad depende de la tecnología de envío elegida:
1. **SMTP Tradicional (Monitoreo Simple):**
   El sistema sabrá si fue aceptado por el servidor proveedor. Si el servidor lanza una excepción (timeout, correo mal formado, full capacity), FastAPI lo guardará como error en `ControlEnviosCorreo`.
2. **Webhooks (Monitoreo Avanzado):**
   Si se integra un panel tipo *Resend*, se creará un endpoint de Webhooks (`POST /api/correos/webhook`) para recibir notificaciones cuando el buzón del usuario final rebote el inicio (`bounced`) o si presiona *Reportar como Spam* (`complained`).

## 4. UI / UX e Interacciones en el Frontend
### 4.1. Configuración de Parámetros
- Ajustes > Correo Electrónico: Interfaz para ingresar las credenciales operativas del emisor. 
- Al guardar credenciales, el sistema debe permitir hacer un botón "Envío de Prueba" al administrador.

### 4.2. Flujo de Envío en Lotes
- Dentro de Pases Masivos > Gestionar Lote.
- Acción: "Enviar Correos de Acceso".
- Configuración previa: 
  - Switch: Enviar solo enlace QR o Adjuntar el PDF de Carnets.
  - Campos editables: Asunto, Cuerpo del mensaje pre-cargado.
  - Indicadores con colores explicando al usuario las etiquetas permitidas: `{{nombre}}`.
  - Acción Final: Botón rojo "Comenzar distribución masiva a X personas".

## 5. Implementación Progresiva (SOP)
1. **Fase 1 (Ajustes):** Crear la tabla `configuracion_correo` y sus endpoints REST. Conectar la UI de Configuración de Correo.
2. **Fase 2 (Envío Core):** Construir la clase utilitaria de Python para despachar y adjuntar archivos via SMTP.
3. **Fase 3 (Lotes Frontend):** [COMPLETADO] Modal en Pases Masivos para configurar el asunto y elegir el envío del lote.
4. **Fase 4 (Monitor y Trazabilidad):** [COMPLETADO] Campos `email_enviado`, `email_ultimo_error` y `fecha_envio_email` integrados en `CodigoQR`. UI actualizada con badges de estado y botones de reintento individual.
5. **Fase 5 (Webhooks):** [PENDIENTE] Integración de webhooks de Resend para monitorear rebotados (bounced) externos.
