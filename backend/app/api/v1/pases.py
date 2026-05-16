from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
from uuid import UUID

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.models.enums import RolTipo
from app.models.usuario import Usuario
from app.schemas.pases import LotePaseMasivoCrear, LotePaseMasivoSalida
from app.schemas.codigo_qr import CodigoQRSalida, CodigoQRUpdate
from app.services.pase_service import pase_service
from app.services.template_service import template_service
from app.models.alcabala_evento import LotePaseMasivo, SolicitudEvento
from app.models.codigo_qr import CodigoQR
from sqlalchemy import select

router = APIRouter()

# Roles autorizados para gestionar lotes masivos
ADMIN_ROLES = [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD]

@router.post("/lotes", response_model=LotePaseMasivoSalida, status_code=status.HTTP_201_CREATED)
async def crear_lote(
    datos: LotePaseMasivoCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Crea un lote masivo de pases simples o con portal."""
    return await pase_service.crear_lote(db, datos.model_dump(), usuario_actual.id)

@router.get("/lotes", response_model=List[LotePaseMasivoSalida])
async def listar_lotes(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES + [RolTipo.ALCABALA]))
):
    """Lista lotes de pases masivos. Para ADMIN_ENTIDAD excluye los lotes ya vencidos."""
    from sqlalchemy.orm import selectinload
    from datetime import date as date_type

    from sqlalchemy import func
    # Subconsulta para contar pases usados por lote
    usados_sub = select(
        CodigoQR.lote_id,
        func.count(CodigoQR.id).label("total_usados")
    ).where(CodigoQR.accesos_usados > 0).group_by(CodigoQR.lote_id).subquery()

    query = select(
        LotePaseMasivo,
        func.coalesce(usados_sub.c.total_usados, 0).label("pases_usados")
    ).outerjoin(
        usados_sub, LotePaseMasivo.id == usados_sub.c.lote_id
    ).options(
        selectinload(LotePaseMasivo.zona_asignada),
        selectinload(LotePaseMasivo.tipo_acceso_custom)
    )

    # Filtrar por entidad y excluir vencidos para ADMIN_ENTIDAD
    if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD and usuario_actual.entidad_id:
        query = query.where(
            LotePaseMasivo.entidad_id == usuario_actual.entidad_id,
            LotePaseMasivo.fecha_fin >= date_type.today()
        )

    query = query.order_by(LotePaseMasivo.created_at.desc())
    res = await db.execute(query)
    rows = res.all()
    
    # Mapear pases_usados al modelo para el schema
    lotes = []
    for row in rows:
        l = row.LotePaseMasivo
        l.pases_usados = row.pases_usados
        lotes.append(l)
        
    return lotes

@router.get("/lotes/disponibilidad")
async def obtener_disponibilidad_zona(
    zona_id: UUID,
    inicio: str,
    fin: str,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Calcula disponibilidad proyectada para una zona en un periodo."""
    from datetime import datetime
    try:
        ini_dt = datetime.strptime(inicio, '%Y-%m-%d').date()
        fin_dt = datetime.strptime(fin, '%Y-%m-%d').date()
    except:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (YYYY-MM-DD)")
        
    ocupacion = await pase_service.calcular_ocupacion_proyectada(db, zona_id, ini_dt, fin_dt)
    return {"ocupacion_proyectada": ocupacion}

@router.get("/lotes/validar-capacidad")
async def validar_capacidad(
    cantidad: int,
    inicio: str,
    fin: str,
    zona_id: UUID = None,
    tipo_acceso: str = 'general',
    tipo_acceso_custom_id: UUID = None,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Validación Inteligente de Capacidad v3.0 — 3 niveles con sugerencias."""
    from datetime import datetime as dt
    if not usuario_actual.entidad_id:
        raise HTTPException(status_code=400, detail="Usuario sin entidad asociada")
    
    try:
        ini_dt = dt.strptime(inicio, '%Y-%m-%d').date()
        fin_dt = dt.strptime(fin, '%Y-%m-%d').date()
    except:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (YYYY-MM-DD)")
    
    return await pase_service.validar_capacidad_completa(
        db, usuario_actual.entidad_id,
        zona_id, tipo_acceso, tipo_acceso_custom_id,
        cantidad, ini_dt, fin_dt
    )

@router.get("/lotes/sugerir-distribucion")
async def sugerir_distribucion(
    cantidad: int,
    inicio: str,
    fin: str,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Sugiere cómo repartir pases entre las zonas de la entidad."""
    from datetime import datetime
    if not usuario_actual.entidad_id:
        raise HTTPException(status_code=400, detail="Usuario sin entidad asociada")
        
    try:
        ini_dt = datetime.strptime(inicio, '%Y-%m-%d').date()
        fin_dt = datetime.strptime(fin, '%Y-%m-%d').date()
    except:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (YYYY-MM-DD)")

    return await pase_service.sugerir_distribucion_entidad(db, usuario_actual.entidad_id, cantidad, ini_dt, fin_dt)

@router.get("/lotes/{lote_id}", response_model=LotePaseMasivoSalida)
async def obtener_lote(
    lote_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES + [RolTipo.ALCABALA]))
):
    """Obtiene detalle de un lote específico."""
    lote = await db.get(LotePaseMasivo, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return lote

@router.get("/lotes/{lote_id}/pases", response_model=List[CodigoQRSalida])
async def listar_pases_lote(
    lote_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES + [RolTipo.ALCABALA]))
):
    """Lista los pases individuales de un lote (Drill-down)."""
    query = select(CodigoQR).where(CodigoQR.lote_id == lote_id).order_by(CodigoQR.serial_legible.asc())
    res = await db.execute(query)
    return res.scalars().all()

@router.post("/lotes/{lote_id}/generar-zip")
async def generar_zip_endpoint(
    lote_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Dispara la generación del ZIP y subida a Supabase."""
    url = await pase_service.generar_zip_lote(db, lote_id)
    if not url:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return {"url": url}

@router.get("/lotes/{lote_id}/pdf")
async def generar_pdf_lote(
    lote_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES + [RolTipo.ALCABALA]))
):
    """Genera (o recupera) el PDF masivo del lote para descarga inmediata."""
    lote = await db.get(LotePaseMasivo, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    from fastapi.responses import StreamingResponse
    from app.services.pdf_service import pdf_service
    
    # Generamos el buffer en memoria
    pdf_buffer = await pdf_service.generar_pdf_lote(db, lote_id)
    
    # Intentamos subirlo en segundo plano (opcional) para persistencia
    import asyncio
    asyncio.create_task(pase_service.generar_pdf_masivo(db, lote_id))
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=PASES_{lote.codigo_serial}.pdf"
        }
    )

@router.get("/lotes/{lote_id}/excel")
async def descargar_excel_lote(
    lote_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES + [RolTipo.ALCABALA]))
):
    """Genera y sirve un Excel con los links de acceso al portal para cada pase."""
    lote = await db.get(LotePaseMasivo, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
        
    from fastapi.responses import StreamingResponse
    excel_buffer = await pase_service.generar_excel_lote(db, lote_id)
    
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=LISTADO_PASES_{lote.codigo_serial}.xlsx"
        }
    )

@router.post("/lotes/{lote_id}/importar-excel")
async def importar_excel_lote(
    lote_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Importa identificaciones para un lote Tipo B."""
    lote = await db.get(LotePaseMasivo, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
        
    contenido = await file.read()
    await pase_service.procesar_excel_identificado(db, lote, contenido, usuario_actual.id)
    await db.commit()
    return {"status": "ok", "pases_generados": lote.cantidad_pases}

@router.post("/lotes/{lote_id}/importar-json")
async def importar_json_lote(
    lote_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Importa identificaciones para un lote Tipo B desde JSON prevalidado en el Frontend."""
    lote = await db.get(LotePaseMasivo, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
        
    filas = payload.get("pases", [])
    await pase_service.procesar_json_identificado(db, lote, filas, usuario_actual.id)
    await db.commit()
    return {"status": "ok", "pases_generados": lote.cantidad_pases}

from fastapi import BackgroundTasks
from app.schemas.pases import LotePaseMasivoEnvioCorreo
from app.services.correo_service import correo_masivo_service

@router.post("/lotes/{lote_id}/enviar-correos", status_code=status.HTTP_202_ACCEPTED)
async def enviar_correos_lote_endpoint(
    lote_id: UUID,
    datos: LotePaseMasivoEnvioCorreo,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Encola el envío masivo de correos usando Resend en segundo plano."""
    lote = await db.get(LotePaseMasivo, lote_id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
        
    background_tasks.add_task(
        correo_masivo_service.despachar_correos_lote,
        db,
        lote_id,
        datos.asunto,
        datos.cuerpo,
        datos.adjuntar_pdf,
        datos.tipo_envio,
        datos.estilo_carnet,
        datos.formato_carnet
    )
    
    return {"status": "accepted", "message": "Proceso de despacho de correos iniciado en segundo plano."}

@router.post("/lotes/{lote_id}/pases/{pase_id}/enviar-correo", status_code=status.HTTP_202_ACCEPTED)
async def enviar_correo_individual_endpoint(
    lote_id: UUID,
    pase_id: UUID,
    datos: LotePaseMasivoEnvioCorreo,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Encola el envío individual de correo para un pase específico."""
    background_tasks.add_task(
        correo_masivo_service.enviar_correo_individual,
        db,
        pase_id,
        datos.asunto,
        datos.cuerpo,
        datos.adjuntar_pdf,
        datos.tipo_envio,
        datos.estilo_carnet,
        datos.formato_carnet
    )
    return {"status": "accepted", "message": "Re-envío de correo individual iniciado."}

@router.get("/template", status_code=status.HTTP_200_OK)
async def descargar_plantilla_pases(
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Descarga la plantilla Excel para pases identificados."""
    excel_data = template_service.generar_excel_pases_template()
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=TEMPLATE_PASES_IDENTIFICADOS.xlsx"
        }
    )

@router.delete("/lotes/{lote_id}")
async def eliminar_lote(
    lote_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Elimina un lote completo y sus QRs asociados."""
    exito = await pase_service.eliminar_lote(db, lote_id)
    if not exito:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return {"status": "ok", "message": "Lote eliminado correctamente"}

@router.patch("/{pase_id}", response_model=CodigoQRSalida)
async def actualizar_pase(
    pase_id: UUID,
    datos: CodigoQRUpdate,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(ADMIN_ROLES))
):
    """Actualiza datos de un pase individual."""
    pase = await pase_service.actualizar_pase(db, pase_id, datos.model_dump(exclude_unset=True))
    if not pase:
        raise HTTPException(status_code=404, detail="Pase no encontrado")
    return pase

# ====== ENDPOINTS PÚBLICOS PARA PORTAL DE AUTOREGISTRO ======

@router.get("/portal/lote/{serial}")
async def obtener_lote_publico(serial: str, db: AsyncSession = Depends(obtener_db)):
    """Obtiene información básica de un lote por su serial legible (PÚBLICO)."""
    query = select(LotePaseMasivo).where(LotePaseMasivo.codigo_serial == serial)
    res = await db.execute(query)
    lote = res.scalar_one_or_none()
    
    if not lote:
        raise HTTPException(status_code=404, detail="Enlace táctico no válido")
    
    # Solo permitimos ver si el lote es de autoregistro o identificado (para consulta)
    # pero no el tipo simple que es de control interno puro.
    from app.models.enums import PasseTipo
    if lote.tipo_pase == PasseTipo.simple:
        raise HTTPException(status_code=403, detail="Este lote no tiene portal público")

    return {
        "id": lote.id,
        "nombre_evento": lote.nombre_evento,
        "fecha_inicio": lote.fecha_inicio,
        "fecha_fin": lote.fecha_fin,
        "tipo_pase": lote.tipo_pase,
        "serial_lote": lote.codigo_serial
    }

@router.get("/portal/pase/{token}")
async def obtener_pase_publico(token: str, db: AsyncSession = Depends(obtener_db)):
    """Obtiene los datos de un pase específico por su token (PÚBLICO).
    Soporta tanto pases de lotes masivos como pases de comando (sin lote).
    """
    from sqlalchemy.orm import joinedload
    query = select(CodigoQR).where(CodigoQR.token == token).options(
        joinedload(CodigoQR.tipo_acceso_custom),
        joinedload(CodigoQR.zona_asignada),
        joinedload(CodigoQR.vehiculos_adicionales)
    )
    res = await db.execute(query)
    pase = res.unique().scalar_one_or_none()
    
    if not pase:
        raise HTTPException(status_code=404, detail="Token de acceso inválido")
    
    # ─────────────────────────────────────────────────────────────────────
    # Caso A: Pase con lote (pases masivos, eventos, portal de entidad)
    # ─────────────────────────────────────────────────────────────────────
    if pase.lote_id:
        lote = await db.scalar(
            select(LotePaseMasivo)
            .where(LotePaseMasivo.id == pase.lote_id)
            .options(
                joinedload(LotePaseMasivo.entidad),
                joinedload(LotePaseMasivo.zona_asignada)
            )
        )
        entidad_nombre = lote.entidad.nombre if lote and lote.entidad else "BAGFM ACCESS"
        lote_data = {
            "nombre_evento": lote.nombre_evento if lote else "BAGFM ACCESS",
            "fecha_inicio": lote.fecha_inicio if lote else None,
            "fecha_fin": lote.fecha_fin if lote else None,
            "tipo_pase": lote.tipo_pase if lote else "portal",
            "zona_nombre": lote.zona_asignada.nombre if (lote and lote.zona_asignada) else (lote.zona_nombre if lote else None),
            "latitud": lote.zona_asignada.latitud if (lote and lote.zona_asignada) else None,
            "longitud": lote.zona_asignada.longitud if (lote and lote.zona_asignada) else None,
        }
    # ─────────────────────────────────────────────────────────────────────
    # Caso B: Pase de base/comando (sin lote) — datos del propio QR
    # ─────────────────────────────────────────────────────────────────────
    else:
        lote = None
        entidad_nombre = "COMANDO BAGFM"
        zona_nombre = pase.zona_asignada.nombre if pase.zona_asignada else "BASE BAGFM"
        lote_data = {
            "nombre_evento": f"PASE DE COMANDO — {zona_nombre}",
            "fecha_inicio": pase.created_at.date() if pase.created_at else None,
            "fecha_fin": pase.fecha_expiracion.date() if pase.fecha_expiracion else None,
            "tipo_pase": "portal",  # Tratar como portal para habilitar el autoregistro
            "zona_nombre": zona_nombre,
            "latitud": pase.zona_asignada.latitud if pase.zona_asignada else None,
            "longitud": pase.zona_asignada.longitud if pase.zona_asignada else None,
        }
    
    # Mapeo de estilos para tipos base (si no hay custom)
    PRESETS_BASE = {
        "general":    {"layout": "qr", "color_preset": "aegis", "color_hex": "#4EDEA3"},
        "staff":      {"layout": "qr", "color_preset": "militar", "color_hex": "#6B7280"},
        "produccion": {"layout": "qr", "color_preset": "alfa", "color_hex": "#EB5757"},
        "logistica":  {"layout": "qr", "color_preset": "civil", "color_hex": "#3B82F6"},
        "vip":        {"layout": "qr", "color_preset": "vip", "color_hex": "#F2C94C"},
        "base":       {"layout": "qr", "color_preset": "militar", "color_hex": "#6366F1"},
    }
    
    # Cargar Branding de la Entidad si existe
    import json
    branding_entidad = {}
    if lote and lote.entidad and lote.entidad.config_branding:
        try:
            branding_entidad = json.loads(lote.entidad.config_branding)
        except: pass
    
    # Determinar visual final base
    tipo_str = pase.tipo_acceso.value if hasattr(pase.tipo_acceso, 'value') else str(pase.tipo_acceso)
    
    # 0. Base absoluta del sistema
    visual = PRESETS_BASE.get(tipo_str, PRESETS_BASE["general"]).copy()
    
    # 1. Aplicar primero la base 'general' de la entidad si existe (herencia)
    if "general" in branding_entidad:
        visual.update({k: v for k, v in branding_entidad["general"].items() if v})
    
    # 2. Aplicar sobreescritura específica del tipo base si existe en el JSON de la entidad
    if tipo_str in branding_entidad and tipo_str != "general":
        visual.update({k: v for k, v in branding_entidad[tipo_str].items() if v})
    
    # 3. Si tiene tipo custom, este tiene la máxima prioridad
    if pase.tipo_acceso_custom:
        custom = pase.tipo_acceso_custom
        visual.update({
            "layout": custom.plantilla_layout or visual.get("layout", "qr"),
            "color_preset": custom.color_preset or visual.get("color_preset", "aegis"),
            "color_hex": custom.color_hex or visual.get("color_hex", "#4EDEA3")
        })
    
    return {
        "pase": {
            "id": pase.id,
            "serial": pase.serial_legible,
            "nombre": pase.nombre_portador,
            "cedula": pase.cedula_portador,
            "email": pase.email_portador,
            "telefono": pase.telefono_portador,
            "entidad_nombre": entidad_nombre,
            "vehiculo": {
                "placa": pase.vehiculo_placa,
                "marca": pase.vehiculo_marca,
                "modelo": pase.vehiculo_modelo,
                "color": pase.vehiculo_color
            },
            "vehiculos_adicionales": [
                {
                    "id": v.id,
                    "placa": v.placa,
                    "marca": v.marca,
                    "modelo": v.modelo,
                    "color": v.color
                } for v in pase.vehiculos_adicionales
            ],
            "visual": visual,
            "datos_completos": pase.datos_completos
        },
        "lote": lote_data
    }

@router.post("/portal/{serial}/registrar")
async def registrar_invitado_publico(
    serial: str, 
    datos: dict, 
    db: AsyncSession = Depends(obtener_db)
):
    """Registra un nuevo invitado en un lote de Autoregistro (PÚBLICO)."""
    # 1. Buscar el lote
    query = select(LotePaseMasivo).where(LotePaseMasivo.codigo_serial == serial)
    res = await db.execute(query)
    lote = res.scalar_one_or_none()
    
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
        
    from app.models.enums import PasseTipo
    if lote.tipo_pase != PasseTipo.portal:
        raise HTTPException(status_code=403, detail="Este lote no permite autorregistro público")

    # 2. Verificar si hay QRs disponibles (que no tengan nombre aún)
    # Por ahora, simplemente crearemos uno nuevo si hay cupo o usaremos uno vacío.
    # Pero el flujo actual de pasesService es registrar un nuevo invitado.
    return await pase_service.registrar_invitado_portal(db, lote.id, datos)

@router.patch("/portal/pase/{token}")
async def completar_pase_publico(
    token: str,
    datos: dict,
    db: AsyncSession = Depends(obtener_db)
):
    """Permite al usuario completar sus datos en el portal.
    Soporta pases de lotes (tipo portal) y pases de base (sin lote, datos_completos=False).
    """
    from app.models.enums import TipoAccesoPase as TAP
    query = select(CodigoQR).where(CodigoQR.token == token)
    res = await db.execute(query)
    pase = res.scalar_one_or_none()
    
    if not pase:
        raise HTTPException(status_code=404, detail="Pase no encontrado")
    
    # Verificar que el pase aún no tiene datos completos (evitar suplantación post-registro)
    if pase.datos_completos:
        raise HTTPException(status_code=403, detail="Este pase ya fue completado. No se permite modificación.")

    # Caso A: Pase con lote — validar que sea tipo portal o identificado
    if pase.lote_id:
        lote = await db.get(LotePaseMasivo, pase.lote_id)
        from app.models.enums import PasseTipo
        if not lote or (lote.tipo_pase != PasseTipo.portal and lote.tipo_pase != PasseTipo.identificado):
            raise HTTPException(status_code=403, detail="Solo se pueden completar pases de tipo autorregistro o identificados incompletos")
    # Caso B: Pase de base/comando sin lote — permitir completar
    else:
        from app.models.enums import TipoAccesoPase
        if pase.tipo_acceso != TipoAccesoPase.base:
            raise HTTPException(status_code=403, detail="Tipo de pase no autorizado para completar desde el portal")
        
    return await pase_service.actualizar_pase_publico(db, pase.id, datos)
