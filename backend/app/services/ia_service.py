import json
import base64
import google.generativeai as genai
from typing import Dict, Any, Optional
from app.core.config import obtener_config

config = obtener_config()

class IAService:
    def __init__(self):
        # La API Key debe estar en config.gemini_api_key
        genai.configure(api_key=config.gemini_api_key)
        # Usamos la versión 2.5 Flash solicitada para máxima precisión táctica
        self.model = genai.GenerativeModel('gemini-2.5-flash')

    async def refinar_mensaje_correo(self, contexto: str, mensaje_actual: str) -> str:
        """
        Refina profesionalmente el cuerpo de un correo usando Gemini 2.0 Flash.
        """
        try:
            prompt = (
                f"Eres un experto en comunicación institucional y seguridad táctica para la base BAGFM. "
                f"El contexto es: {contexto}. "
                f"El mensaje actual es: '{mensaje_actual}'. "
                f"REQUERIMIENTOS: "
                f"1. Hazlo sonar profesional, respetuoso y ejecutivo. "
                f"2. Mantén obligatoriamente las variables '{{{{nombre}}}}' y '{{{{qr_url}}}}' sin modificarlas. "
                f"3. No incluyas variables internas como número de lote. "
                f"4. El tono debe ser de servicio institucional. "
                f"5. Responde ÚNICAMENTE con el cuerpo del mensaje refinado, sin intros ni explicaciones."
            )

            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Error IA Refinar: {str(e)}")
            return mensaje_actual

    async def extraer_datos_documento(self, image_base64: str, tipo: str) -> Dict[str, Any]:
        """
        Extrae datos estructurados de una imagen de documento usando Gemini 2.5 Flash.
        image_base64: Imagen en base64 (string).
        tipo: 'cedula' o 'vehiculo'.
        """
        try:
            # Los prompts tácticos aseguran una respuesta JSON limpia
            if tipo == 'cedula':
                prompt = (
                    "Eres un sistema OCR de seguridad táctica para BAGFM. "
                    "Analiza esta imagen de una cédula de identidad venezolana. "
                    "Extrae Nombre, Apellido y Número de Cédula. "
                    "Importante: NO extraigas el teléfono (se ingresa manual). "
                    "Devuelve estrictamente un objeto JSON con estas claves: "
                    "{'nombre': string, 'apellido': string, 'cedula': string}. "
                    "Si no logras leer algún campo, deja el string vacío."
                )
            elif tipo == 'vehiculo':
                prompt = (
                    "Eres un sistema OCR de seguridad táctica para BAGFM. "
                    "Analiza esta imagen de un certificado de circulación de vehículo. "
                    "Extrae la Marca, Modelo, Placa y Color del vehículo. "
                    "Devuelve estrictamente un objeto JSON con estas claves: "
                    "{'marca': string, 'modelo': string, 'placa': string, 'color': string}. "
                    "Si no logras leer algún campo, deja el string vacío."
                )
            else:
                raise ValueError("Tipo de documento no soportado")

            # Decodificar imagen
            image_data = base64.b64decode(image_base64)
            
            # Llamada a Gemini
            response = self.model.generate_content([
                prompt,
                {'mime_type': 'image/jpeg', 'data': image_data}
            ])

            # Limpiar respuesta (a veces el modelo añade ```json ... ```)
            content = response.text.strip()
            if content.startswith('```'):
                content = content.split('```')[1]
                if content.startswith('json'):
                    content = content[4:].strip()
            
            return json.loads(content)

        except Exception as e:
            print(f"ERROR IA_SERVICE: {str(e)}")
            # Retornar estructura vacía para prevenir caídas de UI
            if tipo == 'cedula':
                return {"nombre": "", "apellido": "", "cedula": ""}
            return {"marca": "", "modelo": "", "placa": "", "color": ""}

ia_service = IAService()
