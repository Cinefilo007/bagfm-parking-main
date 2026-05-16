from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, and_

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.core.excepciones import EntidadDuplicada, EntidadNoEncontrada
from app.models.enums import RolTipo, AccesoTipo
from app.models.usuario import Usuario
from app.models.acceso import Acceso
from app.models.codigo_qr import CodigoQR
from app.models.vehiculo_pase import VehiculoPase
from app.models.asignacion_zona import AsignacionZona
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.schemas.entidad_civil import EntidadCivilCrear, EntidadCivilSalida, EntidadCivilActualizar
from app.services.entidad_service import entidad_service
from sqlalchemy.orm import joinedload

router = APIRouter()

# Solo COMANDANTE y ADMIN_BASE pueden administrar entidades
DEPENDENCY_ADMIN_BASE = Depends(require_rol([RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR]))


@router.get("/stats")
async def obtener_stats_entidades(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Retorna estadísticas globales para el Comandante."""
    return await entidad_service.obtener_stats_globales(db)


@router.get("", response_model=List[EntidadCivilSalida])
async def listar_entidades(
    activas_solo: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """
    Lista todas las entidades civiles con soporte para paginación. 
    Cualquier usuario autenticado puede verlas.
    """
    return await entidad_service.obtener_todas(db, activas_solo, skip=skip, limit=limit)


@router.post("", response_model=EntidadCivilSalida, status_code=status.HTTP_201_CREATED)
async def crear_entidad(
    datos: EntidadCivilCrear,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_ADMIN_BASE,
):
    """
    Crea una nueva entidad civil y notifica al administrador si se proporciona email.
    Requiere rol COMANDANTE o ADMIN_BASE.
    """
    try:
        nueva_entidad = await entidad_service.crear(db, datos, usuario_actual)
        
        if datos.admin_email:
            from app.services.correo_service import correo_masivo_service
            from app.core.config import obtener_config
            
            c_env = obtener_config()
            html_content = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #f8fafc; background-color: #0c0f17; padding: 40px; border-radius: 16px; border: 1px solid #1e293b;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style='color: #4ade80; margin: 0; font-size: 24px; letter-spacing: 1px;'>SISTEMA TÁCTICO BAGFM</h2>
                    <p style="color: #94a3b8; font-size: 14px; margin-top: 8px;">Módulo de Concesiones y Accesos</p>
                </div>
                
                <p>Saludos <strong>{datos.admin_nombre} {datos.admin_apellido}</strong>,</p>
                <p>Se ha configurado exitosamente su perfil de administrador para la entidad <strong>{nueva_entidad.nombre}</strong>.</p>
                
                <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin: 24px 0;">
                    <h3 style="color: #cbd5e1; margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Credenciales de Acceso</h3>
                    <ul style="list-style: none; padding: 0; margin: 0; color: #f8fafc;">
                        <li style="margin-bottom: 12px;"><strong>Usuario / Cédula:</strong> {datos.admin_cedula}</li>
                        <li><strong>Contraseña temporal:</strong> {datos.admin_password}</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin: 32px 0;">
                    <a href='{c_env.frontend_url}' style='background-color: #4ade80; color: #022c22; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 1px;'>INGRESAR AL PORTAL</a>
                </div>
                
                <h3 style="color: #4ade80; font-size: 16px; margin-bottom: 12px;">Primeros Pasos Recomendados:</h3>
                <ul style="color: #cbd5e1; line-height: 1.6;">
                    <li>Por seguridad, cambie su contraseña al iniciar sesión por primera vez en la sección de Ajustes.</li>
                    <li>Configure sus zonas de estacionamiento táctico.</li>
                    <li>Registre a sus socios o personal operativo y asigne sus vehículos.</li>
                    <li>Utilice el sistema de Pases QR para gestionar a sus visitantes o autorizados.</li>
                </ul>
                
                <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px;">
                    Este es un mensaje automático del Sistema Táctico BAGFM. Por favor no responda a este correo.
                </p>
            </div>
            """
            
            background_tasks.add_task(
                correo_masivo_service.enviar_correo_generico,
                datos.admin_email,
                f"Acceso Administrativo - {nueva_entidad.nombre}",
                html_content
            )
            
        return nueva_entidad
    except EntidadDuplicada as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{id}", response_model=EntidadCivilSalida)
async def obtener_entidad(
    id: UUID, 
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """
    Obtiene una entidad civil por su ID.
    Lanza 404 si no existe.
    """
    try:
        return await entidad_service.obtener_por_id(db, id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{id}", response_model=EntidadCivilSalida)
async def actualizar_entidad(
    id: UUID,
    datos: EntidadCivilActualizar,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_ADMIN_BASE,
):
    """
    Actualiza datos de la entidad especificada.
    Requiere rol COMANDANTE o ADMIN_BASE.
    """
    try:
        return await entidad_service.actualizar(db, id, datos)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except EntidadDuplicada as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/{id}/toggle", response_model=EntidadCivilSalida)
async def toggle_estado_entidad(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_ADMIN_BASE,
):
    """Alterna el estado ACTIVO/INACTIVO de la entidad."""
    try:
        return await entidad_service.toggle_estado(db, id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/{id}/branding", response_model=EntidadCivilSalida)
async def actualizar_branding_entidad(
    id: UUID,
    datos: dict,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Actualiza la configuración de marca (JSON) de la entidad."""
    # Validación de permisos: Admin Base puede todo, Admin Entidad solo su propia entidad
    es_admin_base = usuario_actual.rol in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]
    es_su_entidad = usuario_actual.rol == RolTipo.ADMIN_ENTIDAD and usuario_actual.entidad_id == id
    
    if not (es_admin_base or es_su_entidad):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="No tiene permisos para modificar la marca de esta entidad"
        )

    try:
        return await entidad_service.actualizar_branding(db, id, datos)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{id}")
async def eliminar_entidad(
    id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = DEPENDENCY_ADMIN_BASE,
):
    """
    BAJA DEFINITIVA: Elimina la entidad y todos sus datos relacionados (socios, vehículos, QRs) en cascada técnica.
    Esta acción es irreversible.
    """
    try:
        exito = await entidad_service.eliminar(db, id)
        return {"status": "success", "message": "Entidad eliminada permanentemente", "deleted": exito}
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al eliminar entidad: {str(e)}")


# ──────────────────────────────────────────────────────────────────────────────
# DASHBOARD CONSOLIDADO — Admin de Entidad
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/me/dashboard")
async def dashboard_entidad(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(require_rol(["ADMIN_ENTIDAD"]))
):
    """
    SOP: Dashboard Táctico de la Entidad (Aegis v2.5).
    Retorna en una sola llamada:
    - KPIs globales (socios, vehículos activos, capacidad total)
    - Historial de flujo vehicular filtrado por zonas de la entidad
    - Capacidad en tiempo real por zona asignada
    - Vehículos perdidos en zonas de la entidad
    - Rendimiento de parqueros asignados
    """
    if not usuario_actual.entidad_id:
        raise HTTPException(status_code=403, detail="No perteneces a ninguna entidad civil.")

    entidad_id = usuario_actual.entidad_id

    # ── 1. Obtener Asignaciones de Zona de la Entidad ──
    rs_asig = await db.execute(
        select(AsignacionZona)
        .options(joinedload(AsignacionZona.zona))
        .where(
            AsignacionZona.entidad_id == entidad_id,
            AsignacionZona.activa == True
        )
    )
    asignaciones = rs_asig.scalars().all()
    zona_ids = [asig.zona_id for asig in asignaciones]

    # ── 2. KPIs de Zonas (capacidad consolidada) ──
    capacidad_total = 0
    vehiculos_activos = 0
    zonas_resumen = []

    for asig in asignaciones:
        zona = asig.zona
        if not zona:
            continue
        cap = zona.capacidad_total or 0
        ocup = zona.ocupacion_actual or 0
        capacidad_total += asig.cupo_asignado or cap
        vehiculos_activos += ocup

        # Parqueros asignados a esta zona
        rs_pq = await db.execute(
            select(Usuario.nombre, Usuario.apellido, Usuario.id)
            .where(
                Usuario.zona_asignada_id == zona.id,
                Usuario.rol == RolTipo.PARQUERO,
                Usuario.activo == True,
                Usuario.is_deleted == False
            )
        )
        parqueros_zona = [{"nombre": f"{r.nombre} {r.apellido}", "id": str(r.id)} for r in rs_pq.all()]

        cupo_libre = max(0, (asig.cupo_asignado or cap) - ocup)
        uso_pct = round((ocup / max(1, asig.cupo_asignado or cap)) * 100)

        zonas_resumen.append({
            "zona_id": str(zona.id),
            "zona_nombre": asig.zona_nombre or zona.nombre,
            "cupo_asignado": asig.cupo_asignado or cap,
            "ocupados": ocup,
            "libres": cupo_libre,
            "uso_pct": uso_pct,
            "parqueros": parqueros_zona,
        })

    dict_zonas = {z["zona_id"]: z["zona_nombre"] for z in zonas_resumen}

    libres_total = max(0, capacidad_total - vehiculos_activos)

    # ── 3. Socios de la entidad ──
    from app.models.membresia import Membresia
    from app.models.enums import MembresiaEstado
    rs_socios = await db.execute(
        select(func.count(Usuario.id)).where(
            Usuario.entidad_id == entidad_id,
            Usuario.rol == RolTipo.SOCIO,
            Usuario.activo == True,
            Usuario.is_deleted == False
        )
    )
    total_socios = rs_socios.scalar() or 0

    # ── 4. Historial de Flujo Vehicular por Zonas de la Entidad ──
    historial = []
    if zona_ids:
        rs_accesos = await db.execute(
            select(Acceso)
            .where(Acceso.zona_id.in_(zona_ids))
            .order_by(Acceso.timestamp.desc())
            .limit(50)
        )
        for acc in rs_accesos.scalars().all():
            # Resolver datos del vehículo y portador
            placa = acc.vehiculo_placa
            portador = acc.nombre_manual
            marca = acc.vehiculo_marca
            modelo = acc.vehiculo_modelo
            punto = acc.punto_acceso
            tipo_evento = "alcabala"

            if not portador and acc.qr_id:
                qr = await db.get(CodigoQR, acc.qr_id)
                if qr:
                    if not placa: placa = qr.vehiculo_placa
                    if not marca: marca = qr.vehiculo_marca
                    if not modelo: modelo = qr.vehiculo_modelo
                    if not portador: portador = qr.nombre_portador

            # Resolver nombre del usuario si existe
            if not portador and acc.usuario_id:
                u = await db.get(Usuario, acc.usuario_id)
                if u:
                    portador = f"{u.nombre} {u.apellido}".strip()

            historial.append({
                "id": str(acc.id),
                "tipo": acc.tipo.value,
                "tipo_evento": tipo_evento,
                "timestamp": acc.timestamp.isoformat() if acc.timestamp else None,
                "placa": placa or "SIN PLACA",
                "marca": marca,
                "modelo": modelo,
                "portador": portador or "DESCONOCIDO",
                "punto_acceso": punto,
                "es_manual": acc.es_manual,
                "zona_id": str(acc.zona_id) if acc.zona_id else None,
            })

        # Agregar también eventos de llegada/salida de zona (VehiculoPase)
        rs_vp = await db.execute(
            select(VehiculoPase)
            .where(
                VehiculoPase.zona_asignada_id.in_(zona_ids),
                VehiculoPase.hora_ingreso.isnot(None)
            )
            .order_by(VehiculoPase.hora_ingreso.desc())
            .limit(30)
        )
        for vp in rs_vp.scalars().all():
            portador = None
            if vp.qr_id:
                qr = await db.get(CodigoQR, vp.qr_id)
                if qr:
                    portador = qr.nombre_portador

            historial.append({
                "id": str(vp.id),
                "tipo": "entrada",
                "tipo_evento": "ingreso_zona",
                "timestamp": vp.hora_ingreso.isoformat() if vp.hora_ingreso else None,
                "placa": vp.placa or "SIN PLACA",
                "marca": vp.marca,
                "modelo": vp.modelo,
                "portador": portador or "DESCONOCIDO",
                "punto_acceso": dict_zonas.get(str(vp.zona_asignada_id), "ZONA ESTACIONAMIENTO"),
                "es_manual": False,
                "zona_id": str(vp.zona_asignada_id) if vp.zona_asignada_id else None,
            })

            if vp.hora_salida:
                historial.append({
                    "id": f"{str(vp.id)}_salida",
                    "tipo": "salida",
                    "tipo_evento": "salida_zona",
                    "timestamp": vp.hora_salida.isoformat(),
                    "placa": vp.placa or "SIN PLACA",
                    "marca": vp.marca,
                    "modelo": vp.modelo,
                    "portador": portador or "DESCONOCIDO",
                    "punto_acceso": dict_zonas.get(str(vp.zona_asignada_id), "ZONA ESTACIONAMIENTO"),
                    "es_manual": False,
                    "zona_id": str(vp.zona_asignada_id) if vp.zona_asignada_id else None,
                })

        # Ordenar historial por timestamp desc
        def sort_ts(e):
            ts = e.get("timestamp")
            if ts:
                try:
                    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    pass
            return datetime.min.replace(tzinfo=timezone.utc)

        historial.sort(key=sort_ts, reverse=True)
        historial = historial[:50]

    # ── 5. Vehículos Perdidos y En Camino (de las zonas de la entidad) ──
    vehiculos_perdidos = []
    vehiculos_en_camino = []
    if zona_ids:
        ahora = datetime.now(timezone.utc)
        hace_12h = ahora - timedelta(hours=12)

        for zona_id_p in zona_ids:
            # Obtener tiempo límite de esta zona
            rs_zona = await db.execute(select(ZonaEstacionamiento).where(ZonaEstacionamiento.id == zona_id_p))
            zona_p = rs_zona.scalars().first()
            zona_nombre_p = dict_zonas.get(str(zona_id_p), "ZONA")
            tiempo_limite = (zona_p.tiempo_limite_llegada_min or 15) if zona_p else 15

            # Accesos con destino a esta zona sin registro de llegada
            rs_acc_p = await db.execute(
                select(Acceso, CodigoQR)
                .join(CodigoQR, Acceso.qr_id == CodigoQR.id)
                .where(
                    CodigoQR.zona_asignada_id == zona_id_p,
                    Acceso.tipo == AccesoTipo.entrada,
                    Acceso.timestamp >= hace_12h
                )
            )
            for acc_p, qr_p in rs_acc_p.all():
                # ¿Ya llegó a la zona?
                rs_vp_p = await db.execute(
                    select(VehiculoPase).where(
                        VehiculoPase.qr_id == qr_p.id,
                        VehiculoPase.zona_asignada_id == zona_id_p,
                        VehiculoPase.hora_ingreso >= acc_p.timestamp
                    )
                )
                if rs_vp_p.scalars().first():
                    continue

                # ¿Ya salió?
                rs_sal_p = await db.execute(
                    select(Acceso).where(
                        Acceso.qr_id == qr_p.id,
                        Acceso.tipo == AccesoTipo.salida,
                        Acceso.timestamp >= acc_p.timestamp
                    )
                )
                if rs_sal_p.scalars().first():
                    continue

                ts_acc = acc_p.timestamp.replace(tzinfo=timezone.utc) if acc_p.timestamp.tzinfo is None else acc_p.timestamp
                min_transcurridos = int((ahora - ts_acc).total_seconds() / 60)

                item = {
                    "placa": qr_p.vehiculo_placa or "SIN PLACA",
                    "marca": qr_p.vehiculo_marca,
                    "modelo": qr_p.vehiculo_modelo,
                    "portador": qr_p.nombre_portador or "DESCONOCIDO",
                    "telefono": qr_p.telefono_portador,
                    "hora_alcabala": ts_acc.isoformat(),
                    "minutos_transcurridos": min_transcurridos,
                    "tiempo_limite": tiempo_limite,
                    "zona_id": str(zona_id_p),
                    "zona_nombre": zona_nombre_p,
                    "punto_acceso": acc_p.punto_acceso,
                }

                if min_transcurridos > tiempo_limite:
                    vehiculos_perdidos.append(item)
                else:
                    vehiculos_en_camino.append(item)

        vehiculos_perdidos.sort(key=lambda x: x["minutos_transcurridos"], reverse=True)
        vehiculos_en_camino.sort(key=lambda x: x["minutos_transcurridos"], reverse=True)

    # ── 6. Rendimiento de Parqueros ──
    parqueros_rendimiento = []
    if zona_ids:
        rs_parqueros = await db.execute(
            select(Usuario)
            .where(
                Usuario.zona_asignada_id.in_(zona_ids),
                Usuario.rol == RolTipo.PARQUERO,
                Usuario.activo == True,
                Usuario.is_deleted == False
            )
        )
        for pq in rs_parqueros.scalars().all():
            # Contar registros manuales de HOY (ajustado a UTC-4)
            ahora_utc = datetime.now(timezone.utc)
            ahora_local = ahora_utc - timedelta(hours=4)
            hoy_inicio_local = ahora_local.replace(hour=0, minute=0, second=0, microsecond=0)
            hoy_inicio_utc = hoy_inicio_local + timedelta(hours=4)

            rs_ops = await db.execute(
                select(func.count(VehiculoPase.id)).where(
                    VehiculoPase.zona_asignada_id == pq.zona_asignada_id,
                    VehiculoPase.hora_ingreso >= hoy_inicio_utc
                )
            )
            ops_hoy = rs_ops.scalar() or 0

            parqueros_rendimiento.append({
                "id": str(pq.id),
                "nombre": f"{pq.nombre} {pq.apellido}".strip(),
                "zona_id": str(pq.zona_asignada_id) if pq.zona_asignada_id else None,
                "ops_hoy": ops_hoy,
                "activo": pq.activo,
            })

    from app.models.entidad_civil import EntidadCivil
    rs_ent = await db.execute(select(EntidadCivil).where(EntidadCivil.id == entidad_id))
    entidad_civil = rs_ent.scalar_one_or_none()
    entidad_nombre = entidad_civil.nombre if entidad_civil else "PANEL DE ENTIDAD"

    return {
        "entidad_nombre": entidad_nombre,
        "kpis": {
            "capacidad_total": capacidad_total,
            "vehiculos_activos": vehiculos_activos,
            "libres_total": libres_total,
            "uso_pct": round((vehiculos_activos / max(1, capacidad_total)) * 100),
            "total_socios": total_socios,
            "total_perdidos": len(vehiculos_perdidos),
            "total_en_camino": len(vehiculos_en_camino),
            "total_parqueros": len(parqueros_rendimiento),
        },
        "zonas": zonas_resumen,
        "historial": historial,
        "vehiculos_perdidos": vehiculos_perdidos,
        "vehiculos_en_camino": vehiculos_en_camino,
        "parqueros": parqueros_rendimiento,
    }
