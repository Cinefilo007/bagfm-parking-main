"""
Almacenamiento local de archivos — BAGFM

Reemplaza a Supabase Storage. Hay dos almacenamientos separados:

- `almacenamiento` (config.storage_dir): archivos PÚBLICOS, servidos como estáticos
  bajo config.storage_url_prefix. Aquí van los ZIP y PDF de pases masivos.

- `almacenamiento_privado` (config.storage_private_dir): archivos que NO se sirven
  como estáticos y solo se entregan a través de endpoints que validan permisos.
  Aquí van las fotos de evidencia de combustible.

IMPORTANTE: ambos directorios tienen que apuntar a volúmenes persistentes. Si apuntan
al sistema de archivos del contenedor, cada despliegue borra los archivos con él.
"""
import base64
import binascii
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

from app.core.config import obtener_config

config = obtener_config()

# Marca que distingue una ruta de archivo de una imagen guardada en base64.
# Sin ella no se pueden diferenciar: el alfabeto base64 incluye '/', así que una
# cadena base64 puede parecerse a una ruta.
PREFIJO_ARCHIVO = "file:"

_EXTENSION_POR_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/gif": "gif",
}

_MIME_POR_EXTENSION = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
    "gif": "image/gif",
}


class AlmacenamientoLocal:
    def __init__(self, directorio_base: str, prefijo_url: Optional[str] = None) -> None:
        self.base = Path(directorio_base).resolve()
        self.prefijo_url = prefijo_url
        self.base.mkdir(parents=True, exist_ok=True)

    def _ruta_segura(self, ruta_relativa: str) -> Path:
        """
        Resuelve una ruta relativa dentro del directorio base.

        Impide que un nombre con '..' o una ruta absoluta lea, escriba o borre fuera
        del almacenamiento. Las rutas se arman con datos que vienen del usuario
        (nombres de evento, nombres de archivo), así que la comprobación no es teórica.
        """
        destino = (self.base / ruta_relativa.lstrip("/")).resolve()
        if not destino.is_relative_to(self.base):
            raise ValueError(f"Ruta fuera del almacenamiento: {ruta_relativa}")
        return destino

    def guardar(self, contenido: bytes, ruta_relativa: str) -> str:
        """Guarda el archivo. Devuelve la URL pública si el almacenamiento la tiene."""
        destino = self._ruta_segura(ruta_relativa)
        destino.parent.mkdir(parents=True, exist_ok=True)

        # Escritura atómica: si el proceso muere a mitad de la escritura, no queda
        # un archivo truncado ocupando el lugar del bueno.
        temporal = destino.with_name(destino.name + ".tmp")
        temporal.write_bytes(contenido)
        temporal.replace(destino)

        return self.url_publica(ruta_relativa) if self.prefijo_url else ruta_relativa

    def leer(self, ruta_relativa: str) -> bytes:
        return self._ruta_segura(ruta_relativa).read_bytes()

    def existe(self, ruta_relativa: str) -> bool:
        try:
            return self._ruta_segura(ruta_relativa).is_file()
        except ValueError:
            return False

    def borrar(self, rutas_relativas: Iterable[str]) -> None:
        """Borra archivos. No falla si alguno no existe."""
        for ruta in rutas_relativas:
            try:
                self._ruta_segura(ruta).unlink(missing_ok=True)
            except (ValueError, OSError) as e:
                print(f"ALERTA STORAGE: no se pudo borrar {ruta}: {e}")

    def url_publica(self, ruta_relativa: str) -> str:
        if not self.prefijo_url:
            raise ValueError("Este almacenamiento no expone URLs públicas")
        return f"{config.backend_url_base}{self.prefijo_url.rstrip('/')}/{ruta_relativa.lstrip('/')}"


almacenamiento = AlmacenamientoLocal(config.storage_dir, config.storage_url_prefix)
almacenamiento_privado = AlmacenamientoLocal(config.storage_private_dir)


# --------------------------------------------------------------------------------
# Imágenes recibidas en base64
# --------------------------------------------------------------------------------

_SOLO_BASE64 = re.compile(r"^[A-Za-z0-9+/=\s]+$")


def _decodificar(valor: str) -> Optional[tuple[bytes, str]]:
    """
    Devuelve (bytes, extensión) si el valor es una imagen en base64, o None si no lo es.

    Acepta tanto Data URI (`data:image/jpeg;base64,...`) como base64 puro, que son
    los dos formatos que la app viene guardando.
    """
    if not valor:
        return None

    if valor.startswith("data:"):
        try:
            cabecera, datos = valor.split(",", 1)
        except ValueError:
            return None
        mime = cabecera.split(";")[0].replace("data:", "").strip().lower()
        extension = _EXTENSION_POR_MIME.get(mime, "jpg")
    else:
        # Base64 puro: exigir tamaño y alfabeto para no confundirlo con una ruta
        # o con un marcador como 'placeholder_excepcional'.
        if len(valor) < 500 or not _SOLO_BASE64.match(valor):
            return None
        datos, extension = valor, "jpg"

    try:
        contenido = base64.b64decode(datos, validate=False)
    except (binascii.Error, ValueError):
        return None

    return (contenido, extension) if contenido else None


def guardar_imagen_base64(valor: Optional[str], carpeta: str) -> str:
    """
    Convierte una imagen en base64 en un archivo del almacenamiento privado y devuelve
    la referencia a guardar en la base ('file:<ruta>').

    Si el valor no es una imagen en base64 —está vacío, ya es una referencia a archivo,
    o es un marcador como 'placeholder_excepcional'— se devuelve intacto. Eso hace que
    la función sea segura de aplicar sobre datos ya migrados.
    """
    if not valor or valor.startswith(PREFIJO_ARCHIVO):
        return valor or ""

    decodificado = _decodificar(valor)
    if decodificado is None:
        return valor

    contenido, extension = decodificado
    ahora = datetime.now(timezone.utc)
    ruta = f"{carpeta}/{ahora:%Y/%m}/{uuid.uuid4()}.{extension}"
    almacenamiento_privado.guardar(contenido, ruta)
    return f"{PREFIJO_ARCHIVO}{ruta}"


def leer_imagen(valor: Optional[str]) -> Optional[bytes]:
    """
    Devuelve los bytes de una imagen, venga como referencia a archivo o como base64.

    Mantener los dos caminos es lo que permite migrar sin ventana de mantenimiento:
    los registros viejos siguen sirviéndose mientras se convierten.
    """
    if not valor:
        return None

    if valor.startswith(PREFIJO_ARCHIVO):
        ruta = valor[len(PREFIJO_ARCHIVO):]
        try:
            return almacenamiento_privado.leer(ruta)
        except (OSError, ValueError) as e:
            print(f"ALERTA STORAGE: no se pudo leer {ruta}: {e}")
            return None

    decodificado = _decodificar(valor)
    return decodificado[0] if decodificado else None


def leer_imagen_data_uri(valor: Optional[str]) -> Optional[str]:
    """
    Devuelve la imagen como Data URI, esté guardada como archivo o como base64.

    Es para los endpoints que entregan la foto embebida en el JSON: el frontend pone
    ese valor directamente en un <img src>, y una referencia 'file:...' no le sirve.
    Con esto el contrato de la API no cambia al migrar el almacenamiento.
    """
    if not valor or not valor.startswith(PREFIJO_ARCHIVO):
        # Vacío, marcador, o ya es un Data URI / base64: se devuelve intacto.
        return valor

    contenido = leer_imagen(valor)
    if not contenido:
        return ""

    extension = valor.rsplit(".", 1)[-1].lower() if "." in valor else "jpg"
    mime = _MIME_POR_EXTENSION.get(extension, "image/jpeg")
    return f"data:{mime};base64,{base64.b64encode(contenido).decode('ascii')}"


def borrar_imagenes(valores: Iterable[Optional[str]]) -> None:
    """Borra del disco las imágenes que sean referencias a archivo. Ignora las base64."""
    rutas = [
        v[len(PREFIJO_ARCHIVO):]
        for v in valores
        if v and v.startswith(PREFIJO_ARCHIVO)
    ]
    if rutas:
        almacenamiento_privado.borrar(rutas)
