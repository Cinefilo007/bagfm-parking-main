from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import func, or_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from app.models.acceso import Acceso
from app.models.usuario import Usuario
from app.models.vehiculo import Vehiculo
from app.models.membresia import Membresia
from app.models.infraccion import Infraccion
from app.models.codigo_qr import CodigoQR
from app.models.entidad_civil import EntidadCivil
from app.models.vehiculo_pase import VehiculoPase
from app.models.alcabala_evento import LotePaseMasivo
from app.models.asignacion_zona import AsignacionZona
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from app.models.enums import AccesoTipo, MembresiaEstado, InfraccionEstado, QRTipo, TipoAccesoPase, RolTipo
from app.schemas.acceso import AccesoValidar, AccesoRegistrar, ResultadoValidacion, EventoTactico
from app.services.membresia_service import membresia_service
from app.services.zona_service import zona_service
from app.services.notificacion_service import notificacion_service
from app.core.security import decodificar_token

class AccesoService:
    """
    🧠 Lógica de Negocio (SOP) para el Control de Accesos.
    Encapsula la validación integral de seguridad y cumplimiento.
    """
    
    async def validar_qr(self, db: AsyncSession, datos: AccesoValidar) -> ResultadoValidacion:
        """
        Valida un token de QR y retorna la ficha del socio con su estado de cumplimiento.
        """
        try:
            # 1. Decodificar Token
            try:
                payload = decodificar_token(datos.qr_token)
            except JWTError:
                return ResultadoValidacion(permitido=False, mensaje="Token QR expirado o corrupto", tipo_alerta="error")
                
            usuario_id_str = payload.get("sub")
            vehiculo_id_str = payload.get("vehiculo_id")
            
            # 2. Buscar QR en BD
            query_qr = select(CodigoQR).where(CodigoQR.token == datos.qr_token)
            res_qr = await db.execute(query_qr)
            qr_db = res_qr.scalar_one_or_none()
            
            if not qr_db:
                return ResultadoValidacion(permitido=False, mensaje="QR no registrado en el sistema", tipo_alerta="error")
            
            if not qr_db.activo:
                return ResultadoValidacion(permitido=False, mensaje="El QR ha sido revocado o ya no es válido", tipo_alerta="error")

            # 3. Buscar Usuario (Socio) - Usa qr_db.usuario_id que siempre es seguro
            socio = None
            if qr_db.usuario_id:
                query_socio = select(Usuario).where(Usuario.id == qr_db.usuario_id, Usuario.activo == True)
                res_socio = await db.execute(query_socio)
                socio = res_socio.scalar_one_or_none()

            # 4. Lógica de Pases Masivos
            if qr_db.lote_id:
                # Validar Límites de Acceso - Solo bloquea en ENTRADA
                if datos.tipo == AccesoTipo.entrada:
                    if qr_db.max_accesos is not None and qr_db.accesos_usados >= qr_db.max_accesos:
                        return ResultadoValidacion(
                            permitido=False, 
                            mensaje=f"LÍMITE DE ACCESOS ALCANZADO ({qr_db.max_accesos}/{qr_db.max_accesos})", 
                            tipo_alerta="error"
                        )
                
                # Buscar nombre del evento
                query_lote = select(LotePaseMasivo).where(LotePaseMasivo.id == qr_db.lote_id).options(selectinload(LotePaseMasivo.entidad))
                res_lote = await db.execute(query_lote)
                lote = res_lote.scalar_one_or_none()
                
                # Resolver Zona y Puesto legibles (Aegis Tactical v2.3 - Unificado)
                z_id = qr_db.zona_asignada_id or (lote.zona_estacionamiento_id if lote else None)
                p_id = qr_db.puesto_asignado_id
                z_nombre = None
                p_nombre = None

                if z_id:
                    z_db = await db.get(ZonaEstacionamiento, z_id)
                    if z_db:
                        z_nombre = z_db.nombre
                        
                if p_id:
                    p_db = await db.get(PuestoEstacionamiento, p_id)
                    if p_db:
                        p_nombre = str(p_db.numero_puesto)
                
                # ... (resto de validaciones de fechas igual) ...
                
                # Buscar todos los vehículos del socio (para selección múltiple)
                vehiculos_socio = []
                vehiculo = None
                if socio:
                    query_veh_socio = select(Vehiculo).where(Vehiculo.socio_id == socio.id, Vehiculo.activo == True)
                    res_veh_socio = await db.execute(query_veh_socio)
                    vehiculos_socio = res_veh_socio.scalars().all()
                    vehiculo = vehiculos_socio[0] if vehiculos_socio else None

                # Determinar si requiere datos manuales (Tipo A o falta de datos en el registro)
                necesita_datos = (qr_db.tipo == QRTipo.evento_simple) or (not socio) or (not vehiculo)

                # Si no hay socio en BD pero el QR ya tiene datos de portador empotrados (Excel), mockeamos para mostrar en frontend
                if not socio and (qr_db.nombre_portador or qr_db.cedula_portador):
                    # Solo lo mandamos para lectura en FichaSocio de ResultadoValidacion
                    entidad_nombre = "Pase Evento"
                    if lote and lote.entidad:
                        entidad_nombre = lote.entidad.nombre
                    elif qr_db.entidad_nombre_manual: # Solo si existiera este campo, por ahora fallback
                        entidad_nombre = qr_db.entidad_nombre_manual

                    socio = {
                        "id": qr_db.usuario_id or qr_db.id,
                        "nombre": qr_db.nombre_portador or "Visitante",
                        "apellido": "",
                        "cedula": qr_db.cedula_portador or "",
                        "telefono": qr_db.telefono_portador or "",
                        "rol": "SOCIO",
                        "activo": True,
                        "entidad_nombre": entidad_nombre,
                        "updated_at": qr_db.created_at,
                        "created_at": qr_db.created_at
                    }
                    vehiculos_socio = []
                    
                    # Primer vehículo (Principal embazado en la tabla codigos_qr)
                    if qr_db.vehiculo_placa:
                        v_mock = {
                            "id": qr_db.vehiculo_id or qr_db.id,
                            "placa": qr_db.vehiculo_placa,
                            "marca": qr_db.vehiculo_marca or "GENÉRICO",
                            "modelo": qr_db.vehiculo_modelo or "GENÉRICO",
                            "color": qr_db.vehiculo_color or "SIN COLOR",
                            "activo": True,
                            "socio_id": socio["id"],
                            "created_at": qr_db.created_at # Requerido por Pydantic (VehiculoSalida)
                        }
                        vehiculo = v_mock
                        vehiculos_socio.append(v_mock)
                    
                    # Adicionales (Tabla VehiculoPase)
                    query_veh_adi = select(VehiculoPase).where(VehiculoPase.qr_id == qr_db.id)
                    res_veh_adi = await db.execute(query_veh_adi)
                    vehiculos_adicionales = res_veh_adi.scalars().all()
                    
                    for va in vehiculos_adicionales:
                        v_adi = {
                            "id": va.id,
                            "placa": va.placa,
                            "marca": va.marca or "GENÉRICO",
                            "modelo": va.modelo or "GENÉRICO",
                            "color": va.color or "SIN COLOR",
                            "activo": True,
                            "socio_id": socio["id"],
                            "created_at": va.created_at
                        }
                        vehiculos_socio.append(v_adi)
                        
                    if not vehiculo and vehiculos_socio:
                        vehiculo = vehiculos_socio[0]
                    
                    # Si ya logramos mockear datos (Tipo B excel), no requiere datos manuales mandatorios
                    if qr_db.nombre_portador and vehiculos_socio:
                        necesita_datos = False

                # --- CONTROL DE CAPACIDAD (Aegis v4.0) ---
                alerta_cap_critica = False
                info_cap = None
                entidad_id_lote = lote.entidad_id if lote else None
                
                if z_id and entidad_id_lote and datos.tipo == AccesoTipo.entrada:
                    info_cap = await zona_service.obtener_ocupacion_real_entidad(db, entidad_id_lote, z_id)
                    alerta_cap_critica = info_cap["critico"]

                return ResultadoValidacion(
                    permitido=True,
                    mensaje="CAPACIDAD MÁXIMA ALCANZADA" if alerta_cap_critica else "Pase Masivo Válido",
                    tipo_alerta="error" if alerta_cap_critica else ("warning" if qr_db.tipo == QRTipo.evento_simple else "info"),
                    es_pase_masivo=True,
                    serial_legible=qr_db.serial_legible,
                    nombre_evento=lote.nombre_evento if lote else "Evento BAGFM",
                    accesos_restantes=qr_db.max_accesos - qr_db.accesos_usados if qr_db.max_accesos else None,
                    qr_id=qr_db.id,
                    usuario_id=socio["id"] if isinstance(socio, dict) else getattr(socio, "id", None),
                    socio=socio,
                    vehiculo=vehiculo,
                    vehiculos=vehiculos_socio,
                    vehiculo_id=vehiculo["id"] if isinstance(vehiculo, dict) else getattr(vehiculo, "id", None),
                    requiere_datos_manuales=necesita_datos,
                    zona_asignada_id=z_id,
                    zona_nombre=z_nombre,
                    puesto_asignado_id=p_id,
                    puesto_nombre=p_nombre,
                    tipo_acceso=qr_db.tipo_acceso,
                    alerta_capacidad_critica=alerta_cap_critica,
                    info_capacidad_zona=info_cap
                )

            # 5. Pases de Base (tipo_acceso == base) — sin lote_id ni usuario_id
            if qr_db.tipo_acceso == TipoAccesoPase.base:
                # Verificar si el pase no está expirado por fecha
                if qr_db.fecha_expiracion and qr_db.fecha_expiracion < datetime.now(timezone.utc):
                    return ResultadoValidacion(
                        permitido=False,
                        mensaje=f"PASE BASE VENCIDO — Expiró el {qr_db.fecha_expiracion.strftime('%d/%m/%Y')}",
                        tipo_alerta="error"
                    )

                socio_mock = {
                    "id": str(qr_db.id),
                    "nombre": qr_db.nombre_portador or "PORTADOR BASE",
                    "apellido": "",
                    "cedula": qr_db.cedula_portador or "",
                    "telefono": qr_db.telefono_portador or "",
                    "rol": "SOCIO",
                    "activo": True,
                    "entidad_nombre": "PERSONAL DE BASE",
                    "updated_at": qr_db.created_at,
                    "created_at": qr_db.created_at
                }
                vehiculo_mock = None
                vehiculos_mock = []
                if qr_db.vehiculo_placa:
                    vehiculo_mock = {
                        "id": str(qr_db.id),
                        "placa": qr_db.vehiculo_placa,
                        "marca": qr_db.vehiculo_marca or "GENÉRICO",
                        "modelo": qr_db.vehiculo_modelo or "GENÉRICO",
                        "color": qr_db.vehiculo_color or "SIN COLOR",
                        "activo": True,
                        "socio_id": str(qr_db.id),
                        "created_at": qr_db.created_at
                    }
                    vehiculos_mock = [vehiculo_mock]

                # Resolver zona y puesto
                z_nombre = None
                p_nombre = None
                if qr_db.zona_asignada_id:
                    z_db = await db.get(ZonaEstacionamiento, qr_db.zona_asignada_id)
                    if z_db:
                        z_nombre = z_db.nombre
                if qr_db.puesto_asignado_id:
                    p_db = await db.get(PuestoEstacionamiento, qr_db.puesto_asignado_id)
                    if p_db:
                        p_nombre = str(p_db.numero_puesto)

                return ResultadoValidacion(
                    permitido=True,
                    mensaje=f"✅ PASE BASE — {qr_db.serial_legible}",
                    tipo_alerta="success",
                    es_pase_masivo=False,
                    serial_legible=qr_db.serial_legible,
                    nombre_evento="ACCESO BASE",
                    qr_id=qr_db.id,
                    usuario_id=None,
                    socio=socio_mock,
                    vehiculo=vehiculo_mock,
                    vehiculos=vehiculos_mock,
                    vehiculo_id=None,
                    requiere_datos_manuales=False,
                    zona_asignada_id=qr_db.zona_asignada_id,
                    zona_nombre=z_nombre,
                    puesto_asignado_id=qr_db.puesto_asignado_id,
                    puesto_nombre=p_nombre,
                    tipo_acceso=qr_db.tipo_acceso
                )

            # 6. Validación Estándar para Socios Permanentes
            if not socio:
                return ResultadoValidacion(permitido=False, mensaje="Socio no encontrado o inactivo", tipo_alerta="error")

            # 5.a Verificar Membresía
            query_mem = select(Membresia).where(
                Membresia.socio_id == socio.id
            ).order_by(Membresia.updated_at.desc())
            res_mem = await db.execute(query_mem)
            membresia = res_mem.scalars().first()

            if not membresia or membresia.estado not in [MembresiaEstado.activa, MembresiaEstado.exonerada]:
                msg = "Socio sin registro de membresía vigente"
                if membresia:
                    if membresia.estado == MembresiaEstado.suspendida:
                        msg = "MEMBRESÍA SUSPENDIDA ADMIN."
                    elif membresia.estado == MembresiaEstado.vencida:
                        msg = "MEMBRESÍA VENCIDA (PAGO PENDIENTE)"
                return ResultadoValidacion(permitido=False, mensaje=msg, tipo_alerta="error")

            # 5.b Vehículos del socio (todos, para selección múltiple)
            vehiculo = None
            vehiculos_socio = []
            if vehiculo_id_str:
                query_veh = select(Vehiculo).where(Vehiculo.id == UUID(vehiculo_id_str), Vehiculo.activo == True)
                res_veh = await db.execute(query_veh)
                vehiculo = res_veh.scalar_one_or_none()
            
            # Siempre obtener todos los vehículos del socio
            query_veh_all = select(Vehiculo).where(Vehiculo.socio_id == socio.id, Vehiculo.activo == True)
            res_veh_all = await db.execute(query_veh_all)
            vehiculos_socio = res_veh_all.scalars().all()
            
            if not vehiculo and vehiculos_socio:
                vehiculo = vehiculos_socio[0]

            # 5.c Infracciones
            query_inf = select(Infraccion).where(
                Infraccion.usuario_id == socio.id, 
                Infraccion.estado == InfraccionEstado.activa
            )
            res_inf = await db.execute(query_inf)
            infracciones = res_inf.scalars().all()
            
            bloqueado = False
            msg_bloqueo = ""
            if datos.tipo == AccesoTipo.salida:
                for inf in infracciones:
                    if inf.bloquea_salida:
                        bloqueado = True
                        msg_bloqueo = f"SALIDA BLOQUEADA: {inf.descripcion}"
                        break

            # 5.d Entidad
            query_ent = select(EntidadCivil).where(EntidadCivil.id == socio.entidad_id)
            res_ent = await db.execute(query_ent)
            entidad = res_ent.scalar_one_or_none()

            if entidad and not entidad.activo:
                return ResultadoValidacion(
                    permitido=False, 
                    mensaje=f"CESE DE SERVICIOS: CONCESIÓN {entidad.nombre} SUSPENDIDA", 
                    tipo_alerta="error"
                )

            # 5.e Última Entrada
            query_last = select(Acceso).where(
                Acceso.usuario_id == socio.id,
                Acceso.tipo == AccesoTipo.entrada
            ).order_by(Acceso.timestamp.desc()).limit(1)
            res_last = await db.execute(query_last)
            ultima_entrada = res_last.scalar_one_or_none()

            # 5.f Verificar cupo de estacionamiento
            estado_cupo = {"cupo_total": 1, "cupo_usado": 0, "cupo_libre": 1, "bloqueado": False}
            try:
                estado_cupo = await membresia_service.verificar_cupo_socio(db, socio.id)
            except Exception as e_cupo:
                print(f"[CUPO] Error verificando cupo de {socio.id}: {e_cupo}")

            # 5.g Resolver zona de destino para socio permanente
            # Prioridad: membresia.zona_id (override) → zona única de la entidad (automático)
            zona_id_socio = membresia.zona_id if membresia else None
            zona_nombre_socio = None
            mensaje_zona = None

            if not zona_id_socio and socio.entidad_id:
                # Buscar asignaciones activas de la entidad
                res_asig = await db.execute(
                    select(AsignacionZona)
                    .where(
                        AsignacionZona.entidad_id == socio.entidad_id,
                        AsignacionZona.activa == True
                    )
                )
                asignaciones = res_asig.scalars().all()

                if len(asignaciones) == 1:
                    # Una sola zona → asignación automática
                    zona_id_socio = asignaciones[0].zona_id
                    zona_nombre_socio = asignaciones[0].zona_nombre
                elif len(asignaciones) > 1:
                    # Múltiples zonas → requiere asignación explícita en membresía
                    mensaje_zona = "Entidad con múltiples zonas. Contacte al administrador para asignar zona al socio."

            # Resolver nombre de zona si tenemos el ID pero no el nombre
            if zona_id_socio and not zona_nombre_socio:
                z_db = await db.get(ZonaEstacionamiento, zona_id_socio)
                if z_db:
                    zona_nombre_socio = z_db.nombre

            # --- CONTROL DE CAPACIDAD (Aegis v4.0) ---
            alerta_cap_critica = False
            info_cap = None
            if zona_id_socio and socio.entidad_id and datos.tipo == AccesoTipo.entrada:
                info_cap = await zona_service.obtener_ocupacion_real_entidad(db, socio.entidad_id, zona_id_socio)
                alerta_cap_critica = info_cap["critico"]

            return ResultadoValidacion(
                permitido = not bloqueado,
                mensaje = "CAPACIDAD MÁXIMA ALCANZADA" if alerta_cap_critica else (msg_bloqueo if bloqueado else "Validación Exitosa"),
                tipo_alerta = "error" if (bloqueado or alerta_cap_critica) else ("warning" if infracciones else "info"),
                socio = socio,
                vehiculo = vehiculo,
                vehiculos = vehiculos_socio,
                entidad_nombre = entidad.nombre if entidad else "N/A",
                qr_id = qr_db.id,
                usuario_id = socio.id,
                vehiculo_id = vehiculo.id if vehiculo else None,
                infracciones_activas = [{"tipo": i.tipo, "descripcion": i.descripcion, "bloquea": i.bloquea_salida} for i in infracciones],
                membresia_info = {
                    "id": membresia.id,
                    "estado": membresia.estado,
                    "fecha_inicio": membresia.fecha_inicio,
                    "fecha_fin": membresia.fecha_fin,
                    "progreso": membresia_service.calcular_progreso(membresia),
                    "puestos_asignados": membresia.puestos_asignados
                } if membresia else None,
                ultima_entrada = ultima_entrada.timestamp if ultima_entrada else None,
                alerta_cupo = estado_cupo["bloqueado"],
                cupo_info = estado_cupo,
                zona_asignada_id = zona_id_socio,
                zona_nombre = zona_nombre_socio,
                mensaje_adicional = mensaje_zona,
                alerta_capacidad_critica = alerta_cap_critica,
                info_capacidad_zona = info_cap
            )

        except Exception as e:
            print(f"DEBUG: Error inesperado en validación: {str(e)}")
            return ResultadoValidacion(permitido=False, mensaje=f"Error en validación: {str(e)}", tipo_alerta="error")

    async def registrar_acceso(self, db: AsyncSession, datos: AccesoRegistrar, registrado_por_id: UUID) -> Acceso:
        """
        Persiste el registro de acceso y actualiza contadores de pases masivos si aplica.
        Maneja creación de usuarios ligeros si vienen datos manuales.
        """
        final_usuario_id = datos.usuario_id
        final_vehiculo_id = datos.vehiculo_id
        final_vehiculo_pase_id = datos.vehiculo_pase_id

        # 0. Validar integridad de IDs provenientes del Frontend (Filtrar IDs mockeados de pases masivos excel)
        
        if final_usuario_id:
            q_exists_u = select(Usuario.id).where(Usuario.id == final_usuario_id)
            if not (await db.execute(q_exists_u)).scalar_one_or_none():
                final_usuario_id = None
                
        if final_vehiculo_id:
            q_exists_v = select(Vehiculo.id).where(Vehiculo.id == final_vehiculo_id)
            if not (await db.execute(q_exists_v)).scalar_one_or_none():
                # Evaluar si el ID es en realidad un VehiculoPase (Vehículos Múltiples Mock)
                q_exists_vp = select(VehiculoPase.id).where(VehiculoPase.id == final_vehiculo_id)
                if (await db.execute(q_exists_vp)).scalar_one_or_none():
                    final_vehiculo_pase_id = final_vehiculo_id
                
                # Desvincular de la tabla permanente para evitar ForeignKeyViolationError
                final_vehiculo_id = None

        # 1. Registro Ligero de Usuario/Vehículo si se proveen datos manuales
        if datos.es_manual:
            # Buscar si es un pase masivo o crear uno temporal
            qr_db = None
            if datos.qr_id:
                qr_db = await db.get(CodigoQR, datos.qr_id)
            
            if qr_db and qr_db.tipo in [QRTipo.evento_simple, QRTipo.evento_identificado, QRTipo.temporal]:
                # Actualizar datos en el QR directamente (Bitácora rápida)
                if datos.nombre_manual: qr_db.nombre_portador = datos.nombre_manual.upper()
                if datos.cedula_manual: qr_db.cedula_portador = datos.cedula_manual
                if datos.telefono_manual: qr_db.telefono_portador = datos.telefono_manual
                
                # Vehículo en el QR (si no es multi-vehículo, guardamos los datos base)
                if not qr_db.multi_vehiculo:
                    if datos.vehiculo_placa: qr_db.vehiculo_placa = datos.vehiculo_placa.upper()
                    if datos.vehiculo_marca: qr_db.vehiculo_marca = datos.vehiculo_marca.upper()
                    if datos.vehiculo_modelo: qr_db.vehiculo_modelo = datos.vehiculo_modelo.upper()
                    if datos.vehiculo_color: qr_db.vehiculo_color = datos.vehiculo_color.upper()
                else:
                    # Lógica para multi-vehículo (VehiculoPase)
                    if datos.vehiculo_placa:
                        q_vp = select(VehiculoPase).where(VehiculoPase.qr_id == qr_db.id, VehiculoPase.placa == datos.vehiculo_placa.upper())
                        vp_existente = (await db.execute(q_vp)).scalar_one_or_none()
                        if not vp_existente:
                            vp_existente = VehiculoPase(
                                qr_id=qr_db.id,
                                placa=datos.vehiculo_placa.upper(),
                                marca=datos.vehiculo_marca.upper() if datos.vehiculo_marca else "GENÉRICO",
                                modelo=datos.vehiculo_modelo.upper() if datos.vehiculo_modelo else "GENÉRICO",
                                color=datos.vehiculo_color.upper() if datos.vehiculo_color else "SIN COLOR"
                            )
                            db.add(vp_existente)
                            await db.flush()
                        final_vehiculo_pase_id = vp_existente.id
                
                qr_db.datos_completos = True
                await db.flush()

            elif not qr_db:
                # Creación de pase temporal para registro manual/excepcional (sin ensuciar usuarios)
                import secrets
                nuevo_token = f"TEMP-{secrets.token_hex(8)}"
                
                qr_db = CodigoQR(
                    tipo=QRTipo.temporal,
                    token=nuevo_token,
                    nombre_portador=datos.nombre_manual.upper() if datos.nombre_manual else "VISITANTE",
                    cedula_portador=datos.cedula_manual,
                    telefono_portador=datos.telefono_manual,
                    vehiculo_placa=datos.vehiculo_placa.upper() if datos.vehiculo_placa else None,
                    vehiculo_marca=datos.vehiculo_marca.upper() if datos.vehiculo_marca else "GENÉRICO",
                    vehiculo_modelo=datos.vehiculo_modelo.upper() if datos.vehiculo_modelo else "GENÉRICO",
                    vehiculo_color=datos.vehiculo_color.upper() if datos.vehiculo_color else "SIN COLOR",
                    datos_completos=True
                )
                db.add(qr_db)
                await db.flush()
                datos.qr_id = qr_db.id  # Asignamos el qr_id generado al DTO para el registro del Acceso

        # 2. Si todavía no tenemos usuario_id, el registro de acceso quedará sin usuario asociado
        # logueando la entrada exclusivamente por el medio temporal (qr_id).
        # (Se eliminó la creación del usuario VISITANTE_ANÓNIMO a petición de mantener la tabla limpia)

        # 2.5 SOP Auto-Cierre por Re-entrada (Aegis v2.3 Mandatorio)
        # Si es una entrada, verificar si existe una entrada previa sin salida para este vehículo
        if datos.tipo == AccesoTipo.entrada:
            placa_para_buscar = datos.vehiculo_placa
            if not placa_para_buscar and final_vehiculo_id:
                v_db = await db.get(Vehiculo, final_vehiculo_id)
                if v_db: placa_para_buscar = v_db.placa
            elif not placa_para_buscar and final_vehiculo_pase_id:
                vp_db = await db.get(VehiculoPase, final_vehiculo_pase_id)
                if vp_db: placa_para_buscar = vp_db.placa
            
            if placa_para_buscar:
                q_last = select(Acceso).where(
                    or_(
                        Acceso.vehiculo_placa == placa_para_buscar,
                        Acceso.vehiculo_id == final_vehiculo_id if final_vehiculo_id else False
                    )
                ).order_by(Acceso.timestamp.desc()).limit(1)
                
                res_last = await db.execute(q_last)
                ultimo_acceso = res_last.scalar_one_or_none()
                
                if ultimo_acceso and ultimo_acceso.tipo == AccesoTipo.entrada:
                    # Crear salida automática para cerrar el ciclo previo en la bitácora
                    salida_auto = Acceso(
                        qr_id = ultimo_acceso.qr_id,
                        usuario_id = ultimo_acceso.usuario_id,
                        vehiculo_id = ultimo_acceso.vehiculo_id,
                        vehiculo_pase_id = ultimo_acceso.vehiculo_pase_id,
                        tipo = AccesoTipo.salida,
                        punto_acceso = "SISTEMA (RE-ENTRADA)",
                        registrado_por = registrado_por_id,
                        es_manual = True,
                        observaciones = f"Auto-cierre por entrada detectada en {datos.punto_acceso}"
                    )
                    db.add(salida_auto)
                    await db.flush()

                    # ── FIX: Expulsar del estacionamiento activo (Aegis v3.1) ──────────────
                    # El auto-cierre de accesos solo registraba la salida en bitácora pero
                    # dejaba VehiculoPase.ingresado=True y el puesto ocupado.
                    # Ahora también liberamos el estacionamiento para que el operador
                    # pueda confirmar el nuevo ingreso sin conflictos.
                    q_vp_activo = select(VehiculoPase).where(
                        VehiculoPase.placa == placa_para_buscar,
                        VehiculoPase.ingresado == True,
                    )
                    res_vp = await db.execute(q_vp_activo)
                    vp_activo = res_vp.scalars().first()

                    if vp_activo:
                        vp_activo.ingresado = False
                        vp_activo.hora_salida = datetime.now(timezone.utc)

                        # Liberar puesto físico si estaba asignado
                        if vp_activo.puesto_asignado_id:
                            puesto_db = await db.get(
                                PuestoEstacionamiento, vp_activo.puesto_asignado_id
                            )
                            if puesto_db:
                                from app.models.enums import EstadoPuesto
                                puesto_db.estado = EstadoPuesto.libre
                                puesto_db.qr_actual_id = None
                                puesto_db.vehiculo_actual_id = None
                                puesto_db.ocupado_desde = None

                        # Decrementar ocupación de zona
                        if vp_activo.zona_asignada_id:
                            res_zona = await db.execute(
                                select(ZonaEstacionamiento).where(
                                    ZonaEstacionamiento.id == vp_activo.zona_asignada_id
                                )
                            )
                            zona_db = res_zona.scalars().first()
                            if zona_db:
                                zona_db.ocupacion_actual = max(
                                    0, (zona_db.ocupacion_actual or 0) - 1
                                )

                        await db.flush()
                    # ── Fin del fix ────────────────────────────────────────────────────────

        # 3. Resolver zona de destino para persistir en el registro de acceso
        # Para pases masivos: desde QR o lote. Para socios permanentes: desde membresía o entidad.
        zona_id_acceso = None
        
        # Prioridad 1: Si hay entidad explícita provista por Alcabala
        if datos.entidad_id:
            entidad_db = await db.get(EntidadCivil, datos.entidad_id)
            if entidad_db:
                if entidad_db.zona_id:
                    zona_id_acceso = entidad_db.zona_id
                else:
                    res_asig = await db.execute(select(AsignacionZona).where(
                        AsignacionZona.entidad_id == datos.entidad_id,
                        AsignacionZona.activa == True
                    ).limit(1))
                    asig_db = res_asig.scalar_one_or_none()
                    if asig_db:
                        zona_id_acceso = asig_db.zona_id
                
        # Prioridad 2: Buscar zona en el QR
        if not zona_id_acceso and datos.qr_id:
            qr_para_zona = await db.get(CodigoQR, datos.qr_id)
            if qr_para_zona:
                zona_id_acceso = qr_para_zona.zona_asignada_id
                
                # Fallback: Si no tiene zona pero tiene puesto, obtener la zona del puesto (v2.4 Fix)
                if not zona_id_acceso and qr_para_zona.puesto_asignado_id:
                    p_db = await db.get(PuestoEstacionamiento, qr_para_zona.puesto_asignado_id)
                    if p_db:
                        zona_id_acceso = p_db.zona_id
                
                if not zona_id_acceso and qr_para_zona.lote_id:
                    lote_para_zona = await db.get(LotePaseMasivo, qr_para_zona.lote_id)
                    if lote_para_zona:
                        zona_id_acceso = lote_para_zona.zona_estacionamiento_id

        # Prioridad 3: Buscar en membresía/entidad del socio permanente
        if not zona_id_acceso and final_usuario_id:
            res_mem_zona = await db.execute(
                select(Membresia)
                .where(Membresia.socio_id == final_usuario_id)
                .order_by(Membresia.updated_at.desc())
            )
            mem_zona = res_mem_zona.scalars().first()
            if mem_zona and mem_zona.zona_id:
                zona_id_acceso = mem_zona.zona_id
            elif mem_zona:
                # Fallback: zona única de la entidad del socio
                res_usr_zona = await db.get(Usuario, final_usuario_id)
                if res_usr_zona and res_usr_zona.entidad_id:
                    res_asig_zona = await db.execute(
                        select(AsignacionZona)
                        .where(
                            AsignacionZona.entidad_id == res_usr_zona.entidad_id,
                            AsignacionZona.activa == True
                        )
                    )
                    asig_list = res_asig_zona.scalars().all()
                    if len(asig_list) == 1:
                        zona_id_acceso = asig_list[0].zona_id

        # 4. Persistir Acceso
        # Auto-poblar datos de vehículo si tenemos vehiculo_id pero no datos manuales (v2.5)
        v_placa = datos.vehiculo_placa
        v_marca = datos.vehiculo_marca
        v_modelo = datos.vehiculo_modelo
        v_color = datos.vehiculo_color
        
        if not v_placa and final_vehiculo_id:
            v_db_notif = await db.get(Vehiculo, final_vehiculo_id)
            if v_db_notif:
                v_placa = v_db_notif.placa
                v_marca = v_db_notif.marca
                v_modelo = v_db_notif.modelo
                v_color = v_db_notif.color

        nuevo_acceso = Acceso(
            qr_id = datos.qr_id,
            usuario_id = final_usuario_id,
            vehiculo_id = final_vehiculo_id,
            vehiculo_pase_id = final_vehiculo_pase_id,
            tipo = datos.tipo,
            punto_acceso = datos.punto_acceso,
            registrado_por = registrado_por_id,
            es_manual = datos.es_manual,
            # Campos de trazabilidad de contingencia (Aegis Tactical v2.2)
            nombre_manual = datos.nombre_manual,
            cedula_manual = datos.cedula_manual,
            telefono_manual = datos.telefono_manual,
            vehiculo_placa = v_placa,
            vehiculo_marca = v_marca,
            vehiculo_modelo = v_modelo,
            vehiculo_color = v_color,
            observaciones = datos.observaciones,
            es_excepcion = datos.es_excepcion,
            # Zona de destino persistida en el momento del acceso
            zona_id = zona_id_acceso
        )
        db.add(nuevo_acceso)

        # Si es un QR vinculado a un lote, incrementar accesos_usados SOLO en entrada
        if datos.qr_id:
            qr_db = await db.get(CodigoQR, datos.qr_id)
            if qr_db:
                if qr_db.lote_id and datos.tipo == AccesoTipo.entrada:
                    qr_db.accesos_usados += 1
                    
        # Si el QR no tenía usuario_id (evento_simple), vincularlo al creado ahora para trazabilidad futura
                if not qr_db.usuario_id and final_usuario_id:
                    qr_db.usuario_id = final_usuario_id
        
        # 4. Comprometer transacción principal
        await db.commit()
        await db.refresh(nuevo_acceso)

        # 5. Sistema de Notificaciones (Post-Commit)
        # 5.1 Alerta de Vehículo Excepcional / Fantasma / Intimidación
        if datos.es_excepcion:
            try:
                # Esta alerta va para supervisores y administradores
                await notificacion_service.notificar_excepcion_alcabala(db, nuevo_acceso)
            except Exception as e:
                print(f"[TACTICAL] Error notificar excepción: {e}")
                
        # 5.1.5 Notificación específica de Autorización a Entidad
        if datos.es_manual and datos.entidad_id:
            try:
                await notificacion_service.notificar_acceso_entidad(db, datos.entidad_id, nuevo_acceso)
            except Exception as e:
                print(f"[TACTICAL] Error notificar a entidad: {e}")

        # 5.2 Notificaciones de flujo normal (Parqueros)
        if (datos.qr_id or final_usuario_id) and datos.tipo == AccesoTipo.entrada:
            try:
                # Resolver Zona: Usar la zona persistida en el registro de acceso (Aegis v2.4)
                zona_id = nuevo_acceso.zona_id
                
                if zona_id:
                    # 1. Determinar Nombre del Conductor
                    nombre_socio = "Socio Desconocido"
                    if final_usuario_id:
                        u_notif = await db.get(Usuario, final_usuario_id)
                        if u_notif:
                            nombre_socio = f"{u_notif.nombre} {u_notif.apellido}"
                    elif nuevo_acceso.nombre_manual:
                        nombre_socio = nuevo_acceso.nombre_manual
                    else:
                        qr_n = await db.get(CodigoQR, datos.qr_id) if datos.qr_id else None
                        if qr_n and qr_n.nombre_portador:
                            nombre_socio = f"{qr_n.nombre_portador} (PASE)"
                    
                    # 2. Determinar Vehículo
                    placa = "S/P"
                    detalles = "Detalles no registrados"
                    
                    if final_vehiculo_id:
                        v_notif = await db.get(Vehiculo, final_vehiculo_id)
                        if v_notif:
                            placa = v_notif.placa
                            detalles = f"{v_notif.marca} {v_notif.modelo} ({v_notif.color})"
                    elif nuevo_acceso.vehiculo_placa:
                        placa = nuevo_acceso.vehiculo_placa
                        detalles = " ".join(filter(None, [nuevo_acceso.vehiculo_marca, nuevo_acceso.vehiculo_modelo, nuevo_acceso.vehiculo_color])) or "Registro Manual"
                    else:
                        qr_v = await db.get(CodigoQR, datos.qr_id) if datos.qr_id else None
                        if qr_v and qr_v.vehiculo_placa:
                            placa = qr_v.vehiculo_placa
                            detalles = " ".join(filter(None, [qr_v.vehiculo_marca, qr_v.vehiculo_modelo, qr_v.vehiculo_color])) or "Pase Temporal"

                    # 3. Enviar Notificación
                    await notificacion_service.notificar_entrada_vehiculo(
                        db,
                        zona_id=zona_id,
                        placa=placa,
                        detalles_vehiculo=detalles,
                        nombre_socio=nombre_socio
                    )
            except Exception as e:
                # Loguear error pero no propagar para no romper la respuesta al guardia
                print(f"⚠️ ERROR no crítico enviando notificación: {str(e)}")

        return nuevo_acceso

    async def obtener_historial_tactico(self, db: AsyncSession, page: int, size: int, punto_nombre: str = None) -> dict:
        """Obtiene la bitácora de eventos paginada"""

        query = select(Acceso)
        if punto_nombre:
            query = query.where(func.trim(Acceso.punto_acceso) == punto_nombre.strip())

        # Contar total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        # Obtener página ordenada desc
        query = query.order_by(Acceso.timestamp.desc()).offset((page - 1) * size).limit(size)
        result = await db.execute(query)
        accesos = result.scalars().all()

        items = []
        for acc in accesos:
            # Rehydrate user
            u_query = select(Usuario).where(Usuario.id == acc.usuario_id)
            u = (await db.execute(u_query)).scalar_one_or_none()
            
            usuario_nombre = "Socio Desconocido"
            vehiculo_str = "SIN VEHÍCULO"
            es_pase_temporal = False
            
            # 1. Resolver Nombre y Tipo (Mejorado v2.5)
            if u:
                usuario_nombre = f"{u.nombre} {u.apellido}"
            elif acc.nombre_manual:
                usuario_nombre = f"{acc.nombre_manual} (MANUAL)"
            elif acc.qr_id:
                es_pase_temporal = True
                qr_db = await db.get(CodigoQR, acc.qr_id)
                if qr_db and qr_db.nombre_portador:
                    usuario_nombre = f"{qr_db.nombre_portador} (PASE)"
            
            # 2. Resolver Vehículo (Mejorado v2.5)
            if acc.vehiculo_id:
                v = await db.get(Vehiculo, acc.vehiculo_id)
                if v:
                    vehiculo_str = f"{v.marca} {v.modelo} [{v.placa}]"
            elif acc.vehiculo_placa:
                # Priorizar datos de trazabilidad del Acceso
                mca = acc.vehiculo_marca or ""
                mod = acc.vehiculo_modelo or ""
                detalles = " ".join(filter(None, [mca, mod]))
                if detalles:
                    vehiculo_str = f"{detalles} [{acc.vehiculo_placa}]"
                else:
                    vehiculo_str = f"REGISTRO [{acc.vehiculo_placa}]"
            elif acc.vehiculo_pase_id:
                # El usuario entró con un vehículo secundario del pase masivo
                vp = await db.get(VehiculoPase, acc.vehiculo_pase_id)
                if vp:
                    mca = vp.marca or ""
                    mod = vp.modelo or ""
                    detalles = " ".join(filter(None, [mca, mod]))
                    if detalles:
                        vehiculo_str = f"{detalles} [{vp.placa}]"
                    else:
                        vehiculo_str = f"PASE [{vp.placa}]"
            elif acc.qr_id:
                # Fallback al QR
                qr_db = await db.get(CodigoQR, acc.qr_id)
                if qr_db and qr_db.vehiculo_placa:
                    mca = qr_db.vehiculo_marca or ""
                    mod = qr_db.vehiculo_modelo or ""
                    detalles = " ".join(filter(None, [mca, mod]))
                    if detalles:
                        vehiculo_str = f"{detalles} [{qr_db.vehiculo_placa}]"
                    else:
                        vehiculo_str = f"PASE [{qr_db.vehiculo_placa}]"

            items.append(EventoTactico(
                id=acc.id,
                tipo=acc.tipo,
                timestamp=acc.timestamp,
                usuario=usuario_nombre,
                vehiculo=vehiculo_str,
                punto=acc.punto_acceso,
                es_manual=acc.es_manual,
                es_pase_temporal=es_pase_temporal
            ))

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size
        }

    async def obtener_historial_socio(self, db: AsyncSession, usuario_id: UUID, page: int, size: int) -> dict:
        """Obtiene la bitácora de accesos de un socio específico (y sus vehículos)"""
        
        # Obtener todos los vehículos del socio
        q_vehiculos = select(Vehiculo.id).where(Vehiculo.socio_id == usuario_id)
        vehiculos_res = await db.execute(q_vehiculos)
        vehiculo_ids = [v for v in vehiculos_res.scalars().all()]
        
        query = select(Acceso).where(
            or_(
                Acceso.usuario_id == usuario_id,
                Acceso.vehiculo_id.in_(vehiculo_ids) if vehiculo_ids else False
            )
        )

        # Contar total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0

        # Obtener página ordenada desc
        query = query.order_by(Acceso.timestamp.desc()).offset((page - 1) * size).limit(size)
        result = await db.execute(query)
        accesos = result.scalars().all()

        items = []
        for acc in accesos:
            vehiculo_str = "SIN VEHÍCULO"
            
            if acc.vehiculo_id:
                v = await db.get(Vehiculo, acc.vehiculo_id)
                if v:
                    vehiculo_str = f"{v.marca} {v.modelo} [{v.placa}]"
            elif acc.vehiculo_placa:
                vehiculo_str = f"VEH. PASE [{acc.vehiculo_placa}]"
                
            items.append(EventoTactico(
                id=acc.id,
                tipo=acc.tipo,
                timestamp=acc.timestamp,
                usuario="", # No hace falta el nombre del socio aquí porque es su propia vista
                vehiculo=vehiculo_str,
                punto=acc.punto_acceso,
                es_manual=acc.es_manual,
                es_pase_temporal=False
            ))

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size
        }

    async def buscar_por_placa(self, db: AsyncSession, placa: str, tipo: AccesoTipo) -> ResultadoValidacion:
        """
        Busca un vehículo por placa exacta en todos los orígenes posibles.
        SOP: Aegis Tactical v2.2 - Verificación Manual de Contingencia.
        """
        placa = placa.strip().upper()
        
        # 1. Buscar en Vehiculo (Socio permanente)
        query_v = select(Vehiculo).where(Vehiculo.placa == placa, Vehiculo.activo == True)
        res_v = await db.execute(query_v)
        vehiculo = res_v.scalar_one_or_none()
        
        if vehiculo:
            # Buscar al socio
            query_socio = select(Usuario).where(Usuario.id == vehiculo.socio_id, Usuario.activo == True)
            res_socio = await db.execute(query_socio)
            socio = res_socio.scalar_one_or_none()
            
            if socio:
                # Validar membresía e infracciones (Lógica simplificada de validar_qr)
                query_mem = select(Membresia).where(Membresia.socio_id == socio.id).order_by(Membresia.updated_at.desc())
                res_mem = await db.execute(query_mem)
                membresia = res_mem.scalars().first()
                
                query_inf = select(Infraccion).where(Infraccion.usuario_id == socio.id, Infraccion.estado == InfraccionEstado.activa)
                res_inf = await db.execute(query_inf)
                infracciones = res_inf.scalars().all()
                
                query_ent = select(EntidadCivil).where(EntidadCivil.id == socio.entidad_id)
                res_ent = await db.execute(query_ent)
                entidad = res_ent.scalar_one_or_none()
                
                # Buscar QR activo para este socio si existe (para trazabilidad)
                query_qr = select(CodigoQR).where(CodigoQR.usuario_id == socio.id, CodigoQR.activo == True).order_by(CodigoQR.created_at.desc())
                res_qr = await db.execute(query_qr)
                qr_db = res_qr.scalar_one_or_none()
                
                bloqueado = False
                msg_bloqueo = ""
                if tipo == AccesoTipo.salida:
                    for inf in infracciones:
                        if inf.bloquea_salida:
                            bloqueado = True
                            msg_bloqueo = f"SALIDA BLOQUEADA: {inf.descripcion}"
                            break
                
                if not bloqueado and membresia and membresia.estado not in [MembresiaEstado.activa, MembresiaEstado.exonerada]:
                    bloqueado = False # El sistema de alcabala suele dejar pasar pero marcar warning? 
                    # Re-revisando validar_qr: ahí SÍ bloquea si la membresía no es activa/exonerada.
                    # Líneas 206-213 de validar_qr.
                    return ResultadoValidacion(
                        permitido=False, 
                        mensaje=f"MEMBRESÍA {(membresia.estado.value if membresia else 'INEXISTENTE').upper()}", 
                        tipo_alerta="error",
                        socio=socio,
                        vehiculo=vehiculo
                    )

                return ResultadoValidacion(
                    permitido = not bloqueado,
                    mensaje = msg_bloqueo or "Vehículo Permanente Identificado",
                    tipo_alerta = "error" if bloqueado else ("warning" if infracciones else "success"),
                    socio = socio,
                    vehiculo = vehiculo,
                    vehiculos = [vehiculo],
                    entidad_nombre = entidad.nombre if entidad else "N/A",
                    qr_id = qr_db.id if qr_db else None,
                    usuario_id = socio.id,
                    vehiculo_id = vehiculo.id,
                    infracciones_activas = [{"tipo": i.tipo, "descripcion": i.descripcion, "bloquea": i.bloquea_salida} for i in infracciones],
                    membresia_info = {
                        "id": membresia.id,
                        "estado": membresia.estado,
                        "fecha_inicio": membresia.fecha_inicio,
                        "fecha_fin": membresia.fecha_fin,
                        "progreso": membresia_service.calcular_progreso(membresia),
                        "puestos_asignados": membresia.puestos_asignados
                    } if membresia else None
                )

        # 2. Buscar en VehiculoPase (Pases Masivos / Eventos)
        query_vp = select(VehiculoPase).where(VehiculoPase.placa == placa)
        res_vp = await db.execute(query_vp)
        vehiculo_pase = res_vp.scalar_one_or_none()
        
        if vehiculo_pase:
            # Buscar el QR
            qr_db = await db.get(CodigoQR, vehiculo_pase.qr_id)
            if qr_db:
                # Validar el QR
                datos_val = AccesoValidar(qr_token=qr_db.token, tipo=tipo)
                res = await self.validar_qr(db, datos_val)
                # Forzar el vehículo específico de la placa
                res.vehiculo = {
                    "id": vehiculo_pase.id,
                    "placa": vehiculo_pase.placa,
                    "marca": vehiculo_pase.marca or "GENÉRICO",
                    "modelo": vehiculo_pase.modelo or "GENÉRICO",
                    "color": vehiculo_pase.color or "SIN COLOR",
                    "activo": True,
                    "socio_id": res.usuario_id,
                    "created_at": vehiculo_pase.created_at
                }
                res.vehiculo_id = vehiculo_pase.id
                return res

        # 3. Buscar en CodigoQR (Placa principal del pase)
        query_qrp = select(CodigoQR).where(CodigoQR.vehiculo_placa == placa, CodigoQR.activo == True).order_by(CodigoQR.created_at.desc())
        res_qrp = await db.execute(query_qrp)
        qr_p = res_qrp.scalar_one_or_none()
        
        if qr_p:
            datos_val = AccesoValidar(qr_token=qr_p.token, tipo=tipo)
            return await self.validar_qr(db, datos_val)

        # 4. No encontrado
        return ResultadoValidacion(
            permitido=False, 
            mensaje=f"PLACA {placa} NO REGISTRADA", 
            tipo_alerta="error"
        )

acceso_service = AccesoService()
