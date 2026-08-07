"""
Almacenamiento local de archivos — BAGFM

Reemplaza a Supabase Storage. Los archivos viven en un directorio del servidor
(config.storage_dir) y se sirven como estáticos bajo config.storage_url_prefix.

IMPORTANTE: config.storage_dir tiene que apuntar a un volumen persistente. Si apunta
al sistema de archivos del contenedor, cada despliegue borra los archivos con él.
"""
from pathlib import Path
from typing import Iterable

from app.core.config import obtener_config

config = obtener_config()


class AlmacenamientoLocal:
    def __init__(self) -> None:
        self.base = Path(config.storage_dir).resolve()
        self.base.mkdir(parents=True, exist_ok=True)

    def _ruta_segura(self, ruta_relativa: str) -> Path:
        """
        Resuelve una ruta relativa dentro del directorio base.

        Impide que un nombre con '..' o una ruta absoluta escriba o borre fuera del
        almacenamiento. Las rutas se arman con nombres de evento que vienen del
        usuario, así que esta comprobación no es teórica.
        """
        destino = (self.base / ruta_relativa.lstrip("/")).resolve()
        if not destino.is_relative_to(self.base):
            raise ValueError(f"Ruta fuera del almacenamiento: {ruta_relativa}")
        return destino

    def guardar(self, contenido: bytes, ruta_relativa: str) -> str:
        """Guarda el archivo y devuelve su URL pública."""
        destino = self._ruta_segura(ruta_relativa)
        destino.parent.mkdir(parents=True, exist_ok=True)

        # Escritura atómica: si el proceso muere a mitad de la escritura, no queda
        # un archivo truncado ocupando el lugar del bueno.
        temporal = destino.with_name(destino.name + ".tmp")
        temporal.write_bytes(contenido)
        temporal.replace(destino)

        return self.url_publica(ruta_relativa)

    def borrar(self, rutas_relativas: Iterable[str]) -> None:
        """Borra archivos. No falla si alguno no existe."""
        for ruta in rutas_relativas:
            try:
                self._ruta_segura(ruta).unlink(missing_ok=True)
            except (ValueError, OSError) as e:
                print(f"ALERTA STORAGE: no se pudo borrar {ruta}: {e}")

    def url_publica(self, ruta_relativa: str) -> str:
        prefijo = config.storage_url_prefix.rstrip("/")
        return f"{config.backend_url_base}{prefijo}/{ruta_relativa.lstrip('/')}"


almacenamiento = AlmacenamientoLocal()
