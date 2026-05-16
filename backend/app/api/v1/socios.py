from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Response, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import date

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.models.enums import RolTipo, MembresiaEstado
from app.models.usuario import Usuario
from app.schemas.socio import SocioCrear, SocioSalida, SocioPortal, SocioUpdate
from app.schemas.vehiculo import VehiculoCrear, VehiculoSalida
from app.services.socio_service import socio_service
from app.services.membresia_service import membresia_service
from app.services.import_service import import_service
from app.services.template_service import template_service
from app.models.entidad_civil import EntidadCivil
from app.models.membresia import Membresia
from app.models.vehiculo import Vehiculo
from sqlalchemy import select, func

router = APIRouter()

# Roles que pueden gestionar socios
GESTORES_SOCIOS = [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD, RolTipo.SUPERVISOR]

@router.post("/", response_model=SocioSalida, status_code=status.HTTP_201_CREATED)
async def crear_socio(
    datos: SocioCrear,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Registra un nuevo socio y su membresía inicial.
    Si el usuario es ADMIN_ENTIDAD, solo puede registrar socios para su propia entidad.
    """
    if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
        if usuario_actual.entidad_id != datos.entidad_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes registrar socios para una entidad ajena"
            )
    
    return await socio_service.crear_socio_con_membresia(db, datos, usuario_actual.id, background_tasks)

@router.get("/entidad/{entidad_id}", response_model=List[SocioSalida])
async def listar_socios_por_entidad(
    entidad_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Lista todos los socios vinculados a una entidad específica.
    Si el usuario es ADMIN_ENTIDAD, solo puede ver los socios de su propia entidad.
    """
    if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
        if usuario_actual.entidad_id != entidad_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver los socios de esta entidad"
            )
            
    return await socio_service.obtener_socios_entidad(db, entidad_id)

@router.post("/importar", status_code=status.HTTP_200_OK)
async def importar_socios_excel(
    entidad_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    fecha_expiracion: Optional[date] = Query(None, description="Fecha de expiración para el lote"),
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Importa socios masivamente desde un archivo Excel (.xlsx).
    """
    if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
        if usuario_actual.entidad_id != entidad_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes importar socios para una entidad ajena"
            )
            
    try:
        contenido = await file.read()
        resultado = await import_service.procesar_excel_socios(
            db, contenido, entidad_id, usuario_actual.id,
            fecha_expiracion=fecha_expiracion,
            background_tasks=background_tasks
        )
        return resultado
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/{socio_id}", status_code=status.HTTP_200_OK)
async def eliminar_socio(
    socio_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Elimina un socio y todos sus registros asociados (membresías, vehículos, QRs) en cascada.
    """
    try:
        return await socio_service.eliminar_socio_cascada(db, socio_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.patch("/{socio_id}/membresia")
async def actualizar_membresia_socio(
    socio_id: UUID,
    puestos_asignados: int,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Actualiza los puestos de estacionamiento asignados a un socio.
    Permite configurar cuántos vehículos simultáneos puede tener el socio dentro de la base.
    """
    if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
        # Solo puede editar socios de su entidad
        query_socio = select(Usuario).where(Usuario.id == socio_id)
        res = await db.execute(query_socio)
        socio = res.scalar_one_or_none()
        if not socio or socio.entidad_id != usuario_actual.entidad_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permiso sobre este socio")
    try:
        return await socio_service.actualizar_puestos_asignados(db, socio_id, puestos_asignados)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.patch("/{socio_id}", response_model=SocioSalida)
async def actualizar_socio(
    socio_id: UUID,
    datos: SocioUpdate,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Actualiza los datos básicos de un socio.
    """
    if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
        query_socio = select(Usuario).where(Usuario.id == socio_id)
        res = await db.execute(query_socio)
        socio = res.scalar_one_or_none()
        if not socio or socio.entidad_id != usuario_actual.entidad_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permiso sobre este socio")
            
    try:
        updated_socio = await socio_service.actualizar_socio(db, socio_id, datos)
        # Recargar para devolver con la info completa (membresía, etc)
        # Aunque SocioSalida no requiere todo, el servicio obtener_socios_entidad usa un mapeo complejo.
        # Por simplicidad, devolvemos el socio y el frontend refrescará la lista.
        return updated_socio
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/template", status_code=status.HTTP_200_OK)
async def descargar_plantilla_socios(
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Descarga la plantilla Excel (.xlsx) con los encabezados para importar socios.
    """
    excel_data = template_service.generar_excel_socios_template()
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=TEMPLATE_SOCIOS_BAGFM.xlsx"
        }
    )
@router.get("/me/portal", response_model=SocioPortal)
async def obtener_portal_socio(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol([RolTipo.SOCIO]))
):
    """
    Obtiene los datos para el portal del socio logueado.
    Soporta Socios regulares (con membresía) y Temporales (Invitados de Evento, sin membresía).
    """
    from app.models.codigo_qr import CodigoQR
    from app.models.enums import MembresiaEstado, QRTipo

    # Buscar su membresía activa
    query_mem = select(Membresia).where(Membresia.socio_id == usuario_actual.id).order_by(Membresia.created_at.desc())
    res_mem = await db.execute(query_mem)
    membresia = res_mem.scalars().first()
        
    # Buscar su QR activo
    query_qr = select(CodigoQR).where(CodigoQR.usuario_id == usuario_actual.id, CodigoQR.activo == True)
    res_qr = await db.execute(query_qr)
    qr = res_qr.scalars().first()
    
    if not membresia and not qr:
        raise HTTPException(status_code=404, detail="Usuario sin accesos válidos")
    
    # Si no tiene membresia pero SI tiene QR de portal de evento, creamos una falsa al vuelo
    if not membresia and qr and qr.tipo == QRTipo.evento_portal:
        import datetime
        import uuid
        from dateutil.relativedelta import relativedelta

        _fecha_inicio = qr.created_at.date() if qr.created_at else datetime.date.today()
        _fecha_fin = qr.fecha_expiracion.date() if qr.fecha_expiracion else datetime.date.today() + relativedelta(days=1)
        
        # Emular objeto membresia
        class MockMembresia:
            id = uuid.uuid4()
            estado = MembresiaEstado.activa
            fecha_inicio = _fecha_inicio
            fecha_fin = _fecha_fin
        
        membresia = MockMembresia()
        progreso = membresia_service.calcular_progreso(membresia)
    elif not membresia:
         raise HTTPException(status_code=404, detail="Membresía no encontrada")
    else:
        progreso = membresia_service.calcular_progreso(membresia)

        if not qr:
            # Generar uno al vuelo si no existe
            qr = await membresia_service.refrescar_qr_socio(db, usuario_actual.id, membresia.id, usuario_actual.id)
            await db.commit()

    # Obtener nombre de la entidad
    query_ent = select(EntidadCivil.nombre).where(EntidadCivil.id == usuario_actual.entidad_id)
    res_ent = await db.execute(query_ent)
    nombre_entidad = res_ent.scalar() or "BAGFM"

    # Obtener vehículos
    query_veh = select(Vehiculo).where(Vehiculo.socio_id == usuario_actual.id, Vehiculo.activo == True)
    res_veh = await db.execute(query_veh)
    vehiculos = res_veh.scalars().all()

    return {
        "perfil": {
            "id": usuario_actual.id,
            "cedula": usuario_actual.cedula,
            "nombre": usuario_actual.nombre,
            "apellido": usuario_actual.apellido,
            "nombre_completo": usuario_actual.nombre_completo,
            "email": usuario_actual.email,
            "telefono": usuario_actual.telefono,
            "activo": usuario_actual.activo,
            "rol": usuario_actual.rol,
            "entidad_id": usuario_actual.entidad_id,
            "debe_cambiar_password": usuario_actual.debe_cambiar_password,
            "created_at": usuario_actual.created_at,
            "membresia": {
                "id": membresia.id,
                "estado": membresia.estado,
                "fecha_inicio": membresia.fecha_inicio,
                "fecha_fin": membresia.fecha_fin,
                "progreso": progreso
            },
            "vehiculos": vehiculos
        },
        "qr_token": qr.token,
        "nombre_entidad": nombre_entidad
    }

@router.post("/{socio_id}/renovar", status_code=status.HTTP_200_OK)
async def renovar_membresia_socio(
    socio_id: UUID,
    meses: int = 1,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Renueva la membresía de un socio por N meses.
    """
    return await membresia_service.renovar_membresia(db, socio_id, meses, usuario_actual.id)

@router.post("/{socio_id}/estado", status_code=status.HTTP_200_OK)
async def cambiar_estado_socio(
    socio_id: UUID,
    estado: MembresiaEstado,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(GESTORES_SOCIOS))
):
    """
    Cambia el estado de la membresía (suspender, exonerar, activar).
    """
    return await membresia_service.cambiar_estado(db, socio_id, estado)

@router.post("/me/vehiculos", response_model=VehiculoSalida, status_code=status.HTTP_201_CREATED)
async def vincular_vehiculo_socio(
    vehiculo: VehiculoCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol([RolTipo.SOCIO]))
):
    """
    Permite a un socio registrar un vehículo para su propio uso.
    Invitados de evento (sin membresía real) solo pueden registrar 1 vehículo.
    """
    query_mem = select(Membresia).where(Membresia.socio_id == usuario_actual.id)
    res_mem = await db.execute(query_mem)
    membresia = res_mem.scalars().first()

    query_veh = select(func.count(Vehiculo.id)).where(Vehiculo.socio_id == usuario_actual.id, Vehiculo.activo == True)
    res_veh = await db.execute(query_veh)
    count_vehiculos = res_veh.scalar() or 0

    if not membresia and count_vehiculos >= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los pases de invitados solo permiten 1 vehículo registrado."
        )

    if membresia and count_vehiculos >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Como socio permanente, tienes un límite de 3 vehículos en tu flota autorizada."
        )

    try:
        return await socio_service.vincular_vehiculo(db, usuario_actual.id, vehiculo.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

from app.schemas.usuario import UsuarioUpdatePerfil, UsuarioSalida

@router.put("/me", response_model=UsuarioSalida, status_code=status.HTTP_200_OK)
async def actualizar_perfil_me(
    datos: UsuarioUpdatePerfil,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol([RolTipo.SOCIO]))
):
    """
    Permite a un usuario temporal o socio actualizar su perfil básico
    """
    if datos.nombre:
        usuario_actual.nombre = datos.nombre.upper()
    if datos.apellido:
        usuario_actual.apellido = datos.apellido.upper()
    if datos.cedula:
        usuario_actual.cedula = datos.cedula
    if datos.telefono:
        usuario_actual.telefono = datos.telefono
    if datos.email:
        usuario_actual.email = datos.email

    try:
        await db.commit()
        await db.refresh(usuario_actual)
        return usuario_actual
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Cédula duplicada o datos inválidos")
