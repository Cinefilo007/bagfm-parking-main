from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.models.usuario import Usuario
from app.models.enums import RolTipo
from app.schemas.configuracion_correo import ConfiguracionCorreoCreate, ConfiguracionCorreoResponse
from app.services.configuracion_correo_service import configuracion_correo_service

router = APIRouter()

DEPENDENCY_ADMIN = Depends(require_rol([RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD]))

@router.get("", response_model=Optional[ConfiguracionCorreoResponse])
async def obtener_mi_configuracion(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_ADMIN,
):
    """
    Obtiene la configuración de correo de la entidad a la que pertenece el usuario.
    Si el usuario es COMANDANTE, obtiene la genérica (NULL).
    """
    if usuario_actual.rol == RolTipo.COMANDANTE or usuario_actual.rol == RolTipo.ADMIN_BASE:
        # Obtener configuración global
        return await configuracion_correo_service.obtener_general(db)
    
    if not usuario_actual.entidad_id:
        raise HTTPException(status_code=400, detail="El usuario no pertenece a ninguna entidad.")
        
    return await configuracion_correo_service.obtener_por_entidad(db, usuario_actual.entidad_id)

@router.post("", response_model=ConfiguracionCorreoResponse)
async def actualizar_mi_configuracion(
    datos: ConfiguracionCorreoCreate,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_ADMIN,
):
    """
    Crea o actualiza la configuración de la entidad actual.
    """
    entidad_id = None
    if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        if not usuario_actual.entidad_id:
            raise HTTPException(status_code=400, detail="El usuario no pertenece a ninguna entidad.")
        entidad_id = usuario_actual.entidad_id

    return await configuracion_correo_service.crear_o_actualizar(db, datos, entidad_id=entidad_id)
