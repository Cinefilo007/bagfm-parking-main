from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from app.models.usuario import Usuario
from app.models.infraccion import Infraccion
from app.models.enums import RolTipo, InfraccionTipo, GravedadInfraccion

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.schemas.infraccion import InfraccionCrear, InfraccionSalida, InfraccionResolver
from app.services.infraccion_service import infraccion_service
from app.services.ai_vision_service import ai_vision_service

router = APIRouter()

# Solo SUPERVISOR, ADMIN_BASE o COMANDANTE pueden registrar infracciones
DEPENDENCY_SUPERVISOR = Depends(require_rol([RolTipo.SUPERVISOR, RolTipo.ADMIN_BASE, RolTipo.COMANDANTE]))

@router.get("/me", response_model=List[InfraccionSalida])
async def mis_infracciones(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol([RolTipo.SOCIO]))
):
    """
    Retorna las infracciones del socio autenticado.
    """
    from app.models.vehiculo import Vehiculo
    # Obtener IDs de vehículos del socio
    res_vehs = await db.execute(select(Vehiculo.id).where(Vehiculo.socio_id == usuario_actual.id))
    vehiculo_ids = [r[0] for r in res_vehs.all()]

    if not vehiculo_ids:
        return []

    query = select(Infraccion).where(Infraccion.vehiculo_id.in_(vehiculo_ids)).order_by(Infraccion.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("", response_model=List[InfraccionSalida])
async def listar_infracciones(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """
    Lista todas las infracciones (historial completo).
    """
    from sqlalchemy.orm import selectinload
    query = select(Infraccion).options(selectinload(Infraccion.vehiculo), selectinload(Infraccion.infractor)).order_by(Infraccion.created_at.desc())
    result = await db.execute(query)
    infracciones = result.scalars().all()
    
    return await enrich_infracciones_temporales(db, infracciones)

@router.get("/activas", response_model=List[InfraccionSalida])
async def listar_infracciones_activas(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """
    Lista las infracciones que aún no han sido resueltas.
    """
    infracciones = await infraccion_service.obtener_activas(db)
    return await enrich_infracciones_temporales(db, infracciones)

async def enrich_infracciones_temporales(db: AsyncSession, infracciones: List[Infraccion]) -> List[InfraccionSalida]:
    from app.models.codigo_qr import CodigoQR
    from app.schemas.infraccion import UsuarioBasico
    
    salida = []
    for inf in infracciones:
        inf_dto = InfraccionSalida.model_validate(inf)
        if not inf_dto.infractor and inf.vehiculo:
            # Buscar el QR más reciente asociado a la placa
            qr_temp = await db.execute(
                select(CodigoQR)
                .where(CodigoQR.vehiculo_placa == inf.vehiculo.placa)
                .order_by(CodigoQR.created_at.desc())
                .limit(1)
            )
            qr = qr_temp.scalar_one_or_none()
            if qr:
                inf_dto.infractor = UsuarioBasico(
                    nombre=qr.nombre_portador or "Visitante Temporal",
                    apellido="",
                    telefono=qr.telefono_portador,
                    rol="VISITANTE TEMPORAL"
                )
        salida.append(inf_dto)
    return salida

@router.post("/analizar-evidencias", status_code=status.HTTP_200_OK)
async def analizar_evidencias_endpoint(
    archivos: List[UploadFile] = File(...),
    usuario_actual: Usuario = DEPENDENCY_SUPERVISOR
):
    """
    Envía hasta 3 fotos al servicio de IA (Gemini) para extraer placa, marca y modelo.
    """
    files_data = []
    mime_types = []
    for f in archivos[:3]:
        data = await f.read()
        if data:
            files_data.append(data)
            mime_types.append(f.content_type)
    
    resultado = await ai_vision_service.analizar_evidencias_vehiculo(files_data, mime_types)
    return resultado

@router.get("/buscar-vehiculo/{placa}")
async def buscar_vehiculo_endpoint(
    placa: str,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_SUPERVISOR
):
    """
    Busca un vehículo por placa en socios permanentes y pases temporales.
    """
    from app.models.vehiculo import Vehiculo
    from app.models.codigo_qr import CodigoQR
    from sqlalchemy.orm import selectinload
    
    placa_upper = placa.upper().strip()
    
    # 1. Buscar en socios permanentes
    stmt = select(Vehiculo).options(selectinload(Vehiculo.socio)).where(Vehiculo.placa == placa_upper)
    res = await db.execute(stmt)
    veh_perm = res.scalar_one_or_none()
    
    if veh_perm and veh_perm.socio:
        return {
            "encontrado": True,
            "tipo": "PERMANENTE",
            "placa": veh_perm.placa,
            "marca": veh_perm.marca,
            "modelo": veh_perm.modelo,
            "responsable": {
                "nombre": veh_perm.socio.nombre,
                "apellido": veh_perm.socio.apellido,
                "telefono": veh_perm.socio.telefono,
                "rol": veh_perm.socio.rol.name
            }
        }
        
    # 2. Buscar en pases temporales (codigos_qr)
    stmt_qr = select(CodigoQR).where(CodigoQR.vehiculo_placa == placa_upper).order_by(CodigoQR.created_at.desc())
    res_qr = await db.execute(stmt_qr)
    qr_temp = res_qr.scalar_one_or_none() # Tomar el más reciente
    
    if qr_temp:
        return {
            "encontrado": True,
            "tipo": "TEMPORAL",
            "placa": qr_temp.vehiculo_placa,
            "marca": qr_temp.vehiculo_marca,
            "modelo": qr_temp.vehiculo_modelo,
            "responsable": {
                "nombre": qr_temp.nombre_portador or "Desconocido",
                "apellido": "",
                "telefono": qr_temp.telefono_portador,
                "rol": "VISITANTE_TEMPORAL"
            }
        }
        
    return {"encontrado": False}

@router.post("", response_model=InfraccionSalida, status_code=status.HTTP_201_CREATED)
async def registrar_infraccion(
    tipo: InfraccionTipo = Form(...),
    gravedad: GravedadInfraccion = Form(GravedadInfraccion.leve),
    descripcion: str = Form(...),
    vehiculo_placa: Optional[str] = Form(None),
    vehiculo_marca: Optional[str] = Form(None),
    vehiculo_modelo: Optional[str] = Form(None),
    zona_id: Optional[UUID] = Form(None),
    bloquea_salida: bool = Form(True),
    bloquea_acceso_futuro: bool = Form(False),
    latitud: Optional[float] = Form(None),
    longitud: Optional[float] = Form(None),
    archivos: List[UploadFile] = File(None),
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_SUPERVISOR
):
    """
    Registra una nueva infracción con soporte para evidencias fotográficas y GPS.
    Si el vehículo no existe, lo crea como "huérfano".
    """
    # 1. Subir archivos si existen
    urls_evidencia = []
    if archivos:
        files_to_upload = [f for f in archivos if f.size > 0]
        if files_to_upload:
            from app.services.storage_service import storage_service
            urls_evidencia = await storage_service.subir_multiples_evidencias(files_to_upload[:3])

    # 2. Buscar o crear vehiculo por placa
    vehiculo_id = None
    vehiculo_obj = None
    if vehiculo_placa:
        from app.models.vehiculo import Vehiculo
        placa_upper = vehiculo_placa.upper().strip()
        stmt = select(Vehiculo).where(Vehiculo.placa == placa_upper)
        res = await db.execute(stmt)
        vehiculo_obj = res.scalar_one_or_none()
        
        if vehiculo_obj:
            vehiculo_id = vehiculo_obj.id
        else:
            # Crear vehículo huérfano
            nuevo_veh = Vehiculo(
                placa=placa_upper,
                marca=vehiculo_marca or "DESCONOCIDA",
                modelo=vehiculo_modelo or "DESCONOCIDO",
                color="DESCONOCIDO",
                socio_id=None,
                activo=True
            )
            db.add(nuevo_veh)
            await db.flush()
            vehiculo_id = nuevo_veh.id
            vehiculo_obj = nuevo_veh

    # 3. Mapear a objeto Crear
    datos_dict = {
        "tipo": tipo,
        "gravedad": gravedad,
        "descripcion": descripcion,
        "vehiculo_id": vehiculo_id,
        "usuario_id": vehiculo_obj.socio_id if vehiculo_obj else None,
        "zona_id": zona_id,
        "bloquea_salida": bloquea_salida,
        "bloquea_acceso_futuro": bloquea_acceso_futuro,
        "fotos_evidencia": urls_evidencia,
        "latitud_infraccion": latitud,
        "longitud_infraccion": longitud
    }
    
    from app.schemas.infraccion import InfraccionCrear
    datos = InfraccionCrear(**datos_dict)
    
    resultado = await infraccion_service.registrar(db, datos, usuario_actual.id)
    
    # Notificar si hay un dueño asociado
    if vehiculo_obj and vehiculo_obj.socio_id:
        from app.services.notificacion_service import notificacion_service
        try:
            await notificacion_service.notificar_infraccion_socio(
                db, vehiculo.socio_id, vehiculo.placa, tipo.value, gravedad.value
            )
        except Exception as e:
            import logging
            logging.error(f"Error al intentar notificar infracción: {e}")
            
    return resultado

@router.put("/{id}/resolver", response_model=InfraccionSalida)
async def resolver_infraccion(
    id: UUID,
    datos: InfraccionResolver,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol([RolTipo.ADMIN_BASE, RolTipo.COMANDANTE, RolTipo.SUPERVISOR_PARQUEROS, RolTipo.ADMIN_ENTIDAD, RolTipo.SUPERVISOR]))
):
    """
    Resuelve o perdona una infracción.
    Supervisores de parqueros y Admin de Entidad solo pueden resolver faltas leves.
    """
    try:
        return await infraccion_service.resolver(db, id, datos, usuario_actual)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN if "permisos" in str(e).lower() else status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/lista-negra")
async def obtener_lista_negra(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol([RolTipo.ADMIN_BASE, RolTipo.COMANDANTE, RolTipo.SUPERVISOR_PARQUEROS, RolTipo.ADMIN_ENTIDAD, RolTipo.SUPERVISOR]))
):
    """
    Retorna los vehículos y usuarios en la lista negra (bloquea_acceso_futuro=True)
    """
    from app.models.infraccion import Infraccion
    from app.models.vehiculo import Vehiculo
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    
    stmt = (
        select(Infraccion)
        .options(selectinload(Infraccion.vehiculo).selectinload(Vehiculo.socio))
        .where(Infraccion.bloquea_acceso_futuro == True, Infraccion.estado == "activa")
        .order_by(Infraccion.created_at.desc())
    )
    res = await db.execute(stmt)
    infracciones = res.scalars().all()
    
    lista = []
    for inf in infracciones:
        nombre = "DESCONOCIDO"
        cedula = "N/A"
        placa = inf.vehiculo.placa if inf.vehiculo else "S/P"
        
        if inf.vehiculo and inf.vehiculo.socio:
            nombre = inf.vehiculo.socio.nombre_completo
            cedula = inf.vehiculo.socio.cedula
            
        lista.append({
            "id": str(inf.id),
            "nombre": nombre,
            "cedula": cedula,
            "placa": placa,
            "motivo": inf.descripcion or inf.tipo.value,
            "bloqueado_at": inf.created_at.isoformat()
        })
        
    return lista
