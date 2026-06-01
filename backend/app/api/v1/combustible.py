"""
Enrutador de Combustible (Aegis Fuel API).
Controlador de rutas para el módulo de control de combustible y parque automotor.
"""
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query, Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual
from app.models.usuario import Usuario
from app.models.enums import RolTipo, EstadoSolicitudCombustible
from app.models.tanque_combustible import TanqueCombustible
from app.services.abastecimiento_service import abastecimiento_service
from app.services.import_combustible_service import import_combustible_service
from app.services.template_service import template_service

router = APIRouter()

# --- Esquemas Pydantic ---
class SolicitudCombustibleRequest(BaseModel):
    placa: str = Field(..., max_length=20)
    cantidad_solicitada: float
    motivo: str
    nombre_conductor_manual: Optional[str] = None
    cedula_conductor_manual: Optional[str] = None
    marca_manual: Optional[str] = None
    modelo_manual: Optional[str] = None
    color_manual: Optional[str] = None

class AbastecimientoRequest(BaseModel):
    placa: str = Field(..., max_length=20)
    tanque_id: UUID
    kilometraje_actual: int
    cantidad_abastecida: float
    foto_kilometraje_url: str
    foto_maquina_url: str
    datos_ia_ocr: Optional[Dict[str, Any]] = None
    solicitud_aprobacion_id: Optional[UUID] = None

class ResolverSolicitudRequest(BaseModel):
    estado: str # 'aprobada' | 'rechazada'
    entidad_id: Optional[UUID] = None

class LecturaInicialRequest(BaseModel):
    tanque_id: UUID
    cantidad_medida: float
    observaciones: Optional[str] = None

# --- Endpoints ---

@router.get("/vehiculo/{placa}")
async def consultar_vehiculo(
    placa: str,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Consulta el estado de autorización de un vehículo para abastecer combustible.
    """
    try:
        datos = await abastecimiento_service.consultar_vehiculo_combustible(db, placa)
        return {"status": "success", "data": datos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/abastecer")
async def registrar_abastecimiento(
    request: AbastecimientoRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Registra una carga de combustible y descuenta inventario del tanque.
    """
    if usuario.rol not in [RolTipo.BOMBERO, RolTipo.ADMIN_BASE, RolTipo.COMANDANTE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de Bombero requerido.")
        
    try:
        abastecimiento = await abastecimiento_service.registrar_abastecimiento(
            db, usuario.id, request.model_dump()
        )
        await db.commit()
        return {"status": "success", "message": "Abastecimiento registrado con éxito", "id": abastecimiento.id}
    except ValueError as ve:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en servidor: {str(e)}")

@router.post("/solicitudes")
async def registrar_solicitud(
    request: SolicitudCombustibleRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Eleva una solicitud de abastecimiento por emergencia para aprobación remota.
    """
    if usuario.rol not in [RolTipo.BOMBERO, RolTipo.ADMIN_BASE, RolTipo.COMANDANTE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de Bombero requerido.")
        
    try:
        solicitud = await abastecimiento_service.registrar_solicitud_emergencia(
            db, usuario.id, request.model_dump()
        )
        await db.commit()
        return {
            "status": "success",
            "message": "Solicitud de emergencia elevada al comando",
            "id": solicitud.id
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/solicitudes/bombero")
async def listar_solicitudes_bombero(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Obtiene las solicitudes activas de emergencia creadas por el bombero logueado.
    """
    if usuario.rol != RolTipo.BOMBERO:
         raise HTTPException(status_code=403, detail="Rol de Bombero requerido.")
         
    try:
        from app.models.solicitud_combustible import SolicitudCombustible
        query = select(SolicitudCombustible).where(
            SolicitudCombustible.bombero_id == usuario.id,
            SolicitudCombustible.estado.in_([EstadoSolicitudCombustible.pendiente, EstadoSolicitudCombustible.aprobada])
        ).order_by(SolicitudCombustible.created_at.desc())
        
        res = await db.execute(query)
        solicitudes = res.scalars().all()
        
        return {
            "status": "success",
            "data": [
                {
                    "id": sol.id,
                    "placa": sol.placa,
                    "cantidad_solicitada": sol.cantidad_solicitada,
                    "tipo_solicitud": sol.tipo_solicitud.value,
                    "motivo": sol.motivo,
                    "estado": sol.estado.value,
                    "conductor": sol.nombre_conductor_manual,
                    "fecha": sol.created_at.isoformat()
                } for sol in solicitudes
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/solicitudes/pendientes")
async def listar_solicitudes_pendientes(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Obtiene las solicitudes pendientes de combustible a nivel global (Comandante/Admin Base).
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")
        
    try:
        from app.models.solicitud_combustible import SolicitudCombustible
        query = select(SolicitudCombustible).where(
            SolicitudCombustible.estado == EstadoSolicitudCombustible.pendiente
        ).order_by(SolicitudCombustible.created_at.asc())
        
        res = await db.execute(query)
        solicitudes = res.scalars().all()
        
        return {
            "status": "success",
            "data": [
                {
                    "id": sol.id,
                    "placa": sol.placa,
                    "cantidad_solicitada": sol.cantidad_solicitada,
                    "tipo_solicitud": sol.tipo_solicitud.value,
                    "motivo": sol.motivo,
                    "conductor": sol.nombre_conductor_manual,
                    "cedula": sol.cedula_conductor_manual,
                    "marca": sol.marca_manual,
                    "modelo": sol.modelo_manual,
                    "color": sol.color_manual,
                    "fecha": sol.created_at.isoformat()
                } for sol in solicitudes
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/solicitudes/{id}/resolver")
async def resolver_solicitud(
    id: UUID,
    request: ResolverSolicitudRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Aprueba o rechaza una solicitud remota de combustible.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")
        
    try:
        estado_enum = EstadoSolicitudCombustible(request.estado)
    except ValueError:
        raise HTTPException(status_code=400, detail="Estado de solicitud inválido")
        
    try:
        solicitud = await abastecimiento_service.resolver_solicitud(
            db, id, usuario.id, estado_enum, request.entidad_id
        )
        await db.commit()
        return {"status": "success", "message": f"Solicitud {request.estado} con éxito"}
    except ValueError as ve:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/solicitudes/{id}/estado")
async def obtener_estado_solicitud(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Consulta rápida del estado de una solicitud para el bombero.
    """
    from app.models.solicitud_combustible import SolicitudCombustible
    query = select(SolicitudCombustible).where(SolicitudCombustible.id == id)
    res = await db.execute(query)
    solicitud = res.scalar_one_or_none()
    
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        
    return {
        "id": solicitud.id,
        "estado": solicitud.estado.value,
        "placa": solicitud.placa
    }

@router.get("/tanques")
async def listar_tanques(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Lista todos los tanques de combustible y su inventario actual.
    """
    try:
        query = select(TanqueCombustible).where(TanqueCombustible.activo == True).order_by(TanqueCombustible.nombre.asc())
        res = await db.execute(query)
        tanques = res.scalars().all()
        
        # Verificar si ya hay lectura inicial declarada en la semana
        tiene_lectura_semana = await abastecimiento_service.verificar_lectura_inicial_semanal(db)
        
        return {
            "status": "success",
            "tiene_lectura_semana": tiene_lectura_semana,
            "data": [
                {
                    "id": t.id,
                    "nombre": t.nombre,
                    "tipo_combustible": t.tipo_combustible.value,
                    "capacidad_maxima": t.capacidad_maxima,
                    "cantidad_actual": t.cantidad_actual,
                    "porcentaje": (t.cantidad_actual / t.capacidad_maxima) * 100 if t.capacidad_maxima > 0 else 0
                } for t in tanques
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tanques/lectura-inicial")
async def registrar_lectura_inicial(
    request: LecturaInicialRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Registra el inventario de litros al inicio de semana/turno (Solo Bombero).
    """
    if usuario.rol not in [RolTipo.BOMBERO, RolTipo.ADMIN_BASE, RolTipo.COMANDANTE]:
        raise HTTPException(status_code=403, detail="Rol de Bombero requerido.")
        
    try:
        lectura = await abastecimiento_service.registrar_lectura_inicial_tanques(
            db, usuario.id, request.tanque_id, request.cantidad_medida, request.observaciones
        )
        await db.commit()
        return {"status": "success", "message": "Lectura de inventario inicial declarada con éxito", "id": lectura.id}
    except ValueError as ve:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/template")
async def descargar_plantilla_parque(
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Descarga la plantilla Excel (.xlsx) para importación de la flota del parque automotor.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")
        
    excel_data = template_service.generar_excel_parque_template()
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=TEMPLATE_PARQUE_AUTOMOTOR_BAGFM.xlsx"
        }
    )

@router.post("/importar-excel")
async def importar_excel_parque(
    entidad_id: UUID = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Carga masiva de la flota vehicular y autorización de combustible mediante plantilla Excel.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")
        
    try:
        contenido = await file.read()
        resumen = await import_combustible_service.procesar_excel_parque_automotor(
            db, contenido, usuario.id, entidad_id
        )
        await db.commit()
        return {"status": "success", "data": resumen}
    except ValueError as ve:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error fatal: {str(e)}")

@router.get("/reportes")
async def obtener_reportes(
    inicio: Optional[str] = Query(None),
    fin: Optional[str] = Query(None),
    entidad_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Genera reportes de consumos diarios/semanales con filtros.
    """
    # Si no se pasan fechas, usamos las de la semana actual
    try:
        if inicio:
            dt_inicio = datetime.fromisoformat(inicio)
        else:
            # Default lunes
            dt_inicio, _ = await abastecimiento_service.obtener_rango_semana()
            
        if fin:
            dt_fin = datetime.fromisoformat(fin)
        else:
            dt_fin = datetime.now()
            
        # Filtro de entidad para administradores de entidad
        filtro_entidad_id = entidad_id
        if usuario.rol == RolTipo.ADMIN_ENTIDAD:
            filtro_entidad_id = usuario.entidad_id
            
        reporte = await abastecimiento_service.obtener_reporte_combustible(
            db, dt_inicio, dt_fin, filtro_entidad_id
        )
        return {"status": "success", "data": reporte}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Endpoints de Administración de Flota / Parque Automotor ---

class VehiculoCombustibleUpdate(BaseModel):
    autorizado_combustible: Optional[bool] = None
    uso_vehiculo: Optional[str] = None # 'particular' | 'protocolar' | 'servicio'
    tipo_combustible: Optional[str] = None # 'gasolina' | 'diesel'
    capacidad_tanque: Optional[float] = None
    asignacion_combustible_semanal: Optional[float] = None
    entidad_id: Optional[UUID] = None

@router.get("/vehiculos")
async def listar_vehiculos_parque(
    entidad_id: Optional[UUID] = None,
    placa: Optional[str] = None,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Lista los vehículos registrados en la base con sus datos de combustible.
    Mando y supervisión ven todo; admin de entidad ve sólo su entidad.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR, RolTipo.ADMIN_ENTIDAD]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes.")
        
    try:
        from app.models.vehiculo import Vehiculo
        from app.models.entidad_civil import EntidadCivil
        from sqlalchemy.orm import selectinload
        
        query = select(Vehiculo).options(selectinload(Vehiculo.entidad)).where(Vehiculo.activo == True)
        
        # Filtro de seguridad por entidad para ADMIN_ENTIDAD
        if usuario.rol == RolTipo.ADMIN_ENTIDAD:
            query = query.where(Vehiculo.entidad_id == usuario.entidad_id)
        elif entidad_id:
            query = query.where(Vehiculo.entidad_id == entidad_id)
            
        if placa:
            query = query.where(Vehiculo.placa.ilike(f"%{placa.strip().upper()}%"))
            
        query = query.order_by(Vehiculo.placa.asc())
        res = await db.execute(query)
        vehiculos = res.scalars().all()
        
        return {
            "status": "success",
            "data": [
                {
                    "id": v.id,
                    "placa": v.placa,
                    "marca": v.marca,
                    "modelo": v.modelo,
                    "color": v.color,
                    "uso_vehiculo": v.uso_vehiculo.value,
                    "autorizado_combustible": v.autorizado_combustible,
                    "tipo_combustible": v.tipo_combustible.value,
                    "capacidad_tanque": v.capacidad_tanque,
                    "asignacion_combustible_semanal": v.asignacion_combustible_semanal,
                    "ultimo_kilometraje": v.ultimo_kilometraje,
                    "entidad_id": v.entidad_id,
                    "entidad_nombre": v.entidad.nombre if v.entidad else None
                } for v in vehiculos
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/vehiculos/{vehiculo_id}")
async def actualizar_vehiculo_combustible(
    vehiculo_id: UUID,
    request: VehiculoCombustibleUpdate,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Actualiza la autorización y parámetros de combustible de un vehículo.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR, RolTipo.ADMIN_ENTIDAD]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes.")
        
    try:
        from app.models.vehiculo import Vehiculo
        from app.models.enums import UsoVehiculo, TipoCombustible
        
        query = select(Vehiculo).where(Vehiculo.id == vehiculo_id, Vehiculo.activo == True)
        res = await db.execute(query)
        vehiculo = res.scalar_one_or_none()
        
        if not vehiculo:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado")
            
        # Filtro de seguridad por entidad para ADMIN_ENTIDAD
        if usuario.rol == RolTipo.ADMIN_ENTIDAD and vehiculo.entidad_id != usuario.entidad_id:
            raise HTTPException(status_code=403, detail="No tienes permisos para modificar este vehículo")
            
        # Actualizaciones permitidas
        if request.autorizado_combustible is not None:
            vehiculo.autorizado_combustible = request.autorizado_combustible
            
        if request.uso_vehiculo is not None:
            try:
                vehiculo.uso_vehiculo = UsoVehiculo(request.uso_vehiculo)
            except ValueError:
                raise HTTPException(status_code=400, detail="Uso de vehículo inválido")
                
        if request.tipo_combustible is not None:
            try:
                vehiculo.tipo_combustible = TipoCombustible(request.tipo_combustible)
            except ValueError:
                raise HTTPException(status_code=400, detail="Tipo de combustible inválido")
                
        if request.capacidad_tanque is not None:
            if request.capacidad_tanque < 0:
                raise HTTPException(status_code=400, detail="La capacidad del tanque no puede ser negativa")
            vehiculo.capacidad_tanque = request.capacidad_tanque
            
        if request.asignacion_combustible_semanal is not None:
            if request.asignacion_combustible_semanal < 0:
                raise HTTPException(status_code=400, detail="La asignación semanal no puede ser negativa")
            vehiculo.asignacion_combustible_semanal = request.asignacion_combustible_semanal
            
        if request.entidad_id is not None:
            # Solo comandantes/admin_base pueden reasignar entidades
            if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
                raise HTTPException(status_code=403, detail="No puedes reasignar la entidad de un vehículo")
            vehiculo.entidad_id = request.entidad_id
            
        await db.commit()
        return {"status": "success", "message": "Vehículo actualizado con éxito"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# --- Endpoint: Creación Individual de Vehículo ---

class VehiculoCreateRequest(BaseModel):
    placa: str = Field(..., max_length=20)
    entidad_id: UUID
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    año: Optional[int] = None
    tipo: Optional[str] = None
    uso_vehiculo: Optional[str] = "particular"
    tipo_combustible: Optional[str] = "gasolina"
    capacidad_tanque: Optional[float] = 0.0
    asignacion_combustible_semanal: Optional[float] = 0.0
    autorizado_combustible: Optional[bool] = False

@router.post("/vehiculos")
async def crear_vehiculo_individual(
    request: VehiculoCreateRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Registra un vehículo individual en el parque automotor con placa y entidad obligatorios.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")

    try:
        from app.models.vehiculo import Vehiculo
        from app.models.entidad_civil import EntidadCivil
        from app.models.enums import UsoVehiculo, TipoCombustible

        placa_normalizada = request.placa.strip().upper()
        if not placa_normalizada:
            raise HTTPException(status_code=400, detail="La placa es obligatoria.")

        # Validar placa única
        query_existente = select(Vehiculo).where(
            func.upper(Vehiculo.placa) == placa_normalizada,
            Vehiculo.activo == True
        )
        res_existente = await db.execute(query_existente)
        if res_existente.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Ya existe un vehículo activo con la placa {placa_normalizada}.")

        # Validar que la entidad existe
        query_entidad = select(EntidadCivil).where(
            EntidadCivil.id == request.entidad_id,
            EntidadCivil.activo == True
        )
        res_entidad = await db.execute(query_entidad)
        if not res_entidad.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="La entidad seleccionada no existe o no está activa.")

        # Parsear enums con fallback seguro
        try:
            uso_v = UsoVehiculo(request.uso_vehiculo) if request.uso_vehiculo else UsoVehiculo.particular
        except ValueError:
            uso_v = UsoVehiculo.particular
        try:
            tipo_c = TipoCombustible(request.tipo_combustible) if request.tipo_combustible else TipoCombustible.gasolina
        except ValueError:
            tipo_c = TipoCombustible.gasolina

        nuevo_vehiculo = Vehiculo(
            id=uuid.uuid4(),
            placa=placa_normalizada,
            marca=request.marca.strip() if request.marca and request.marca.strip() else "S/M",
            modelo=request.modelo.strip() if request.modelo and request.modelo.strip() else "S/M",
            color=request.color.strip() if request.color and request.color.strip() else "S/C",
            año=request.año,
            tipo=request.tipo,
            entidad_id=request.entidad_id,
            uso_vehiculo=uso_v,
            tipo_combustible=tipo_c,
            autorizado_combustible=request.autorizado_combustible or False,
            capacidad_tanque=request.capacidad_tanque or 0.0,
            asignacion_combustible_semanal=request.asignacion_combustible_semanal or 0.0,
            ultimo_kilometraje=0,
            activo=True
        )
        db.add(nuevo_vehiculo)
        await db.commit()
        return {"status": "success", "message": f"Vehículo {placa_normalizada} registrado con éxito.", "id": nuevo_vehiculo.id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear el vehículo: {str(e)}")


# --- Endpoint: KPIs del Dashboard de Combustible ---

@router.get("/dashboard-kpis")
async def obtener_dashboard_kpis(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Devuelve los KPIs compactos del módulo de combustible para el Dashboard del Comandante.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes.")

    try:
        from app.models.solicitud_combustible import SolicitudCombustible
        from app.models.abastecimiento import Abastecimiento
        from app.models.vehiculo import Vehiculo
        from app.models.usuario import Usuario as UsuarioModel
        from sqlalchemy.orm import selectinload
        import uuid as uuid_mod

        inicio_semana, fin_semana = await abastecimiento_service.obtener_rango_semana()

        # 1. Total litros surtidos esta semana
        q_litros = select(func.coalesce(func.sum(Abastecimiento.cantidad_abastecida), 0.0)).where(
            Abastecimiento.fecha >= inicio_semana,
            Abastecimiento.fecha <= fin_semana
        )
        total_litros = (await db.execute(q_litros)).scalar() or 0.0

        # 2. Total cargas esta semana
        q_cargas = select(func.count(Abastecimiento.id)).where(
            Abastecimiento.fecha >= inicio_semana,
            Abastecimiento.fecha <= fin_semana
        )
        total_cargas = (await db.execute(q_cargas)).scalar() or 0

        # 3. Solicitudes pendientes
        q_pendientes = select(func.count(SolicitudCombustible.id)).where(
            SolicitudCombustible.estado == EstadoSolicitudCombustible.pendiente
        )
        solicitudes_pendientes = (await db.execute(q_pendientes)).scalar() or 0

        # 4. Alertas de fraude esta semana
        q_alertas = select(func.count(Abastecimiento.id)).where(
            Abastecimiento.fecha >= inicio_semana,
            Abastecimiento.fecha <= fin_semana,
            Abastecimiento.tiene_alerta == True
        )
        alertas_fraude = (await db.execute(q_alertas)).scalar() or 0

        # 5. Stock total de combustible (todos los tanques activos)
        q_stock = select(func.coalesce(func.sum(TanqueCombustible.cantidad_actual), 0.0)).where(
            TanqueCombustible.activo == True
        )
        stock_total = (await db.execute(q_stock)).scalar() or 0.0

        # 6. Estado de tanques
        q_tanques = select(TanqueCombustible).where(TanqueCombustible.activo == True).order_by(TanqueCombustible.nombre.asc())
        tanques_res = await db.execute(q_tanques)
        tanques = tanques_res.scalars().all()

        tanques_data = [
            {
                "id": str(t.id),
                "nombre": t.nombre,
                "tipo_combustible": t.tipo_combustible.value,
                "capacidad_maxima": t.capacidad_maxima,
                "cantidad_actual": t.cantidad_actual,
                "porcentaje": round((t.cantidad_actual / t.capacidad_maxima) * 100, 1) if t.capacidad_maxima > 0 else 0
            } for t in tanques
        ]

        # 7. Últimos 15 abastecimientos
        q_ultimos = (
            select(Abastecimiento)
            .options(selectinload(Abastecimiento.vehiculo), selectinload(Abastecimiento.bombero))
            .order_by(Abastecimiento.fecha.desc())
            .limit(15)
        )
        ultimos_res = await db.execute(q_ultimos)
        ultimos = ultimos_res.scalars().all()

        ultimos_data = [
            {
                "id": str(a.id),
                "placa": a.vehiculo.placa if a.vehiculo else "—",
                "bombero": f"{a.bombero.nombre} {a.bombero.apellido}" if a.bombero else "—",
                "litros": a.cantidad_abastecida,
                "fecha": a.fecha.isoformat(),
                "tiene_alerta": a.tiene_alerta
            } for a in ultimos
        ]

        return {
            "status": "success",
            "data": {
                "total_litros_semana": round(total_litros, 1),
                "total_cargas_semana": total_cargas,
                "solicitudes_pendientes": solicitudes_pendientes,
                "alertas_fraude_semana": alertas_fraude,
                "stock_combustible_total": round(stock_total, 1),
                "tanques": tanques_data,
                "ultimos_abastecimientos": ultimos_data
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener KPIs: {str(e)}")


# --- Endpoints: CRUD de Tanques de Combustible ---

class TanqueCreateRequest(BaseModel):
    nombre: str = Field(..., max_length=100)
    tipo_combustible: str  # 'gasolina' | 'diesel'
    capacidad_maxima: float
    cantidad_actual: float

class TanqueUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    capacidad_maxima: Optional[float] = None

@router.post("/tanques")
async def crear_tanque(
    request: TanqueCreateRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Registra un nuevo tanque de combustible en la bomba de la base.
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")

    try:
        from app.models.enums import TipoCombustible

        nombre_limpio = request.nombre.strip()
        if not nombre_limpio:
            raise HTTPException(status_code=400, detail="El nombre del tanque es obligatorio.")

        if request.capacidad_maxima <= 0:
            raise HTTPException(status_code=400, detail="La capacidad máxima debe ser mayor a 0.")
        if request.cantidad_actual < 0:
            raise HTTPException(status_code=400, detail="La cantidad actual no puede ser negativa.")
        if request.cantidad_actual > request.capacidad_maxima:
            raise HTTPException(status_code=400, detail="La cantidad actual no puede exceder la capacidad máxima.")

        try:
            tipo_c = TipoCombustible(request.tipo_combustible)
        except ValueError:
            raise HTTPException(status_code=400, detail="Tipo de combustible inválido. Use 'gasolina' o 'diesel'.")

        nuevo_tanque = TanqueCombustible(
            id=uuid.uuid4(),
            nombre=nombre_limpio,
            tipo_combustible=tipo_c,
            capacidad_maxima=request.capacidad_maxima,
            cantidad_actual=request.cantidad_actual,
            activo=True
        )
        db.add(nuevo_tanque)
        await db.commit()
        return {
            "status": "success",
            "message": f"Tanque '{nombre_limpio}' registrado con éxito.",
            "id": nuevo_tanque.id
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear el tanque: {str(e)}")

@router.patch("/tanques/{tanque_id}")
async def editar_tanque(
    tanque_id: UUID,
    request: TanqueUpdateRequest,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Edita el nombre y/o la capacidad máxima de un tanque.
    La cantidad actual NO es editable desde este endpoint (solo vía lectura semanal y abastecimientos).
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")

    try:
        query = select(TanqueCombustible).where(TanqueCombustible.id == tanque_id, TanqueCombustible.activo == True)
        res = await db.execute(query)
        tanque = res.scalar_one_or_none()

        if not tanque:
            raise HTTPException(status_code=404, detail="Tanque no encontrado o desactivado.")

        if request.nombre is not None:
            nombre_limpio = request.nombre.strip()
            if not nombre_limpio:
                raise HTTPException(status_code=400, detail="El nombre del tanque no puede estar vacío.")
            tanque.nombre = nombre_limpio

        if request.capacidad_maxima is not None:
            if request.capacidad_maxima <= 0:
                raise HTTPException(status_code=400, detail="La capacidad máxima debe ser mayor a 0.")
            tanque.capacidad_maxima = request.capacidad_maxima

        await db.commit()
        return {"status": "success", "message": f"Tanque '{tanque.nombre}' actualizado con éxito."}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al editar el tanque: {str(e)}")

@router.delete("/tanques/{tanque_id}")
async def desactivar_tanque(
    tanque_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Desactiva un tanque de combustible (soft-delete).
    """
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
        raise HTTPException(status_code=403, detail="Permisos insuficientes. Rol de mando requerido.")

    try:
        from app.models.abastecimiento import Abastecimiento

        query = select(TanqueCombustible).where(TanqueCombustible.id == tanque_id, TanqueCombustible.activo == True)
        res = await db.execute(query)
        tanque = res.scalar_one_or_none()

        if not tanque:
            raise HTTPException(status_code=404, detail="Tanque no encontrado o ya desactivado.")

        # Verificar si tiene abastecimientos en la semana actual
        inicio_semana, _ = await abastecimiento_service.obtener_rango_semana()
        q_abast = select(func.count(Abastecimiento.id)).where(
            Abastecimiento.tanque_id == tanque_id,
            Abastecimiento.fecha >= inicio_semana
        )
        abast_semana = (await db.execute(q_abast)).scalar() or 0

        if abast_semana > 0:
            raise HTTPException(
                status_code=400,
                detail=f"No se puede desactivar: el tanque tiene {abast_semana} abastecimiento(s) vinculado(s) esta semana."
            )

        tanque.activo = False
        await db.commit()
        return {"status": "success", "message": f"Tanque '{tanque.nombre}' desactivado con éxito."}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al desactivar el tanque: {str(e)}")
