# DOCUMENTACIÓN COMPLETA DEL SISTEMA — BAGFM (LEGACY)
**Sistema de Control de Acceso Vehicular y Gestión de Estacionamientos**  
Base Aérea Generalísimo Francisco de Miranda  

---

> ⚠️ **AVISO v2.0**: Este archivo es una referencia LEGACY. Las directivas actualizadas están en `docs/`:
> - `docs/DIRECTIVA_MAESTRA.md` — Fuente de verdad principal
> - `docs/SCHEMA_BD.md` — Schema de BD v2.0
> - `docs/ROLES_Y_PERMISOS.md` — Roles actualizados
> - `docs/FLUJOS_DE_NEGOCIO.md` — Flujos v2.0 (FL-01 a FL-15)
> - `docs/DIRECTIVA_PARQUERO.md` — **NUEVO** Módulo parquero
> - `docs/DIRECTIVA_PASES_MASIVOS.md` — **NUEVO** Pases autónomos + carnets
> - `docs/DIRECTIVA_ALCABALAS.md` — Alcabalas v2.0 (simplificadas)
> - `docs/API_REFERENCE.md` — Endpoints v2.0
> - `docs/REGISTRO_CAMBIOS.md` — Changelog completo

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
- Cada nueva funcionalidad o modificación mayor debe reflejarse en las directivas correspondientes.
- Las directivas se actualizan **antes** de hacer merge al branch principal.

**3. Ningún campo se elimina, se depreca**  
- Si un campo ya no se usa, se marca `deprecated: true` en el schema y se documenta aquí.
- Esto protege la integridad histórica de los datos.

**4. Configuración > Hardcoding**  
- Cualquier comportamiento que pueda cambiar en el futuro va en `.env` o en la tabla `configuracion` de la BD.
- Ejemplos: `salida_requerida`, `max_vehiculos_evento`, `APP_DOMAIN`.

**5. Ciclo de mejora**  
```
Identificar necesidad
    → Documentar en directiva correspondiente
    → Planificar cambio (sin romper lo existente)
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
| Tiempo real | Supabase Realtime | — |
| QR (generación) | `qrcode` (Python) | 7.x |
| QR (escaneo) | `jsQR` (JS) | 1.x |
| Excel import | `openpyxl` (Python) | 3.x |
| Push | Web Push API (VAPID) | — |
| Deploy | Railway | — |
| PWA | Vite PWA Plugin | 0.19.x |

---

## 4. Estructura de Carpetas

```
bagfm/
├── backend/               # API Python FastAPI
│   ├── app/
│   │   ├── api/v1/        # Rutas (solo orquestación)
│   │   ├── core/          # Config, seguridad, DB
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
│   │   ├── components/    # UI reutilizable
│   │   ├── pages/         # Vistas por rol
│   │   ├── services/      # Llamadas a la API
│   │   ├── store/         # Zustand stores
│   │   └── utils/         # Helpers
│   ├── vite.config.js
│   └── package.json
│
└── docs/                  # 📚 Directivas del sistema
    ├── DIRECTIVA_MAESTRA.md    ← este archivo
    ├── GUIA_VISUAL.md          ← 🎨 Design system Aegis Tactical (LEER antes de CSS)
    ├── ROLES_Y_PERMISOS.md
    ├── SCHEMA_BD.md
    ├── FLUJOS_DE_NEGOCIO.md
    ├── CONVENCIONES_CODIGO.md
    ├── API_REFERENCE.md
    └── REGISTRO_CAMBIOS.md
```

---

## 5. Variables de Entorno Críticas

Definidas en `backend/.env` y `frontend/.env`. Ver `.env.example` en cada carpeta.

| Variable | Dónde | Descripción |
|----------|-------|-------------|
| `APP_DOMAIN` | frontend | URL base del sistema |
| `API_URL` | frontend | URL del backend FastAPI |
| `SUPABASE_URL` | backend | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | backend | Clave de servicio (privada) |
| `DATABASE_URL` | backend | URL directa PostgreSQL |
| `JWT_SECRET` | backend | Clave para firmar tokens |
| `VAPID_PUBLIC_KEY` | ambos | Clave pública Push |
| `VAPID_PRIVATE_KEY` | backend | Clave privada Push |
| `TELEGRAM_BOT_TOKEN` | backend | (futuro) |

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
- Mobile-first siempre. Probar en 375px de ancho como base.
- El sistema es PWA: todos los íconos críticos deben funcionar offline si es posible.

### Base de Datos
- Ninguna migración elimina columnas sin deprecación previa.
- Toda tabla tiene `created_at TIMESTAMPTZ DEFAULT now()`.
- Toda tabla tiene `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`.
- Las relaciones FK siempre tienen `ON DELETE RESTRICT` salvo excepción documentada.

---

## 7. Directivas Relacionadas

| Documento | Propósito |
|-----------|-----------|
| [GUIA_VISUAL.md](./GUIA_VISUAL.md) | 🎨 Design system completo — colores, fuentes, componentes |
| [ROLES_Y_PERMISOS.md](./ROLES_Y_PERMISOS.md) | Matriz completa de accesos por rol |
| [SCHEMA_BD.md](./SCHEMA_BD.md) | Schema de base de datos detallado |
| [FLUJOS_DE_NEGOCIO.md](./FLUJOS_DE_NEGOCIO.md) | Flujos paso a paso de cada proceso |
| [CONVENCIONES_CODIGO.md](./CONVENCIONES_CODIGO.md) | Nombres, estructura, estilo de código |
| [API_REFERENCE.md](./API_REFERENCE.md) | Endpoints disponibles y contratos |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 🚀 Guía de despliegue para GitHub y Railway |
| [REGISTRO_CAMBIOS.md](./docs/REGISTRO_CAMBIOS.md) | Log de cambios mayor por versión |
| [RAILWAY_STABILITY.md](./docs/RAILWAY_STABILITY.md) | 🛡️ Notas técnicas sobre el parche de estabilidad en producción |

---

## 8. Estado Actual del Sistema

| Módulo | Estado |
|--------|--------|
| Planificación | ✅ Completa |
| Directivas | ✅ Completas |
| Setup proyecto | ✅ Completo |
| Schema BD | ✅ Completo |
| Autenticación | ✅ Completa |
| Panel Comandante | 🏗️ En progreso |
| Portal Entidad | 🏗️ En progreso |
| Portal Alcabala | ⏳ Pendiente |
| Portal Parquero | ⏳ Pendiente |
| Portal Socio | ⏳ Pendiente |
| Portal Supervisor | ⏳ Pendiente |
| QR engine | ⏳ Pendiente |
| Importación Excel | ⏳ Pendiente |
| Push Notifications | ⏳ Pendiente |
| PWA completa | ⏳ Pendiente |
| Deploy Railway | 🏗️ En progreso |

---

*Última actualización: 2026-03-30 | Autor: Sistema*  
*Guía Visual: Design System Aegis Tactical generado y validado en Google Stitch · Proyecto `4512440937494164528`*
# GUÍA VISUAL — BAGFM
## Design System: **Aegis Tactical**

> **REGLA DE ORO**: Todo componente, pantalla o elemento visual del sistema BAGFM debe seguir esta guía sin excepción. Antes de escribir CSS, consulta esta directiva.  
> Fuente de origen: generado y validado en **Google Stitch** — proyecto `4512440937494164528`

---

## 1. Filosofía de Diseño

### North Star: "The Sentinel Interface"
Este no es un sistema de consumo masivo. Es un entorno de **misión crítica de alto riesgo**. La estética va más allá del "Dark Mode" hacia una **profundidad táctica**: acentos esmeralda de alto contraste sobre fondos abismales y profundos.

**Tres pilares del diseño:**
1. **Asimetría Intencional** — Rechazamos la cuadrícula rígida. La importancia se señala por "capas de luminancia", no por bordes.
2. **Transparencia en Capas** — La UI se trata como una pila física de láminas de vidrio semitransparente superpuestas.
3. **HUD Proyectado** — La interfaz debe sentirse como un visor de datos proyectado sobre vidrio obsidiana: autoritario, seguro e hiper-moderno.

---

## 2. Paleta de Colores (Dual Táctico)

El sistema implementa un sistema de temas dual (Claro/Oscuro) basado en variables CSS dinámicas.

### 2.1 Modo Oscuro (Aegis Tactical - Default)
*Jerarquía de profundidad para operaciones nocturnas.*

```css
Surface Lowest:    #090E1C   ← El más profundo
Surface Dim:       #0E1322   ← Fondo Aplicación
Surface Low:       #161B2B   ← Bloques de layout
Surface Container: #1A1F2F   ← Cards / Interacción
Text Main:         #DEE1F7   ← Texto primario
Primary:           #4EDEA3   ← Esmeralda Táctico
```

### 2.2 Modo Claro (Tactical Light)
*Optimizado para visibilidad bajo luz solar directa.*

```css
Surface Lowest:    #F1F5F9   ← Slate 100
Surface Dim:       #F8FAFC   ← Fondo Aplicación (Slate 50)
Surface Low:       #F1F5F9   ← Bloques de layout
Surface Container: #FFFFFF   ← Blanco Puro (Cards)
Text Main:         #0F172A   ← Slate 900
Primary:           #10B981   ← Esmeralda Oscurecido (contraste)
```

---

### Colores Primarios de Marca
```
Primario (Esmeralda):     #4EDEA3   ← Color dominante del sistema
Primario Container:       #10B981   ← Gradiente de CTAs principales
Primario Fixed:           #6FFBBE   ← Glow, detalles menos críticos
Primario Fixed Dim:       #4EDEA3   ← Texto esmeralda no crítico
```

### Superficies (Jerarquía de Profundidad)
```
Surface Lowest:    #090E1C   ← El más profundo / oscuro
Surface Dim:       #0E1322   ← Base Canvas (fondo de aplicación)
Surface:           #0E1322   ← Nivel base ← FONDO APP
Surface Low:       #161B2B   ← Bloques de layout principales
Surface Container: #1A1F2F   ← Elementos interactivos / Cards
Surface High:      #25293A   ← Cards elevadas
Surface Highest:   #2F3445   ← Modales / Popovers flotantes
Surface Bright:    #343949   ← Más brillante (uso moderado)
Surface Variant:   #2F3445   ← Chips, telemetría
Surface Tint:      #4EDEA3   ← Tinte esmeralda
```

### Colores de Estado (On-Surface)
```
On Background:     #DEE1F7   ← Texto principal (NUNCA usar #FFFFFF)
On Surface:        #DEE1F7   ← Texto sobre fondo oscuro
On Surface Var:    #BBCABF   ← Texto secundario / descriptivo
On Primary:        #003824   ← Texto sobre botón verde (alto contraste)
On Primary Cont:   #00422B   ← Texto sobre primario container
On Primary Fixed:  #002113   ← Texto sobre fixed
```

### Colores Semánticos
```css
/* ACCESO PERMITIDO / ÉXITO */
--color-exito:          #4EDEA3;   /* Verde esmeralda */
--color-exito-bg:       #10B981;

/* ACCESO DENEGADO / ERROR */
--color-error:          #FFAB4B;   /* Rojo táctil */
--color-error-dark:     #93000A;
--on-error:             #690005;
--on-error-container:   #FFDAD6;

/* ADVERTENCIA / INFRACCIÓN */
--color-advertencia:    #F59E0B;   /* Ámbar */
--color-advertencia-bg: rgba(245, 158, 11, 0.15);

/* SUSPENDIDA / BLOQUEADA */
--color-bloqueado:      #FFAB4B;   /* Rojo suave */

/* PENDIENTE / EN REVISIÓN */
--color-pendiente:      #F59E0B;   /* Ámbar igual que advertencia */
```

### Colores de Interacción
```
Inverse Primary:   #006C49   ← Modo inverso
Inverse Surface:   #DEE1F7   ← Superficie inversa
Inverse On Surf:   #2B3040   ← Texto en modo inverso
Outline:           #86948A   ← Bordes sutiles
Outline Variant:   #3C4A42   ← Ghost borders (usar a 15% opacity)
```

### Secundario y Terciario
```
Secondary:              #B9C7E0
Secondary Container:    #3C4A5E
Secondary Fixed:        #D5E3FD
Secondary Fixed Dim:    #B9C7E0
On Secondary:           #233144
On Secondary Cont:      #ABB9D2

Tertiary:               #BCC7DE
Tertiary Container:     #98A3BA
Tertiary Fixed:         #D8E3FB
Tertiary Fixed Dim:     #BCC7DE
On Tertiary:            #263143
On Tertiary Cont:       #2E394C
```

---

## 3. Tipografía

### Familia de Fuentes
```
Display / Headlines:  Space Grotesk   ← Precisión técnica, HUD militar
Body / Datos:         Inter           ← Legibilidad en ambientes oscuros
Labels:               Inter           ← Siempre en mayúsculas + letter-spacing
```

### Importación (Google Fonts)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Escala Tipográfica
```css
/* DISPLAY — Métricas de alto impacto */
--text-display-lg:   3.5rem / 700 / Space Grotesk;   /* "47" vehículos dentro */
--text-display-md:   2.5rem / 700 / Space Grotesk;

/* HEADLINES — Títulos de secciones */
--text-headline-lg:  1.75rem / 700 / Space Grotesk;   /* "Centro de Comando" */
--text-headline-md:  1.5rem  / 600 / Space Grotesk;

/* TITLES — Nombres, placas */
--text-title-lg:     1.25rem / 600 / Inter;
--text-title-md:     1.125rem / 600 / Inter;          /* Placas y nombres de conductor */
--text-title-sm:     1rem    / 600 / Inter;

/* BODY — Texto general */
--text-body-lg:      1rem    / 400 / Inter;
--text-body-md:      0.875rem / 400 / Inter;
--text-body-sm:      0.75rem  / 400 / Inter;

/* LABELS — Etiquetas tácticas (SIEMPRE MAYÚSCULAS) */
--text-label-lg:     0.875rem / 500 / Inter / letter-spacing: 0.05em / UPPERCASE;
--text-label-md:     0.75rem  / 500 / Inter / letter-spacing: 0.05em / UPPERCASE;
--text-label-sm:     0.625rem / 500 / Inter / letter-spacing: 0.05em / UPPERCASE;
```

### Reglas Tipográficas
- ✅ Usar `#DEE1F7` (`on_surface`) para texto principal — NUNCA `#FFFFFF`
- ✅ Labels siempre en **MAYÚSCULAS** con `letter-spacing: 0.05em`
- ✅ Datos críticos (placas, cédulas): `title-md` Inter para reconocimiento instantáneo
- ✅ Métricas grandes de dashboard: `display-lg` Space Grotesk
- ❌ Nunca usar `font-weight: 300` — mínimo 400

---

## 4. Forma y Bordes

### Radio de Esquinas (Precision-Machined)
```css
/* Sistema: ROUND_FOUR — Bordes precisos, no "burbujeantes" */
--radius-xs:   2px;    /* Chips pequeños internos */
--radius-sm:   4px;    /* Chips de placa, tags */
--radius-md:   6px;    /* Inputs, botones secundarios */
--radius-lg:   8px;    /* Botones primarios */
--radius-xl:   12px;   /* Cards principales, modales */
--radius-full: 9999px; /* Pills de estado (badges) */
```

**Regla**: Nunca usar bordes mayores a `12px (xl)`. La estética es de **aristas mecanizadas con precisión**, no de diseño amigable de consumo.

### Regla "Sin Líneas Divisorias"
```
❌ PROHIBIDO: border-bottom: 1px solid ...  (entre secciones)
❌ PROHIBIDO: dividers o separators HTML
✅ USAR: Cambio de color de fondo entre secciones
✅ USAR: Espaciado vertical generoso (1.75rem mínimo entre módulos)
✅ PERMITIDO: Ghost Border en datos densos: outline-variant (#3C4A42) al 15% opacity
```

---

## 5. Sistema de Superficies y Elevación

### Jerarquía de Capas (como vidrio apilado)
```
CAPA 0 — Fondo App:       surface          #0E1322  (el vacío)
CAPA 1 — Layout Blocks:   surface-low      #161B2B  (contenedores principales)
CAPA 2 — Cards / Items:   surface-container #1A1F2F (elementos interactivos)
CAPA 3 — Cards Elevadas:  surface-high     #25293A  (hover, selección)
CAPA 4 — Modales/Overlays:surface-highest  #2F3445  (glassmorphism)
```

### Glassmorphism — Fórmula Exacta
```css
/* Para elementos flotantes: modales, dropdowns, cards hover */
.glass-card {
  background: rgba(26, 31, 47, 0.60);   /* surface-container al 60% */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Por cada nivel adicional de elevación, +4px de blur */
.glass-level-2 { backdrop-filter: blur(16px); }
.glass-level-3 { backdrop-filter: blur(20px); }
```

### Sombras Ambientales (Ambient Glow)
```css
/* Modales de misión crítica */
.modal-shadow {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.40);
}

/* Glow de estado OK (verde) */
.glow-success {
  box-shadow: 0 0 20px rgba(78, 222, 163, 0.25);
}

/* Glow de estado ERROR (rojo) */
.glow-error {
  box-shadow: 0 0 20px rgba(255, 180, 171, 0.30);
}
```

---

## 6. Componentes Detallados

### 6.1 Botones

#### Botón Primario (CTA Principal)
```css
.btn-primario {
  background: linear-gradient(135deg, #4EDEA3, #10B981);
  color: #003824;                /* on_primary — máximo contraste */
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 0.875rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-radius: 8px;            /* radius-lg */
  padding: 14px 24px;
  border: none;
  width: 100%;                   /* Full-width en mobile */
  min-height: 48px;              /* Objetivo táctil mínimo */
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primario:active {
  box-shadow: inset 0 0 0 1px #6FFBBE;  /* Glow interior táctil */
  transform: scale(0.99);
}
```

#### Botón Secundario (Ghost)
```css
.btn-secundario {
  background: transparent;
  color: #4EDEA3;                /* primary */
  border: 1px solid rgba(134, 148, 138, 0.20);  /* outline al 20% */
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 500;
  min-height: 44px;
}
```

#### Botón Destructivo / Alerta
```css
.btn-destructivo {
  background: linear-gradient(135deg, #FFAB4B, #93000A);
  color: #FFDAD6;
  border-radius: 8px;
}
```

#### FAB (Floating Action Button)
```css
.fab {
  position: fixed;
  bottom: 80px;                  /* Sobre el bottom nav */
  right: 16px;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #4EDEA3, #10B981);
  color: #003824;
  box-shadow: 0 8px 24px rgba(78, 222, 163, 0.35);
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
```

### 6.2 Campos de Entrada (Inputs)

```css
.input-field {
  background: #2F3445;           /* surface-highest — sin borde */
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 8px 8px 0 0;    /* Solo esquinas superiores */
  padding: 14px 16px;
  color: #DEE1F7;                /* on_surface */
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  width: 100%;
  min-height: 48px;
  transition: border-color 0.2s ease;
}

.input-field::placeholder {
  color: #86948A;                /* outline */
}

/* Focus: solo línea inferior verde, sin box outline */
.input-field:focus {
  outline: none;
  border-bottom-color: #4EDEA3; /* primary */
}

/* Error */
.input-field.error {
  border-bottom-color: #FFAB4B;
  background: rgba(147, 0, 10, 0.10);
}
```

### 6.3 Badges / Pills de Estado

```css
/* BASE */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 9999px;         /* radius-full */
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 0.625rem;           /* label-sm */
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* ACTIVA — Verde */
.badge-activa {
  background: rgba(78, 222, 163, 0.15);
  color: #4EDEA3;
  border: 1px solid rgba(78, 222, 163, 0.30);
}

/* SUSPENDIDA — Rojo */
.badge-suspendida {
  background: rgba(255, 180, 171, 0.15);
  color: #FFAB4B;
  border: 1px solid rgba(255, 180, 171, 0.30);
}

/* PENDIENTE — Ámbar */
.badge-pendiente {
  background: rgba(245, 158, 11, 0.15);
  color: #F59E0B;
  border: 1px solid rgba(245, 158, 11, 0.30);
}

/* SIN MEMBRESÍA — Gris */
.badge-sin-membresia {
  background: rgba(134, 148, 138, 0.15);
  color: #86948A;
  border: 1px solid rgba(134, 148, 138, 0.20);
}

/* VISTA COMANDO — Verde especial */
.badge-comando {
  background: rgba(78, 222, 163, 0.20);
  color: #4EDEA3;
  border: 1px solid rgba(78, 222, 163, 0.40);
}
```

### 6.4 Cards de Socio

```css
.card-socio {
  background: #1A1F2F;           /* surface-container */
  border-radius: 12px;           /* radius-xl */
  padding: 16px;
  margin-bottom: 8px;
  transition: background 0.2s ease;
  cursor: pointer;
}

.card-socio:hover {
  background: #25293A;           /* surface-high */
}

/* Card con infracción — tinte ámbar sutil */
.card-socio.con-infraccion {
  border-left: 3px solid #F59E0B;
}

/* Card suspendida — tinte rojo sutil */
.card-socio.suspendida {
  border-left: 3px solid #FFAB4B;
}

/* Avatar circular con inicial */
.avatar-socio {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

/* Colores de avatar por estado */
.avatar-activo    { background: rgba(78, 222, 163, 0.20); color: #4EDEA3; }
.avatar-suspendido { background: rgba(255, 180, 171, 0.20); color: #FFAB4B; }
.avatar-infraccion { background: rgba(245, 158, 11, 0.20); color: #F59E0B; }
.avatar-sin-datos  { background: rgba(134, 148, 138, 0.20); color: #86948A; }
```

### 6.5 Chip de Placa

```css
/* Chip identificador de placa vehicular */
.chip-placa {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #2F3445;           /* surface-variant */
  color: #4EDEA3;                /* primary */
  border-radius: 4px;            /* radius-sm */
  padding: 4px 10px;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Placa con infracción */
.chip-placa.alerta {
  color: #F59E0B;
  background: rgba(245, 158, 11, 0.15);
}
```

### 6.6 Cards de Estadística (Dashboard)

```css
.stat-card {
  background: #1A1F2F;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Número grande */
.stat-card__numero {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 3.5rem;             /* display-lg */
  color: #4EDEA3;
  line-height: 1;
}

/* Número de alerta (infracciones) */
.stat-card__numero.alerta { color: #F59E0B; }
.stat-card__numero.error  { color: #FFAB4B; }

/* Label de stat */
.stat-card__label {
  font-family: 'Inter', sans-serif;
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #86948A;                /* outline */
}
```

### 6.7 Status Beacon (Indicador Pulsante)

```css
/* Punto activo pulsante tipo radar */
.beacon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: beacon-pulse 2s infinite;
}

.beacon-activo { background: #4EDEA3; }
.beacon-alerta { background: #F59E0B; }
.beacon-error  { background: #FFAB4B; }

@keyframes beacon-pulse {
  0%   { opacity: 1; transform: scale(1); }
  50%  { opacity: 0.4; transform: scale(1.3); }
  100% { opacity: 1; transform: scale(1); }
}
```

### 6.8 Barra de Progreso (Zona de Estacionamiento)

```css
.barra-zona {
  width: 100%;
  height: 6px;
  background: #2F3445;           /* surface-variant */
  border-radius: 3px;
  overflow: hidden;
}

.barra-zona__relleno {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* Estados de ocupación */
.barra-zona__relleno.libre    { background: #4EDEA3; }          /* < 60% */
.barra-zona__relleno.medio    { background: #F59E0B; }          /* 60-85% */
.barra-zona__relleno.lleno    { background: #FFAB4B; }          /* > 85% */
```

### 6.9 Visor QR (Pantalla Alcabala / Parquero)

```css
/* Contenedor de cámara con marco HUD */
.visor-qr {
  width: 100%;
  aspect-ratio: 1;
  background: #090E1C;           /* surface-lowest */
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

/* Esquinas de guía estilo HUD */
.visor-qr::before, .visor-qr::after {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-color: #4EDEA3;
  border-style: solid;
}

.visor-qr::before {
  top: 16px; left: 16px;
  border-width: 3px 0 0 3px;
  border-radius: 4px 0 0 0;
}

/* (aplicar también a esquinas derecha e inferior) */
```

### 6.10 Result Card (Acceso Permitido / Denegado)

```css
/* Card resultado de escaneo */
.result-card {
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

/* ACCESO PERMITIDO */
.result-card.permitido {
  background: rgba(78, 222, 163, 0.10);
  border: 1px solid rgba(78, 222, 163, 0.40);
  box-shadow: 0 0 30px rgba(78, 222, 163, 0.20),
              inset 0 0 20px rgba(78, 222, 163, 0.05);
}

.result-card.permitido .result-titulo {
  color: #4EDEA3;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 1.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ACCESO DENEGADO */
.result-card.denegado {
  background: rgba(147, 0, 10, 0.20);
  border: 1px solid rgba(255, 180, 171, 0.40);
  box-shadow: 0 0 30px rgba(255, 180, 171, 0.20),
              inset 0 0 20px rgba(147, 0, 10, 0.10);
  animation: border-pulse-red 1.5s infinite;
}

.result-card.denegado .result-titulo {
  color: #FFAB4B;
}

@keyframes border-pulse-red {
  0%, 100% { border-color: rgba(255, 180, 171, 0.40); }
  50%       { border-color: rgba(255, 180, 171, 0.80); }
}
```

### 6.11 Bottom Navigation Bar

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #161B2B;           /* surface-low */
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 8px;
  z-index: 100;
}

.bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  color: #86948A;                /* inactivo */
  min-width: 48px;
}

.bottom-nav__item.activo {
  color: #4EDEA3;                /* activo verde */
  background: rgba(78, 222, 163, 0.10);
}

.bottom-nav__label {
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

### 6.12 Chips de Filtro

```css
.chip-filtro {
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

/* Activo */
.chip-filtro.activo {
  background: #10B981;           /* primary-container */
  color: #003824;                /* on-primary */
}

/* Inactivo outline */
.chip-filtro.inactivo {
  background: transparent;
  border: 1px solid rgba(134, 148, 138, 0.30);
  color: #BBCABF;
}

/* Por tipo semántico */
.chip-filtro.activos    { border-color: rgba(78, 222, 163, 0.40); color: #4EDEA3; }
.chip-filtro.suspendidos { border-color: rgba(255, 180, 171, 0.40); color: #FFAB4B; }
.chip-filtro.infracciones { border-color: rgba(245, 158, 11, 0.40); color: #F59E0B; }
```

---

## 7. Espaciado y Layout

### Escala de Espaciado
```css
--space-1:   0.25rem;   /* 4px  */
--space-2:   0.5rem;    /* 8px  */
--space-3:   0.75rem;   /* 12px */
--space-4:   1rem;      /* 16px */
--space-5:   1.25rem;   /* 20px */
--space-6:   1.5rem;    /* 24px */
--space-7:   1.75rem;   /* 28px — "Safe Zone" entre módulos */
--space-8:   2rem;      /* 32px */
--space-10:  2.5rem;    /* 40px */
--space-12:  3rem;      /* 48px */
--space-16:  4rem;      /* 64px — Bottom nav height */
```

### Safe Zones
```
Padding lateral de pantalla:    16px  (--space-4)
Separación entre módulos:       28px  (--space-7) MÍNIMO
Separación entre cards:         8px   (--space-2)
Padding interno de cards:       16px  (--space-4)
Área táctil mínima:             48px x 48px
```

### Layout Mobile-First
```css
/* Contenedor base */
.contenedor {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 80px;          /* Espacio para bottom nav */
}

/* Grid de stats 2x2 */
.grid-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
```

---

## 8. Reglas de Implementación en React + Tailwind

### Variables CSS Globales (index.css)
```css
:root {
  /* Superficies */
  --bg-app:        #0E1322;
  --bg-low:        #161B2B;
  --bg-card:       #1A1F2F;
  --bg-card-high:  #25293A;
  --bg-modal:      #2F3445;
  --bg-chip:       #2F3445;

  /* Primario */
  --primary:       #4EDEA3;
  --primary-dark:  #10B981;
  --on-primary:    #003824;

  /* Texto */
  --text-main:     #DEE1F7;
  --text-sec:      #BBCABF;
  --text-muted:    #86948A;

  /* Semánticos */
  --success:       #4EDEA3;
  --warning:       #F59E0B;
  --danger:        #FFAB4B;
  --danger-deep:   #93000A;

  /* Radios */
  --r-sm:  4px;
  --r-md:  6px;
  --r-lg:  8px;
  --r-xl:  12px;
  --r-full: 9999px;
}
```

### Clases Tailwind Personalizadas (tailwind.config.js)
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg-app':       '#0E1322',
        'bg-low':       '#161B2B',
        'bg-card':      '#1A1F2F',
        'bg-high':      '#25293A',
        'bg-modal':     '#2F3445',
        'primary':      '#4EDEA3',
        'primary-dark': '#10B981',
        'on-primary':   '#003824',
        'text-main':    '#DEE1F7',
        'text-sec':     '#BBCABF',
        'text-muted':   '#86948A',
        'success':      '#4EDEA3',
        'warning':      '#F59E0B',
        'danger':       '#FFAB4B',
      },
      fontFamily: {
        'display': ['"Space Grotesk"', 'sans-serif'],
        'body':    ['Inter', 'sans-serif'],
      },
    }
  }
}
```

---

## 9. Pantallas Diseñadas — Inventario

| # | Pantalla | Rol(es) | Screen ID Stitch |
|---|----------|---------|-----------------|
| 1 | Login | Todos | `5529aac8fcef44218470866b3db57ba4` |
| 2 | Dashboard Comandante | COMANDANTE, ADMIN_BASE | `bb2abfde96f1404793ad0fb5972985f8` |
| 3 | Alcabala — Escaneo QR (Acceso Permitido) | ALCABALA | `da915b0a453a42aeb0c3d6bfb94957fc` |
| 4 | Mi QR — Portal Socio | SOCIO | `91f9e83f99a64639be94ced6c74012eb` |
| 5 | Buscador Maestro | COMANDANTE, ADMIN_BASE, SUPERVISOR, ALCABALA | `2a4a27de284e4ec59a1c06432b35e98d` |
| 6 | Dashboard Admin Entidad (Parque Miranda) | ADMIN_ENTIDAD | `7f1d1eec389f43198dd8f349b2952d63` |
| 7 | Lista de Socios — Vista Admin Entidad | ADMIN_ENTIDAD | `b12a0711562949a098f8757816f144e0` |
| 8 | Lista de Socios — Vista Comandante | COMANDANTE, ADMIN_BASE | `8ea3b86a93674af99311be584c8aaa80` |

**Pantallas pendientes de diseñar:**
- [ ] Ficha Detalle del Socio
- [ ] Formulario Nuevo Socio
- [ ] Pantalla Acceso Denegado (rojo completo)
- [ ] Portal Parquero — Escaneo en Zona
- [ ] Portal Supervisor — Registrar Infracción
- [ ] Formulario Solicitud de Evento
- [ ] Vista Comandante — Aprobar Evento
- [ ] Pantalla Mis Infracciones (Socio)

---

## 10. Do's and Don'ts — Referencia Rápida

### ✅ HACER
- Usar `#DEE1F7` para todo texto principal (nunca `#FFFFFF`)
- `letter-spacing: 0.05em` + `UPPERCASE` en todos los labels
- Glassmorphism (`backdrop-blur: 12px`) en elementos flotantes
- Áreas táctiles mínimas de `48px`
- Gradiente `#4EDEA3 → #10B981` a 135° para CTAs principales
- Separación de 28px mínimo entre módulos principales
- Cambio de tono de superficie para separar secciones (no líneas)
- Punto pulsante (beacon) para estados en tiempo real

### ❌ NO HACER
- Texto blanco puro `#FFFFFF`
- Bordes de separación `1px solid` entre secciones
- `border-radius` mayor a `12px`
- Sombras tipo Material Design (muy suaves)
- Lógica de negocio en componentes React (va en `services/`)
- `font-weight: 300`
- Líneas divisorias HTML (hr, divider)
- Mezclar colores fuera de la paleta Aegis Tactical

---

*Última actualización: 2026-03-30*  
*Fuente: Google Stitch — Proyecto BAGFM `4512440937494164528`*  
*Ver: DIRECTIVA_MAESTRA.md para contexto del sistema completo*
# ROLES Y PERMISOS — BAGFM

> Consultar `DIRECTIVA_MAESTRA.md` antes de modificar este documento.

---

## Definición de Roles

### `COMANDANTE`
Superadministrador de la base. Acceso total al sistema.  
- Crea y administra entidades civiles.
- Crea usuarios de la base (Admin Base, Supervisores, Alcabalas).
- Aprueba, rechaza o modifica solicitudes de acceso para eventos.
- Tiene visibilidad total de todos los socios de todas las entidades.
- Puede buscar por placa, cédula o nombre.
- Puede crear y gestionar infracciones.

### `ADMIN_BASE`
Personal administrativo que apoya al Comandante.  
- Mismos permisos de visualización que el Comandante.
- Puede gestionar entidades civiles y usuarios de la base.
- Acceso al buscador maestro.
- Puede crear infracciones.
- **No puede** aprobar/rechazar solicitudes de eventos (solo el Comandante).

### `SUPERVISOR`
Personal de ronda que recorre la base.  
- Acceso al **buscador maestro** (busca por placa, cédula, nombre).
- Puede ver el estado del vehículo/socio encontrado.
- **Puede crear infracciones** desde el buscador o al escanear QR.
- No tiene acceso al panel de administración.
- No gestiona socios ni entidades.

### `ALCABALA`
Guardia de turno en los puntos de entrada de la base.  
- Escanea QR para verificar autorización de entrada.
- Registra entradas (obligatorio).
- Registra salidas (**opcional**, configurable en `configuracion.salida_requerida`).
- Acceso al **buscador maestro** para confirmar acceso manual o verificar vehículos.
- Ve alertas de infracciones activas que bloquean salida.
- **No puede** crear infracciones.

### `ADMIN_ENTIDAD`
Administrador de una entidad civil (Parque Miranda, Club Fútbol, etc.).  
- Su acceso está limitado a su propia entidad.
- CRUD de socios de su entidad.
- Importación masiva de socios desde Excel.
- Gestión de membresías (activa, suspendida, vencida).
- Asignación de cupos de estacionamiento (**opcional**, no requerido).
- CRUD de usuarios Parquero para su entidad.
- Puede generar y revocar QR de sus socios.
- Puede solicitar acceso temporal para eventos.
- **No puede** ver datos de otras entidades.

### `PARQUERO`
Empleado de una entidad civil que gestiona la zona de estacionamiento.  
- Escanea QR del socio al llegar a la zona.
- Ve: nombre del socio, estado de membresía, cupo asignado (si tiene).
- Marca cupo como ocupado/libre (**si la entidad usa cupos**).
- Ve el estado de la zona (cuántos cupos libres/ocupados).
- **Solo puede** operar dentro de la zona de su entidad.

### `SOCIO`
Miembro de una entidad civil.  
- Registra y actualiza sus datos personales.
- Registra sus vehículos (puede tener más de uno).
- Accede a su QR de identificación.
- Ve el estado de su membresía.
- Ve su historial de entradas/salidas.
- Ve sus infracciones (activas y pasadas).
- **No puede** ver datos de otros socios.

### `VISITANTE_TEMP`
Acceso temporal aprobado para un evento.  
- No tiene cuenta en el sistema.
- Solo existe como un QR temporal generado al aprobar una solicitud de evento.
- El QR tiene fecha de expiración exacta.
- Al expirar, el QR es rechazado automáticamente.

---

## Matriz Completa de Permisos

| Acción | COMANDANTE | ADMIN_BASE | SUPERVISOR | ALCABALA | ADMIN_ENTIDAD | PARQUERO | SOCIO |
|--------|:----------:|:----------:|:----------:|:--------:|:-------------:|:--------:|:-----:|
| **PANEL GENERAL** |
| Ver dashboard base (tiempo real) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver estadísticas globales | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ENTIDADES CIVILES** |
| Crear entidad civil | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Editar entidad civil | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver todas las entidades | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **USUARIOS DE LA BASE** |
| Crear Admin Base | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear Supervisor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear Alcabala | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **BUSCADOR MAESTRO** |
| Buscar por placa | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buscar por cédula | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Buscar por nombre | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **SOCIOS** |
| Ver todos los socios de todas las entidades | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear socio en entidad propia | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Importar socios desde Excel | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Editar socio propio | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Ver perfil propio | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar perfil propio | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **VEHÍCULOS** |
| Registrar vehículo (propio) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver vehículos de cualquier socio | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **MEMBRESÍAS** |
| Crear/editar membresía | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Ver estado de propia membresía | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **CUPOS (OPCIONAL)** |
| Asignar cupo a socio | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Ver cupo asignado propio | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **PARQUEROS** |
| Crear Parquero en entidad propia | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **QR** |
| Generar QR para socio | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Ver propio QR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Revocar QR de socio | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **ACCESOS (ENTRADA/SALIDA)** |
| Registrar entrada (escanear QR) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Registrar salida (escanear QR) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Verificar QR en zona | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Confirmar acceso manual | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Ver historial propio | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver historial de todos | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **INFRACCIONES** |
| Crear infracción | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver infracciones propias | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver todas las infracciones | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver infracciones de su entidad | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Resolver/perdonar infracción | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SOLICITUDES DE EVENTO** |
| Solicitar evento | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Aprobar/Denegar evento | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver solicitudes | ✅ | ✅ | ❌ | ❌ | ✅ (propias) | ❌ | ❌ |

---

## Implementación en Backend (FastAPI)

```python
# Ejemplo de uso en endpoints
from app.api.deps import require_role
from app.core.enums import Rol

@router.get("/buscador")
async def buscador(
    q: str,
    current_user = Depends(require_role([
        Rol.COMANDANTE,
        Rol.ADMIN_BASE,
        Rol.SUPERVISOR,
        Rol.ALCABALA
    ]))
):
    ...
```

### Enum de Roles
```python
class Rol(str, Enum):
    COMANDANTE = "COMANDANTE"
    ADMIN_BASE = "ADMIN_BASE"
    SUPERVISOR = "SUPERVISOR"
    ALCABALA = "ALCABALA"
    ADMIN_ENTIDAD = "ADMIN_ENTIDAD"
    PARQUERO = "PARQUERO"
    SOCIO = "SOCIO"
```

---

*Última actualización: 2026-03-30 | Ver: DIRECTIVA_MAESTRA.md para contexto*
# SCHEMA BASE DE DATOS — BAGFM

> Consultar `DIRECTIVA_MAESTRA.md` antes de modificar este documento.  
> Todo cambio al schema debe reflejarse aquí con su fecha y versión.

---

## Convenciones

- Todos los IDs: `UUID` generado por PostgreSQL (`gen_random_uuid()`)
- Todos los timestamps: `TIMESTAMPTZ` en **UTC**
- Campos eliminados: **nunca se eliminan**, se marcan `deprecated`
- FK siempre con `ON DELETE RESTRICT` salvo excepción documentada

---

## Tablas

---

### `usuarios`
Todos los usuarios del sistema (todos los roles).

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK, default gen | — |
| `cedula` | VARCHAR(20) | UNIQUE, NOT NULL | Identificador principal |
| `nombre` | VARCHAR(100) | NOT NULL | — |
| `apellido` | VARCHAR(100) | NOT NULL | — |
| `email` | VARCHAR(255) | UNIQUE, NULL | Opcional en algunos roles |
| `telefono` | VARCHAR(20) | NULL | — |
| `rol` | ENUM | NOT NULL | Ver enum `rol_tipo` |
| `entidad_id` | UUID | FK → entidades_civiles, NULL | Solo para ADMIN_ENTIDAD, PARQUERO, SOCIO |
| `activo` | BOOLEAN | DEFAULT true | Soft delete |
| `foto_url` | TEXT | NULL | URL de foto de perfil |
| `password_hash` | TEXT | NOT NULL | bcrypt |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | — |

**Enum `rol_tipo`**: `COMANDANTE`, `ADMIN_BASE`, `SUPERVISOR`, `ALCABALA`, `ADMIN_ENTIDAD`, `PARQUERO`, `SOCIO`

---

### `entidades_civiles`
Organizaciones civiles con acceso a la base.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `nombre` | VARCHAR(200) | NOT NULL | Ej: "Parque Miranda" |
| `codigo_slug` | VARCHAR(50) | UNIQUE, NOT NULL | Ej: "parque-miranda" |
| `zona_id` | UUID | FK → zonas_estacionamiento, NULL | Zona asignada |
| `capacidad_vehiculos` | INTEGER | NOT NULL, > 0 | Cupos máximos |
| `descripcion` | TEXT | NULL | — |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `created_by` | UUID | FK → usuarios | Comandante que creó |

---

### `zonas_estacionamiento`
Áreas físicas de estacionamiento dentro de la base.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `nombre` | VARCHAR(200) | NOT NULL | Ej: "Zona A - Norte" |
| `capacidad_total` | INTEGER | NOT NULL | Cupos físicos totales |
| `ocupacion_actual` | INTEGER | DEFAULT 0 | Calculado por accesos |
| `descripcion_ubicacion` | TEXT | NULL | — |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `vehiculos`
Vehículos registrados por socios.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `placa` | VARCHAR(20) | UNIQUE, NOT NULL | Identificador del vehículo |
| `marca` | VARCHAR(100) | NOT NULL | — |
| `modelo` | VARCHAR(100) | NOT NULL | — |
| `color` | VARCHAR(50) | NOT NULL | — |
| `año` | INTEGER | NULL | — |
| `tipo` | VARCHAR(50) | NULL | Ej: "sedan", "SUV", "moto" |
| `socio_id` | UUID | FK → usuarios, NOT NULL | Propietario |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `membresias`
Concesión de cupo / membresía de un socio con su entidad.  
> Terminología discreta: "membresía activa" = socio con acceso vigente.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `socio_id` | UUID | FK → usuarios, NOT NULL | — |
| `entidad_id` | UUID | FK → entidades_civiles, NOT NULL | — |
| `vehiculo_id` | UUID | FK → vehiculos, NULL | Vehículo asociado a esta membresía |
| `cupo_numero` | INTEGER | NULL | **OPCIONAL**: número de puesto |
| `estado` | ENUM | NOT NULL | Ver enum `membresia_estado` |
| `fecha_inicio` | DATE | NOT NULL | — |
| `fecha_fin` | DATE | NULL | NULL = indefinido |
| `observaciones` | TEXT | NULL | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `created_by` | UUID | FK → usuarios | Admin Entidad que creó |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | — |

**Enum `membresia_estado`**: `activa`, `suspendida`, `vencida`

---

### `codigos_qr`
QR de identificación por socio/vehículo.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `usuario_id` | UUID | FK → usuarios, NOT NULL | A quién pertenece |
| `vehiculo_id` | UUID | FK → vehiculos, NULL | Si el QR es por vehículo |
| `membresia_id` | UUID | FK → membresias, NULL | Membresía asociada |
| `tipo` | ENUM | NOT NULL | Ver enum `qr_tipo` |
| `token` | TEXT | UNIQUE, NOT NULL | JWT firmado |
| `fecha_expiracion` | TIMESTAMPTZ | NULL | NULL = permanente |
| `activo` | BOOLEAN | DEFAULT true | Revocable |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `created_by` | UUID | FK → usuarios | Quién lo generó |

**Enum `qr_tipo`**: `permanente`, `temporal`

---

### `accesos`
Log de entradas y salidas de la base.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `qr_id` | UUID | FK → codigos_qr, NULL | NULL si acceso manual |
| `usuario_id` | UUID | FK → usuarios, NOT NULL | Quien entra/sale |
| `vehiculo_id` | UUID | FK → vehiculos, NULL | Vehículo si aplica |
| `tipo` | ENUM | NOT NULL | Ver enum `acceso_tipo` |
| `punto_acceso` | VARCHAR(100) | NOT NULL | Ej: "Alcabala Principal" |
| `registrado_por` | UUID | FK → usuarios, NOT NULL | El guardia/parquero |
| `es_manual` | BOOLEAN | DEFAULT false | Acceso confirmado manualmente |
| `timestamp` | TIMESTAMPTZ | DEFAULT now() | — |

**Enum `acceso_tipo`**: `entrada`, `salida`

---

### `accesos_zona`
Log de entrada/salida en zona de estacionamiento (parquero).

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `qr_id` | UUID | FK → codigos_qr, NULL | — |
| `usuario_id` | UUID | FK → usuarios | Socio |
| `vehiculo_id` | UUID | FK → vehiculos, NULL | — |
| `zona_id` | UUID | FK → zonas_estacionamiento | — |
| `cupo_numero` | INTEGER | NULL | Si usa sistema de cupos |
| `tipo` | ENUM | NOT NULL | `entrada` o `salida` |
| `registrado_por` | UUID | FK → usuarios | Parquero |
| `timestamp` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `infracciones`
Sanciones registradas por supervisores o el Comandante.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `vehiculo_id` | UUID | FK → vehiculos, NOT NULL | — |
| `usuario_id` | UUID | FK → usuarios, NOT NULL | Propietario del vehículo |
| `reportado_por` | UUID | FK → usuarios, NOT NULL | Supervisor o Comandante |
| `tipo` | ENUM | NOT NULL | Ver enum `infraccion_tipo` |
| `descripcion` | TEXT | NOT NULL | — |
| `foto_url` | TEXT | NULL | — |
| `bloquea_salida` | BOOLEAN | DEFAULT true | Si bloquea en alcabala |
| `estado` | ENUM | NOT NULL | Ver enum `infraccion_estado` |
| `resuelta_por` | UUID | FK → usuarios, NULL | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `resuelta_at` | TIMESTAMPTZ | NULL | — |
| `observaciones_resolucion` | TEXT | NULL | — |

**Enum `infraccion_tipo`**: `mal_estacionado`, `exceso_velocidad`, `conducta_indebida`, `documentos_vencidos`, `otro`  
**Enum `infraccion_estado`**: `activa`, `resuelta`, `perdonada`

---

### `solicitudes_evento`
Solicitudes de acceso temporal masivo para eventos.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `entidad_id` | UUID | FK → entidades_civiles | — |
| `solicitado_por` | UUID | FK → usuarios | Admin Entidad |
| `fecha_evento` | DATE | NOT NULL | — |
| `hora_inicio` | TIME | NULL | — |
| `hora_fin` | TIME | NULL | — |
| `cantidad_solicitada` | INTEGER | NOT NULL | Vehículos pedidos |
| `cantidad_aprobada` | INTEGER | NULL | Aprobados por Comandante |
| `motivo` | TEXT | NOT NULL | — |
| `estado` | ENUM | NOT NULL | Ver enum `solicitud_estado` |
| `revisado_por` | UUID | FK → usuarios, NULL | Comandante/Admin Base |
| `motivo_rechazo` | TEXT | NULL | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |
| `revisado_at` | TIMESTAMPTZ | NULL | — |

**Enum `solicitud_estado`**: `pendiente`, `aprobada`, `aprobada_parcial`, `denegada`

---

### `accesos_temporales`
QR temporales generados al aprobar una solicitud de evento.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `solicitud_id` | UUID | FK → solicitudes_evento | — |
| `qr_id` | UUID | FK → codigos_qr | QR generado |
| `nombre_visitante` | VARCHAR(200) | NULL | Opcional |
| `placa_visitante` | VARCHAR(20) | NULL | Opcional |
| `usado` | BOOLEAN | DEFAULT false | Ya fue escaneado |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `push_subscriptions`
Suscripciones Push Notifications (Web Push API).

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `id` | UUID | PK | — |
| `usuario_id` | UUID | FK → usuarios | — |
| `endpoint` | TEXT | NOT NULL | — |
| `p256dh` | TEXT | NOT NULL | Clave pública del cliente |
| `auth` | TEXT | NOT NULL | — |
| `dispositivo` | VARCHAR(100) | NULL | User agent info |
| `activo` | BOOLEAN | DEFAULT true | — |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | — |

---

### `configuracion`
Parámetros globales del sistema. Modificables sin deploy.

| Campo | Tipo | Restricción | Notas |
|-------|------|-------------|-------|
| `clave` | VARCHAR(100) | PK | — |
| `valor` | TEXT | NOT NULL | — |
| `descripcion` | TEXT | NULL | — |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | — |

**Claves predefinidas:**

| Clave | Valor default | Descripción |
|-------|--------------|-------------|
| `salida_requerida` | `false` | Si la alcabala debe registrar salida |
| `max_vehiculos_por_evento` | `50` | Límite de vehículos por solicitud |
| `qr_expiracion_temporal_horas` | `24` | Vigencia de QR temporales |
| `bloquear_salida_por_infraccion` | `true` | Bloqueo automático |

---

## Índices Recomendados

```sql
-- Búsqueda frecuente en alcabalas y supervisores
CREATE INDEX idx_vehiculos_placa ON vehiculos(placa);
CREATE INDEX idx_usuarios_cedula ON usuarios(cedula);
CREATE INDEX idx_accesos_timestamp ON accesos(timestamp DESC);
CREATE INDEX idx_infracciones_vehiculo ON infracciones(vehiculo_id) WHERE estado = 'activa';
CREATE INDEX idx_membresias_socio ON membresias(socio_id) WHERE estado = 'activa';
CREATE INDEX idx_codigos_qr_token ON codigos_qr(token) WHERE activo = true;
```

---

## Historial de Cambios del Schema

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 0.1.0 | 2026-03-30 | Schema inicial definido |

---

*Última actualización: 2026-03-30 | Ver: DIRECTIVA_MAESTRA.md para contexto*
# FLUJOS DE NEGOCIO — BAGFM

> Consultar `DIRECTIVA_MAESTRA.md` antes de modificar este documento.

---

## FL-01 — Onboarding de Entidad Civil

**Actor principal**: Comandante  
**Resultado**: La entidad puede operar y gestionar sus socios.

```
1. Comandante crea Entidad Civil
   - Nombre, código, descripción
   - Zona de estacionamiento asignada
   - Capacidad máxima de vehículos

2. Sistema genera credenciales para Admin Entidad
   - El Comandante crea el usuario Admin Entidad
   - Email + contraseña temporal enviada

3. Admin Entidad ingresa al portal por primera vez
   - Cambia contraseña
   - Completa perfil de la entidad

4. Admin Entidad comienza a cargar socios
   - Manual (uno a uno) o
   - Importación masiva desde Excel (.xlsx)

5. Admin Entidad genera QR para cada socio
   - QR permanente por defecto

6. ✅ Entidad operativa
```

---

## FL-02 — Registro de Socio (Manual)

**Actor principal**: Admin Entidad  
**Resultado**: Socio con QR activo puede ingresar a la base.

```
1. Admin Entidad crea usuario Socio
   - Cédula, nombre, apellido, teléfono, email (opcional)

2. Admin Entidad crea membresía para el socio
   - Selecciona vehículo(s) del socio
   - Estado: activa
   - Fecha inicio
   - Cupo (OPCIONAL, puede dejarse vacío)

3. Admin Entidad genera QR
   - Sistema crea JWT firmado (tipo: permanente)
   - QR descargable para el socio

4. Socio recibe credenciales
   - Puede ingresar al portal con su cédula
   - Descarga su propio QR

5. ✅ Socio listo para acceder a la base
```

---

## FL-03 — Importación Masiva de Socios (Excel)

**Actor principal**: Admin Entidad  
**Resultado**: Múltiples socios cargados de una vez.

```
1. Admin Entidad descarga plantilla Excel (.xlsx)
   - Columnas: cedula | nombre | apellido | telefono | email | placa | marca | modelo | color | año

2. Admin Entidad llena la plantilla

3. Admin Entidad sube el archivo al sistema

4. Backend (excel_service.py) procesa el archivo:
   a. Valida formato y columnas
   b. Valida cédulas únicas
   c. Valida placas únicas
   d. Reporta errores por fila si los hay

5. Vista previa con filas OK y filas con error
   - El Admin puede descargar el reporte de errores

6. Admin confirma importación de filas válidas

7. Sistema crea usuarios, vehículos y membresías activas

8. ✅ Socios importados. QR pendiente de generación manual o en batch
```

**Plantilla Mínima Excel:**
```
cedula | nombre | apellido | telefono | placa | marca | modelo | color
```

---

## FL-04 — Acceso a la Base (Alcabala)

**Actor principal**: Guardia Alcabala  
**Resultado**: El vehículo entra o es rechazado.

```
1. Socio llega a la alcabala y presenta QR

2. Guardia escanea QR con su teléfono (PWA)

3. Sistema verifica:
   a. ¿El token es válido? (firma JWT)
   b. ¿El QR está activo? (activo = true)
   c. ¿No ha expirado? (fecha_expiracion)
   d. ¿El socio tiene membresía activa?
   e. ¿El vehículo tiene infracción activa con bloquea_salida?
      → Solo relevante para salida

4a. Si todo OK:
    - Pantalla verde ✅
    - Muestra: nombre, foto, entidad, vehículo
    - Sistema registra acceso tipo "entrada"
    - Guardia presiona "Confirmar entrada"

4b. Si hay problema:
    - Pantalla roja ❌
    - Muestra motivo (QR inválido, membresía suspendida, etc.)
    - Guardia puede confirmar acceso manual (si tiene permiso)
    - El acceso manual queda registrado con flag es_manual = true

5. ✅ Registro creado en tabla accesos

NOTA: El registro de salida sigue el mismo flujo pero con tipo "salida".
      Si bloquea_salida = true en infracción activa, se muestra alerta
      y el guardia NO puede confirmar salida.
```

---

## FL-05 — Verificación en Zona (Parquero)

**Actor principal**: Parquero de la entidad civil  
**Resultado**: El socio conoce su cupo (si aplica) y el parquero registra ocupación.

```
1. Socio llega a la zona y presenta QR al parquero

2. Parquero escanea QR

3. Sistema verifica (mismo que FL-04 pero solo para su zona)

4. Pantalla muestra:
   - Nombre del socio
   - Estado de membresía (activa/suspendida/vencida)
   - Cupo asignado: "Puesto 15" o "Sin cupo asignado"

5. Si tiene cupo:
   - Parquero ve botón "Marcar como ocupado"
   - Zona actualiza ocupación en tiempo real

6. Si no tiene cupo:
   - Parquero asigna cupo disponible manualmente (si aplica)
   - O simplemente confirma que es un socio válido

7. ✅ Socio ingresa a la zona
```

---

## FL-06 — Registro de Infracción

**Actor principal**: Supervisor  
**Resultado**: Vehículo marcado, socio notificado, salida bloqueada si aplica.

```
OPCIÓN A — Por placa (vehículo sin QR visible):
1. Supervisor abre Buscador Maestro
2. Escribe la placa del vehículo
3. Sistema muestra socio asociado, membresía, historial
4. Supervisor presiona "Registrar Infracción"
5. Formulario: tipo | descripción | foto (opcional) | bloquea_salida
6. Confirma → infracción creada

OPCIÓN B — Con QR (escanea el vehículo directamente):
1. Supervisor escanea QR
2. Sistema muestra ficha del socio
3. Supervisor presiona "Registrar Infracción"
4. Mismo formulario

Resultado:
- Infracción registrada con estado: activa
- Si bloquea_salida = true:
  → Al próximo escaneo en alcabala, pantalla muestra alerta
  → Guardia no puede confirmar salida
- El socio ve la infracción en su portal
- La entidad civil ve la infracción de su socio
```

---

## FL-07 — Resolución de Infracción

**Actor principal**: Comandante o Admin Base  
**Resultado**: Vehículo puede salir nuevamente.

```
1. Comandante abre lista de infracciones activas

2. Ve la infracción: descripción, foto, socio, vehículo, supervisor

3. Opciones:
   a. "Resolver" → infracción pasa a estado: resuelta
      - Se puede agregar observación de resolución
   b. "Perdonar" → infracción pasa a estado: perdonada
      - Requiere justificación

4. Si bloquea_salida era true:
   - Al resolver/perdonar, el bloqueo se levanta automáticamente

5. ✅ Vehículo puede salir en la próxima verificación de alcabala
```

---

## FL-08 — Solicitud de Acceso para Evento

**Actor principal**: Admin Entidad → Comandante  
**Resultado**: QR temporales generados para los visitantes del evento.

```
1. Admin Entidad abre formulario "Solicitar Acceso para Evento"
   - Nombre del evento
   - Fecha y hora del evento
   - Número de vehículos requeridos
   - Motivo/descripción
   - Lista de vehículos (opcional, puede agregarse después)

2. Sistema crea solicitud con estado: pendiente

3. Comandante recibe notificación push en su PWA

4. Comandante revisa la solicitud:
   - Ve todos los detalles
   - Tiene tres opciones:
     a. Aprobar todo → cantidad_aprobada = cantidad_solicitada
     b. Aprobar parcial → ingresa número menor
     c. Denegar → ingresa motivo_rechazo

5. Sistema notifica al Admin Entidad (push notification)

6. Si aprobada (total o parcial):
   - Sistema genera N QR temporales (N = cantidad_aprobada)
   - Tipo: temporal
   - Expiración: fecha del evento + qr_expiracion_temporal_horas (config)
   - Admin Entidad puede descargar QR como PDF o lista de links
   - Distribuye QR a los visitantes del evento

7. El día del evento:
   - Visitantes llegan con su QR temporal
   - Alcabala escanea → el sistema verifica que no haya expirado
   - Registra entrada como acceso_temporal = true
   - El QR puede marcarse como "usado" tras el primer escaneo (configurable)

8. Al vencer la fecha/hora:
   - QR expiran automáticamente
   - Si intentan usar QR vencido → pantalla roja ❌
```

---

## FL-09 — Buscador Maestro (Multi-Rol)

**Actores**: Comandante, Admin Base, Supervisor, Alcabala  
**Resultado**: Ficha completa del socio/vehículo.

```
1. Usuario ingresa al Buscador Maestro

2. Puede buscar por:
   - Placa del vehículo
   - Cédula del socio
   - Nombre / Apellido

3. Sistema retorna resultados paginados

4. Al seleccionar un resultado, se muestra ficha completa:
   - Datos del socio (nombre, cédula, foto, teléfono)
   - Vehículo(s) registrado(s)
   - Entidad civil a la que pertenece
   - Estado de membresía actual
   - Últimos 10 accesos
   - Infracciones activas (resaltadas en rojo)
   - Historial de infracciones

5. Acciones disponibles según rol:
   - SUPERVISOR: Botón "Registrar Infracción"
   - ALCABALA: Botón "Confirmar Acceso Manual"
   - COMANDANTE / ADMIN_BASE: Todo lo anterior + "Ver perfil completo"
```

---

## FL-10 — Membresía y Control de Cupos

**Actor principal**: Admin Entidad  
**Resultado**: Control de quién tiene cupo vigente y cuál.

```
Estado de membresía:
- activa: el socio puede acceder
- suspendida: el socio NO puede acceder (QR bloqueado)
- vencida: el socio NO puede acceder

Cupo de estacionamiento (OPCIONAL):
- La entidad puede operar sin asignar cupos
- Si decide usar cupos, asigna número de puesto a cada socio
- El parquero ve el cupo al escanear el QR
- La entidad ve un mapa de cupos en su dashboard

Flujo de suspensión:
1. Admin Entidad selecciona socio
2. Cambia estado de membresía a "suspendida"
3. Sistema marca membresía como suspendida
4. Al intentar escaner QR del socio → membresía suspendida ❌
5. Cuando se reactiva → membresía activa ✅
```

---

*Última actualización: 2026-03-30 | Ver: DIRECTIVA_MAESTRA.md para contexto*
# CONVENCIONES DE CÓDIGO — BAGFM

> Consultar `DIRECTIVA_MAESTRA.md` antes de modificar este documento.

---

## Idioma

- **Todo en español**: nombres de variables, funciones, clases, comentarios, mensajes al usuario.
- Excepciones: keywords del lenguaje, nombres de librerías externas, convenciones estándar (HTTP methods, etc.).

**Correcto:**
```python
def obtener_socios_por_entidad(entidad_id: UUID) -> list[Usuario]:
    """Retorna todos los socios activos de una entidad."""
    ...
```

**Incorrecto:**
```python
def get_members_by_entity(entity_id: UUID) -> list[User]:
    ...
```

---

## Backend — Python / FastAPI

### Estructura de módulo
```
app/
├── api/v1/
│   └── socios.py           # Solo rutas. Delega a services.
├── services/
│   └── socio_service.py    # Lógica de negocio. NO conoce Request/Response.
├── models/
│   └── socio.py            # SQLAlchemy ORM
├── schemas/
│   └── socio.py            # Pydantic (entrada/salida de API)
└── core/
    ├── config.py
    ├── database.py
    └── security.py
```

### Nombrado
| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Archivos | `snake_case` | `socio_service.py` |
| Clases | `PascalCase` | `class SocioService` |
| Funciones | `snake_case` | `def crear_socio()` |
| Variables | `snake_case` | `socio_activo = True` |
| Constantes | `UPPER_SNAKE` | `MAX_INTENTOS = 3` |
| Endpoints | `kebab-case` (URLs) | `/api/v1/socios-activos` |

### Estructura de endpoint (regla estricta)
```python
@router.post("/socios", response_model=SocioSalidaSchema)
async def crear_socio(
    datos: SocioEntradaSchema,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_role([Rol.ADMIN_ENTIDAD]))
):
    """Crea un nuevo socio en la entidad del usuario autenticado."""
    return await socio_service.crear(db, datos, usuario_actual)
```

### Reglas de services
```python
# ✅ CORRECTO — el service solo hace lógica
class SocioService:
    async def crear(
        self,
        db: AsyncSession,
        datos: SocioEntradaSchema,
        creado_por: Usuario
    ) -> Usuario:
        # Validar, crear, guardar
        ...

# ❌ INCORRECTO — el service no debe conocer HTTPException directamente
# (usa excepciones propias que el endpoint convierte)
```

### Manejo de errores
```python
# Excepciones propias en app/core/excepciones.py
class EntidadNoEncontrada(Exception): ...
class AccesoDenegado(Exception): ...
class QRInvalido(Exception): ...

# El endpoint las convierte
@router.get("/{id}")
async def obtener_socio(id: UUID, ...):
    try:
        return await socio_service.obtener(db, id)
    except EntidadNoEncontrada:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
```

---

## Frontend — React

### Estructura de componente
```jsx
// components/SocioCard.jsx

// 1. Imports externos
import { useState } from 'react'
import { formatearFecha } from '../utils/fechas'

// 2. Imports de services/stores (nunca API directamente aquí)
import { usarSocioStore } from '../store/socio.store'

// 3. Componente
export function SocioCard({ socio, onVerDetalle }) {
  const [cargando, setCargando] = useState(false)

  return (
    <div className="...">
      {/* ... */}
    </div>
  )
}
```

### Nombrado
| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Archivos components | `PascalCase.jsx` | `SocioCard.jsx` |
| Archivos pages | `PascalCase.jsx` | `Dashboard.jsx` |
| Archivos services | `camelCase.service.js` | `socio.service.js` |
| Archivos stores | `camelCase.store.js` | `auth.store.js` |
| Hooks custom | `usarAlgo.js` | `usarQRScanner.js` |
| Variables/funciones | `camelCase` | `const socioActivo` |
| Constantes | `UPPER_SNAKE` | `const ROL_SOCIO = "SOCIO"` |

### Services (llamadas a la API)
```javascript
// services/socio.service.js
import api from './api'

export const socioService = {
  async obtenerTodos(entidadId) {
    const { data } = await api.get(`/socios?entidad_id=${entidadId}`)
    return data
  },

  async crear(datosSocio) {
    const { data } = await api.post('/socios', datosSocio)
    return data
  }
}
```

### Zustand Stores
```javascript
// store/auth.store.js
import { create } from 'zustand'

export const usarAuthStore = create((set, get) => ({
  usuario: null,
  token: null,

  iniciarSesion: (usuario, token) => set({ usuario, token }),
  cerrarSesion: () => set({ usuario: null, token: null }),
  esRol: (rol) => get().usuario?.rol === rol,
}))
```

---

## Base de Datos

### Convenciones SQL
- Nombres de tablas: `snake_case` plural → `usuarios`, `entidades_civiles`
- Nombres de columnas: `snake_case` → `fecha_inicio`, `created_at`
- Enums: definidos en PostgreSQL con nombre descriptivo → `rol_tipo`, `membresia_estado`
- Índices: prefijo `idx_` → `idx_vehiculos_placa`
- FK: nombre `tabla_referenciada_id` → `entidad_id`, `socio_id`

### Reglas de migración (Alembic)
- Una migración = un cambio lógico (no mezclar)
- Mensaje descriptivo: `"agregar campo foto_url a usuarios"`
- Nunca hacer `DROP COLUMN` directamente → primero deprecar
- Probar rollback antes de hacer merge

---

## Git

### Branches
```
main              → Producción (Railway)
develop           → Desarrollo activo
feature/nombre    → Nueva funcionalidad
fix/nombre        → Corrección de bug
```

### Commits (Conventional Commits en español)
```
feat: agregar importación masiva de socios desde Excel
fix: corregir validación de QR expirados en alcabala
docs: actualizar SCHEMA_BD con tabla accesos_zona
refactor: mover lógica de infracciones a servicio dedicado
chore: actualizar dependencias de Python
```

---

## Seguridad

- **Nunca** exponer `SUPABASE_SERVICE_KEY` al frontend
- **Nunca** retornar `password_hash` en respuestas de API
- Validar rol en **cada** endpoint protegido
- Los QR son tokens JWT firmados → verificar firma siempre en backend
- Fotos de infracciones: almacenar en Supabase Storage, retornar URL firmada con expiración
- Rate limiting en endpoints de escaneo QR (prevenir abuso)

---

*Última actualización: 2026-03-30 | Ver: DIRECTIVA_MAESTRA.md para contexto*
# API REFERENCE — BAGFM

Esta referencia documenta los endpoints disponibles en la API del sistema BAGFM (v1).

---

## 🔐 Autenticación
`Base URL: /api/v1/auth`

### `POST /login`
Inicia sesión en el sistema y retorna un token JWT.
- **Body (OAuth2 Form)**: `username` (Cédula), `password`.
- **Respuesta**: Token JWT e información básica del usuario.

---

## 🏛️ Entidades Civiles
`Base URL: /api/v1/entidades`

### `GET /`
Lista todas las entidades civiles registradas.
- **Permisos**: Cualquier usuario autenticado.
- **Parámetros**: `activas_solo` (boolean, opcional).

### `POST /`
Crea una nueva entidad civil.
- **Permisos**: `COMANDANTE`, `ADMIN_BASE`.
- **Body**: `EntidadCivilCrear` (nombre, codigo_slug, zona_id, etc).

### `GET /{id}`
Obtiene detalles de una entidad específica.

### `PUT /{id}`
Actualiza una entidad.
- **Permisos**: `COMANDANTE`, `ADMIN_BASE`.

### `DELETE /{id}`
Desactivación lógica de una entidad (soft delete).
- **Permisos**: `COMANDANTE`, `ADMIN_BASE`.

---

## 👥 Socios y Membresías
`Base URL: /api/v1/socios`

### `POST /`
Registra un nuevo socio y su membresía inicial.
- **Permisos**: `COMANDANTE`, `ADMIN_BASE`, `ADMIN_ENTIDAD`.
- **Restricción**: `ADMIN_ENTIDAD` solo puede registrar para su propia entidad.

### `GET /entidad/{entidad_id}`
Lista todos los socios de una entidad.
- **Permisos**: `COMANDANTE`, `ADMIN_BASE`, `ADMIN_ENTIDAD`.
- **Restricción**: `ADMIN_ENTIDAD` solo puede ver su propia entidad.

### `POST /importar`
Carga masiva de socios desde un archivo Excel (.xlsx).
- **Permisos**: `COMANDANTE`, `ADMIN_BASE`, `ADMIN_ENTIDAD`.
- **Parámetros**: `entidad_id` (UUID).
- **Archivo**: Multi-part form data.

---

*Última actualización: 2026-04-02 | Ver: DIRECTIVA_MAESTRA.md para contexto*
# REGISTRO DE CAMBIOS — BAGFM

> Este documento registra todos los cambios significativos al sistema.  
> Sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

---

## [Sin lanzar] — En desarrollo

### Planificado
- Setup inicial del proyecto (FastAPI + React/Vite + Supabase)
- Integración global de Supabase MCP y `supabase/agent-skills`
- Schema completo de base de datos
- Sistema de autenticación con roles JWT
- Panel del Comandante (CRUD Entidades Civiles)
- Portal Admin Entidad (CRUD Socios + Importación Excel)
- Generación y escaneo de QR
- Portal Alcabala (registro de entradas)
- Buscador Maestro (Comandante, Admin Base, Supervisor, Alcabala)
- Portal Parquero (verificación en zona)
- Portal Socio (perfil, QR, historial)
- Portal Supervisor (infracciones)
- Flujo Solicitudes de Evento
- Push Notifications (VAPID)
- PWA completa (manifest + Service Worker)
- Deploy en Railway

## [0.2.0] — 2026-03-31

### Agregado
- **Backend (Módulo Socios)**:
  - Definición de esquemas Pydantic (`Socio`, `Membresia`).
  - Servicio de negocio `socio_service` para registro de miembros y vinculación a entidades.
  - Endpoints de API `/api/v1/socios` con validación de autonomía para `ADMIN_ENTIDAD`.
- **Base de Datos**: Confirmación de modelos `Membresia` e `Infraccion`.

### Corregido
- **Frontend (Estética)**: Migración completa a **Tailwind CSS v4** y corrección de variables de diseño **Aegis Tactical**.
- **Backend (Seguridad)**: Normalización de CORS para admitir todos los orígenes en desarrollo (`APP_ENV=development`).

---

## [0.1.0] — 2026-03-30

### Agregado
- Directiva Maestra del sistema
- Directiva de Roles y Permisos
- Schema de Base de Datos
- Flujos de Negocio (FL-01 a FL-10)
- Convenciones de Código
- Plan de implementación aprobado

### Decisiones de arquitectura
- Stack: FastAPI (Python) + React/Vite + Supabase + Railway
- PWA mobile-first para funcionamiento en teléfonos personales
- Cupos de estacionamiento: opcionales, no requeridos
- Registro de salida: opcional, configurable via `configuracion.salida_requerida`
- Buscador Maestro accesible a: COMANDANTE, ADMIN_BASE, SUPERVISOR, ALCABALA
- Terminología discreta: "membresía" en lugar de referencias financieras

---

*Formato: `## [versión] — fecha`*
*Categorías: Agregado | Modificado | Deprecado | Eliminado | Corregido | Seguridad*
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
# DIRECTIVA: MIGRACIÓN A NOTEBOOKLM — BAGFM

Este documento describe el proceso y la estructura de la base de conocimientos del sistema BAGFM en NotebookLM, permitiendo un análisis avanzado y recuperación de información asistida por IA.

---

## 1. Propósito
Centralizar toda la documentación técnica, de diseño y de negocio en un cuaderno (Notebook) de NotebookLM para facilitar la consulta rápida y la consistencia en el desarrollo del sistema BAGFM.

## 2. Fuentes de Información (Fuentes)
Se han migrado los siguientes documentos como fuentes individuales para mantener la granularidad:

- **Directiva Maestra**: `docs/DIRECTIVA_MAESTRA.md` (Fuente de verdad principal)
- **Guía Visual (Aegis Tactical)**: `docs/GUIA_VISUAL.md` (Design System)
- **Roles y Permisos**: `docs/ROLES_Y_PERMISOS.md` (Matriz de acceso)
- **Schema de Base de Datos**: `docs/SCHEMA_BD.md` (Modelo E-R)
- **Flujos de Negocio**: `docs/FLUJOS_DE_NEGOCIO.md` (Procesos operativos)
- **Convenciones de Código**: `docs/CONVENCIONES_CODIGO.md` (Estándares de desarrollo)
- **Registro de Cambios**: `docs/REGISTRO_CAMBIOS.md` (Historial de versiones)

## 3. Estructura del Cuaderno
- **Nombre**: `BAGFM — Sistema de Control de Acceso`
- **Ubicación**: [NotebookLM](https://notebooklm.google.com/)

## 4. Guía de Actualización
Cada vez que se modifique un archivo en la carpeta `docs/` local, se debe:
1. Actualizar el archivo localmente.
2. Re-cargar la fuente correspondiente en NotebookLM para asegurar que la IA tenga la versión más reciente.

---
*Fecha de creación: 2026-04-02 | Autor: Antigravity*
