import logging
import json
import base64
import os
import google.generativeai as genai
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class AIVisionService:
    def __init__(self):
        # Configurar Gemini usando la variable de entorno
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            # Usar modelo vision, como gemini-1.5-flash
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            logger.warning("GEMINI_API_KEY no está configurada. El servicio de IA Vision fallará graciosamente.")
            self.model = None

    async def analizar_evidencias_vehiculo(self, files_data: List[bytes], mime_types: List[str]) -> Dict[str, Optional[str]]:
        """
        Analiza múltiples imágenes usando Gemini para extraer información del vehículo.
        Retorna: {"placa": str, "marca": str, "modelo": str} o None en caso de fallo.
        """
        if not self.model:
            return {"placa": None, "marca": None, "modelo": None, "error": "AI no configurada"}

        if not files_data:
            return {"placa": None, "marca": None, "modelo": None, "error": "No hay imágenes"}

        try:
            # Preparar partes de imagen para Gemini
            image_parts = []
            for file_data, mime_type in zip(files_data, mime_types):
                image_parts.append({
                    "mime_type": mime_type,
                    "data": file_data
                })

            prompt = """
            Analiza cuidadosamente la(s) siguiente(s) imagen(es) de un vehículo y extrae la siguiente información:
            1.  **placa**: El número de la matrícula (placa) del vehículo. Ignora guiones o espacios (ej. "ABC123D"). Si no es visible, devuelve null.
            2.  **marca**: La marca del vehículo (ej. Toyota, Chevrolet, Ford). Si no es identificable, devuelve null.
            3.  **modelo**: El modelo del vehículo (ej. Corolla, Aveo, Explorer). Si no es identificable, devuelve null.

            Responde ÚNICAMENTE en formato JSON estricto con las claves "placa", "marca", y "modelo". No incluyas texto adicional ni bloques de código (```json).
            """

            # La llamada a generate_content en genai puede no ser async por defecto, pero fastapi soporta def o threadpool
            response = self.model.generate_content([prompt, *image_parts])
            
            # Limpiar posible markdown del JSON devuelto por Gemini
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
                
            data = json.loads(text.strip())
            
            return {
                "placa": data.get("placa"),
                "marca": data.get("marca"),
                "modelo": data.get("modelo")
            }
            
        except Exception as e:
            logger.error(f"Error en AIVisionService.analizar_evidencias_vehiculo: {str(e)}")
            return {"placa": None, "marca": None, "modelo": None, "error": str(e)}

ai_vision_service = AIVisionService()
