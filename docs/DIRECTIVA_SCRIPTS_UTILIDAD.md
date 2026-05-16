# DIRECTIVA-011: SCRIPTS DE UTILIDAD Y GENERACIÓN DE DATOS

## 1. PROPÓSITO
Esta directiva define los estándares para los scripts de utilidad del sistema BAGFM, específicamente para la generación de datos de prueba y herramientas de mantenimiento.

## 2. GENERACIÓN DE DATOS DE PRUEBA
Los scripts de generación de datos deben facilitar la creación de archivos Excel compatibles con las funciones de importación masiva del sistema.

### 2.1 Estándares de Codificación
- **Lenguaje**: Python 3.x.
- **Librerías**: `pandas`, `faker`, `openpyxl`.
- **Localización**: Usar `Faker('es_ES')` para nombres y formatos realistas.
- **Formato de Salida**: Archivos `.xlsx`.

### 2.2 Script de Socios Permanentes (`scripts/generar_datos_socios.py`)
Este script genera la plantilla para la subida masiva de socios permanentes.

**Columnas requeridas:**
1. `CEDULA`: Identificación (Ej: V12345678).
2. `NOMBRE`: Nombres del socio.
3. `APELLIDO`: Apellidos del socio.
4. `EMAIL`: Correo electrónico.
5. `TELEFONO`: Número de contacto.
6. `PLACA`: Identificador del vehículo.
7. `MARCA`: Marca del vehículo.
8. `MODELO`: Modelo del vehículo.
9. `COLOR`: Color del vehículo.

### 2.3 Script de Pases Temporales (`scripts/generar_datos_pases.py`)
Genera datos para pases masivos (v2.2). Soporta hasta 4 vehículos por registro.

## 3. PROCEDIMIENTO DE EJECUCIÓN
Los scripts deben ser ejecutables desde la raíz del proyecto pasando la cantidad de registros deseada como argumento:

```bash
python scripts/generar_datos_socios.py 50
```

## 4. MANTENIMIENTO
Cualquier cambio en los esquemas de base de datos que afecte la importación debe reflejarse inmediatamente en estos scripts.
