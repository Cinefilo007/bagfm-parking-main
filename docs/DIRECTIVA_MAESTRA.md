# DIRECTIVA MAESTRA — BAGFM v2.0
**Sistema de Control de Acceso Vehicular y Gestión de Estacionamientos**  
Base Aérea Generalísimo Francisco de Miranda  

---

> **LEER ANTES DE ESCRIBIR CUALQUIER LÍNEA DE CÓDIGO**  
> Este documento es la fuente de verdad del proyecto. Todo agente, desarrollador o IA que trabaje en este sistema debe consultarlo primero y mantenerlo actualizado.

---

## 1. Identidad del Sistema

| Campo | Valor |
|-------|-------|
| **Nombre** | BAGFM — Control de Acceso Vehicular y Gestión de Estacionamientos |
| **Versión** | 2.0.0 (Evolución: Gestión Inteligente de Estacionamientos) |
| **Dominio** | Configurable via `APP_DOMAIN` (`.env`) |
| **Idioma** | Español (código, comentarios, variables, UI) |
| **Metodología** | Mejora Infinita — SOPs vs Ejecución |

---

## 2. Metodología: Mejora Infinita

El sistema está diseñado para **evolucionar continuamente** sin romper lo existente.

### Principios

**1. SOPs vs Ejecución**  
- La lógica de negocio vive en `backend/app/services/` (SOPs).
- Las rutas API en `backend/app/api/` solo orquestan y delegan.
- El frontend consume APIs. **Nunca** escribe lógica de negocio en componentes.

**2. Todo cambio tiene documentación**  
- Cada nueva funcionalidad debe reflejarse en las directivas correspondientes.
- Las directivas se actualizan **antes** de escribir código.

**3. Ningún campo se elimina, se depreca**  
- Si un campo ya no se usa, se marca `deprecated` en el schema y se documenta.

**4. Configuración > Hardcoding**  
- Comportamientos variables van en `.env` o en la tabla `configuracion` de la BD.

**5. Identidad Visual Unificada (Aegis Tactical v2)**  
- Todas las vistas de mando: Cabecera Táctica (Icono Boxed + Título Black + Subtítulo con Beacon).
- Layout principal: `max-w-[1400px]` para estaciones de trabajo.
- Mobile-first siempre: KPIs en cuadrícula 2x2 con iconos descriptivos.

**6. Ciclo de mejora**  
```
Identificar necesidad
    → Documentar en directiva correspondiente
    → Planificar cambio
    → Implementar
    → Verificar
    → Actualizar directivas
    → Repetir
```

---

## 3. Stack Tecnológico

| Capa | Tecnología | Versión mínima |
|------|-----------|---------------|
| Frontend | React + Vite | React 18 / Vite 5 |
| Estilos | Tailwind CSS | 3.x |
| Estado | Zustand | 4.x |
| Backend | Python — FastAPI | Python 3.11 / FastAPI 0.110 |
| ORM | SQLAlchemy + Alembic | 2.x |
| Base de datos | Supabase (PostgreSQL) | PostgreSQL 15+ |
| Auth | JWT (HS256) | — |
| Tiempo real | WebSocket nativo (FastAPI) | — |
| Push | Web Push API (VAPID) | — |
| QR (generación) | `qrcode` + `Pillow` (Python) | 7.x |
| QR (escaneo) | `jsQR` (JS) | 1.x |
| Excel import | `openpyxl` (Python) | 3.x |
| Mapas | Leaflet (JS) / Deep links | — |
| Email (transaccional) | `fastapi-mail` + SMTP | — |
| Email (masivo) | Resend SDK / AWS SES | — |
| Deploy | Railway | — |
| PWA | Vite PWA Plugin | 0.19.x |

---

## 4. Estructura de Carpetas

```
bagfm/
├── backend/               # API Python FastAPI
│   ├── app/
│   │   ├── api/v1/        # Rutas (solo orquestación)
│   │   ├── core/          # Config, seguridad, DB, WebSocket, Push
│   │   ├── models/        # SQLAlchemy ORM
│   │   ├── schemas/       # Pydantic (entrada/salida)
│   │   └── services/      # 🧠 Lógica de negocio (SOPs)
│   ├── migrations/        # Alembic
│   ├── .env.example
│   ├── requirements.txt
│   └── Procfile
│
├── frontend/              # React + Vite PWA
│   ├── public/
│   │   ├── manifest.json
│   │   └── sw.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/               # Card, Boton, Input, Modal, Badge, ThemeToggle
│   │   │   ├── layout/           # MainLayout, Sidebar, BottomNav
│   │   │   ├── alcabala/         # QRScanner
│   │   │   ├── carnets/          # PlantillaPreview (4 plantillas)
│   │   │   ├── infracciones/     # ReporteRapido (flotante)
│   │   │   ├── eventos/          # LoteCard
│   │   │   ├── dashboard/        # KPIs, Alertas
│   │   │   ├── entidades/        # Componentes de gestión
│   │   │   └── auth/             # Login form
│   │   ├── pages/
│   │   │   ├── alcabala/         # Dashboard, Scanner
│   │   │   ├── comandante/       # Dashboard, Entidades, EntidadDetalle, Alcabalas,
│   │   │   │                     # EventosMando, GestionZonas, Infracciones
│   │   │   ├── entidad/          # Dashboard, Socios, Estacionamientos, Eventos, EditorCarnets
│   │   │   ├── parquero/         # Dashboard (Scanner, Mapa Puestos, Compartir Ubicación)
│   │   │   ├── supervisor/       # Dashboard (Monitor, Fantasmas, Infracciones, Personal)
│   │   │   └── socio/            # Portal
│   │   ├── services/             # API clients (api, accesos, zonas, eventos, pases,
│   │   │                         # parquero, comando, supervisor)
│   │   ├── store/                # Zustand (auth, ui)
│   │   ├── hooks/                # useWebSocket, usePush (pendiente)
│   │   └── lib/                  # utils (cn)
│   ├── vite.config.js
│   └── package.json
│
└── docs/                  # 📚 Directivas del sistema (19 archivos)
    ├── DIRECTIVA_MAESTRA.md         ← Este archivo
    ├── GUIA_VISUAL.md               ← 🎨 Design system Aegis Tactical v3
    ├── ROLES_Y_PERMISOS.md          ← Matriz de accesos por rol (8 roles)
    ├── SCHEMA_BD.md                 ← Schema completo de BD
    ├── FLUJOS_DE_NEGOCIO.md         ← Flujos paso a paso (FL-01 a FL-18+)
    ├── CONVENCIONES_CODIGO.md       ← Nombres, estructura, estilo
    ├── API_REFERENCE.md             ← Endpoints y contratos
    ├── DIRECTIVA_ALCABALAS.md       ← Módulo alcabalas + scanner IA
    ├── DIRECTIVA_PARQUERO.md        ← 🅿️ v2.0 Portal parquero + supervisor
    ├── DIRECTIVA_MAPA_TACTICO.md    ← 🗺️ Mapa táctico
    ├── DIRECTIVA_PASES_MASIVOS.md   ← 🎟️ v2.0 Pases autónomos + carnets
    ├── DIRECTIVA_DISEÑO_VISUAL.md   ← Aegis Tactical full spec
    ├── DEPLOYMENT.md                ← 🚀 Guía de despliegue Railway
    ├── GUIA_INSTALACION_PWA.md      ← Instalación PWA móvil
    ├── RAILWAY_STABILITY.md         ← Estabilidad Railway
    ├── DIRECTIVA_SCRIPTS_UTILIDAD.md ← 🛠️ Scripts de utilidad y generación de datos
    └── REGISTRO_CAMBIOS.md          ← Log de cambios
```

---

## 5. Variables de Entorno Críticas

| Variable | Dónde | Descripción |
|----------|-------|-------------|
| `APP_DOMAIN` | frontend | URL base del sistema |
| `VITE_API_URL` | frontend | URL del backend FastAPI |
| `SUPABASE_URL` | backend | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | backend | Clave de servicio (privada) |
| `DATABASE_URL` | backend | URL directa PostgreSQL |
| `JWT_SECRET` | backend | Clave para firmar tokens |
| `VAPID_PUBLIC_KEY` | ambos | Clave pública Push |
| `VAPID_PRIVATE_KEY` | backend | Clave privada Push |
| `MAIL_USERNAME` | backend | Email remitente SMTP |
| `MAIL_PASSWORD` | backend | Contraseña SMTP |
| `MAIL_SERVER` | backend | Servidor SMTP |
| `RESEND_API_KEY` | backend | API Key para email masivo |

---

## 6. Reglas de Desarrollo

### Backend (FastAPI)
- Todas las funciones de negocio van en `services/`. **Nunca** en los endpoints.
- Los endpoints solo: validan permisos → llaman el service → retornan respuesta.
- Usar `Depends(get_current_user)` en todos los endpoints protegidos.
- Usar `Depends(require_role([...]))` para control de acceso por rol.
- Todos los IDs son `UUID4`.
- Todos los timestamps en `UTC`.

### Frontend (React)
- Las llamadas a la API van en `services/`. **Nunca** directamente en componentes.
- El estado global (usuario, sesión, notificaciones) va en `store/`.
- Las páginas son tontas: solo muestran, llaman services, manejan estados locales simples.
- Navigation Layout: El menú inferior (BottomNav) se inyecta globalmente vía RutaProtegida.
- Mobile-first siempre. Probar en 375px de ancho como base.
- El sistema es PWA: Instalable en iOS/Android con Service Worker y Manifiesto.
- **v2.0**: WebSocket para actualizaciones en tiempo real (sin recargar página).
- **v2.0**: Push Notifications personalizadas por rol y zona.

### Base de Datos
- Ninguna migración elimina columnas sin deprecación previa.
- Toda tabla tiene `created_at TIMESTAMPTZ DEFAULT now()`.
- Toda tabla tiene `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`.
- Las relaciones FK siempre tienen `ON DELETE RESTRICT` salvo excepción documentada.

---

## 7. Directivas Relacionadas

| Documento | Propósito |
|-----------|-----------|
| [GUIA_VISUAL.md](./GUIA_VISUAL.md) | 🎨 Design system completo — Aegis Tactical v3 |
| [ROLES_Y_PERMISOS.md](./ROLES_Y_PERMISOS.md) | Matriz completa de accesos por rol (8 roles) |
| [SCHEMA_BD.md](./SCHEMA_BD.md) | Schema de base de datos detallado |
| [FLUJOS_DE_NEGOCIO.md](./FLUJOS_DE_NEGOCIO.md) | Flujos paso a paso de cada proceso |
| [CONVENCIONES_CODIGO.md](./CONVENCIONES_CODIGO.md) | Nombres, estructura, estilo de código |
| [API_REFERENCE.md](./API_REFERENCE.md) | Endpoints disponibles y contratos |
| [DIRECTIVA_ALCABALAS.md](./DIRECTIVA_ALCABALAS.md) | Módulo de alcabalas + scanner IA |
| [DIRECTIVA_PARQUERO.md](./DIRECTIVA_PARQUERO.md) | 🅿️ v2.0 — Portal parquero + supervisor |
| [DIRECTIVA_PASES_MASIVOS.md](./DIRECTIVA_PASES_MASIVOS.md) | 🎟️ v2.0 — Pases autónomos + carnets + editor visual |
| [DIRECTIVA_MAPA_TACTICO.md](./DIRECTIVA_MAPA_TACTICO.md) | 🗺️ Mapa táctico de la base |
| [DIRECTIVA_DISEÑO_VISUAL.md](./DIRECTIVA_DISEÑO_VISUAL.md) | Aegis Tactical v3 — spec completa |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 🚀 Guía de despliegue para Railway |
| [DIRECTIVA_SCRIPTS_UTILIDAD.md](./DIRECTIVA_SCRIPTS_UTILIDAD.md) | 🛠️ Scripts de utilidad y generación de datos |
| [REGISTRO_CAMBIOS.md](./REGISTRO_CAMBIOS.md) | Log de cambios por versión |

---

## 8. Estado Actual del Sistema (actualizado 2026-04-18)

### Frontend — Implementado ✅

| Módulo | Ruta | Rol | Estado |
|--------|------|-----|--------|
| Login | `/login` | Todos | ✅ Producción |
| Dashboard Comandante | `/comando/dashboard` | COMANDANTE, ADMIN_BASE, SUPERVISOR | ✅ Producción |
| Gestión Entidades | `/comando/entidades` | COMANDANTE, ADMIN_BASE | ✅ Producción |
| Detalle Entidad | `/comando/entidades/:id` | COMANDANTE, ADMIN_BASE | ✅ Producción |
| Gestión Alcabalas | `/comando/alcabalas` | COMANDANTE, ADMIN_BASE | ✅ Producción |
| Eventos Mando | `/comando/eventos` | COMANDANTE, ADMIN_BASE | ✅ Producción |
| Gestión Personal | `/comando/personal` | COMANDANTE, ADMIN_BASE | ✅ Sprint 2 |
| Gestión Zonas | `/comando/zonas` | COMANDANTE, ADMIN_BASE | ✅ Sprint 2 |
| **Dashboard Infracciones** | `/comando/infracciones` | COMANDANTE, ADMIN_BASE | ✅ Sprint 3 |
| Dashboard Entidad | `/entidad/dashboard` | ADMIN_ENTIDAD | ✅ Producción |
| Gestión Socios | `/entidad/socios` | ADMIN_ENTIDAD | ✅ Producción |
| Estacionamientos | `/entidad/estacionamientos` | ADMIN_ENTIDAD | ✅ Sprint 1 |
| **Eventos y Pases v2** | `/entidad/eventos` | ADMIN_ENTIDAD | ✅ Sprint 3 |
| **Editor de Carnets** | `/entidad/carnets` | ADMIN_ENTIDAD | ✅ Sprint 4 |
| Dashboard Alcabala | `/alcabala/dashboard` | ALCABALA | ✅ Producción |
| Scanner Alcabala | `/alcabala/scanner` | ALCABALA | ✅ Producción |
| **Portal Parquero** | `/parquero/dashboard` | PARQUERO | ✅ Sprint 2 |
| **Portal Supervisor** | `/supervisor/dashboard` | SUPERVISOR_PARQUEROS | ✅ Sprint 2 |
| Portal Socio | `/socio/portal` | SOCIO | ✅ Producción |
| Portal Evento | `/portal-evento/:serial` | Público | ✅ Producción |
| Ajustes | `/ajustes` | Todos | ✅ Producción |

### Componentes Reutilizables Creados

| Componente | Ubicación | Función |
|------------|-----------|---------|
| `PlantillaPreview` | `components/carnets/` | 4 plantillas visuales de carnet (colgante, cartera, ticket, credencial) |
| `ReporteRapido` | `components/infracciones/` | Botón flotante ⚠️ con modal de reporte rápido + GPS |
| `LoteCard` / `LoteCardV2` | `components/eventos/` + `pages/entidad/Eventos.jsx` | Tarjeta de lote con drill-down a pases individuales |
| `QRScanner` | `components/alcabala/` | Escáner QR (usado en Alcabala y Parquero) |
| `MapaTactico` / `MapaBaseSVG` / `MapaBaseReal` | `components/` | Mapas de la base (SVG y Leaflet) |

### Backend — Pendiente de sincronización

| Servicio | Endpoints | Estado |
|----------|-----------|--------|
| `zona_service.py` | `/zonas/` CRUD + puestos + cuotas + tiempo límite | 🏗️ Parcial |
| `parquero_service.py` | `/parqueros/` recepción, salida, asignación | 🏗️ Parcial |
| `supervisor_parqueros_service.py` | `/supervisor-parqueros/` broadcast, fantasmas | ⏳ Pendiente |
| `infraccion_service.py` v2 | `/infracciones/` gravedad, GPS, lista negra | 🏗️ Parcial |
| `vehiculo_fantasma_service.py` | `/infracciones/fantasmas` job + escalamiento | ⏳ Pendiente |
| `carnet_service.py` | `/carnets/` generación Pillow/PIL | ⏳ Pendiente |
| `email_service.py` | `/pases/{id}/enviar-email` + masivo | ⏳ Pendiente |
| `tipo_acceso_service.py` | `/tipos-acceso/` CRUD por entidad | ⏳ Pendiente |
| WebSocket canales | `/ws/` por zona/entidad/rol | ⏳ Pendiente |
| Push Notifications | VAPID + Service Worker | ⏳ Pendiente |

### Funcionalidades UI listas esperando backend

| Feature | Página | Service Frontend |
|---------|--------|------------------|
| Asignación zona/puesto en pases | Eventos.jsx | `zonaService.getPuestosZona()` |
| Multi-vehículo por pase | Eventos.jsx | `pasesService.crearLote()` |
| Drill-down pases individuales | Eventos.jsx (LoteCardV2) | `api.get('/pases/lotes/{id}/pases')` |
| Compartir pase (Web Share) | Eventos.jsx | `navigator.share()` |
| Envío email individual | Eventos.jsx | `api.post('/pases/{id}/enviar-email')` |
| Resolución infracciones por gravedad | Infracciones.jsx | `api.put('/infracciones/{id}/resolver')` |
| Lista negra CRUD | Infracciones.jsx | `api.get/delete('/infracciones/lista-negra')` |
| Escalamiento infracciones | Infracciones.jsx | `api.put('/infracciones/{id}/escalar')` |
| Compartir ubicación parquero | Dashboard Parquero | `navigator.share()` + `navigator.geolocation` |
| Reporte rápido infracción + GPS | ReporteRapido.jsx | `api.post('/infracciones/reporte-rapido')` |
| Impresión carnet | EditorCarnets.jsx | `window.print()` (local, sin backend) |
| Guardar plantilla carnet | EditorCarnets.jsx | `localStorage` (local, sin backend) |

---

## 9. Roadmap — Pendientes

### Prioridad Alta (Backend)
1. **Migraciones BD v2.0** — Nuevas tablas + columnas + enums
2. **Endpoints de infracciones v2** — Gravedad, GPS, resolución por rol, lista negra
3. **Endpoints de zonas/puestos** — CRUD completo + asignación cuotas
4. **Endpoints de pases v2** — Multi-vehículo, tipos custom, drill-down
5. **Job vehículos fantasma** — Cron job periódico + escalamiento

### Prioridad Media
6. **WebSocket por canales** — Actualización en tiempo real
7. **Push Notifications** — VAPID + Service Worker
8. **Email Service** — `fastapi-mail` + proveedor masivo
9. **Generación carnets backend** — Pillow/PIL con QR real

### Prioridad Baja / Futuro
10. **Mapa de calor de infracciones** — Heatmap con coords GPS
11. **Sistema anti-corrupción** — Incentivos/sanciones a parqueros
12. **Portal Supervisor de Ronda** — Diferente al supervisor de parqueros
13. **IA para parquero** — Escaneo de documentos con IA

---

*Última actualización: 2026-04-18 | Autor: Antigravity*  
*Versión: 2.0.0 — Evolución: Gestión Inteligente de Estacionamientos*  
*Build: 1930 módulos — React + Vite | FastAPI + PostgreSQL*
