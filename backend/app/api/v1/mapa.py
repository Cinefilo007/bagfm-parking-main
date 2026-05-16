from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.services import mapa_service
from pydantic import BaseModel
from typing import Literal, Optional
from uuid import UUID
from datetime import datetime
from app.models.enums import RolTipo
from app.models.infraccion import Infraccion
from app.models.vehiculo import Vehiculo
from app.models.usuario import Usuario

router = APIRouter()

class GeorreferenciaRequest(BaseModel):
    tipo: Literal['entidad', 'alcabala', 'zona']
    id: str
    lat: float
    lng: float

@router.get("/situacion")
async def get_situacion(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual = Depends(obtener_usuario_actual)
):
    """Retorna la situación táctica consolidada de la Base."""
    return await mapa_service.get_situacion_actual(db)

@router.get("/trafico")
async def get_trafico(
    weeks_ago: int = 0,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual = Depends(obtener_usuario_actual)
):
    """Retorna estadísticas de tráfico histórico por días."""
    return await mapa_service.get_trafico_historico(db, weeks_ago)

@router.put("/georreferenciar")
async def actualizar_ubicacion(
    request: GeorreferenciaRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual = Depends(obtener_usuario_actual)
):
    """Actualiza la posición geográfica de una entidad en el mapa."""
    # Solo roles de alto mando pueden georreferenciar
    ALTO_MANDO = [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR]
    if usuario_actual.rol not in ALTO_MANDO:
        raise HTTPException(status_code=403, detail="No tienes permisos para georreferenciar.")
    
    exito = await mapa_service.actualizar_georreferencia(
        db, request.tipo, request.id, request.lat, request.lng
    )
    
    if not exito:
        raise HTTPException(status_code=404, detail="Entidad no encontrada.")
        
    return {"message": "Ubicación actualizada correctamente."}

@router.get("/infracciones")
async def get_infracciones_mapa(
    estado: Optional[str] = Query(None),      # activa | resuelta | en_revision | todas
    gravedad: Optional[str] = Query(None),     # leve | moderada | grave | critica
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    zona_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(obtener_db),
    usuario_actual = Depends(require_rol([RolTipo.SUPERVISOR, RolTipo.ADMIN_BASE, RolTipo.COMANDANTE])),
):
    """
    Retorna infracciones enriquecidas para el mapa táctico del Supervisor de Base.
    Incluye coordenadas, datos del vehículo y del infractor.
    Las infracciones sin coordenadas se incluyen con lat/lon = null.
    """
    from sqlalchemy.orm import selectinload

    condiciones = []
    if estado and estado != "todas":
        condiciones.append(Infraccion.estado == estado)
    if gravedad:
        condiciones.append(Infraccion.gravedad == gravedad)
    if desde:
        condiciones.append(Infraccion.created_at >= desde)
    if hasta:
        condiciones.append(Infraccion.created_at <= hasta)
    if zona_id:
        condiciones.append(Infraccion.zona_id == zona_id)

    q = (
        select(Infraccion)
        .options(
            selectinload(Infraccion.vehiculo),
            selectinload(Infraccion.infractor),
            selectinload(Infraccion.reportero),
        )
        .where(and_(*condiciones) if condiciones else True)
        .order_by(Infraccion.created_at.desc())
    )
    res = await db.execute(q)
    infracciones = res.scalars().all()

    con_coords = []
    sin_coords = []

    for inf in infracciones:
        placa = inf.vehiculo.placa if inf.vehiculo else "S/P"
        nombre_infractor = "Desconocido"
        if inf.infractor:
            nombre_infractor = inf.infractor.nombre_completo
        elif inf.vehiculo:
            # Buscar en QRs por placa
            res_qr = await db.execute(
                select(Vehiculo.socio).where(Vehiculo.placa == placa).limit(1)
            )

        nombre_reportero = inf.reportero.nombre_completo if inf.reportero else "Sistema"

        item = {
            "id": str(inf.id),
            "tipo": inf.tipo.value,
            "gravedad": inf.gravedad.value,
            "estado": inf.estado.value,
            "lat": float(inf.latitud_infraccion) if inf.latitud_infraccion else None,
            "lon": float(inf.longitud_infraccion) if inf.longitud_infraccion else None,
            "placa": placa,
            "nombre_infractor": nombre_infractor,
            "reportado_por": nombre_reportero,
            "descripcion": inf.descripcion,
            "created_at": inf.created_at.isoformat(),
            "bloquea_salida": inf.bloquea_salida,
            "foto_url": inf.foto_url,
            "fotos_evidencia": inf.fotos_evidencia or [],
        }

        if inf.latitud_infraccion and inf.longitud_infraccion:
            con_coords.append(item)
        else:
            sin_coords.append(item)

    return {
        "total": len(infracciones),
        "con_coordenadas": con_coords,
        "sin_coordenadas": sin_coords,
    }
