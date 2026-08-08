"""
Verificación de una placa contra la base de datos.

Esta es la ÚNICA fuente de verdad sobre qué significa una placa en el sistema. La
consultan tres caminos distintos y tienen que responder todos lo mismo:

  - `ia_placa_service`  — el parquero fotografía la placa y Gemini la lee.
  - `anpr_service`      — la cámara ANPR de la alcabala la lee por su cuenta.
  - la búsqueda manual por placa de la alcabala.

Mientras la lógica vivía dentro de `IAPlacaService` no había forma de que el resto la
usara sin duplicarla, y unas reglas de membresía duplicadas se desincronizan sin que
nadie lo note hasta que un socio vigente aparece rechazado en una pantalla y aceptado
en otra.
"""
from typing import Any, Dict, Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehiculo import Vehiculo
from app.models.vehiculo_pase import VehiculoPase
from app.models.codigo_qr import CodigoQR
from app.models.usuario import Usuario
from app.models.membresia import Membresia
from app.models.enums import MembresiaEstado


# Valores de `coincidencia`: clasificación estable del resultado, pensada para
# guardarse en BD y agruparse en reportes. Los campos `mensaje`/`alerta`/`tipo_pase`
# son para mostrar en pantalla y pueden cambiar de redacción sin romper nada.
COINCIDENCIA_REINGRESO = "reingreso"
COINCIDENCIA_SOCIO = "socio"
COINCIDENCIA_SOCIO_VENCIDO = "socio_vencido"
COINCIDENCIA_PASE = "pase"
COINCIDENCIA_PASE_INVALIDO = "pase_invalido"
COINCIDENCIA_NO_REGISTRADO = "no_registrado"


def normalizar_placa(valor: Optional[str]) -> str:
    """
    Deja la placa en la forma canónica con la que se guarda y se compara.

    Todas las fuentes (Gemini, cámara ANPR, carga por Excel, tecleo del guardia)
    tienen que pasar por aquí o las comparaciones fallan por un guion.
    """
    if not valor:
        return ""
    return valor.strip().upper().replace(" ", "").replace("-", "")


async def verificar_placa(
    db: AsyncSession,
    placa: str,
    zona_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resuelve qué es una placa, en este orden:

      1. ¿Ya está adentro? (VehiculoPase ingresado) → reingreso
      2. ¿Vehículo de socio? → verifica membresía
      3. ¿Tiene un QR activo? → verifica expiración y cupo de accesos
      4. No registrado

    El orden importa: un socio que ya entró tiene que dar "reingreso", no "socio",
    porque si no el sistema le abre dos veces y descuadra la ocupación de la zona.
    """
    placa = normalizar_placa(placa)
    ahora = datetime.now(timezone.utc)

    # ── 1. ¿Ya está ingresado en alguna zona? ──────────────────────────────────
    q_activo = select(VehiculoPase).where(
        VehiculoPase.placa == placa,
        VehiculoPase.ingresado == True,
    )
    if zona_id:
        q_activo = q_activo.where(VehiculoPase.zona_asignada_id == UUID(str(zona_id)))

    vp_activo = (await db.execute(q_activo)).scalars().first()
    if vp_activo:
        return {
            "encontrado": True,
            "sin_datos": False,
            "ya_ingresado": True,
            "pase_valido": True,
            "coincidencia": COINCIDENCIA_REINGRESO,
            "tipo_pase": "REINGRESO",
            "tipo_pase_color": "#f59e0b",
            "nombre_portador": None,
            "usuario_id": None,
            "vehiculo_id": None,
            "qr_id": None,
            "vehiculo_pase_id": str(vp_activo.id),
            "mensaje": f"⚠️ {placa} ya está registrado dentro. Se expulsará del estacionamiento al confirmar.",
            "alerta": "warning",
        }

    # ── 2. Socio permanente ────────────────────────────────────────────────────
    vehiculo = (await db.execute(
        select(Vehiculo).where(Vehiculo.placa == placa, Vehiculo.activo == True)
    )).scalars().first()

    if vehiculo and vehiculo.socio_id:
        socio = (await db.execute(
            select(Usuario).where(Usuario.id == vehiculo.socio_id, Usuario.activo == True)
        )).scalars().first()

        if socio:
            membresia = (await db.execute(
                select(Membresia)
                .where(Membresia.socio_id == socio.id)
                .order_by(Membresia.updated_at.desc())
            )).scalars().first()

            membresia_ok = (
                membresia and
                membresia.estado in [MembresiaEstado.activa, MembresiaEstado.exonerada]
            )
            nombre = f"{socio.nombre} {socio.apellido}".strip()

            if not membresia_ok:
                estado_msg = membresia.estado.value.upper() if membresia else "SIN MEMBRESÍA"
                return {
                    "encontrado": True,
                    "sin_datos": False,
                    "ya_ingresado": False,
                    "pase_valido": False,
                    "coincidencia": COINCIDENCIA_SOCIO_VENCIDO,
                    "tipo_pase": "SOCIO",
                    "tipo_pase_color": "#ef4444",
                    "nombre_portador": nombre,
                    "usuario_id": str(socio.id),
                    "vehiculo_id": str(vehiculo.id),
                    "qr_id": None,
                    "vehiculo_pase_id": None,
                    "mensaje": f"🚫 MEMBRESÍA {estado_msg}",
                    "alerta": "error",
                }

            return {
                "encontrado": True,
                "sin_datos": False,
                "ya_ingresado": False,
                "pase_valido": True,
                "coincidencia": COINCIDENCIA_SOCIO,
                "tipo_pase": "SOCIO PERMANENTE",
                "tipo_pase_color": "#3b82f6",
                "nombre_portador": nombre,
                "usuario_id": str(socio.id),
                "vehiculo_id": str(vehiculo.id),
                "qr_id": None,
                "vehiculo_pase_id": None,
                "mensaje": "✅ Socio registrado — Membresía vigente",
                "alerta": "success",
            }

    # ── 3. CodigoQR activo (pases masivos/temporales) ──────────────────────────
    qr = (await db.execute(
        select(CodigoQR)
        .where(CodigoQR.vehiculo_placa == placa, CodigoQR.activo == True)
        .order_by(CodigoQR.created_at.desc())
    )).scalars().first()

    if qr:
        vehiculo_id = str(vehiculo.id) if vehiculo else None

        if qr.fecha_expiracion and qr.fecha_expiracion < ahora:
            return {
                "encontrado": True,
                "sin_datos": False,
                "ya_ingresado": False,
                "pase_valido": False,
                "coincidencia": COINCIDENCIA_PASE_INVALIDO,
                "tipo_pase": qr.tipo.value.upper() if qr.tipo else "PASE",
                "tipo_pase_color": "#ef4444",
                "nombre_portador": qr.nombre_portador,
                "usuario_id": None,
                "vehiculo_id": vehiculo_id,
                "qr_id": str(qr.id),
                "vehiculo_pase_id": None,
                "mensaje": f"🚫 PASE VENCIDO — Expiró el {qr.fecha_expiracion.strftime('%d/%m/%Y')}",
                "alerta": "error",
            }

        if qr.max_accesos and qr.accesos_usados >= qr.max_accesos:
            return {
                "encontrado": True,
                "sin_datos": False,
                "ya_ingresado": False,
                "pase_valido": False,
                "coincidencia": COINCIDENCIA_PASE_INVALIDO,
                "tipo_pase": "PASE AGOTADO",
                "tipo_pase_color": "#ef4444",
                "nombre_portador": qr.nombre_portador,
                "usuario_id": None,
                "vehiculo_id": vehiculo_id,
                "qr_id": str(qr.id),
                "vehiculo_pase_id": None,
                "mensaje": f"🚫 LÍMITE DE ACCESOS AGOTADO ({qr.max_accesos}/{qr.max_accesos})",
                "alerta": "error",
            }

        tipo_label = "PASE EVENTO"
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
            "coincidencia": COINCIDENCIA_PASE,
            "tipo_pase": tipo_label,
            "tipo_pase_color": "#10b981",
            "nombre_portador": qr.nombre_portador,
            "usuario_id": None,
            "vehiculo_id": vehiculo_id,
            "qr_id": str(qr.id),
            "vehiculo_pase_id": None,
            "mensaje": f"✅ Pase válido{vigencia_msg}",
            "alerta": "success",
        }

    # ── 4. No encontrado ───────────────────────────────────────────────────────
    return {
        "encontrado": False,
        "sin_datos": True,
        "ya_ingresado": False,
        "pase_valido": False,
        "coincidencia": COINCIDENCIA_NO_REGISTRADO,
        "tipo_pase": None,
        "tipo_pase_color": "#94a3b8",
        "nombre_portador": None,
        "usuario_id": None,
        "vehiculo_id": None,
        "qr_id": None,
        "vehiculo_pase_id": None,
        "mensaje": f"❌ {placa} NO REGISTRADO. Pedir Pase QR.",
        "alerta": "error",
    }
