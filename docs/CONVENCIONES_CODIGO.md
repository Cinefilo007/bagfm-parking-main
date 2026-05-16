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
