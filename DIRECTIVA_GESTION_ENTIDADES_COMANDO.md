# DIRECTIVA: GESTIÓN DE ENTIDADES POR COMANDO
## Sistema BAGFM — Aegis Tactical

---

## 1. Objetivo

Proveer al **Comandante** y **Admin Base** la capacidad de administrar el ciclo de vida de las Entidades Civiles (concesiones) alojadas en la base.

---

## 2. Funcionalidades Principales

### 2.1 Creación de Entidad
- **Modal de Creación**: Permite registrar el Nombre de la Entidad y los datos del Administrador de Entidad asociado.
- **Flujo Backend**: Crea la `EntidadCivil` y un `Usuario` con rol `ADMIN_ENTIDAD` ligado a esta.
- **Endpoint**: `POST /api/v1/entidades` (utiliza `EntidadCivilCrear`)

### 2.2 Edición de Datos
- **Botón de Edición**: Ícono de lápiz en cada tarjeta de entidad.
- **Modal de Edición**: Permite modificar el nombre de la entidad de forma segura, así como los datos personales de su respectivo Administrador (Nombre, Apellido, Cédula, Email).
- **Endpoint**: `PUT /api/v1/entidades/{id}` (utiliza `EntidadCivilActualizar`)
- **Mejora**: Se separó el schema de creación (`EntidadCivilCrear`) del de actualización (`EntidadCivilActualizar`) para evitar requerir los datos del administrador original en cada actualización de la entidad.

### 2.3 Suspensión Temporal
- **Botón Toggle**: Alterna el estado `activo` de la entidad.
- **Endpoint**: `POST /api/v1/entidades/{id}/toggle`
- **Impacto**: Si la entidad es suspendida, los motores de acceso verificarán esto e impedirán ingresos hacia dicha entidad.

### 2.4 Baja Definitiva (Purga)
- **Acción Irreversible**: Borrado en cascada profunda.
- **Alcance**: Elimina en cascada Accesos, Códigos QR, Membresías, Eventos, Vehículos, Usuarios y finalmente la EntidadCivil.
- **Endpoint**: `DELETE /api/v1/entidades/{id}`

---

## 3. Consideraciones Técnicas

- La creación y actualización usan Pydantic Schemas diferentes (`EntidadCivilCrear` y `EntidadCivilActualizar`).
- La edición en el frontend re-utiliza componentes estandarizados (`Input`, `Modal`, `Boton`).
- La actualización en base de datos (`entidad_service.actualizar`) utiliza `exclude_unset=True` para parchear solo los campos enviados.

## 4. Historial de Cambios

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2026-05-12 | v2.6 | Se agregó la edición de Entidades desde el Dashboard de Comando y se corrigió el schema PUT en el backend. |
