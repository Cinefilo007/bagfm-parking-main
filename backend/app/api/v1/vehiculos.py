"""
Saneamiento del registro de vehículos.

La misma placa quedó cargada varias veces con formatos distintos ("AC255LB" y
"AC-255LB"), y esos duplicados no son inocuos: el historial de un carro queda
partido entre dos fichas, y la de combustible puede no ser la misma que la que ve
la alcabala.

Borrar sin más no es posible ni deseable. Cinco tablas apuntan a `vehiculos` con
ON DELETE RESTRICT —abastecimientos, accesos, infracciones, membresías y códigos
QR—, así que la base impide eliminar una ficha con historial. Y hace bien: ese
historial es justamente lo que no se quiere perder.

Por eso la operación que se ofrece es FUSIONAR: mover todo lo que cuelga de la
ficha sobrante a la que se conserva, y solo entonces eliminarla.
"""
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import obtener_db
from app.core.dependencias import require_rol
from app.models.abastecimiento import Abastecimiento
from app.models.acceso import Acceso
from app.models.codigo_qr import CodigoQR
from app.models.entidad_civil import EntidadCivil
from app.models.enums import RolTipo
from app.models.infraccion import Infraccion
from app.models.membresia import Membresia
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from app.models.solicitud_combustible import SolicitudCombustible
from app.models.usuario import Usuario
from app.models.vehiculo import Vehiculo
from app.models.vehiculo_pase import VehiculoPase

router = APIRouter()

DEPENDENCY_ADMIN = Depends(require_rol([
    RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR_BOMBEROS,
]))

# Todo lo que cuelga de un vehículo. El orden no importa para contar, pero sí para
# fusionar: se mueve todo antes de borrar.
#   (modelo, columna, etiqueta para la pantalla)
_DEPENDENCIAS = [
    (Abastecimiento, "vehiculo_id", "abastecimientos"),
    (Acceso, "vehiculo_id", "accesos"),
    (Infraccion, "vehiculo_id", "infracciones"),
    (Membresia, "vehiculo_id", "membresias"),
    (CodigoQR, "vehiculo_id", "codigos_qr"),
    (VehiculoPase, "vehiculo_id", "pases"),
    (SolicitudCombustible, "vehiculo_id", "solicitudes_combustible"),
    (PuestoEstacionamiento, "vehiculo_actual_id", "puestos_ocupados"),
]

_NORMALIZADA = func.upper(
    func.replace(func.replace(Vehiculo.placa, "-", ""), " ", "")
)


async def _conteos(db: AsyncSession, ids: List[UUID]) -> Dict[UUID, Dict[str, int]]:
    """
    Cuántas filas cuelgan de cada vehículo, por tabla.

    Se hace con una consulta agrupada por tabla —ocho en total, no una por
    vehículo— para que la vista siga siendo rápida por muchos duplicados que haya.
    """
    conteos: Dict[UUID, Dict[str, int]] = {i: {} for i in ids}

    for modelo, columna, etiqueta in _DEPENDENCIAS:
        col = getattr(modelo, columna)
        filas = (await db.execute(
            select(col, func.count()).where(col.in_(ids)).group_by(col)
        )).all()
        for vehiculo_id, total in filas:
            if vehiculo_id in conteos:
                conteos[vehiculo_id][etiqueta] = total

    return conteos


async def _ultimas_fechas(db: AsyncSession, ids: List[UUID]) -> Dict[UUID, Dict[str, Any]]:
    """Última actividad de cada ficha: es lo que revela cuál se está usando de verdad."""
    fechas: Dict[UUID, Dict[str, Any]] = {i: {} for i in ids}

    for modelo, columna, campo_fecha, etiqueta in (
        (Abastecimiento, "vehiculo_id", "created_at", "ultimo_abastecimiento"),
        (Acceso, "vehiculo_id", "timestamp", "ultimo_acceso"),
    ):
        col = getattr(modelo, columna)
        filas = (await db.execute(
            select(col, func.max(getattr(modelo, campo_fecha)))
            .where(col.in_(ids))
            .group_by(col)
        )).all()
        for vehiculo_id, fecha in filas:
            if vehiculo_id in fechas:
                fechas[vehiculo_id][etiqueta] = fecha

    return fechas


@router.get("/duplicados")
async def listar_duplicados(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Fichas de vehículo que comparten placa una vez normalizada.

    Devuelve cada grupo con el detalle de uso de cada ficha, para poder decidir
    cuál conservar con criterio y no a ciegas.
    """
    # Placas normalizadas con más de una ficha.
    duplicadas = (await db.execute(
        select(_NORMALIZADA.label("placa"))
        .group_by(_NORMALIZADA)
        .having(func.count() > 1)
    )).scalars().all()

    if not duplicadas:
        return []

    vehiculos = (await db.execute(
        select(Vehiculo).where(_NORMALIZADA.in_(duplicadas)).order_by(Vehiculo.created_at)
    )).scalars().all()

    ids = [v.id for v in vehiculos]
    conteos = await _conteos(db, ids)
    fechas = await _ultimas_fechas(db, ids)

    # Nombres de socio y entidad, para saber de quién es cada ficha.
    socios = {
        u.id: f"{u.nombre} {u.apellido}".strip()
        for u in (await db.execute(
            select(Usuario).where(Usuario.id.in_([v.socio_id for v in vehiculos if v.socio_id]))
        )).scalars().all()
    } if any(v.socio_id for v in vehiculos) else {}

    entidades = {
        e.id: e.nombre
        for e in (await db.execute(
            select(EntidadCivil).where(EntidadCivil.id.in_([v.entidad_id for v in vehiculos if v.entidad_id]))
        )).scalars().all()
    } if any(v.entidad_id for v in vehiculos) else {}

    grupos: Dict[str, List[Dict[str, Any]]] = {}
    for v in vehiculos:
        clave = v.placa.upper().replace("-", "").replace(" ", "")
        uso = conteos.get(v.id, {})
        grupos.setdefault(clave, []).append({
            "id": str(v.id),
            "placa_guardada": v.placa,
            "marca": v.marca,
            "modelo": v.modelo,
            "color": v.color,
            "activo": v.activo,
            "socio": socios.get(v.socio_id),
            "entidad": entidades.get(v.entidad_id),
            "autorizado_combustible": v.autorizado_combustible,
            "asignacion_combustible_semanal": v.asignacion_combustible_semanal,
            "created_at": v.created_at,
            "uso": uso,
            # Suma de todo lo que se perdería si se elimina esta ficha sin fusionar.
            "total_referencias": sum(uso.values()),
            **fechas.get(v.id, {}),
        })

    return [
        {"placa": placa, "fichas": fichas}
        for placa, fichas in sorted(grupos.items())
    ]


@router.post("/{vehiculo_id}/fusionar-en/{destino_id}", status_code=status.HTTP_200_OK)
async def fusionar_vehiculo(
    vehiculo_id: UUID,
    destino_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Mueve todo el historial de una ficha a otra y elimina la sobrante.

    Es la unica forma de "eliminar" un duplicado sin perder datos: cinco tablas
    apuntan a `vehiculos` con ON DELETE RESTRICT, asi que una ficha con historial
    no se puede borrar mientras ese historial siga colgando de ella.
    """
    if vehiculo_id == destino_id:
        raise HTTPException(status_code=400, detail="Son la misma ficha")

    origen = await db.get(Vehiculo, vehiculo_id)
    destino = await db.get(Vehiculo, destino_id)
    if not origen or not destino:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    # Se exige que sean la misma placa normalizada. Fusionar dos vehículos distintos
    # mezclaría historiales de carros que no tienen nada que ver, y eso no se puede
    # deshacer.
    def norm(p):
        return (p or "").upper().replace("-", "").replace(" ", "")

    if norm(origen.placa) != norm(destino.placa):
        raise HTTPException(
            status_code=400,
            detail=f"Las placas no coinciden: {origen.placa} y {destino.placa}",
        )

    movidos: Dict[str, int] = {}
    for modelo, columna, etiqueta in _DEPENDENCIAS:
        col = getattr(modelo, columna)
        resultado = await db.execute(
            update(modelo).where(col == vehiculo_id).values(**{columna: destino_id})
        )
        if resultado.rowcount:
            movidos[etiqueta] = resultado.rowcount

    await db.delete(origen)
    await db.commit()

    return {
        "eliminado": str(vehiculo_id),
        "conservado": str(destino_id),
        "placa": destino.placa,
        "movidos": movidos,
    }
