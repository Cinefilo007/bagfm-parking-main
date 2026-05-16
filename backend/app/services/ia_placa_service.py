"""
Servicio de Análisis IA de Placas Vehiculares.
SOP: Aegis Tactical — Módulo de Detección Rápida de Placas.

Arquitectura:
  - El operador sube fotos SIN esperar resultado (no bloqueo de flujo).
  - Cada foto recibe un `job_id` único vinculado al dispositivo/sesión.
  - El procesamiento IA corre en background (FastAPI BackgroundTasks).
  - Los resultados se almacenan en memoria con TTL de 15 minutos.
  - El frontend hace polling ligero para recuperar resultados por job_id.
  - Múltiples operadores en el mismo turno no comparten jobs: cada dispositivo
    genera sus propios job_ids aislados.
"""
import uuid
import base64
import json
import asyncio
import time
from typing import Dict, Any, Optional

import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone, timedelta

from app.core.config import obtener_config
from app.models.vehiculo import Vehiculo
from app.models.vehiculo_pase import VehiculoPase
from app.models.codigo_qr import CodigoQR
from app.models.usuario import Usuario
from app.models.membresia import Membresia
from app.models.enums import MembresiaEstado

config = obtener_config()


# ──────────────────────────────────────────────────────────────────────────────
# Store en memoria de resultados (TTL 15 min)
# Estructura: { job_id: { status, resultado, created_at } }
# ──────────────────────────────────────────────────────────────────────────────
_jobs_store: Dict[str, Dict[str, Any]] = {}
_JOB_TTL_SECONDS = 900  # 15 minutos


def _limpiar_jobs_expirados():
    """Elimina jobs que superaron el TTL para evitar memory leak."""
    ahora = time.time()
    expirados = [jid for jid, j in _jobs_store.items()
                 if ahora - j["created_at"] > _JOB_TTL_SECONDS]
    for jid in expirados:
        del _jobs_store[jid]


def crear_job(image_base64: str, zona_id: Optional[str], tipo_operador: str) -> str:
    """Registra un job pendiente y retorna su ID único."""
    _limpiar_jobs_expirados()
    job_id = str(uuid.uuid4())
    _jobs_store[job_id] = {
        "status": "pendiente",
        "resultado": None,
        "image_b64": image_base64,
        "zona_id": zona_id,
        "tipo_operador": tipo_operador,  # 'parquero' | 'alcabala'
        "created_at": time.time(),
    }
    return job_id


def obtener_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Retorna el estado del job (sin la imagen para no sobrecargar)."""
    job = _jobs_store.get(job_id)
    if not job:
        return None
    return {
        "job_id": job_id,
        "status": job["status"],
        "resultado": job["resultado"],
    }


def _marcar_job(job_id: str, status: str, resultado: Dict[str, Any]):
    if job_id in _jobs_store:
        _jobs_store[job_id]["status"] = status
        _jobs_store[job_id]["resultado"] = resultado
        # Limpiar imagen para liberar memoria tras procesamiento
        _jobs_store[job_id].pop("image_b64", None)


# ──────────────────────────────────────────────────────────────────────────────
# Prompts especializados para placas venezolanas
# ──────────────────────────────────────────────────────────────────────────────
_PROMPT_PLACA_VE = """
Eres un sistema OCR táctico de alta precisión especializado en placas vehiculares venezolanas.

Contexto de la placa venezolana:
- Encabezado: "REPÚBLICA BOLIVARIANA DE VENEZUELA"
- Número de placa: formato típico AA000AA (2 letras, 3 dígitos, 2 letras) o AA000A para placas antiguas
- Pie de placa: nombre del estado venezolano emisor (ej: MIRANDA, CARACAS, ZULIA, etc.)
- Fondo: tricolor de la bandera venezolana (amarillo, azul, rojo)
- Las placas pueden estar sucias, en ángulo o con reflejos de luz solar

TAREA: Analiza la imagen y extrae ÚNICAMENTE el número de placa del vehículo.

Reglas estrictas:
1. Devuelve SOLO el número de placa sin espacios, guiones ni caracteres especiales (ej: "AB123CD")
2. Si ves varias placas en la foto, devuelve la que está más centrada o más cercana
3. Si la imagen NO contiene una placa legible, devuelve placa vacía
4. Convierte todo a MAYÚSCULAS
5. Elimina espacios intermedios (ej: "AB 12 3CD" → "AB123CD")

Responde ÚNICAMENTE con un objeto JSON:
{"placa": "AB123CD", "confianza": "alta|media|baja", "estado": "MIRANDA"}

Si no se puede leer: {"placa": "", "confianza": "baja", "estado": ""}
"""


# ──────────────────────────────────────────────────────────────────────────────
# Procesador principal (corre en background)
# ──────────────────────────────────────────────────────────────────────────────
class IAPlacaService:

    def __init__(self):
        genai.configure(api_key=config.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")

    async def _detectar_placa_gemini(self, image_base64: str) -> Dict[str, Any]:
        """Llama a Gemini para detectar la placa en la imagen."""
        try:
            image_data = base64.b64decode(image_base64)
            response = self.model.generate_content([
                _PROMPT_PLACA_VE,
                {"mime_type": "image/jpeg", "data": image_data}
            ])
            content = response.text.strip()

            # Limpiar markdown si Gemini añade ```json ... ```
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:].strip()

            datos = json.loads(content)
            placa = datos.get("placa", "").strip().upper().replace(" ", "").replace("-", "")
            return {
                "placa": placa,
                "confianza": datos.get("confianza", "baja"),
                "estado_emisor": datos.get("estado", ""),
            }
        except Exception as e:
            print(f"[IA_PLACA] Error Gemini: {e}")
            return {"placa": "", "confianza": "baja", "estado_emisor": ""}

    async def _verificar_placa_en_bd(
        self, db: AsyncSession, placa: str, zona_id: Optional[str]
    ) -> Dict[str, Any]:
        """
        Verifica la placa en la base de datos siguiendo esta cadena:
        1. VehiculoPase activo en zona → ya ingresado (re-ingreso)
        2. Socio permanente (tabla vehiculos) → verifica membresía
        3. CodigoQR activo (pases masivos/temporales) → verifica vigencia
        4. No encontrado
        """
        ahora = datetime.now(timezone.utc)

        # ── 1. ¿Ya está ingresado en alguna zona? ──────────────────────────
        q_activo = select(VehiculoPase).where(
            VehiculoPase.placa == placa,
            VehiculoPase.ingresado == True,
        )
        if zona_id:
            from uuid import UUID as _UUID
            q_activo = q_activo.where(VehiculoPase.zona_asignada_id == _UUID(zona_id))

        res_activo = await db.execute(q_activo)
        vp_activo = res_activo.scalars().first()
        if vp_activo:
            return {
                "encontrado": True,
                "sin_datos": False,
                "ya_ingresado": True,
                "pase_valido": True,
                "tipo_pase": "REINGRESO",
                "tipo_pase_color": "#f59e0b",
                "nombre_portador": None,
                "vehiculo_pase_id": str(vp_activo.id),
                "mensaje": f"⚠️ {placa} ya está registrado dentro. Se expulsará del estacionamiento al confirmar.",
                "alerta": "warning",
            }

        # ── 2. Socio permanente ─────────────────────────────────────────────
        res_v = await db.execute(
            select(Vehiculo).where(Vehiculo.placa == placa, Vehiculo.activo == True)
        )
        vehiculo = res_v.scalars().first()

        if vehiculo and vehiculo.socio_id:
            res_u = await db.execute(
                select(Usuario).where(Usuario.id == vehiculo.socio_id, Usuario.activo == True)
            )
            socio = res_u.scalars().first()

            if socio:
                res_m = await db.execute(
                    select(Membresia)
                    .where(Membresia.socio_id == socio.id)
                    .order_by(Membresia.updated_at.desc())
                )
                membresia = res_m.scalars().first()

                membresia_ok = (
                    membresia and
                    membresia.estado in [MembresiaEstado.activa, MembresiaEstado.exonerada]
                )

                if not membresia_ok:
                    estado_msg = membresia.estado.value.upper() if membresia else "SIN MEMBRESÍA"
                    return {
                        "encontrado": True,
                        "sin_datos": False,
                        "ya_ingresado": False,
                        "pase_valido": False,
                        "tipo_pase": "SOCIO",
                        "tipo_pase_color": "#ef4444",
                        "nombre_portador": f"{socio.nombre} {socio.apellido}".strip(),
                        "vehiculo_pase_id": None,
                        "mensaje": f"🚫 MEMBRESÍA {estado_msg}",
                        "alerta": "error",
                    }

                return {
                    "encontrado": True,
                    "sin_datos": False,
                    "ya_ingresado": False,
                    "pase_valido": True,
                    "tipo_pase": "SOCIO PERMANENTE",
                    "tipo_pase_color": "#3b82f6",
                    "nombre_portador": f"{socio.nombre} {socio.apellido}".strip(),
                    "vehiculo_pase_id": None,
                    "mensaje": f"✅ Socio registrado — Membresía vigente",
                    "alerta": "success",
                }

        # ── 3. CodigoQR activo (pases masivos/temporales) ──────────────────
        res_qr = await db.execute(
            select(CodigoQR).where(
                CodigoQR.vehiculo_placa == placa,
                CodigoQR.activo == True,
            ).order_by(CodigoQR.created_at.desc())
        )
        qr = res_qr.scalars().first()

        if qr:
            # Verificar expiración
            if qr.fecha_expiracion and qr.fecha_expiracion < ahora:
                return {
                    "encontrado": True,
                    "sin_datos": False,
                    "ya_ingresado": False,
                    "pase_valido": False,
                    "tipo_pase": qr.tipo.value.upper() if qr.tipo else "PASE",
                    "tipo_pase_color": "#ef4444",
                    "nombre_portador": qr.nombre_portador,
                    "vehiculo_pase_id": None,
                    "mensaje": f"🚫 PASE VENCIDO — Expiró el {qr.fecha_expiracion.strftime('%d/%m/%Y')}",
                    "alerta": "error",
                }

            # Verificar límite de accesos
            if qr.max_accesos and qr.accesos_usados >= qr.max_accesos:
                return {
                    "encontrado": True,
                    "sin_datos": False,
                    "ya_ingresado": False,
                    "pase_valido": False,
                    "tipo_pase": "PASE AGOTADO",
                    "tipo_pase_color": "#ef4444",
                    "nombre_portador": qr.nombre_portador,
                    "vehiculo_pase_id": None,
                    "mensaje": f"🚫 LÍMITE DE ACCESOS AGOTADO ({qr.max_accesos}/{qr.max_accesos})",
                    "alerta": "error",
                }

            tipo_label = "PASE EVENTO"
            tipo_color = "#10b981"
            if qr.tipo_acceso:
                tipo_label = qr.tipo_acceso.value.upper()
            elif qr.tipo:
                tipo_label = qr.tipo.value.upper()

            vigencia_msg = ""
            if qr.fecha_expiracion:
                dias_restantes = (qr.fecha_expiracion - ahora).days
                vigencia_msg = f" — Vence en {dias_restantes}d" if dias_restantes >= 0 else ""

            return {
                "encontrado": True,
                "sin_datos": False,
                "ya_ingresado": False,
                "pase_valido": True,
                "tipo_pase": tipo_label,
                "tipo_pase_color": tipo_color,
                "nombre_portador": qr.nombre_portador,
                "qr_id": str(qr.id),
                "vehiculo_pase_id": None,
                "mensaje": f"✅ Pase válido{vigencia_msg}",
                "alerta": "success",
            }

        # ── 4. No encontrado ────────────────────────────────────────────────
        return {
            "encontrado": False,
            "sin_datos": True,
            "ya_ingresado": False,
            "pase_valido": False,
            "tipo_pase": None,
            "tipo_pase_color": "#94a3b8",
            "nombre_portador": None,
            "vehiculo_pase_id": None,
            "mensaje": f"❌ {placa} NO REGISTRADO. Pedir Pase QR.",
            "alerta": "error",
        }

    async def procesar_job(self, job_id: str, db: AsyncSession):
        """
        Tarea de fondo: detecta la placa y verifica en BD.
        Se llama desde FastAPI BackgroundTasks, no bloquea el request.
        """
        job = _jobs_store.get(job_id)
        if not job:
            return

        try:
            _jobs_store[job_id]["status"] = "procesando"

            # 1. Detectar placa con Gemini
            deteccion = await self._detectar_placa_gemini(job["image_b64"])
            placa = deteccion["placa"]

            if not placa:
                _marcar_job(job_id, "completado", {
                    "placa": "",
                    "confianza": deteccion["confianza"],
                    "encontrado": False,
                    "sin_datos": True,
                    "pase_valido": False,
                    "mensaje": "⚠️ No se pudo leer la placa. Intente con otra foto.",
                    "alerta": "warning",
                    "tipo_pase": None,
                    "tipo_pase_color": "#94a3b8",
                    "nombre_portador": None,
                    "vehiculo_pase_id": None,
                    "estado_emisor": deteccion.get("estado_emisor", ""),
                })
                return

            # 2. Verificar en BD
            verificacion = await self._verificar_placa_en_bd(
                db, placa, job.get("zona_id")
            )

            _marcar_job(job_id, "completado", {
                "placa": placa,
                "confianza": deteccion["confianza"],
                "estado_emisor": deteccion.get("estado_emisor", ""),
                **verificacion,
            })

        except Exception as e:
            print(f"[IA_PLACA] Error procesando job {job_id}: {e}")
            _marcar_job(job_id, "error", {
                "placa": "",
                "mensaje": f"Error interno del sistema IA: {str(e)}",
                "alerta": "error",
                "encontrado": False,
                "sin_datos": True,
                "pase_valido": False,
                "tipo_pase": None,
                "tipo_pase_color": "#94a3b8",
                "nombre_portador": None,
                "vehiculo_pase_id": None,
            })


ia_placa_service = IAPlacaService()
