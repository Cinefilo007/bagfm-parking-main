import uuid
from typing import List
from fastapi import UploadFile
from supabase import create_client, Client
from app.core.config import obtener_config

config = obtener_config()

class StorageService:
    def __init__(self):
        self.supabase: Client = create_client(config.supabase_url, config.supabase_service_key)
        self.bucket_name = "infracciones-evidencia"

    async def subir_evidencia(self, file: UploadFile, folder: str = "general") -> str:
        """
        Sube un archivo a Supabase Storage y retorna la URL pública.
        """
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        file_path = f"{folder}/{uuid.uuid4()}.{file_extension}"
        
        # Leer contenido del archivo
        content = await file.read()
        
        # Subir a Supabase
        # Resumen: storage.from_(bucket).upload(path, file, file_options)
        self.supabase.storage.from_(self.bucket_name).upload(
            path=file_path,
            file=content,
            file_options={"content-type": file.content_type}
        )
        
        # Obtener URL pública (asumiendo que el bucket es público)
        return self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)

    async def subir_multiples_evidencias(self, files: List[UploadFile], folder: str = "infracciones") -> List[str]:
        """
        Sube varios archivos y retorna lista de URLs.
        """
        urls = []
        for file in files:
            if file:
                url = await self.subir_evidencia(file, folder)
                urls.append(url)
        return urls

storage_service = StorageService()
