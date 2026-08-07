import uuid
from typing import List
from fastapi import UploadFile

from app.services.storage_local import almacenamiento


class StorageService:
    """
    Evidencia de infracciones. Antes iba al bucket 'infracciones-evidencia' de
    Supabase Storage; ahora se guarda en el volumen del servidor.
    """

    def __init__(self):
        self.carpeta_raiz = "infracciones-evidencia"

    async def subir_evidencia(self, file: UploadFile, folder: str = "general") -> str:
        """
        Guarda un archivo y retorna la URL pública.
        """
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        # El nombre lo genera el servidor: el nombre original del archivo llega del
        # cliente y no se usa para construir la ruta.
        file_path = f"{self.carpeta_raiz}/{folder}/{uuid.uuid4()}.{file_extension}"

        content = await file.read()
        return almacenamiento.guardar(content, file_path)

    async def subir_multiples_evidencias(self, files: List[UploadFile], folder: str = "infracciones") -> List[str]:
        """
        Guarda varios archivos y retorna la lista de URLs.
        """
        urls = []
        for file in files:
            if file:
                url = await self.subir_evidencia(file, folder)
                urls.append(url)
        return urls


storage_service = StorageService()
