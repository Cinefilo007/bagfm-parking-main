"""
Lectura de documentos con IA (Gemini).

La usan la bomba de combustible (odómetro y surtidor), el parquero (certificado de
circulación) y la alcabala (cédula del conductor). Es el mismo modelo para todos, así
que lo que pase aquí se nota en los tres sitios a la vez.

POR QUÉ ESTE ARCHIVO TIENE REINTENTOS Y HILO APARTE
En combustible se veía que, tras varias fotos seguidas, la lectura dejaba de
funcionar. Dos causas, ambas del lado del servidor y ninguna de la foto:

  1. `generate_content` del SDK de Gemini es BLOQUEANTE. Llamarlo directamente dentro
     de un `async def` congela el bucle de eventos entero mientras dura: con varias
     lecturas encadenadas el servidor deja de atender lo demás y las peticiones
     empiezan a caer por tiempo de espera. Va en un hilo aparte.
  2. Gemini responde 429 (cuota por minuto) y 503 (modelo saturado) con frecuencia
     cuando se le mandan fotos en ráfaga. Antes eso se tragaba y se devolvían campos
     vacíos, así que en pantalla se leía "no se pudo leer el documento" y parecía un
     problema de la foto. Ahora se reintenta con espera creciente y, si aun así falla,
     se devuelve el MOTIVO para que la pantalla pueda decir la verdad.

Nunca se lanza una excepción hacia arriba: quien llama debe poder seguir a mano. El
motivo viaja en la clave `_error` del propio diccionario de datos.
"""
import asyncio
import base64
import json
import random
from typing import Any, Dict, Optional

import google.generativeai as genai

from app.core.config import obtener_config

config = obtener_config()

# Tres intentos alcanzan para pasar un pico de cuota sin dejar al guardia esperando:
# con la espera creciente son ~4 segundos en el peor caso.
INTENTOS = 3
ESPERA_BASE_SEG = 1.2

# Estructura vacía por tipo de documento. Se devuelve cuando la lectura falla, para
# que la pantalla se pinte igual y los campos queden editables a mano.
VACIOS: Dict[str, Dict[str, Any]] = {
    "cedula": {"nombre": "", "apellido": "", "cedula": ""},
    "vehiculo": {"marca": "", "modelo": "", "placa": "", "color": ""},
    "odometro": {"kilometraje": 0},
    "surtidor": {"litros": 0.0},
}

PROMPTS: Dict[str, str] = {
    "cedula": (
        "Eres un sistema OCR de seguridad táctica para BAGFM. "
        "Analiza esta imagen de una cédula de identidad venezolana. "
        "Extrae Nombre, Apellido y Número de Cédula. "
        "Importante: NO extraigas el teléfono (se ingresa manual). "
        "Devuelve estrictamente un objeto JSON con estas claves: "
        "{'nombre': string, 'apellido': string, 'cedula': string}. "
        "Si no logras leer algún campo, deja el string vacío."
    ),
    "vehiculo": (
        "Eres un sistema OCR de seguridad táctica para BAGFM. "
        "Analiza esta imagen de un certificado de circulación de vehículo. "
        "Extrae la Marca, Modelo, Placa y Color del vehículo. "
        "Devuelve estrictamente un objeto JSON con estas claves: "
        "{'marca': string, 'modelo': string, 'placa': string, 'color': string}. "
        "Si no logras leer algún campo, deja el string vacío."
    ),
    "odometro": (
        "Eres un sistema OCR de seguridad táctica para la bomba de combustible de BAGFM. "
        "Analiza esta imagen del tablero/odómetro de un vehículo. "
        "Extrae el valor numérico exacto del kilometraje actual que se observa en la pantalla del odómetro. "
        "Devuelve estrictamente un objeto JSON con esta clave: "
        "{'kilometraje': integer}. "
        "No incluyas texto adicional ni símbolos, solo el valor numérico entero. "
        "Si no logras leer el odómetro o la imagen no es legible, devuelve el valor como 0."
    ),
    "surtidor": (
        "Eres un sistema OCR de seguridad táctica para la bomba de combustible de BAGFM. "
        "Analiza esta imagen de la pantalla de visualización de un surtidor de combustible (dispensador). "
        "Extrae el valor numérico exacto de los litros surtidos que se muestra en la sección correspondiente a 'Litros' o 'Volume'. "
        "Devuelve estrictamente un objeto JSON con esta clave: "
        "{'litros': float}. "
        "No incluyas texto adicional ni símbolos, solo el valor numérico decimal. "
        "Si no logras leer los litros o la imagen no es legible, devuelve el valor como 0.0."
    ),
}


def _clasificar_error(error: Exception) -> str:
    """
    Traduce el fallo del SDK a un motivo que la pantalla pueda explicar.

    Se mira el texto y no la clase de la excepción porque el SDK envuelve los errores
    de la API en tipos distintos según por dónde falle, y la única señal estable entre
    versiones es el código HTTP que aparece en el mensaje.

      cuota    → se agotó el límite por minuto o por día. Esperar o escribir a mano.
      servicio → Gemini saturado o caído. Reintentar más tarde.
      clave    → la credencial no sirve. Esto no lo arregla el guardia.
      lectura  → llegó respuesta pero no era el JSON esperado.
    """
    texto = f"{type(error).__name__} {error}".lower()

    if any(p in texto for p in ("429", "quota", "exhausted", "rate limit", "resource_exhausted")):
        return "cuota"
    if any(p in texto for p in ("503", "500", "unavailable", "overloaded", "internal", "deadline", "timeout")):
        return "servicio"
    if any(p in texto for p in ("api key", "api_key", "permission", "401", "403", "unauthenticated")):
        return "clave"
    return "lectura"


def _reintentable(motivo: str) -> bool:
    """Solo se reintenta lo que puede mejorar solo. Una clave mala no mejora sola."""
    return motivo in ("cuota", "servicio")


def _extraer_json(texto: str) -> Dict[str, Any]:
    """
    Saca el objeto JSON de la respuesta.

    Aunque se pide `response_mime_type=application/json`, el modelo a veces devuelve
    el bloque envuelto en ```json …```, y en ese caso `json.loads` falla directo.
    """
    contenido = (texto or "").strip()

    if contenido.startswith("```"):
        partes = contenido.split("```")
        if len(partes) > 1:
            contenido = partes[1].strip()
        if contenido.lower().startswith("json"):
            contenido = contenido[4:].strip()

    return json.loads(contenido)


class IAService:
    def __init__(self):
        # La API Key debe estar en config.gemini_api_key
        genai.configure(api_key=config.gemini_api_key)
        # Usamos la versión 2.5 Flash solicitada para máxima precisión táctica
        self.model = genai.GenerativeModel("gemini-2.5-flash")

    async def refinar_mensaje_correo(self, contexto: str, mensaje_actual: str) -> str:
        """
        Refina profesionalmente el cuerpo de un correo usando Gemini.
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

            # En un hilo aparte por lo mismo que la lectura de documentos: el SDK es
            # bloqueante y aquí se está dentro del bucle de eventos.
            respuesta = await asyncio.to_thread(self.model.generate_content, prompt)
            return respuesta.text.strip()
        except Exception as e:
            print(f"Error IA Refinar: {str(e)}")
            return mensaje_actual

    def _leer_documento_bloqueante(self, imagen: bytes, prompt: str) -> Dict[str, Any]:
        """La llamada al modelo, tal cual. Corre siempre dentro de `asyncio.to_thread`."""
        respuesta = self.model.generate_content(
            [prompt, {"mime_type": "image/jpeg", "data": imagen}],
            # Pedir JSON explícitamente evita la mayor parte de los fallos de parseo:
            # sin esto el modelo intercala explicaciones cuando la foto está regular.
            generation_config={"response_mime_type": "application/json"},
        )
        return _extraer_json(respuesta.text)

    async def extraer_datos_documento(self, image_base64: str, tipo: str) -> Dict[str, Any]:
        """
        Extrae datos estructurados de una imagen de documento.

        Devuelve SIEMPRE un diccionario con las claves del tipo pedido. Si la lectura
        falló, esas claves vienen vacías y `_error` dice por qué, para que la pantalla
        distinga "la foto salió mal" de "la IA está sin cuota" — que es lo que el
        guardia necesita saber para decidir si repite la foto o escribe a mano.
        """
        vacio = dict(VACIOS.get(tipo, VACIOS["vehiculo"]))
        prompt = PROMPTS.get(tipo)
        if not prompt:
            return {**vacio, "_error": "tipo"}

        try:
            imagen = base64.b64decode(image_base64)
        except Exception:
            return {**vacio, "_error": "imagen"}

        motivo: Optional[str] = None

        for intento in range(1, INTENTOS + 1):
            try:
                datos = await asyncio.to_thread(self._leer_documento_bloqueante, imagen, prompt)
                # El modelo puede devolver un JSON válido con claves de más o de
                # menos; se queda solo con las que se esperaban.
                return {**vacio, **{k: v for k, v in datos.items() if k in vacio}}

            except Exception as e:
                motivo = _clasificar_error(e)
                print(f"ERROR IA_SERVICE ({tipo}, intento {intento}/{INTENTOS}, {motivo}): {e}")

                if intento == INTENTOS or not _reintentable(motivo):
                    break

                # Espera creciente con algo de azar: si dos garitas fotografían a la
                # vez, reintentar ambas en el mismo instante repite el 429.
                espera = ESPERA_BASE_SEG * (2 ** (intento - 1)) + random.uniform(0, 0.4)
                await asyncio.sleep(espera)

        return {**vacio, "_error": motivo or "lectura"}


ia_service = IAService()
