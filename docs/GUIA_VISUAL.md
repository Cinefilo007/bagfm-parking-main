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

El sistema utiliza variables CSS dinámicas que se alternan según el tema seleccionado.

### 2.1 Modo Oscuro (Aegis Tactical - Default)
*Jerarquía de profundidad para operaciones nocturnas.*

```css
Surface Lowest:    #090E1C   /* --bg-app */
Surface Dim:       #0E1322   /* Base */
Surface Low:       #161B2B   /* Layout Blocks */
Surface Container: #1A1F2F   /* Cards */
Text Main:         #DEE1F7   /* on_surface */
Text Sec:          #BBCABF   /* on_surface_var */
Primary:           #4EDEA3   /* Esmeralda Táctico */
```

### 2.2 Modo Claro (Tactical Light)
*Optimizado para visibilidad bajo luz solar directa.*

```css
Surface Lowest:    #F1F5F9   /* Slate 100 */
Surface Dim:       #F8FAFC   /* Slate 50 (App Base) */
Surface Low:       #F1F5F9   /* Slate 100 (Layout) */
Surface Container: #FFFFFF   /* Blanco Puro (Cards) */
Text Main:         #0F172A   /* Slate 900 */
Text Sec:          #475569   /* Slate 600 */
Primary:           #10B981   /* Esmeralda Oscuro (Contraste) */
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

/* 6.6.1 Estándar de KPIs Tácticos (v2.1) */
/* Todos los resúmenes de métricas deben seguir este patrón: */
.grid-stats-tactico {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 2x2 en móviles */
  gap: 12px;
}

@media (min-width: 1024px) {
  .grid-stats-tactico {
    grid-template-columns: repeat(4, 1fr); /* 4 columnas en desktop */
  }
}

.stat-item-tactico {
  padding: 16px;
  background: rgba(26, 31, 47, 0.40);    /* bg-card/40 */
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;                   /* radius-2xl */
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s ease;
}

.stat-item-tactico:hover {
  background: rgba(37, 41, 58, 0.80);    /* bg-high/80 */
  border-bottom: 2px solid var(--primary);
}

.stat-icon-container {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.40);
  border: 1px solid rgba(255, 255, 255, 0.05);
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
/* El sistema conmuta entre :root y .dark */
:root {
  --bg-app: #F8FAFC;
  --primary: #10B981;
  /* ... resto de variables claras */
}

.dark {
  --bg-app: #0E1322;
  --primary: #4EDEA3;
  /* ... resto de variables oscuras */
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

## 10. Estándares de Arquitectura de Vistas (Aegis v2)

Tras la estandarización del panel de mando, se establecen las siguientes reglas estructurales:

### 10.1 Cabecera de Mando (Sticky Header)
- **Estructura**: `LayoutDashboard` logic. Siempre `sticky top-0`, `z-[50]`, con `backdrop-blur-md` y fondo `bg-bg-app/40`.
- **Alineación**: Centrado en contenedor `max-w-7xl` (o 1400px).
- **Elementos**: Icono de sección, Título en `font-black uppercase tracking-tight italic`, beacons de estado pulsantes para indicar "Operativo".

### 10.2 Vista de Perfil / Expediente
- **Visual Impact**: Uso de `Header Visual` con gradientes `primary/30` a `secondary/10`.
- **Avatar**: Centrado o lateral-izquierdo, tamaño `w-32 h-32` (2xl), con bordes de alta fidelidad y badges de estado (`BadgeCheck`).
- **Data Grid**: Los datos se presentan en tarjetas de solo lectura con iconos de lucide a opacidad reducida (40%).
- **Acciones**: Botones de acción principal (Editar, Seguridad) deben ser prominentes, de altura `h-14` mínimo, con tipografía `font-black uppercase tracking-widest`.

### 10.3 Regla de Modales (Desplazamiento Compensado)
- **Centrado Universal**: Todo modal debe implementar la clase `lg:pl-72` en su contenedor raíz `fixed`.
- **Razón**: Compensar el ancho de la `Sidebar` fija para que el contenido del modal quede centrado visualmente respecto al área de trabajo y no respecto al borde del navegador.

---

## 11. Anatomía de Componentes Críticos (v2)

### 11.1 Boton.jsx (Estandarizado)
Los botones deben seguir este patrón de clases para mantener la autoridad visual:
- **Font**: `font-black uppercase tracking-widest text-[11px]`
- **Height**: `h-14` para acciones primarias, `h-12` para secundarias.
- **Iconografía**: Icono a la izquierda, espaciado `gap-3`. Usar `transition-transform` para efectos de rotación o escala en hover.
- **Focus/Hover**: Efectos de gradiente o inversión de color según la variante.

### 11.2 Inputs de Formulario (Tácticos)
- Altura estándar `h-12`.
- Border `white/10` por defecto, cambia a `primary` o `danger` según el contexto.
- Iconos de entrada siempre a la izquierda con `pl-12`.
- Tipografía `font-bold text-white text-sm`.

---

## 12. Glosario de Clases Tailwind BAGFM

| Propósito | Clase Tailwind |
|-----------|----------------|
| Fondo Aplicación | `bg-bg-app` (#0E1322) |
| Contenedor Bloque | `bg-bg-low` (#161B2B) |
| Tarjeta / Item | `bg-bg-high/20` |
| Texto Principal | `text-text-main` |
| Acento Sistema | `text-primary` (#4EDEA3) |
| Feedback Peligro | `text-danger` (#FFAB4B) |
| Blur Táctico | `backdrop-blur-xl` |
| Sombra Comando | `shadow-2xl shadow-primary/5` |

---

*Última actualización: 2026-04-12 | Autor: Antigravity*  
*Basado en la refactorización exitosa de los módulos de Comando y Perfil.*
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

## 11. Estándar de Cabeceras Tácticas (Aegis Tactical v2)

Para unificar la identidad del Mando Central, todas las vistas principales de gestión (Personal, Entidades, Alcabalas) deben seguir esta estructura exacta.

### 11.1 Anatomía del Header
```jsx
<header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-bg-card/30 p-4 rounded-3xl border border-white/5">
  <div className="min-w-0">
    <h1 className="text-2xl font-black text-text-main flex items-center gap-3 tracking-tight">
      <div className="p-2 bg-primary/10 rounded-xl">
          <IconTáctico className="text-primary shrink-0" size={24} />
      </div>
      <span className="truncate">Título de la Operación</span>
    </h1>
    <p className="text-text-muted text-sm mt-1 flex items-center gap-1.5 px-1">
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
      Subtítulo Contextual / Estado del Protocolo
    </p>
  </div>
  <Boton size="lg" className="...">
    Acción Principal de la Vista
  </Boton>
</header>
```

### 11.2 Reglas de Layout Superior
- **Contenedor Maestro**: Todas las páginas de gestión deben estar envueltas en un `max-w-[1400px] mx-auto` para optimizar la visualización en estaciones de trabajo PC.
- **Acción Principal**: El botón de creación (ej. "Añadir Personal", "Nueva Alcabala") **DEBE** ir en la cabecera, alineado a la derecha en PC y expandido en Mobile.
- **Iconografía**: Los iconos de cabecera deben usar el color `primary` y estar contenidos en un background `primary/10` con border-radius `xl`.

---

## 12. Alineación de Componentes de Datos

### 12.1 Botones de Acción Inline
En campos que muestran datos sensibles (como claves tácticas o contraseñas), el botón de regeneración o reinicio debe estar **nivelado horizontalmente con el contenedor del dato**, no con el label superior.

- **Estructura Recomendada**:
  - Label superior (pequeño, tracking ancho).
  - Flex container que agrupa el `Input/DataContainer` y el `Boton`.
  - Ambos elementos deben tener la misma altura visual o estar centrados entre sí.

---


*Última actualización: 2026-03-30*  
*Fuente: Google Stitch — Proyecto BAGFM `4512440937494164528`*  
*Ver: DIRECTIVA_MAESTRA.md para contexto del sistema completo*
