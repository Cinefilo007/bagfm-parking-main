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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehiculo import Vehiculo
from app.models.vehiculo_pase import VehiculoPase
from app.models.codigo_qr import CodigoQR
from app.models.usuario import Usuario
from app.models.membresia import Membresia
from app.models.entidad_civil import EntidadCivil
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
# El vehículo SÍ está en el registro pero no cuelga de un socio: es de una entidad
# —los internos de la base, los del módulo de combustible— o quedó sin dueño.
COINCIDENCIA_VEHICULO = "vehiculo_registrado"


# Semáforo: la lectura de un vistazo, a varios metros y con prisa. Se calcula en el
# backend y no en cada pantalla para que el teléfono del guardia y el monitor no
# puedan discrepar nunca sobre si un vehículo pasa o no.
#
#   verde    → registrado y en regla: pasa
#   amarillo → no registrado, o algo que mirar: pasa, pero el guardia decide
#   rojo     → no debe entrar
SEMAFORO_VERDE = "verde"
SEMAFORO_AMARILLO = "amarillo"
SEMAFORO_ROJO = "rojo"

_SEMAFORO_POR_COINCIDENCIA = {
    COINCIDENCIA_SOCIO: SEMAFORO_VERDE,
    COINCIDENCIA_VEHICULO: SEMAFORO_VERDE,
    COINCIDENCIA_PASE: SEMAFORO_VERDE,
    COINCIDENCIA_REINGRESO: SEMAFORO_AMARILLO,
    COINCIDENCIA_NO_REGISTRADO: SEMAFORO_AMARILLO,
    COINCIDENCIA_SOCIO_VENCIDO: SEMAFORO_ROJO,
    COINCIDENCIA_PASE_INVALIDO: SEMAFORO_ROJO,
}


def semaforo_de(coincidencia: Optional[str]) -> str:
    """Color que corresponde a un veredicto, sin considerar infracciones."""
    return _SEMAFORO_POR_COINCIDENCIA.get(coincidencia, SEMAFORO_AMARILLO)


def normalizar_placa(valor: Optional[str]) -> str:
    """
    Deja la placa en la forma canónica con la que se compara.

    Todas las fuentes (Gemini, cámara ANPR, carga por Excel, tecleo del guardia)
    tienen que pasar por aquí o las comparaciones fallan por un guion.
    """
    if not valor:
        return ""
    return valor.strip().upper().replace(" ", "").replace("-", "")


def _placa_sin_separadores(columna):
    """
    La misma normalización, pero aplicada en SQL sobre la columna.

    Hace falta porque los datos existentes NO están normalizados: la importación por
    Excel guarda la placa con `.strip().upper()` y conserva guiones y espacios, así
    que un vehículo cargado como "AV-645" jamás casaría con el "AV645" que lee la
    cámara. Sin esto, un socio perfectamente registrado aparece como desconocido en
    la alcabala, que es el peor error posible en este sistema.
    """
    return func.replace(func.replace(func.upper(columna), "-", ""), " ", "")


async def verificar_placa(
    db: AsyncSession,
    placa: str,
    zona_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resuelve qué es una placa, en este orden:

      1. ¿Ya está adentro? (VehiculoPase ingresado) → reingreso
      2. ¿Está en el registro de vehículos?
           · con socio activo → verifica su membresía
           · sin socio (vehículo de entidad o interno de la base) → registrado igual
      3. ¿Tiene un QR activo? → verifica expiración y cupo de accesos
      4. No registrado

    El paso 2 no exige socio a propósito. Los vehículos internos de la base cuelgan
    de una entidad y no de una persona; exigirlo hacía que todo el parque propio
    saliera como desconocido en la alcabala.

    El orden importa: un socio que ya entró tiene que dar "reingreso", no "socio",
    porque si no el sistema le abre dos veces y descuadra la ocupación de la zona.
    """
    placa = normalizar_placa(placa)
    ahora = datetime.now(timezone.utc)

    # ── 1. ¿Ya está ingresado en alguna zona? ──────────────────────────────────
    q_activo = select(VehiculoPase).where(
        _placa_sin_separadores(VehiculoPase.placa) == placa,
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
            "semaforo": SEMAFORO_AMARILLO,
            "tipo_pase": "REINGRESO",
            "tipo_pase_color": "#f59e0b",
            "nombre_portador": None,
            "usuario_id": None,
            "vehiculo_id": None,
            "qr_id": None,
            "vehiculo_pase_id": str(vp_activo.id),
            "vehiculo_marca": vp_activo.marca,
            "vehiculo_modelo": vp_activo.modelo,
            "vehiculo_color": vp_activo.color,
            "mensaje": f"⚠️ {placa} ya está registrado dentro. Se expulsará del estacionamiento al confirmar.",
            "alerta": "warning",
        }

    # ── 2. Socio permanente ────────────────────────────────────────────────────
    # Primero la comparación exacta, que aprovecha el índice de `placa`. Solo si no
    # aparece nada se paga el coste de la normalizada, que no puede usarlo.
    vehiculo = (await db.execute(
        select(Vehiculo).where(Vehiculo.placa == placa, Vehiculo.activo == True)
    )).scalars().first()

    if not vehiculo:
        vehiculo = (await db.execute(
            select(Vehiculo).where(
                _placa_sin_separadores(Vehiculo.placa) == placa,
                Vehiculo.activo == True,
            )
        )).scalars().first()

    if vehiculo:
        socio = None
        if vehiculo.socio_id:
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
                    "semaforo": SEMAFORO_ROJO,
                    "tipo_pase": "SOCIO",
                    "tipo_pase_color": "#ef4444",
                    "nombre_portador": nombre,
                    "usuario_id": str(socio.id),
                    "vehiculo_id": str(vehiculo.id),
                    "qr_id": None,
                    "vehiculo_pase_id": None,
                    "vehiculo_marca": vehiculo.marca,
                    "vehiculo_modelo": vehiculo.modelo,
                    "vehiculo_color": vehiculo.color,
                    "mensaje": f"🚫 MEMBRESÍA {estado_msg}",
                    "alerta": "error",
                }

            return {
                "encontrado": True,
                "sin_datos": False,
                "ya_ingresado": False,
                "pase_valido": True,
                "coincidencia": COINCIDENCIA_SOCIO,
                "semaforo": SEMAFORO_VERDE,
                "tipo_pase": "SOCIO PERMANENTE",
                "tipo_pase_color": "#3b82f6",
                "nombre_portador": nombre,
                "usuario_id": str(socio.id),
                "vehiculo_id": str(vehiculo.id),
                "qr_id": None,
                "vehiculo_pase_id": None,
                "vehiculo_marca": vehiculo.marca,
                "vehiculo_modelo": vehiculo.modelo,
                "vehiculo_color": vehiculo.color,
                "mensaje": "✅ Socio registrado — Membresía vigente",
                "alerta": "success",
            }

        # Está en el registro de vehículos pero sin socio activo detrás. Antes se
        # caía por aquí hasta acabar en "NO REGISTRADO", que es falso y grave: los
        # vehículos internos de la base cuelgan de una entidad, no de un socio, así
        # que todo el parque propio aparecía como desconocido en la alcabala.
        entidad = None
        if vehiculo.entidad_id:
            entidad = (await db.execute(
                select(EntidadCivil).where(EntidadCivil.id == vehiculo.entidad_id)
            )).scalars().first()

        return {
            "encontrado": True,
            "sin_datos": False,
            "ya_ingresado": False,
            "pase_valido": True,
            "coincidencia": COINCIDENCIA_VEHICULO,
            # Sin dueño de ningún tipo es un registro incompleto, no una autorización:
            # se deja en ámbar para que el guardia lo mire, no para frenarlo.
            "semaforo": SEMAFORO_VERDE if entidad else SEMAFORO_AMARILLO,
            "tipo_pase": "VEHÍCULO REGISTRADO",
            "tipo_pase_color": "#3b82f6",
            "nombre_portador": entidad.nombre if entidad else None,
            "usuario_id": None,
            "vehiculo_id": str(vehiculo.id),
            "qr_id": None,
            "vehiculo_pase_id": None,
            "vehiculo_marca": vehiculo.marca,
            "vehiculo_modelo": vehiculo.modelo,
            "vehiculo_color": vehiculo.color,
            "mensaje": (
                f"✅ Vehículo de {entidad.nombre}" if entidad
                else "⚠️ Vehículo registrado sin titular asignado"
            ),
            "alerta": "success" if entidad else "warning",
        }

    # ── 3. CodigoQR activo (pases masivos/temporales) ──────────────────────────
    qr = (await db.execute(
        select(CodigoQR)
        .where(CodigoQR.vehiculo_placa == placa, CodigoQR.activo == True)
        .order_by(CodigoQR.created_at.desc())
    )).scalars().first()

    if not qr:
        qr = (await db.execute(
            select(CodigoQR)
            .where(
                _placa_sin_separadores(CodigoQR.vehiculo_placa) == placa,
                CodigoQR.activo == True,
            )
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
                "semaforo": SEMAFORO_ROJO,
                "tipo_pase": qr.tipo.value.upper() if qr.tipo else "PASE",
                "tipo_pase_color": "#ef4444",
                "nombre_portador": qr.nombre_portador,
                "usuario_id": None,
                "vehiculo_id": vehiculo_id,
                "qr_id": str(qr.id),
                "vehiculo_pase_id": None,
                "vehiculo_marca": qr.vehiculo_marca,
                "vehiculo_modelo": qr.vehiculo_modelo,
                "vehiculo_color": qr.vehiculo_color,
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
                "semaforo": SEMAFORO_ROJO,
                "tipo_pase": "PASE AGOTADO",
                "tipo_pase_color": "#ef4444",
                "nombre_portador": qr.nombre_portador,
                "usuario_id": None,
                "vehiculo_id": vehiculo_id,
                "qr_id": str(qr.id),
                "vehiculo_pase_id": None,
                "vehiculo_marca": qr.vehiculo_marca,
                "vehiculo_modelo": qr.vehiculo_modelo,
                "vehiculo_color": qr.vehiculo_color,
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
            "semaforo": SEMAFORO_VERDE,
            "tipo_pase": tipo_label,
            "tipo_pase_color": "#10b981",
            "nombre_portador": qr.nombre_portador,
            "usuario_id": None,
            "vehiculo_id": vehiculo_id,
            "qr_id": str(qr.id),
            "vehiculo_pase_id": None,
            "vehiculo_marca": qr.vehiculo_marca,
            "vehiculo_modelo": qr.vehiculo_modelo,
            "vehiculo_color": qr.vehiculo_color,
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
        "semaforo": SEMAFORO_AMARILLO,
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
