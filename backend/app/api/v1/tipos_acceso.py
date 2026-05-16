from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from app.core.database import obtener_db
from app.core.dependencias import require_rol
from app.models.usuario import Usuario
from app.models.tipo_acceso_custom import TipoAccesoCustom
from app.schemas.tipo_acceso_custom import TipoAccesoCustomCrear, TipoAccesoCustomActualizar, TipoAccesoCustomSalida

router = APIRouter()

@router.get("/entidad/{entidad_id}", response_model=List[TipoAccesoCustomSalida])
async def listar_tipos_acceso_entidad(
    entidad_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD", "ADMIN_BASE", "COMANDANTE"]))
):
    if current_user.rol == "ADMIN_ENTIDAD" and current_user.entidad_id != entidad_id:
        raise HTTPException(status_code=403, detail="No puedes ver los tipos de acceso de otra entidad.")
    
    rs = await db.execute(select(TipoAccesoCustom).where(TipoAccesoCustom.entidad_id == entidad_id))
    return rs.scalars().all()

@router.post("", response_model=TipoAccesoCustomSalida)
async def crear_tipo_acceso(
    datos: TipoAccesoCustomCrear,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    if not current_user.entidad_id:
        raise HTTPException(status_code=403, detail="No perteneces a una entidad.")
    
    nuevo_tipo = TipoAccesoCustom(
        entidad_id=current_user.entidad_id,
        **datos.model_dump()
    )
    db.add(nuevo_tipo)
    await db.commit()
    await db.refresh(nuevo_tipo)
    return nuevo_tipo

@router.patch("/{tipo_id}", response_model=TipoAccesoCustomSalida)
async def actualizar_tipo_acceso(
    tipo_id: UUID,
    datos: TipoAccesoCustomActualizar,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    if not current_user.entidad_id:
        raise HTTPException(status_code=403, detail="No perteneces a una entidad.")
    
    tipo = await db.get(TipoAccesoCustom, tipo_id)
    if not tipo or tipo.entidad_id != current_user.entidad_id:
        raise HTTPException(status_code=404, detail="Tipo de acceso no encontrado.")
    
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(tipo, k, v)
    
    await db.commit()
    await db.refresh(tipo)
    return tipo

@router.delete("/{tipo_id}")
async def eliminar_tipo_acceso(
    tipo_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    if not current_user.entidad_id:
        raise HTTPException(status_code=403, detail="No perteneces a una entidad.")
        
    tipo = await db.get(TipoAccesoCustom, tipo_id)
    if not tipo or tipo.entidad_id != current_user.entidad_id:
        raise HTTPException(status_code=404, detail="Tipo de acceso no encontrado.")
        
    await db.delete(tipo)
    await db.commit()
    return {"status": "ok"}
