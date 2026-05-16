
# DIRECTIVA MAESTRA DE DISEÑO — BAGFM FRONTEND
## Sistema Aegis Tactical v2 | Guía de Implementación para Diseñadores y Desarrolladores

> **REGLA DE ORO:** Este documento es la única fuente de verdad visual del sistema.  
> Toda vista nueva o modificada **DEBE** consultarlo antes de escribir una sola clase CSS.  
> Actualizar este documento al introducir un nuevo patrón de diseño.

---

## SECCIÓN 1 — FILOSOFÍA VISUAL

El sistema BAGFM no es una aplicación de consumo masivo. Es un entorno de **misión crítica táctica** que opera en condiciones de luz variable (nocturno → solar directo). Por eso:

1. **Mobile-First siempre:** Toda vista se diseña para 375px primero. Desktop es una expansión.
2. **Contraste absoluto:** Nunca se sacrifica contraste por estética. El HUD debe ser legible a 1 metro de distancia.
3. **Sin truncado de información:** Ningún texto de datos operativos (nombre, placa, cédula) puede quedar truncado en la pantalla de resultado. Se prioriza el wrapping sobre el truncado.
4. **Dual Mode nativo:** Cada token de color tiene su equivalente para modo claro y oscuro. Un switch nunca debe romper la interfaz.

---

## SECCIÓN 2 — SISTEMA DE COLORES DUAL

### 2.1 Modo Oscuro (`class="dark"`) — Operaciones Nocturnas

| Token CSS | Valor Hex | Uso |
|-----------|-----------|-----|
| `--bg-app` | `#0E1322` | Fondo raíz de la aplicación |
| `--bg-low` | `#161B2B` | Bloques de layout, secciones |
| `--bg-card` | `#1A1F2F` | Fondo de cards y contenedores |
| `--bg-high` | `#25293A` | Elevación alta, tooltip, chips |
| `--bg-modal` | `#2F3445` | Fondo de modales |
| `--primary` | `#4EDEA3` | Esmeralda táctico – acento principal |
| `--text-main` | `#DEE1F7` | **TEXTO PRINCIPAL** (nunca usar #FFFFFF) |
| `--text-sec` | `#BBCABF` | Texto secundario de cuerpo |
| `--text-muted` | `#86948A` | Texto auxiliar, labels, metadatos |

### 2.2 Modo Claro (`:root`) — Operaciones Diurnas / Luz Solar

| Token CSS | Valor Hex | Uso |
|-----------|-----------|-----|
| `--bg-app` | `#F1F5F9` | Fondo raíz |
| `--bg-low` | `#E2E8F0` | Bloques de layout |
| `--bg-card` | `#FFFFFF` | Cards (blanco puro sobre gris) |
| `--bg-high` | `#CBD5E1` | Elevación alta |
| `--bg-modal` | `#FFFFFF` | Modales |
| `--primary` | `#10B981` | Esmeralda oscuro (contraste sobre blanco) |
| `--text-main` | `#0F172A` | Texto principal (casi negro) |
| `--text-sec` | `#334155` | Texto secundario |
| `--text-muted` | `#475569` | Texto auxiliar |

### 2.3 Colores Semánticos (Invariantes en ambos modos)

| Nombre | Clase Tailwind | Uso |
|--------|---------------|-----|
| Éxito / Acceso OK | `text-success`, `bg-success` | Acceso autorizado, estado activo |
| Peligro / Denegado | `text-danger`, `bg-danger` | Acceso rechazado, estado inactivo |
| Advertencia | `text-warning`, `bg-warning` | Infracción activa, revisión pendiente |
| Amarillo supervisor | `text-amber-400` | Rol supervisor |
| Azul alcabala | `text-sky-400` | Rol operador de alcabala |
| Púrpura entidad | `text-purple-400` | Rol admin entidad |

---

## SECCIÓN 3 — TIPOGRAFÍA TÁCTICA

### 3.1 Familias de Fuente

| Variable | Fuente | Uso |
|----------|--------|-----|
| `--font-sans` | Inter | Cuerpo, UI, labels, formularios |
| `--font-display` | Space Grotesk | Números grandes, KPIs, títulos hero |

> **Regla:** Nunca usar las fuentes del sistema (Arial, sans-serif) directamente. Siempre `font-sans` o `font-display`.

### 3.2 Escala Tipográfica Estándar

| Elemento | Clase Tailwind | Descripción |
|----------|---------------|-------------|
| **H1 — Título de Módulo** | `text-2xl font-black uppercase tracking-tight` | Cabecera principal de cada vista |
| **H2 — Título de Sección** | `text-lg font-black uppercase tracking-tight italic` | Subtítulos de secciones dentro de una vista |
| **H3 — Título de Card** | `text-base font-black uppercase tracking-tight` | Nombre del elemento dentro de una card |
| **Subtítulo de página** | `text-sm font-bold text-text-muted` | Info contextual en Sentence case (no uppercase) |
| **Label de campo** | `text-[10px] font-black uppercase tracking-widest opacity-60` | Labels de inputs y selectores |
| **Metadato / Elemento menor** | `text-[9px] font-black uppercase tracking-widest opacity-70` | Cédula, teléfono, entidad en cards |
| **Chip / Badge de rol** | `text-[8px] font-black uppercase tracking-widest` | Etiqueta de rol en card de personal |
| **Nota de pie** | `text-[9px] font-bold tracking-widest opacity-60 italic` | Avisos al pie de modales |

### 3.3 Pesos de Fuente

- `font-black` (900): Títulos, nombres propios, KPIs, CTA buttons.
- `font-bold` (700): Subtítulos, texto de apoyo, valores de metadato.
- `font-medium` (500): Texto de cuerpo en párrafos largos.
- **PROHIBIDO:** `font-light` — rompe la estética táctica.

---

## SECCIÓN 4 — SISTEMA DE ESPACIADO Y LAYOUT

### 4.1 Contenedor Principal de Página

```jsx
// ✅ CORRECTO — Aplicar siempre en el div raíz de cada página de gestión
<div className="p-4 md:p-6 space-y-6 pb-24 max-w-[1400px] mx-auto animate-in fade-in duration-500">
```

| Propiedad | Valor | Razón |
|-----------|-------|-------|
| Padding mobile | `p-4` (16px) | Espacio mínimo para pantallas pequeñas |
| Padding desktop | `md:p-6` (24px) | Mayor comodidad visual en escritorio |
| Ancho máximo | `max-w-[1400px]` | Evita que el contenido se estire en 4K |
| Padding inferior | `pb-24` (96px) | Espacio para el BottomNav en mobile |
| Espacio entre secciones | `space-y-6` (24px) | Consistente entre módulos |

### 4.2 Cabecera Táctica de Página (Patrón Estándar)

Este patrón es **obligatorio** para todas las páginas de gestión. Es el único patrón de cabecera permitido.

```jsx
<header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 
                   bg-bg-card/30 p-4 md:p-5 rounded-2xl border border-white/5">
  {/* Bloque Izquierdo: Identidad del módulo */}
  <div className="min-w-0">
    <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight">
      <div className="p-2 bg-primary/10 rounded-xl shrink-0">
        <IconoModulo className="text-primary" size={24} />
      </div>
      <span className="uppercase">NOMBRE DEL MÓDULO</span>
    </h1>
    <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1 font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
      Descripción contextual del módulo (Ej: Módulo de Concesiones)
    </p>
  </div>

  {/* Bloque Derecho: CTA Principal */}
  <Boton className="gap-2 h-11 px-6 w-full sm:w-auto shrink-0 
                    bg-primary text-bg-app font-black uppercase tracking-widest text-[11px]
                    rounded-xl shadow-tactica hover:scale-[1.02] active:scale-[0.98] transition-all">
    <Plus size={18} />
    <span>ACCIÓN PRINCIPAL</span>
  </Boton>
</header>
```

---

## SECCIÓN 5 — COMPONENTES DE CARD

### 5.1 Card de Lista Horizontal (Personal, Alcabalas, Operativos)

```
┌──────────────────────────────────────────────────────────────────┐
│ █ [AVATAR]  [ROL BADGE]                          [ACCIONES]     │
│             NOMBRE APELLIDO                                      │
│             # CÉDULA  🏢 ENTIDAD  📞 TELÉFONO                   │
└──────────────────────────────────────────────────────────────────┘
```

- `rounded-xl` (12px) para el borde de la card
- El nombre no se trunca, usa `whitespace-normal break-words`
- Layout: `space-y-4` — Lista vertical completa (Full width) en PC

### 5.2 Card de Recurso KPI

- `rounded-xl p-4 bg-bg-card/60 border border-white/5`
- Icono en `p-2.5 bg-primary/10 rounded-lg`
- Número en `text-2xl font-black font-display`

### 5.3 Ficha de Resultado QR (CRÍTICO)

**Sin truncado. Sin overflow hidden. Sin max-w fijo.**
- Marca + Modelo: `text-xl font-black whitespace-normal break-words`
- Placa: `text-3xl font-black text-primary` (máxima jerarquía visual)
- Botón Autorizar: `w-full h-14` (no se puede truncar su texto tampoco)

---

## SECCIÓN 6 — BOTONES

| Tipo | Alto | Padding | Texto | Radio | Uso |
|------|------|---------|-------|-------|-----|
| CTA Principal | `h-11` (44px) | `px-6` | `text-[11px] font-black uppercase tracking-widest` | `rounded-xl` | Cabecera de módulo |
| Acción Modal | `h-14` (56px) | `px-6` | `font-black uppercase tracking-[0.2em]` | `rounded-xl` | Submit de formularios |
| Secundario/Ghost | `h-11` (44px) | `px-4` | `text-[10px] font-black uppercase tracking-widest` | `rounded-xl` | Acciones secundarias |
| Icono Acción | `p-2` (32px) | — | — | `rounded-md` | Editar / Borrar en card |
| Radar/Scanner | `h-16` (64px) | — | `text-[8px] font-black uppercase` | `rounded-2xl` | Controles del escáner |

---

## SECCIÓN 7 — GRIDS RESPONSIVOS

| Uso | Grid | Detalle |
|-----|------|---------|
| Cards de lista (Personal, Operativos) | `flex flex-col space-y-4` | Lista vertical completa (Alargadas) |
| Cards de galería (Socios) | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` | Permite foto |
| KPIs / Métricas | `grid-cols-2 md:grid-cols-4` | Resumen numérico |
| Metadatos (Últimas acciones, historial) | `grid-cols-2` | Siempre dos columnas iguales |

---

## SECCIÓN 8 — MODO CLARO / OSCURO — LISTA DE VERIFICACIÓN

Antes de hacer merge de cualquier vista, verificar:

- [ ] ¿No hay `text-white` hardcoded? → usar `text-text-main`
- [ ] ¿No hay `bg-white`, `bg-black` hardcoded? → usar variables
- [ ] ¿Los borders usan `border-white/5`? → funciona en ambos modos
- [ ] ¿Las sombras usan `shadow-tactica`? → variable adaptativa
- [ ] ¿Los inputs tienen `bg-bg-card` y no `bg-gray-900`?
- [ ] ¿Los overlays del scanner usan `bg-bg-app` como base?
- [ ] ¿Probaste el switch de tema en la pantalla antes de hacer push?

---

## SECCIÓN 9 — SCROLLBAR TÁCTICO MODERNO

Para mantener la estética premium y evitar las barras grises genéricas del navegador, todo contenedor desplazable (especialmente modales y paneles laterales) debe usar el estilo de scrollbar táctico:

### 9.1 Configuración Visual (CSS Global)
- **Ancho/Alto:** `6px` (minimalista).
- **Track:** `rgba(255, 255, 255, 0.02)` (casi invisible).
- **Thumb (Barra):** `rgba(255, 255, 255, 0.1)` en reposo.
- **Hover Thumb:** `var(--primary)` (esmeralda táctico) al pasar el cursor.
- **Radio:** `10px` (bordes redondeados).

### 9.2 Implementación
El estilo se aplica globalmente en `index.css`. Si se requiere ocultar el scrollbar pero mantener el scroll funcional, usar la clase `.no-scrollbar`.

---

*Versión: 2.2 | Actualizada: 2026-04-18 | Autor: Antigravity*
