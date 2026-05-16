# NOTAS TÉCNICAS: Parche de Estabilidad Railway (0.3.0)

Este documento detalla las medidas de emergencia y estabilidad aplicadas para resolver los errores de conectividad (CORS) y disponibilidad (502 Bad Gateway) en el entorno de producción de Railway.

---

## 1. Problema: Error 502 Bad Gateway (Backend)
**Síntoma:** El navegador recibía una respuesta 502 al intentar conectar con el backend.
**Causa:** 
- Exceso de consumo de memoria al iniciar con `--workers 4` en instancias de nivel entrada de Railway.
- Fallos en la etapa de migración (`alembic`) que detenían el arranque del servidor.

**Solución aplicada:**
- Reducción de workers de `uvicorn` de **4 a 1**.
- **Eliminación de `entrypoint.sh`**: Se detectó que el archivo creado en Windows usaba finales de línea `CRLF`, lo que impedía su ejecución en los servidores Linux de Railway.
- **Migración a CMD**: Comando de inicio movido directamente al `Dockerfile`.
- **Resolución de Puerto**: Se identificó que Railway asigna el puerto **8080** dinámicamente, requiriendo su configuración manual en el panel de "Public Networking" para eliminar el error 502.

---

## 2. Problema: Fallo de CORS y Conectividad (Frontend)
**Síntoma:** El frontend intentaba realizar peticiones a `localhost:8000` a pesar de tener configurada la variable `VITE_API_URL`.
**Causa:** 
- Las variables de entorno de Vite se inyectan en tiempo de construcción (*build-time*). Si el build ocurre antes de configurar la variable en Railway, el valor queda "quemado" como `localhost`.
- Existencia de un slash (`/`) inicial en las peticiones del store que causaba problemas de ruteo con el `baseURL`.

**Solución aplicada:**
- **Hardcoded Fallback:** Se cambió el valor por defecto de la API en `frontend/src/services/api.js` de `localhost:8000` a la URL de producción de Railway. Esto garantiza conectividad incluso si falla la inyección de variables.
- **Relativa Pathing:** Se eliminó el slash inicial en las llamadas `api.post('auth/login')`.

---

## 3. Configuración Maestras de Producción
Para futuras actualizaciones, mantener estos valores:

| Componente | Variable | Valor Producción Recomendado |
|------------|----------|-----------------------------|
| Backend | `CORS_ORIGINS` | `https://bagfm-frontend-production.up.railway.app` |
| Backend | `APP_ENV` | `production` |
| Frontend | `VITE_API_URL` | `https://bagfm-backend-production.up.railway.app/api/v1` |

---

## 4. Guía de Recuperación
Si el error 502 vuelve a aparecer:
1. Revisar los logs de Railway buscando errores de memoria (OOM).
2. Verificar que `DATABASE_URL` tenga el driver asíncrono `postgresql+asyncpg://`.
3. Forzar un **Redeploy** del frontend limpiando la caché del navegador.
