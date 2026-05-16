# DIRECTIVA: DASHBOARD ADMIN ENTIDAD
## Sistema BAGFM — Aegis Tactical v2.5

---

## 1. Objetivo

Proveer al **Admin de Entidad** un panel de control táctico operativo en tiempo real que consolide:
- KPIs de capacidad total y uso
- Historial de flujo vehicular completo (alcabala → zona → salida)
- Capacidad en tiempo real por zona asignada
- Alertas de vehículos en tránsito retrasados (perdidos)
- Rendimiento diario de parqueros

---

## 2. Arquitectura

### Backend: Endpoint Consolidado
- **Ruta**: `GET /api/v1/entidades/me/dashboard`
- **Archivo**: `backend/app/api/v1/entidades.py`
- **Rol requerido**: `ADMIN_ENTIDAD`
- **Polling recomendado**: 15 segundos

### Frontend: Componente Principal
- **Archivo**: `frontend/src/pages/entidad/Dashboard.jsx`
- **Patrón**: Polling cada 15s con indicador de sincronización no intrusivo
- **Estilo**: Estandarizado al Design System Aegis Tactical (= Dashboard Comandante)

---

## 3. Estructura de Respuesta del Endpoint

```json
{
  "kpis": {
    "capacidad_total": 100,
    "vehiculos_activos": 45,
    "libres_total": 55,
    "uso_pct": 45,
    "total_socios": 120,
    "total_perdidos": 2,
    "total_parqueros": 4
  },
  "zonas": [
    {
      "zona_id": "uuid",
      "zona_nombre": "Zona VIP Norte",
      "cupo_asignado": 50,
      "ocupados": 23,
      "libres": 27,
      "uso_pct": 46,
      "parqueros": [{"nombre": "JUAN PEREZ", "id": "uuid"}]
    }
  ],
  "historial": [
    {
      "id": "uuid",
      "tipo": "entrada|salida",
      "tipo_evento": "alcabala|ingreso_zona|salida_zona",
      "timestamp": "ISO8601",
      "placa": "ABC123",
      "marca": "TOYOTA",
      "modelo": "HILUX",
      "portador": "NOMBRE APELLIDO",
      "punto_acceso": "Alcabala Principal",
      "es_manual": false,
      "zona_id": "uuid"
    }
  ],
  "vehiculos_perdidos": [
    {
      "placa": "XYZ789",
      "marca": "FORD",
      "modelo": "RANGER",
      "portador": "NOMBRE",
      "telefono": "+584141234567",
      "hora_alcabala": "ISO8601",
      "minutos_transcurridos": 25,
      "tiempo_limite": 15,
      "zona_id": "uuid"
    }
  ],
  "parqueros": [
    {
      "id": "uuid",
      "nombre": "ANTONIO PERDONO",
      "zona_id": "uuid",
      "ops_hoy": 12,
      "activo": true
    }
  ]
}
```

---

## 4. Lógica del Historial de Flujo

El historial combina dos fuentes de datos:

### 4.1 Tabla `accesos` (Eventos de Alcabala)
- Filtro: `Acceso.zona_id IN [zonas_de_entidad]`
- Tipo evento: `alcabala`
- Captura: entrada a la base por alcabala con destino a zona de la entidad

### 4.2 Tabla `vehiculos_pase` (Eventos de Zona)
- Filtro: `VehiculoPase.zona_asignada_id IN [zonas_de_entidad]`
- Tipos evento: `ingreso_zona` (hora_ingreso) y `salida_zona` (hora_salida)
- Captura: llegada y salida física del vehículo en el estacionamiento

### 4.3 Orden Cronológico
Ambas listas se combinan, ordenan por `timestamp DESC` y se limitan a 50 eventos.

---

## 5. Lógica de Vehículos Perdidos

Un vehículo está "perdido" si cumple TODAS estas condiciones:
1. Registró entrada por alcabala con `CodigoQR.zona_asignada_id` de la entidad
2. El acceso ocurrió en las últimas 12 horas
3. **NO** existe `VehiculoPase` con `hora_ingreso >= timestamp_acceso` para ese QR y zona
4. **NO** existe `Acceso` de salida posterior al acceso de entrada
5. Han transcurrido más minutos que `zona.tiempo_limite_llegada_min` (default: 15)

---

## 6. KPIs de Parqueros

- **ops_hoy**: Cuenta de `VehiculoPase` con `hora_ingreso >= inicio_del_día` en la zona del parquero
- Limitado a parqueros activos asignados a zonas de la entidad

---

## 7. Estilo Visual

El dashboard sigue el Design System Aegis Tactical idéntico al Dashboard del Comandante:

### KPIs Fila 1 (Estilo Comandante)
- 4 tarjetas con número grande, ícono y etiqueta
- Colors: `text-primary/70` normal, `text-warning` alerta, `text-danger` crítico

### KPIs Fila 2 (Estilo Mini-Cards)
- Libres, Uso%, Socios, Zonas
- Grid 4 columnas con colores semánticos

### Historial de Flujo (Columna 7/12)
- Scroll infinito de 50 eventos
- 4 tipos: ALCABALA (verde), EGRESO (amarillo), ZONA↓ (verde claro), ZONA↑ (azul)
- Barra lateral de color por tipo de evento

### Capacidad por Zona (Columna 5/12)
- Cards apilables por zona
- Barra de progreso con colores: verde < 60%, amarillo 60-85%, rojo > 85%
- KPIs de cupo, ocupados y libres
- Chips de parqueros asignados

### Vehículos Perdidos
- Solo visible si `total_perdidos > 0`
- Cards en grilla con indicador de minutos transcurridos
- Link clickeable a teléfono del portador

### Rendimiento de Parqueros
- Cards con inicial de nombre y ops del día
- Verde si ops > 0, gris si sin actividad

---

## 8. Polling y Sincronización

- **Intervalo**: 15 segundos (configurable)
- **Indicador de estado**: Badge LIVE/SYNC/ERROR en el header
- **Botón de refresco manual**: Ícono RefreshCw en el header
- **Sincronización silenciosa**: No bloquea la UI durante el polling

---

## 9. Historial de Cambios

| Versión | Fecha | Cambio |
|---------|-------|--------|
| v2.5 | 2026-05-11 | Dashboard Entidad: implementación completa con endpoint consolidado, historial de flujo, vehículos perdidos y rendimiento de parqueros |
