/**
 * Compone y comprime una imagen seleccionada o capturada mediante HTML5 Canvas.
 * Reduce las dimensiones máximas a 800px manteniendo la relación de aspecto
 * y aplica compresión JPEG al 65% para optimizar peso en almacenamiento.
 *
 * @param {File|Blob} file - Archivo de imagen original.
 * @param {Object} options - Opciones de compresión.
 * @param {number} options.maxWidth - Ancho máximo permitido (por defecto 800).
 * @param {number} options.maxHeight - Alto máximo permitido (por defecto 800).
 * @param {number} options.quality - Calidad de compresión JPEG (0.1 - 1.0, por defecto 0.65).
 * @returns {Promise<File>} Archivo comprimido como File object de tipo image/jpeg.
 */
export async function compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.65 } = {}) {
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular nuevas dimensiones conservando la relación de aspecto
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
              resolve(file); // Fallback al archivo original si falla la conversión
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}
