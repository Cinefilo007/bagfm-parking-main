from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import joinedload
from app.models.puesto_estacionamiento import PuestoEstacionamiento

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.models.usuario import Usuario
from app.services.zona_service import zona_service
from app.schemas.zona_estacionamiento import (
    ZonaEstacionamientoSalida, ZonaEstacionamientoCrear, ZonaEstacionamientoActualizar
)
from app.schemas.asignacion_zona import (
    AsignacionZonaCrear, AsignacionZonaSalida, AsignacionZonaActualizar
)
from app.schemas.puesto_estacionamiento import PuestoEstacionamientoSalida, PuestoEstacionamientoActualizar

router = APIRouter()

@router.post("", response_model=ZonaEstacionamientoSalida)
async def crear_zona(
    datos: ZonaEstacionamientoCrear,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    try:
        return await zona_service.crear_zona_estacionamiento(db, datos.model_dump(), current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{zona_id}", response_model=ZonaEstacionamientoSalida)
async def actualizar_zona(
    zona_id: UUID,
    datos: ZonaEstacionamientoActualizar,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    zona = await zona_service.actualizar_zona(db, zona_id, datos.model_dump(exclude_unset=True))
    if not zona:
        raise HTTPException(status_code=404, detail="Zona no encontrada")
    return zona

@router.get("", response_model=List[ZonaEstacionamientoSalida])
async def listar_zonas(
    skip: int = 0, limit: int = 100, activa: bool = None,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE", "SUPERVISOR", "PARQUERO", "ADMIN_ENTIDAD", "SUPERVISOR_PARQUEROS"]))
):
    entidad_id = current_user.entidad_id if current_user.rol == "ADMIN_ENTIDAD" else None
    return await zona_service.obtener_zonas(db, skip, limit, activa, entidad_id)

@router.put("/{zona_id}/tiempo-llegada")
async def modificar_tiempo_limite(
    zona_id: UUID, 
    minutos: int = Body(..., embed=True),
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE", "SUPERVISOR", "SUPERVISOR_PARQUEROS", "ADMIN_ENTIDAD"]))
):
    try:
        zona = await zona_service.get_zona(db, zona_id)
        if not zona:
            raise HTTPException(status_code=404, detail="Zona no encontrada")
        zona.tiempo_limite_llegada_min = minutos
        await db.commit()
        return {"mensaje": f"Tiempo límite actualizado a {minutos} minutos"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{zona_id}/puestos", response_model=List[PuestoEstacionamientoSalida])
async def obtener_puestos(
    zona_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE", "SUPERVISOR", "PARQUERO", "SUPERVISOR_PARQUEROS", "ADMIN_ENTIDAD"]))
):
    """Retorna los puestos físicos de una zona."""
    return await zona_service.obtener_puestos_zona(db, zona_id)

@router.post("/{zona_id}/puestos", response_model=List[PuestoEstacionamientoSalida])
async def generar_puestos(
    zona_id: UUID,
    prefijo: str = Body(...),
    cantidad: int = Body(...),
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    try:
        return await zona_service.generar_puestos_fisicos(db, zona_id, prefijo, cantidad, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/puestos/{puesto_id}", response_model=PuestoEstacionamientoSalida)
async def actualizar_puesto(
    puesto_id: UUID,
    datos: PuestoEstacionamientoActualizar,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE", "PARQUERO"]))
):
    try:
        return await zona_service.actualizar_puesto_fisico(db, puesto_id, datos.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/puestos/{puesto_id}")
async def eliminar_puesto(
    puesto_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    """Elimina permanentemente un puesto físico."""
    if not await zona_service.eliminar_puesto_fisico(db, puesto_id):
        raise HTTPException(status_code=404, detail="Puesto no encontrado")
    return {"mensaje": "Puesto eliminado correctamente"}

@router.post("/asignaciones", response_model=AsignacionZonaSalida)
async def asignar_zona_entidad(
    datos: AsignacionZonaCrear,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    try:
        return await zona_service.asignar_zona_a_entidad(db, dict(datos), current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/asignaciones", response_model=List[AsignacionZonaSalida])
async def obtener_todas_las_asignaciones(
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    """Retorna todas las asignaciones de cupos en el sistema."""
    return await zona_service.obtener_asignaciones_globales(db)

@router.patch("/asignaciones/{asignacion_id}", response_model=AsignacionZonaSalida)
async def actualizar_asignacion(
    asignacion_id: UUID,
    datos: AsignacionZonaActualizar,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    asig = await zona_service.actualizar_asignacion_zona(db, asignacion_id, datos.model_dump(exclude_unset=True))
    if not asig:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    return asig

@router.delete("/asignaciones/{asignacion_id}")
async def eliminar_asignacion(
    asignacion_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["COMANDANTE", "ADMIN_BASE"]))
):
    if not await zona_service.eliminar_asignacion_zona(db, asignacion_id):
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    return {"mensaje": "Asignación eliminada correctamente"}

@router.get("/entidad/mis-asignaciones", response_model=List[AsignacionZonaSalida])
async def obtener_mis_asignaciones(
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """Obtiene las asignaciones de zona vinculadas a la entidad del usuario."""
    if not current_user.entidad_id:
        return []
    from app.models.asignacion_zona import AsignacionZona
    rs = await db.execute(select(AsignacionZona).options(joinedload(AsignacionZona.zona)).where(
        AsignacionZona.entidad_id == current_user.entidad_id,
        AsignacionZona.activa == True
    ))
    return rs.scalars().all()

@router.get("/mi-cuota", response_model=List[PuestoEstacionamientoSalida])
async def obtener_mis_puestos(
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """Retorna los puestos físicos específicos asignados a la entidad del usuario."""
    if not current_user.entidad_id:
        return []
    rs = await db.execute(
        select(PuestoEstacionamiento)
        .options(joinedload(PuestoEstacionamiento.zona), joinedload(PuestoEstacionamiento.tipo_acceso))
        .where(PuestoEstacionamiento.reservado_entidad_id == current_user.entidad_id)
    )
    return rs.scalars().all()

@router.patch("/entidad/asignaciones/{asignacion_id}/distribucion", response_model=AsignacionZonaSalida)
async def configurar_distribucion_cupos(
    asignacion_id: UUID,
    distribucion_cupos: dict = Body(..., embed=True),
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """Permite al admin de entidad configurar cómo se subdivide su cupo lógico (ej. VIP: 20, Staff: 15)."""
    if not current_user.entidad_id:
        raise HTTPException(status_code=403, detail="No perteneces a una entidad civil activa.")
    asig = await zona_service.get_asignacion(db, asignacion_id)
    if not asig or asig.entidad_id != current_user.entidad_id:
        raise HTTPException(status_code=404, detail="Asignación no encontrada o no pertenece a tu entidad.")
    
    # Validar que los montos propuestos no excedan el cupo total utilizable
    total_reservado = sum(int(v) for v in distribucion_cupos.values() if isinstance(v, (int, float)) or (isinstance(v, str) and v.isdigit()))
    cupo_utilizable = asig.cupo_asignado - asig.cupo_reservado_base
    if total_reservado > cupo_utilizable:
        raise HTTPException(status_code=400, detail=f"Distribuición excedida. Tienes {cupo_utilizable} cupos utilizables y tratas de reservar {total_reservado}.")

    asig.distribucion_cupos = distribucion_cupos
    await db.commit()
    await db.refresh(asig)
    return asig

@router.post("/{zona_id}/puestos-entidad", response_model=List[PuestoEstacionamientoSalida])
async def generar_puestos_entidad(
    zona_id: UUID,
    prefijo: str = Body(...),
    cantidad: int = Body(...),
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """Permite a la Entidad generar puestos físicos individuales limitados a su cupo."""
    if not current_user.entidad_id:
        raise HTTPException(status_code=403, detail="No perteneces a una entidad civil activa.")
    try:
        return await zona_service.generar_puestos_entidad(db, zona_id, current_user.entidad_id, prefijo, cantidad, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/puestos/{puesto_id}/tipo-acceso", response_model=PuestoEstacionamientoSalida)
async def reasignar_tipo_puesto(
    puesto_id: UUID,
    tipo_acceso_id: Optional[UUID] = Body(None, embed=True),
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """Permite al admin de entidad reasignar manualmente el tipo de acceso de un puesto."""
    puesto = await zona_service.get_puesto(db, puesto_id)
    if not puesto or puesto.reservado_entidad_id != current_user.entidad_id:
        raise HTTPException(status_code=404, detail="Puesto no encontrado o no pertenece a tu entidad.")
    
    puesto.tipo_acceso_id = tipo_acceso_id
    await db.commit()
    await db.refresh(puesto)
    
    # Recargar con relaciones para la respuesta
    rs = await db.execute(
        select(PuestoEstacionamiento)
        .options(joinedload(PuestoEstacionamiento.zona), joinedload(PuestoEstacionamiento.tipo_acceso))
        .where(PuestoEstacionamiento.id == puesto_id)
    )
    return rs.scalars().first()


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints de Disponibilidad Inteligente (para el dashboard de estacionamientos)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/entidad/resumen-disponibilidad")
async def resumen_disponibilidad_entidad(
    fecha: str = None,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """
    Retorna el resumen de disponibilidad real por zona para una fecha específica.
    Descuenta los pases masivos vigentes ese día del cupo asignado.
    Si no se pasa fecha, usa la fecha actual.
    """
    from datetime import date as date_type, datetime
    from app.models.asignacion_zona import AsignacionZona
    from app.services.pase_service import pase_service

    if not current_user.entidad_id:
        return []

    # Parsear o usar hoy
    try:
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date() if fecha else date_type.today()
    except (ValueError, TypeError):
        fecha_dt = date_type.today()

    # Obtener asignaciones activas de la entidad
    rs = await db.execute(
        select(AsignacionZona)
        .options(joinedload(AsignacionZona.zona))
        .where(
            AsignacionZona.entidad_id == current_user.entidad_id,
            AsignacionZona.activa == True
        )
    )
    asignaciones = rs.scalars().all()

    resultado = []
    for asig in asignaciones:
        datos_zona = await pase_service.contar_pases_activos_en_zona_para_fecha(
            db, asig.zona_id, fecha_dt, limite=10
        )
        
        # Conocer cuántos están realmente ocupando un espacio físico en esta zona
        ocupados_actual = await pase_service.contar_ocupados_en_zona_por_entidad(
            db, asig.zona_id, current_user.entidad_id
        )

        # Consultar parqueros asignados a esta zona
        from app.models.enums import RolTipo
        rs_p = await db.execute(
            select(Usuario.nombre, Usuario.apellido)
            .where(
                Usuario.zona_asignada_id == asig.zona_id,
                Usuario.rol == RolTipo.PARQUERO,
                Usuario.activo == True
            )
        )
        parqueros = [{"nombre": p.nombre, "apellido": p.apellido} for p in rs_p.all()]

        cupo_libre = max(0, asig.cupo_asignado - datos_zona["total"])
        resultado.append({
            "zona_id": str(asig.zona_id),
            "zona_nombre": asig.zona_nombre or (asig.zona.nombre if asig.zona else "Sin nombre"),
            "cupo_asignado": asig.cupo_asignado,
            "cupo_reservado_base": asig.cupo_reservado_base,
            "distribucion_cupos": asig.distribucion_cupos,
            "pases_vigentes": datos_zona["total"],
            "pases_ingresados": ocupados_actual,
            "cupo_libre": cupo_libre,
            "pases_muestra": datos_zona["pases"],
            "asignacion_id": str(asig.id),
            "fecha_consulta": fecha_dt.isoformat(),
            "parqueros": parqueros
        })

    return resultado


@router.get("/entidad/calendario-lotes")
async def calendario_lotes_entidad(
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """
    Retorna un dict { 'YYYY-MM-DD': ['Zona A', 'Zona B'] } para colorear
    el calendario de fechas con lotes activos en el frontend.
    """
    from app.services.pase_service import pase_service

    if not current_user.entidad_id:
        return {}

    return await pase_service.obtener_fechas_con_lotes_por_entidad(db, current_user.entidad_id)


@router.get("/entidad/pases-zona")
async def pases_zona_paginados(
    zona_id: UUID,
    fecha: str = None,
    busqueda: str = None,
    page: int = 1,
    limite: int = 20,
    db: AsyncSession = Depends(obtener_db),
    current_user: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """
    Retorna pases paginados de una zona específica para una fecha.
    Usado por el panel "Ver todos" del acordeón.
    """
    from datetime import date as date_type, datetime
    from app.services.pase_service import pase_service

    try:
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date() if fecha else date_type.today()
    except (ValueError, TypeError):
        fecha_dt = date_type.today()

    offset = (page - 1) * limite
    resultado = await pase_service.contar_pases_activos_en_zona_para_fecha(
        db, zona_id, fecha_dt, limite=limite, offset=offset, busqueda=busqueda
    )
    resultado["page"] = page
    resultado["limite"] = limite
    resultado["total_paginas"] = max(1, -(-resultado["total"] // limite))  # ceiling division
    return resultado
