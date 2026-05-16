"""
API Endpoints para el Comandante de la Unidad.
Gestión de Alcabalas y Usuarios Temporales.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual
from app.models.usuario import Usuario
from app.models.enums import RolTipo
# Importar esquemas locales para evitar circulares
from app.schemas.alcabala_evento import (
    PuntoAccesoCrear, PuntoAccesoSalida, 
    GuardiaTurnoCrear, GuardiaTurnoSalida,
    PersonalActivoSalida
)
from app.services.alcabala_mgmt_service import alcabala_service
from app.services.comando_service import comando_service
from app.schemas.comando import PaseBaseCrear, PuestoReservadoSalida
from app.schemas.codigo_qr import CodigoQRSalida
from app.services.configuracion_service import configuracion_service
from app.schemas.configuracion import ConfiguracionSalidasUpdate

router = APIRouter()

def verificar_comandante(usuario: Usuario = Depends(obtener_usuario_actual)):
    if usuario.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el Comandante, Administrador de Base o Supervisor pueden realizar esta acción"
        )
    return usuario

@router.post("/puntos-acceso", response_model=PuntoAccesoSalida)
async def crear_punto(
    datos: PuntoAccesoCrear,
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Registra una nueva alcabala física y crea su usuario fijo."""
    return await alcabala_service.crear_punto_acceso(db, datos.nombre, datos.ubicacion)

@router.get("/puntos-acceso", response_model=List[PuntoAccesoSalida])
@router.get("/alcabalas", response_model=List[PuntoAccesoSalida])
async def listar_puntos(
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(obtener_usuario_actual)
):
    """Lista todos los puntos de acceso operativos con sus claves."""
    return await alcabala_service.listar_puntos(db)

@router.patch("/puntos-acceso/{id}", response_model=PuntoAccesoSalida)
async def actualizar_punto(
    id: UUID,
    datos: PuntoAccesoCrear,
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Actualiza datos básicos de la alcabala."""
    punto = await alcabala_service.actualizar_punto_acceso(db, id, datos.nombre, datos.ubicacion)
    if not punto:
        raise HTTPException(status_code=404, detail="Punto no encontrado")
    return punto

@router.delete("/puntos-acceso/{id}")
async def eliminar_punto(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Elimina definitivamente una alcabala y su usuario asociado."""
    exito = await alcabala_service.eliminar_punto_acceso(db, id)
    if not exito:
        raise HTTPException(status_code=404, detail="Punto no encontrado")
    return {"mensaje": "Alcabala desarticulada del sistema con éxito"}

@router.post("/puntos-acceso/{id}/regenerar-clave")
async def regenerar_clave(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Fuerza un cambio de clave táctica por regeneración de salt."""
    clave = await alcabala_service.regenerar_clave_emergencia(db, id)
    if not clave:
        raise HTTPException(status_code=404, detail="Punto no encontrado")
    return {"nueva_clave": clave}

@router.get("/personal-activo", response_model=List[PersonalActivoSalida])
async def listar_personal_activo(
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Panel del Comandante: Quién está operando cada punto ahora mismo."""
    return await alcabala_service.listar_personal_activo_mando(db)

@router.get("/mi-situacion")
async def obtener_situacion_actual(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Retorna el estado del guardia: Punto asignado y si ya se identificó.
    """
    punto = await alcabala_service.obtener_punto_de_usuario(db, usuario.id)
    if not punto:
        raise HTTPException(status_code=404, detail="Usuario no vinculado a una alcabala fija")
    
    identificacion = await alcabala_service.obtener_mi_identificacion_actual(db, usuario.id)

    is_guard = usuario.rol == RolTipo.ALCABALA
    stats_data = await alcabala_service.obtener_metricas_punto(db, punto.nombre, tactico=is_guard)

    return {
        "punto": {
            "id": str(punto.id),
            "nombre": punto.nombre,
            "ubicacion": punto.ubicacion
        },
        "identificado": identificacion is not None,
        "datos_guardia": identificacion if identificacion else {
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "grado": "" # El usuario base de alcabala no tiene grado, se define en el relevo
        },
        "stats": {
            **stats_data,
            "infracciones": 0, # TODO: Integrar con servicio de infracciones cuando esté disponible
        }
    }

@router.post("/identificar-guardia", response_model=GuardiaTurnoSalida)
async def identificar_guardia(
    datos: GuardiaTurnoCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Protocolo mandatorio de identificación: 
    El guardia registra su ingreso físico a la alcabala.
    """
    if usuario.rol != RolTipo.ALCABALA:
        raise HTTPException(status_code=403, detail="Esta acción es solo para el personal en alcabala")
        
    return await alcabala_service.identificar_guardia_entrante(db, datos.punto_id, usuario.id, datos.model_dump())

@router.get("/puestos-reservados", response_model=List[PuestoReservadoSalida])
async def listar_puestos_reservados(
    zona_id: Optional[UUID] = None,
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Lista todos los puestos con estado 'reservado_base'."""
    return await comando_service.obtener_puestos_reservados_base(db, zona_id)

@router.post("/pases-reservados", response_model=CodigoQRSalida)
async def generar_pase_reservado(
    datos: PaseBaseCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(verificar_comandante)
):
    """Genera un pase para un puesto reservado de la base."""
    try:
        return await comando_service.generar_pase_base(db, datos.zona_id, datos.model_dump(), usuario.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/pases-reservados/{id}")
async def liberar_pase_reservado(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(verificar_comandante)
):
    """Anula un pase de base activo y libera el cupo/puesto."""
    exito = await comando_service.liberar_pase_base(db, id, usuario.id)
    if not exito:
        raise HTTPException(status_code=404, detail="Pase no encontrado o no es de tipo base")
    return {"mensaje": "Puesto liberado y pase anulado con éxito"}

@router.get("/configuracion-salidas")
async def obtener_config_salidas(
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Retorna los ajustes actuales de gestión de salidas."""
    return await configuracion_service.get_config_salidas(db)

@router.patch("/configuracion-salidas")
async def actualizar_config_salidas(
    datos: ConfiguracionSalidasUpdate,
    db: AsyncSession = Depends(obtener_db),
    _ = Depends(verificar_comandante)
):
    """Actualiza las preferencias de salida de la base."""
    if datos.sync_parquero is not None:
        await configuracion_service.set_valor(
            db, "BASE_EXIT_SYNC_PARKING", "true" if datos.sync_parquero else "false",
            "Sincronizar salida de base con reporte de parquero"
        )
    
    if datos.mass_time is not None:
        await configuracion_service.set_valor(
            db, "BASE_EXIT_MASS_TIME", datos.mass_time,
            "Hora programada para expulsión masiva (HH:MM)"
        )
        
    return await configuracion_service.get_config_salidas(db)
