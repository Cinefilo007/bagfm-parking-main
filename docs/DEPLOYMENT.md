# DIRECTIVA DE DESPLIEGUE — BAGFM
**Guía de Operación para GitHub y Railway**

## 1. Introducción
Esta directiva establece el Estándar de Operación (SOP) para el despliegue del sistema BAGFM en la nube, utilizando GitHub como repositorio y Railway como plataforma de infraestructura.

---

## 2. Configuración de Repositorio (GitHub)
Para asegurar un repositorio limpio y seguro:
- El archivo `.gitignore` en la raíz debe excluir:
  - `backend/venv/`
  - `**/node_modules/`
  - `**/.env`
  - `**/__pycache__/`
  - `frontend/dist/`

### Envío a GitHub
1. Inicializar git: `git init`
2. Agregar archivos: `git add .`
3. Commit inicial: `git commit -m "feat: setup deployment configuration"`
4. Subir a un repositorio privado.

---

## 3. Dockerización
El sistema utiliza una arquitectura multi-contenedor.

### Backend (FastAPI)
- **Imagen**: `python:3.11-slim`
- **Puerto**: `8000` (o el definido en `$PORT` por Railway)
- **Variables Críticas**: `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

### Frontend (React/Vite)
- **Imagen**: `nginx:alpine` (después de construir con Node)
- **Puerto**: `80` (Railway redirige el tráfico)
- **Variables Críticas**: `VITE_API_URL` (URL pública del backend).

---

## 4. Despliegue en Railway
Railway detectará los `Dockerfile` en cada subdirectorio si se configuran como servicios independientes.

### Pasos de Configuración:
1. Conectar con el repositorio de GitHub.
2. Crear un servicio para el backend apuntando a `./backend`.
3. Crear un servicio para el frontend apuntando a `./frontend`.
4. Configurar las Variables de Entorno en el panel de Railway para cada servicio.

---

## 5. Migraciones de Base de Datos
Las migraciones de Alembic deben ejecutarse antes del inicio de la aplicación en producción. El `Dockerfile` del backend debe incluir un script de entrada que ejecute:
```bash
alembic upgrade head
```

---

## 6. Variables de Entorno de Producción
| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a la BD de Supabase. |
| `API_URL` | URL pública del backend (usada por el frontend). |
| `JWT_SECRET` | Clave secreta para tokens. |
| `CORS_ORIGINS` | Lista de dominios permitidos (incluyendo el del frontend). |

---

*Última actualización: 2026-04-01*
