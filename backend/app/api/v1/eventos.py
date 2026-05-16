"""
API Endpoints para Gestión de Eventos y Pases Masivos.
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual
from app.models.usuario import Usuario
from app.models.enums import RolTipo
from app.schemas.alcabala_evento import (
    SolicitudEventoCrear, SolicitudEventoSalida, SolicitudEventoProcesar
)
from app.schemas.codigo_qr import CodigoQRSalida
from app.services.evento_service import evento_service

router = APIRouter()

@router.get("/stats")
async def obtener_estadisticas_eventos(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """Retorna estadísticas generales de solicitudes (Filtrado por entidad si es ADMIN_ENTIDAD)."""
    entidad_id = usuario.entidad_id if usuario.rol == RolTipo.ADMIN_ENTIDAD else None
    return await evento_service.get_stats(db, entidad_id)

@router.post("/solicitudes", response_model=SolicitudEventoSalida)
async def crear_solicitud_evento(
    datos: SolicitudEventoCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """Permite que un ADMIN_ENTIDAD solicite pases masivos para un evento."""
    if usuario.rol != RolTipo.ADMIN_ENTIDAD:
        raise HTTPException(status_code=403, detail="Solo administradores de entidad pueden solicitar eventos")
    
    return await evento_service.crear_solicitud(db, datos, usuario.id)

@router.get("/solicitudes", response_model=List[SolicitudEventoSalida])
async def listar_solicitudes_evento(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """Lista las solicitudes (Filtrado por entidad si es ADMIN_ENTIDAD)."""
    entidad_id = usuario.entidad_id if usuario.rol == RolTipo.ADMIN_ENTIDAD else None
    return await evento_service.listar_solicitudes(db, entidad_id)

@router.post("/solicitudes/{solicitud_id}/procesar", response_model=SolicitudEventoSalida)
async def procesar_solicitud_evento(
    solicitud_id: UUID,
    datos: SolicitudEventoProcesar,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """El Comandante procesa la solicitud (Aprobación Total/Parcial/Denegación)."""
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="No tiene permisos para procesar solicitudes")
    
    solicitud = await evento_service.procesar_solicitud(db, solicitud_id, datos, usuario.id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    return solicitud

@router.get("/solicitudes/{solicitud_id}/qrs", response_model=List[CodigoQRSalida])
async def obtener_qrs_evento(
    solicitud_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """Obtiene la lista de QRs genéricos aprobados para descargar."""
    solicitud = await evento_service.obtener_solicitud(db, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    # Seguridad: Solo el solicitante o el mando pueden ver los QRs
    if usuario.rol == RolTipo.ADMIN_ENTIDAD and solicitud.entidad_id != usuario.entidad_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a estos pases")

    return await evento_service.obtener_qrs_solicitud(db, solicitud_id)
