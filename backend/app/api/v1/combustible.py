"""
Enrutador de Combustible (Aegis Fuel API).
Controlador de rutas para el módulo de control de combustible y parque automotor.
"""
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual
from app.models.usuario import Usuario
from app.models.enums import RolTipo, EstadoSolicitudCombustible
from app.models.tanque_combustible import TanqueCombustible
from app.services.abastecimiento_service import abastecimiento_service
from app.services.import_combustible_service import import_combustible_service

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

@router.post("/importar-excel")
async def importar_excel_parque(
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
            db, contenido, usuario.id
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
