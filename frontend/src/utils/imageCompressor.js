/**
 * Compone y comprime una imagen seleccionada o capturada mediante HTML5 Canvas.
 * Reduce las dimensiones máximas a 800px manteniendo la relación de aspecto
 * y aplica compresión JPEG al 65% para optimizar peso en almacenamiento.
 * Totalmente compatible con dispositivos móviles (Android/iOS Safari) y capturas directas de cámara.
 *
 * @param {File|Blob} file - Archivo de imagen original.
 * @param {Object} options - Opciones de compresión.
 * @param {number} options.maxWidth - Ancho máximo permitido (por defecto 800).
 * @param {number} options.maxHeight - Alto máximo permitido (por defecto 800).
 * @param {number} options.quality - Calidad de compresión JPEG (0.1 - 1.0, por defecto 0.65).
 * @returns {Promise<File>} Archivo comprimido como File object de tipo image/jpeg.
 */
export async function compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.65 } = {}) {
  if (!file) return file;

  // En dispositivos móviles (cámara nativa), file.type puede venir vacío "" o "application/octet-stream"
  const mimeType = file.type || '';
  const isImage = mimeType.startsWith('image/') || mimeType === '' || mimeType === 'application/octet-stream';

  if (!isImage) {
    return file;
  }

  // Prevenir crash si file.name es undefined en WebViews/Cámaras móviles
  const rawName = file.name || 'foto_capturada.jpg';
  const fileName = rawName.replace(/\.[^/.]+$/, "") + ".jpg";

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Calcular nuevas dimensiones conservando relación de aspecto
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const compressedFile = new File([blob], fileName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          console.warn("[compressImage] Error en canvas, usando archivo original:", e);
          resolve(file);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}
