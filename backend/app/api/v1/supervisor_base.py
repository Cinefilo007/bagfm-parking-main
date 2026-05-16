"""
Supervisor de Base — API v1
Módulo de control táctico de alto nivel. Proporciona al Supervisor de Base
las herramientas de monitoreo y seguridad definidas en DIRECTIVA_SUPERVISOR_BASE.md.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_, func, distinct
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.core.database import obtener_db
from app.core.dependencias import require_rol
from app.models.usuario import Usuario
from app.models.codigo_qr import CodigoQR
from app.models.vehiculo_pase import VehiculoPase
from app.models.acceso import Acceso
from app.models.infraccion import Infraccion
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.entidad_civil import EntidadCivil
from app.models.enums import RolTipo, QRTipo
from app.core.security import crear_token_evento

router = APIRouter()

# Guard compartido para el módulo
GUARD = Depends(require_rol([RolTipo.SUPERVISOR, RolTipo.ADMIN_BASE, RolTipo.COMANDANTE]))

# ─────────────────────────────────────────────────────────────
# TAREA B-01: Censo Vehicular en Tiempo Real
# ─────────────────────────────────────────────────────────────

@router.get("/censo-vehicular")
async def censo_vehicular(
    estado: Optional[str] = None,  # EN_BASE | EN_ESTACIONAMIENTO | DECLARADO_FUERA
    zona_id: Optional[UUID] = None,
    db: AsyncSession = Depends(obtener_db),
    _: Usuario = GUARD,
):
    """
    Retorna todos los vehículos actualmente dentro de la base.
    Fusiona VehiculoPase con CodigoQR para enriquecer datos del portador.
    """
    ahora = datetime.now(timezone.utc)
    ventana_declarados = ahora - timedelta(hours=2)

    # Consulta principal: VehiculoPase ingresados O declarados fuera recientemente
    q = (
        select(VehiculoPase)
        .outerjoin(CodigoQR, VehiculoPase.qr_id == CodigoQR.id)
        .where(
            or_(
                VehiculoPase.ingresado == True,
                and_(
                    VehiculoPase.ingresado == False,
                    VehiculoPase.hora_salida >= ventana_declarados,
                    VehiculoPase.hora_salida.isnot(None),
                ),
            )
        )
    )
    if zona_id:
        q = q.where(VehiculoPase.zona_asignada_id == zona_id)

    res = await db.execute(q)
    vehiculos_pase = res.scalars().all()

    # Mapa de zonas para enriquecer
    zona_ids = {vp.zona_asignada_id for vp in vehiculos_pase if vp.zona_asignada_id}
    zonas_map = {}
    if zona_ids:
        r_zonas = await db.execute(
            select(ZonaEstacionamiento.id, ZonaEstacionamiento.nombre).where(
                ZonaEstacionamiento.id.in_(zona_ids)
            )
        )
        zonas_map = {str(r.id): r.nombre for r in r_zonas.all()}

    resultado = []
    for vp in vehiculos_pase:
        qr = vp.codigo_qr

        # Calcular estado
        if vp.ingresado:
            est = "EN_ESTACIONAMIENTO"
        else:
            est = "DECLARADO_FUERA"

        # Filtro de estado
        if estado and est != estado:
            continue

        # Resolver datos del portador desde QR o VehiculoPase directo
        nombre_conductor = (qr.nombre_portador if qr else None) or "Sin datos"
        cedula = (qr.cedula_portador if qr else None)
        telefono = (qr.telefono_portador if qr else None)
        entidad_id = None
        entidad_nombre = None

        if qr and qr.zona_asignada:
            entidad_id = None  # Si se necesita la entidad hay que join al lote

        # Calcular tiempo en base
        hora_ref = vp.hora_ingreso or vp.created_at
        horas_en_base = None
        if hora_ref:
            delta = ahora - hora_ref.replace(tzinfo=timezone.utc) if hora_ref.tzinfo is None else ahora - hora_ref
            horas_en_base = round(delta.total_seconds() / 3600, 1)

        resultado.append({
            "vehiculo_pase_id": str(vp.id),
            "qr_id": str(vp.qr_id) if vp.qr_id else None,
            "placa": vp.placa,
            "marca": vp.marca,
            "modelo": vp.modelo,
            "color": vp.color,
            "nombre_conductor": nombre_conductor,
            "cedula": cedula,
            "telefono": telefono,
            "zona_nombre": zonas_map.get(str(vp.zona_asignada_id)) if vp.zona_asignada_id else None,
            "estado": est,
            "hora_ingreso": vp.hora_ingreso.isoformat() if vp.hora_ingreso else None,
            "hora_salida": vp.hora_salida.isoformat() if vp.hora_salida else None,
            "horas_en_base": horas_en_base,
        })

    return {"total": len(resultado), "vehiculos": resultado}


# ─────────────────────────────────────────────────────────────
# TAREA B-02: Pase Temporal de Seguridad
# ─────────────────────────────────────────────────────────────

@router.post("/pase-temporal", status_code=status.HTTP_201_CREATED)
async def generar_pase_temporal(
    nombre: str = Body(...),
    cedula: str = Body(...),
    telefono: Optional[str] = Body(None),
    placa: str = Body(...),
    marca: Optional[str] = Body(None),
    modelo: Optional[str] = Body(None),
    color: Optional[str] = Body(None),
    zona_destino_id: Optional[UUID] = Body(None),
    motivo: str = Body(...),
    duracion_horas: int = Body(8),
    observaciones: Optional[str] = Body(None),
    db: AsyncSession = Depends(obtener_db),
    supervisor: Usuario = GUARD,
):
    """
    Genera un pase de seguridad temporal en campo.
    El supervisor interroga a la persona y emite el QR directamente.
    """
    expira_at = datetime.now(timezone.utc) + timedelta(hours=duracion_horas)
    serial = f"SB-{datetime.now().strftime('%d%m%y%H%M')}-{cedula[-4:]}"

    token = crear_token_evento(serial, expira_at)

    nuevo_qr = CodigoQR(
        token=token,
        tipo=QRTipo.evento_simple,
        serial_legible=serial,
        activo=True,
        datos_completos=True,
        fecha_expiracion=expira_at,
        nombre_portador=nombre.upper(),
        cedula_portador=cedula.upper(),
        telefono_portador=telefono,
        vehiculo_placa=placa.upper(),
        vehiculo_marca=marca.upper() if marca else None,
        vehiculo_modelo=modelo.upper() if modelo else None,
        vehiculo_color=color.upper() if color else None,
        zona_asignada_id=zona_destino_id,
        created_by=supervisor.id,
        max_accesos=1,
    )
    db.add(nuevo_qr)
    await db.commit()
    await db.refresh(nuevo_qr)

    config = __import__("app.core.config", fromlist=["obtener_config"]).obtener_config()
    base_url = getattr(config, "base_url", "https://bagfm.app")

    return {
        "id": str(nuevo_qr.id),
        "serial": serial,
        "token": token,
        "nombre_portador": nuevo_qr.nombre_portador,
        "placa": nuevo_qr.vehiculo_placa,
        "expira_at": expira_at.isoformat(),
        "url_pase": f"{base_url}/portal/pase/{token}",
        "emitido_por": supervisor.nombre_completo,
        "motivo": motivo,
        "observaciones": observaciones,
    }


# ─────────────────────────────────────────────────────────────
# TAREA B-03: Censo de Personas (trazabilidad por cédula)
# ─────────────────────────────────────────────────────────────

@router.get("/censo-personas")
async def censo_personas(
    busqueda: Optional[str] = None,
    tipo: Optional[str] = None,   # SOCIO | VISITANTE
    alerta: Optional[bool] = None,
    db: AsyncSession = Depends(obtener_db),
    _: Usuario = GUARD,
):
    """
    Consolidado de personas por cédula.
    Fusiona usuarios registrados + portadores de QR temporales.
    Calcula métricas de frecuencia y señales de alerta automática.
    """
    ahora = datetime.now(timezone.utc)
    hace_30_dias = ahora - timedelta(days=30)

    # ── FUENTE 1: Usuarios registrados ──────────────────────────────
    q_usuarios = select(Usuario).where(
        Usuario.rol == RolTipo.SOCIO,
        Usuario.is_deleted == False,
    )
    if busqueda:
        term = f"%{busqueda}%"
        q_usuarios = q_usuarios.where(
            or_(
                Usuario.cedula.ilike(term),
                Usuario.nombre.ilike(term),
                Usuario.apellido.ilike(term),
            )
        )
    res_usuarios = await db.execute(q_usuarios)
    usuarios = res_usuarios.scalars().all()

    # ── FUENTE 2: Portadores de QR temporales (sin usuario registrado) ──
    q_qr = (
        select(
            CodigoQR.cedula_portador,
            CodigoQR.nombre_portador,
            CodigoQR.telefono_portador,
        )
        .where(
            CodigoQR.cedula_portador.isnot(None),
            CodigoQR.tipo.in_([QRTipo.evento_simple, QRTipo.evento_portal, QRTipo.evento_identificado]),
        )
        .distinct(CodigoQR.cedula_portador)
    )
    if busqueda:
        term = f"%{busqueda}%"
        q_qr = q_qr.where(
            or_(
                CodigoQR.cedula_portador.ilike(term),
                CodigoQR.nombre_portador.ilike(term),
            )
        )
    res_qr = await db.execute(q_qr)
    portadores_qr = res_qr.all()

    # Cédulas de socios registrados para no duplicar
    cedulas_socios = {u.cedula for u in usuarios}

    resultado = []

    # Procesar socios registrados
    for usuario in usuarios:
        perfil = await _construir_perfil_persona(db, usuario.cedula, usuario.nombre_completo, usuario.telefono, "SOCIO", ahora, hace_30_dias)
        if alerta is not None and perfil["alerta"] != alerta:
            continue
        resultado.append(perfil)

    # Procesar visitantes de QR que no tienen cuenta
    for row in portadores_qr:
        if row.cedula_portador in cedulas_socios:
            continue
        nombre = row.nombre_portador or "Sin nombre"
        perfil = await _construir_perfil_persona(db, row.cedula_portador, nombre, row.telefono_portador, "VISITANTE", ahora, hace_30_dias)
        if alerta is not None and perfil["alerta"] != alerta:
            continue
        if tipo and perfil["tipo"] != tipo:
            continue
        resultado.append(perfil)

    return {"total": len(resultado), "personas": resultado}


@router.get("/censo-personas/{cedula}")
async def perfil_persona(
    cedula: str,
    db: AsyncSession = Depends(obtener_db),
    _: Usuario = GUARD,
):
    """Perfil detallado de una persona por cédula."""
    ahora = datetime.now(timezone.utc)
    hace_30_dias = ahora - timedelta(days=30)

    cedula_upper = cedula.strip().upper()

    # Buscar usuario registrado
    res_u = await db.execute(select(Usuario).where(Usuario.cedula == cedula_upper))
    usuario = res_u.scalar_one_or_none()

    tipo = "SOCIO" if usuario else "VISITANTE"
    nombre = usuario.nombre_completo if usuario else cedula_upper
    telefono = usuario.telefono if usuario else None

    if not usuario:
        # Buscar en QRs
        res_qr = await db.execute(
            select(CodigoQR).where(CodigoQR.cedula_portador == cedula_upper).limit(1)
        )
        qr_ref = res_qr.scalar_one_or_none()
        if qr_ref:
            nombre = qr_ref.nombre_portador or cedula_upper
            telefono = qr_ref.telefono_portador

    perfil = await _construir_perfil_persona(db, cedula_upper, nombre, telefono, tipo, ahora, hace_30_dias, detallado=True)
    return perfil


# ─────────────────────────────────────────────────────────────
# TAREA B-04: Registro Global (Dashboard Unificado)
# ─────────────────────────────────────────────────────────────

@router.get("/registro-global")
async def registro_global(
    busqueda: Optional[str] = None,
    db: AsyncSession = Depends(obtener_db),
    _: Usuario = GUARD,
):
    """
    Retorna un listado unificado de todas las entidades (personas y vehículos)
    registradas en el sistema, con su estado actual.
    """
    ahora = datetime.now(timezone.utc)
    
    # ── 1. PERSONAS (Identidades) ──────────────────────────────────
    # Reutilizamos parte de la lógica de censo_personas pero simplificada para el dashboard
    res_per = await censo_personas(busqueda=busqueda, db=db)
    personas_raw = res_per["personas"]
    
    # ── 2. VEHÍCULOS (Placas registradas) ──────────────────────────
    # Obtenemos todas las placas que han tenido actividad o están en QRs
    q_placas = select(distinct(CodigoQR.vehiculo_placa)).where(CodigoQR.vehiculo_placa.isnot(None))
    if busqueda:
        q_placas = q_placas.where(CodigoQR.vehiculo_placa.ilike(f"%{busqueda}%"))
    
    res_placas = await db.execute(q_placas)
    placas = [r[0] for r in res_placas.all()]
    
    vehiculos = []
    for placa in placas:
        # Buscar estado actual en VehiculoPase
        res_vp = await db.execute(
            select(VehiculoPase)
            .where(VehiculoPase.placa == placa)
            .order_by(VehiculoPase.created_at.desc())
            .limit(1)
        )
        vp = res_vp.scalar_one_or_none()
        
        estado = "INACTIVO"
        if vp:
            if vp.ingresado:
                estado = "EN_BASE"
            elif vp.hora_salida and (ahora - vp.hora_salida.replace(tzinfo=timezone.utc) if vp.hora_salida.tzinfo is None else ahora - vp.hora_salida) < timedelta(hours=4):
                estado = "SALIDA_RECIENTE"
            else:
                estado = "FUERA_DE_BASE"
        
        # Enriquecer con datos del último QR
        res_qr = await db.execute(
            select(CodigoQR)
            .where(CodigoQR.vehiculo_placa == placa)
            .order_by(CodigoQR.created_at.desc())
            .limit(1)
        )
        qr = res_qr.scalar_one_or_none()
        
        vehiculos.append({
            "id": placa,
            "tipo": "VEHICULO",
            "titulo": placa,
            "subtitulo": f"{qr.vehiculo_marca or ''} {qr.vehiculo_modelo or ''}".strip() or "VEHÍCULO REGISTRADO",
            "portador": qr.nombre_portador if qr else "DESCONOCIDO",
            "estado": estado,
            "alerta": "NINGUNA" # Podría cruzarse con infracciones
        })

    # Normalizar personas para el listado unificado
    personas_norm = []
    for p in personas_raw:
        personas_norm.append({
            "id": p["cedula"],
            "tipo": "PERSONA",
            "titulo": p["nombre_completo"],
            "subtitulo": f"V-{p['cedula']}",
            "estado": "ACTIVO" if p["total_accesos"] > 0 else "SIN ACTIVIDAD",
            "alerta": p["alerta_nivel"]
        })

    return {
        "total": len(personas_norm) + len(vehiculos),
        "items": sorted(personas_norm + vehiculos, key=lambda x: x["titulo"])
    }


async def _construir_perfil_persona(
    db: AsyncSession,
    cedula: str,
    nombre: str,
    telefono: Optional[str],
    tipo_base: str,
    ahora: datetime,
    hace_30_dias: datetime,
    detallado: bool = False,
) -> dict:
    """Helper: calcula métricas y señales de alerta para una cédula."""

    # Todos los QR asociados a esta cédula
    res_qr = await db.execute(
        select(CodigoQR).where(CodigoQR.cedula_portador == cedula)
    )
    qrs = res_qr.scalars().all()

    total_pases = len(qrs)
    pases_temporales = sum(1 for q in qrs if q.tipo in [QRTipo.evento_simple, QRTipo.evento_portal])
    pases_permanentes = total_pases - pases_temporales

    # Placas únicas
    placas = list({q.vehiculo_placa for q in qrs if q.vehiculo_placa})

    # Accesos en los últimos 30 días usando tabla accesos por qr_ids
    qr_ids = [q.id for q in qrs]
    total_accesos = 0
    ultimo_acceso = None
    primer_acceso = None
    accesos_recientes = []

    if qr_ids:
        res_ac = await db.execute(
            select(Acceso)
            .where(Acceso.qr_id.in_(qr_ids))
            .order_by(Acceso.timestamp.desc())
        )
        accesos_todos = res_ac.scalars().all()
        total_accesos = len(accesos_todos)
        if accesos_todos:
            ultimo_acceso = accesos_todos[0].timestamp
            primer_acceso = accesos_todos[-1].timestamp

        # Para análisis de patrones
        accesos_30d = [a for a in accesos_todos if a.timestamp >= hace_30_dias]
        accesos_recientes = accesos_todos[:30] if detallado else []

        # Hora pico
        if accesos_30d:
            horas = [a.timestamp.hour for a in accesos_30d]
            hora_pico_h = max(set(horas), key=horas.count)
            hora_pico = f"{hora_pico_h:02d}:00-{(hora_pico_h+1):02d}:00"
        else:
            hora_pico = None

        # Frecuencia semanal
        semanas = (ahora - hace_30_dias).days / 7
        frecuencia_semanal = round(len(accesos_30d) / semanas, 1) if semanas > 0 else 0.0
    else:
        hora_pico = None
        frecuencia_semanal = 0.0
        accesos_30d = []

    # Infracciones activas
    infracciones_activas = 0
    if qr_ids:
        # Las infracciones están vinculadas a vehículos, no a QRs directamente
        placas_norm = [p.upper() for p in placas]
        if placas_norm:
            from app.models.vehiculo import Vehiculo
            res_vehs = await db.execute(
                select(Vehiculo.id).where(Vehiculo.placa.in_(placas_norm))
            )
            veh_ids = [r[0] for r in res_vehs.all()]
            if veh_ids:
                res_inf = await db.execute(
                    select(func.count(Infraccion.id)).where(
                        Infraccion.vehiculo_id.in_(veh_ids),
                        Infraccion.estado == "activa",
                    )
                )
                infracciones_activas = res_inf.scalar() or 0

    # ── Señales de alerta ────────────────────────────────────────────
    pases_temp_ultimo_mes = sum(
        1 for q in qrs
        if q.tipo in [QRTipo.evento_simple, QRTipo.evento_portal]
        and q.created_at >= hace_30_dias
    )
    accesos_nocturnos = 0
    if qr_ids and accesos_30d:
        accesos_nocturnos = sum(1 for a in accesos_30d if a.timestamp.hour >= 22 or a.timestamp.hour < 5)

    # ── Graduación de Alerta ──────────────────────────────────────────
    puntos_alerta = 0
    if pases_temp_ultimo_mes > 3: puntos_alerta += 2
    if len(placas) > 2: puntos_alerta += 3
    if frecuencia_semanal > 5: puntos_alerta += 2
    if accesos_nocturnos > 0: puntos_alerta += 3
    if infracciones_activas > 0: puntos_alerta += 5
    
    alerta_nivel = "NINGUNA"
    if puntos_alerta >= 8: alerta_nivel = "CRITICA"
    elif puntos_alerta >= 5: alerta_nivel = "ALTA"
    elif puntos_alerta >= 3: alerta_nivel = "MEDIA"
    elif puntos_alerta >= 1: alerta_nivel = "BAJA"

    # Hallazgos IA
    hallazgos = []
    if pases_temp_ultimo_mes > 3: hallazgos.append(f"Emisión inusual de pases temporales ({pases_temp_ultimo_mes} en 30d)")
    if len(placas) > 2: hallazgos.append(f"Múltiples vehículos vinculados ({len(placas)})")
    if frecuencia_semanal > 5: hallazgos.append("Frecuencia de acceso superior al patrón normal")
    if accesos_nocturnos > 0: hallazgos.append("Detección de accesos en horario táctico nocturno")
    if infracciones_activas > 0: hallazgos.append(f"Mantiene {infracciones_activas} infracciones críticas sin resolver")

    tipo_calculado = tipo_base
    if tipo_base == "VISITANTE":
        if frecuencia_semanal >= 2:
            tipo_calculado = "VISITANTE_FRECUENTE"
        else:
            tipo_calculado = "VISITANTE_OCASIONAL"

    perfil = {
        "cedula": cedula,
        "nombre": nombre,
        "nombre_completo": nombre,
        "telefono": telefono,
        "tipo": tipo_calculado,
        "total_pases": total_pases,
        "total_vehiculos": len(placas),
        "pases_temporales": pases_temporales,
        "pases_permanentes": pases_permanentes,
        "vehiculos": [
            {"placa": p, "marca": "S/D", "modelo": "S/D", "usos": sum(1 for q in qrs if q.vehiculo_placa == p)}
            for p in placas
        ],
        "total_accesos": total_accesos,
        "ultimo_acceso": ultimo_acceso.isoformat() if ultimo_acceso else None,
        "primer_acceso": primer_acceso.isoformat() if primer_acceso else None,
        "hora_pico": hora_pico,
        "punto_frecuente": max(set([a.punto_acceso for a in accesos_todos]), key=[a.punto_acceso for a in accesos_todos].count) if qr_ids and accesos_todos else "N/A",
        "frecuencia_semanal": frecuencia_semanal,
        "infracciones_activas": infracciones_activas,
        "alerta": puntos_alerta > 0,
        "alerta_nivel": alerta_nivel,
        "puntos_alerta": puntos_alerta,
        "hallazgos": hallazgos,
        "alertas_detalle": {
            "pases_temp_ultimo_mes": pases_temp_ultimo_mes,
            "multiples_vehiculos": len(placas) > 2,
            "frecuencia_alta": frecuencia_semanal > 5,
            "accesos_nocturnos": accesos_nocturnos,
            "tiene_infracciones": infracciones_activas > 0,
        },
    }

    if detallado:
        perfil["historial_pases"] = [
            {
                "id": str(q.id),
                "serial": q.serial_legible,
                "tipo": q.tipo.value,
                "placa": q.vehiculo_placa,
                "created_at": q.created_at.isoformat(),
                "expira_at": q.fecha_expiracion.isoformat() if q.fecha_expiracion else None,
                "activo": q.activo,
            }
            for q in sorted(qrs, key=lambda x: x.created_at, reverse=True)
        ]
        perfil["historial_accesos"] = [
            {
                "id": str(a.id),
                "timestamp": a.timestamp.isoformat(),
                "punto_acceso": a.punto_acceso,
                "placa": a.vehiculo_placa,
                "tipo": a.tipo.value,
            }
            for a in accesos_recientes
        ]

    return perfil
