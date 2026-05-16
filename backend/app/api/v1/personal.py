"""
personal.py — Router de Personal Interno (Fuerza de Tareas).
Endpoints para gestión de operativos, zonas, KPIs, incentivos y sanciones.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioSalida, UsuarioCrear, UsuarioActualizar
from app.schemas.incentivo_sancion import (
    IncentivoCrear, IncentivoSalida,
    SancionCrear, SancionActualizar, SancionSalida,
    KPIsOperativo
)
from app.services.personal_service import personal_service
from app.core.excepciones import AccesoDenegado, EntidadNoEncontrada

router = APIRouter()


# ─── LISTADO Y CREACIÓN ────────────────────────────────────────────────────────

@router.get("/lista", response_model=List[UsuarioSalida])
async def listar_personal(
    skip: int = 0,
    limit: int = 10,
    search: str = None,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Retorna la lista de personal operativo según permisos. Soporta paginación y búsqueda."""
    return await personal_service.listar_personal(db, usuario_actual, skip=skip, limit=limit, search=search)


@router.post("/", response_model=UsuarioSalida)
async def crear_personal(
    datos: UsuarioCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Registra un nuevo miembro del personal (Admin, Supervisor, Parquero)."""
    return await personal_service.crear_personal(db, datos, usuario_actual)


# ─── EDICIÓN ──────────────────────────────────────────────────────────────────

@router.patch("/{id}", response_model=UsuarioSalida)
async def actualizar_personal(
    id: UUID,
    datos: UsuarioActualizar,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Edita los datos de un operativo (nombre, teléfono, email, rol, etc.)."""
    try:
        return await personal_service.actualizar_personal(db, id, datos, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{id}/toggle", response_model=UsuarioSalida)
async def toggle_estado_personal(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Activa o suspende el acceso de un miembro del personal."""
    try:
        return await personal_service.toggle_activo(db, id, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{id}")
async def eliminar_personal(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Elimina permanentemente a un miembro del personal. Solo Comandante."""
    try:
        await personal_service.eliminar(db, id, usuario_actual)
        return {"status": "success", "message": "Personal eliminado correctamente"}
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ─── ZONA DE ESTACIONAMIENTO ──────────────────────────────────────────────────

@router.post("/{id}/zona", response_model=UsuarioSalida)
async def asignar_zona_parquero(
    id: UUID,
    zona_id: Optional[UUID] = None,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Asigna (o desasigna si zona_id=null) una zona de estacionamiento a un parquero."""
    try:
        return await personal_service.asignar_zona(db, id, zona_id, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ─── KPIs ─────────────────────────────────────────────────────────────────────

@router.get("/{id}/kpis", response_model=KPIsOperativo)
async def obtener_kpis_operativo(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Retorna los KPIs operacionales de un miembro del personal."""
    try:
        return await personal_service.obtener_kpis(db, id, usuario_actual)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ─── INCENTIVOS ───────────────────────────────────────────────────────────────

@router.get("/{id}/incentivos", response_model=List[IncentivoSalida])
async def listar_incentivos(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Lista todos los incentivos de un operativo."""
    return await personal_service.listar_incentivos(db, id)


@router.post("/{id}/incentivos", response_model=IncentivoSalida, status_code=status.HTTP_201_CREATED)
async def agregar_incentivo(
    id: UUID,
    datos: IncentivoCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Otorga un incentivo a un operativo."""
    try:
        return await personal_service.agregar_incentivo(db, id, datos, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/incentivos/{incentivo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_incentivo(
    incentivo_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Elimina un incentivo."""
    try:
        await personal_service.eliminar_incentivo(db, incentivo_id, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ─── SANCIONES ────────────────────────────────────────────────────────────────

@router.get("/{id}/sanciones", response_model=List[SancionSalida])
async def listar_sanciones(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Lista todas las sanciones de un operativo."""
    return await personal_service.listar_sanciones(db, id)


@router.post("/{id}/sanciones", response_model=SancionSalida, status_code=status.HTTP_201_CREATED)
async def agregar_sancion(
    id: UUID,
    datos: SancionCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Aplica una sanción a un operativo."""
    try:
        return await personal_service.agregar_sancion(db, id, datos, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/sanciones/{sancion_id}", response_model=SancionSalida)
async def actualizar_sancion(
    sancion_id: UUID,
    datos: SancionActualizar,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Actualiza el estado de una sanción (cumplida, apelada)."""
    try:
        return await personal_service.actualizar_sancion(db, sancion_id, datos, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/sanciones/{sancion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_sancion(
    sancion_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Elimina una sanción permanentemente."""
    try:
        await personal_service.eliminar_sancion(db, sancion_id, usuario_actual)
    except AccesoDenegado as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
