# DIRECTIVA-012: PORTAL DE PASES TEMPORALES Y AUTOREGISTRO

## 1. PROPÓSITO
Esta directiva establece los estándares para la visualización y descarga de credenciales digitales en el portal público de BAGFM, asegurando la integridad del token JWT y la calidad de la imagen para su validación en alcabalas.

## 2. FLUJO DE AUTOREGISTRO (SOP)
1. **Acceso**: El usuario ingresa mediante un enlace único (token de portal).
2. **Identificación**: Si el pase no tiene datos, el sistema solicita:
   - Nombre Completo (Upper case automático).
   - Cédula de Identidad.
   - Datos del Vehículo (Placa, Marca, Modelo, Color).
3. **Generación**: Al guardar, el backend actualiza el registro en `codigos_qr` y marca `datos_completos = True`.
4. **Visualización**: El portal muestra el carnet táctico con el QR generado a partir del JWT.

## 3. ESTÁNDARES DE VISUALIZACIÓN QR
- **Componente**: Se utiliza `react-qr-code`.
- **Contenido**: Únicamente el token JWT firmado (máxima seguridad).
- **Dimensiones**: Mínimo 220px para asegurar escaneo rápido.
- **Contraste**: QR negro sobre fondo blanco puro, rodeado de un contenedor con bordes redondeados tácticos.

## 4. PROTOCOLO DE DESCARGA
- **Formato**: Imagen PNG.
- **Lógica**: Uso de `html-to-image` para capturar el contenedor `id="carnet-digital"`.
- **Calidad**: Se debe asegurar que la captura incluya el branding de BAGFM y los detalles del titular para validación visual complementaria.

## 5. SEGURIDAD
- Los tokens tienen fecha de expiración (`lote.fecha_fin + 24h`).
- El portal no permite la edición de datos una vez que han sido registrados, para evitar suplantaciones post-generación.
