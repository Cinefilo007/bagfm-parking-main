# DIRECTIVA — ESTACIONAMIENTOS Y SU DISTRIBUCIÓN TÁCTICA (BAGFM v2.0)

Este documento define el estándar operativo para el control de módulos de estacionamiento desde la perspectiva del `ADMIN_ENTIDAD`, su integración forzosa con el despliegue de **Pases Masivos** y el flujo de los cupos tácticos dentro de la Base Aérea Generalísimo Francisco de Miranda.

---

## 1. Visión General del Estacionamiento

El control de los estacionamientos es el **núcleo rector** de la distribución de usuarios e invitados. Ninguna entidad puede generar accesos masivos y distribuir invitaciones sin antes consolidar y confirmar cómo manejará el espacio físico (estacionamiento) que el Comandante de la base le ha asignado tácticamente.

### Entidades y la Asignación Inicial
Todo inicia cuando el `COMANDANTE` o `ADMIN_BASE` otorga espacios físicos mediante una _Asignación de Zona_ a una Entidad. 
**Tabla implicada**: `asignaciones_zona`
- **cupo_asignado**: El número total de puestos (autos) que la Entidad Civil puede manejar en la zona X.
- **cupo_reservado_base**: De ese cupo asignado, N puestos han sido "embargados" u "ocupados preventivamente" por decisión del comando para propósitos de la base militar.

**Ejemplo Práctico:**
  A "Producciones Acme" se le asignan 100 puestos operativos en Zona Sur.
  El Comandante reservó de facto 10 puestos para inspectores de la base.
  _Capacidad Utilizable por la Entidad_ = 90 puestos.

---

## 2. Abstracción y Personalización por la Entidad

El administrador de la entidad (`ADMIN_ENTIDAD`), a través del módulo **Estacionamientos**, debe categorizar qué uso dará a sus cupos utilizables.

Existen 2 modelos de abordaje que el administrador puede seleccionar o combinar:

### Modelo A: Cuotas Lógicas (Cantidades Simples)
La entidad decide no mapear individualmente el piso, y simplemente subdivide su cuota utilizable en "Lotes Numéricos" para Tipos de Acceso:
- Producción: 15 cupos.
- VIP: 20 cupos.
- General: 55 cupos (el resto que sobra).

### Modelo B: Generación Físico-Virtual de Puestos Identificados
Si el despliegue lo amerita (ej. VIP con puesto resguardado e intransferible), el Admin de la entidad oprime **"Generar Puestos para esta Zona"**.
1. El sistema crea N registros en la tabla `puestos_estacionamiento` (ej: SUR-01, SUR-02, ... SUR-90) etiquetados como pertenecientes a esta Entidad.
2. El Admin puede entrar a SUR-01, SUR-02, ... SUR-15 y asignarlos ("reservarlos") explícitamente para el `TipoAccesoPase: VIP`.

_Cualquier cupo sobrante que no ha sido reservado para VIP, Proveedores o Staff caerá automáticamente y por defecto bajo dominio del "Público General"._

---

## 3. Barrera de Seguridad Transaccional (Pases Masivos)

Para forzar la optimización del espacio, el sistema de **Pases Masivos** depende restrictivamente del módulo de **Estacionamientos**.

### 3.1 Alerta de Desempeño
Si el `ADMIN_ENTIDAD` intenta navegar a `Pases Masivos` sin haber verificado o guardado una configuración base en la vista de `Estacionamientos` (incluso si decide usar el "Modelo A: Simulaciones Numéricas de Puestos Generales"), el sistema levantará un modal bloqueante que indicará que no puede generar pases hasta no planificar su espacio físico.

### 3.2 Restricción Lógica de Emisión
En la vista de `Pases Masivos` -> Modal "Crear Lote", cuando el usuario escoge un `Tipo de Acceso` (Ejemplo: `VIP`), el backend debe computar en tiempo real:
**MAX_PERMITIDO** = `CUPOS RESERVADOS PARA 'VIP'` - `PASES 'VIP' YA EMITIDOS (y no revocados)`.

Si el Admin intenta generar un lote de 21 Pases VIP cuando su cuota para VIP es 20, el sistema rechaza la transacción y lanza validación roja.

---

## 4. Archivos Maestros (Subida y Validación de Excels VIP)

Para pases de **Tipo B - Identificados** y **Tipo C - Portales Específicos**, muchas veces se utiliza una plantilla `.xlsx`.

### 4.1 Excel vs Cupo Asignado
1. En el Modal de Pases Masivos, al seleccionar cargar archivo, el usuario primero declara: "¿Cuántos pases vas a hacer de este grupo?". Responde: **15**.
2. Al descargar la plantilla, la entidad la rellena.
3. Al arrastrarla y subirla al componente, el sistema verifica inmediatamente el conteo de filas útiles en el archivo Excel.
4. Si `Filas_Excel != 15` (está vacía, trae 14 o trae 16), el sistema bloquea, rechaza el archivo y demanda corrección estricta antes de crear el `LotePaseMasivo`.

### 4.2 Proceso
- Recomendación Activa: La ingesta del Excel debe leerse de manera preliminar en Frontend (mediante librerías como `xlsx` de SheetJS) para emitir retroalimentación veloz UX/UI antes de enviar los binarios al backend para su almacenamiento e integración.

---

## 5. Menú de Navegación del Administrador

Regla estricta de ordenamiento y nomenclaturas del `ADMIN_ENTIDAD`:
1. **Panel Control** (`/entidad/dashboard`)
2. **Estacionamientos** (`/entidad/estacionamientos`)
3. **Pases Masivos** (`/entidad/pases-masivos` *— Antes Mis Eventos*)
4. **Socios Permanentes** (`/entidad/socios` *— Antes Gestión Socios*)
5. **Personal Interno** (`/entidad/personal` *— Antes Gestión Personal*)
6. **Editor de carnets** (`/entidad/carnets`) 
