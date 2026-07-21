"""
Servicio AbastecimientoService.
Maneja la lógica de negocio para la bomba de combustible, validaciones, solicitudes de aprobación remota y reportes.
"""
import uuid
import logging
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehiculo import Vehiculo
from app.models.entidad_civil import EntidadCivil
from app.models.tanque_combustible import TanqueCombustible
from app.models.lectura_tanque import LecturaTanque
from app.models.solicitud_combustible import SolicitudCombustible
from app.models.abastecimiento import Abastecimiento
from app.models.usuario import Usuario
from app.models.enums import RolTipo, EstadoSolicitudCombustible, TipoSolicitudCombustible, TipoLecturaTanque, UsoVehiculo, TipoCombustible
from app.services.notificacion_service import notificacion_service

class AbastecimientoService:
    
    async def obtener_rango_semana(self, fecha_str: Optional[str] = None) -> tuple:
        """
        Retorna el inicio de la semana (lunes a las 00:00:00) y el fin del día (domingo o el día indicado).
        """
        if fecha_str:
            try:
                hoy = datetime.fromisoformat(fecha_str.replace("Z", "+00:00")).astimezone(ZoneInfo("America/Caracas"))
            except ValueError:
                hoy = datetime.now(ZoneInfo("America/Caracas"))
        else:
            hoy = datetime.now(ZoneInfo("America/Caracas"))
        lunes = hoy - timedelta(days=hoy.weekday())
        inicio = datetime.combine(lunes.date(), time.min).replace(tzinfo=ZoneInfo("America/Caracas"))
        fin = datetime.combine(hoy.date(), time.max).replace(tzinfo=ZoneInfo("America/Caracas"))
        return inicio, fin

    async def obtener_rango_dia(self, fecha_str: Optional[str] = None) -> tuple:
        """
        Retorna el inicio y fin del día actual o de la fecha indicada (00:00:00 a 23:59:59).
        """
        if fecha_str:
            try:
                hoy = datetime.fromisoformat(fecha_str.replace("Z", "+00:00")).astimezone(ZoneInfo("America/Caracas"))
            except ValueError:
                hoy = datetime.now(ZoneInfo("America/Caracas"))
        else:
            hoy = datetime.now(ZoneInfo("America/Caracas"))
        inicio = datetime.combine(hoy.date(), time.min).replace(tzinfo=ZoneInfo("America/Caracas"))
        fin = datetime.combine(hoy.date(), time.max).replace(tzinfo=ZoneInfo("America/Caracas"))
        return inicio, fin

    async def obtener_entidad_transito(self, db: AsyncSession) -> EntidadCivil:
        """
        Busca u obtiene la entidad especial para vehículos externos/tránsito.
        """
        query = select(EntidadCivil).where(EntidadCivil.codigo_slug == 'transito-externo')
        res = await db.execute(query)
        entidad = res.scalar_one_or_none()
        
        if not entidad:
            entidad = EntidadCivil(
                id=uuid.uuid4(),
                nombre="Tránsito / Externo",
                codigo_slug="transito-externo",
                capacidad_vehiculos=1000,
                cuota_pases_autonoma=0,
                limite_combustible_semanal=5000.0, # 5000 litros por defecto para externos
                activo=True,
                descripcion="Entidad automática para registrar consumos de vehículos externos y de tránsito de emergencia."
            )
            db.add(entidad)
            await db.flush()
            
        return entidad

    async def verificar_consumo_semanal_entidad(self, db: AsyncSession, entidad_id: uuid.UUID) -> float:
        """
        Calcula la suma total de litros abastecidos a los vehículos de una entidad en la semana actual.
        """
        inicio, fin = await self.obtener_rango_semana()
        
        # Query para sumar cantidad_abastecida en la semana de los vehículos que pertenecen a la entidad
        query = select(func.coalesce(func.sum(Abastecimiento.cantidad_abastecida), 0.0)).join(
            Vehiculo, Abastecimiento.vehiculo_id == Vehiculo.id
        ).where(
            Vehiculo.entidad_id == entidad_id,
            Abastecimiento.fecha.between(inicio, fin)
        )
        
        res = await db.execute(query)
        return float(res.scalar_one() or 0.0)

    async def consultar_vehiculo_combustible(self, db: AsyncSession, placa: str) -> Dict[str, Any]:
        """
        Consulta rápida para el bombero. Retorna estado de autorización, último kilometraje,
        tipo de combustible y capacidad del vehículo, más estado del cupo de la entidad.
        """
        placa = placa.strip().upper()
        query = select(Vehiculo).where(Vehiculo.placa == placa, Vehiculo.activo == True)
        res = await db.execute(query)
        vehiculo = res.scalar_one_or_none()
        
        if not vehiculo:
            return {
                "registrado": False,
                "autorizado": False,
                "mensaje": "Vehículo no registrado en la base de datos.",
                "placa": placa
            }
            
        entidad_nombre = None
        cupo_excedido = False
        consumo_semanal = 0.0
        limite_semanal = 0.0
        
        if vehiculo.entidad_id:
            query_ent = select(EntidadCivil).where(EntidadCivil.id == vehiculo.entidad_id)
            res_ent = await db.execute(query_ent)
            entidad = res_ent.scalar_one_or_none()
            if entidad:
                entidad_nombre = entidad.nombre
                limite_semanal = entidad.limite_combustible_semanal
                consumo_semanal = await self.verificar_consumo_semanal_entidad(db, entidad.id)
                if limite_semanal > 0 and consumo_semanal >= limite_semanal:
                    cupo_excedido = True
        
        return {
            "registrado": True,
            "id": vehiculo.id,
            "placa": vehiculo.placa,
            "marca": vehiculo.marca,
            "modelo": vehiculo.modelo,
            "color": vehiculo.color,
            "uso_vehiculo": vehiculo.uso_vehiculo.value,
            "autorizado": vehiculo.autorizado_combustible,
            "tipo_combustible": vehiculo.tipo_combustible.value,
            "capacidad_tanque": vehiculo.capacidad_tanque,
            "ultimo_kilometraje": vehiculo.ultimo_kilometraje,
            "asignacion_semanal": vehiculo.asignacion_combustible_semanal,
            "entidad_id": vehiculo.entidad_id,
            "entidad_nombre": entidad_nombre,
            "consumo_semanal_entidad": consumo_semanal,
            "limite_semanal_entidad": limite_semanal,
            "cupo_entidad_excedido": cupo_excedido,
            "mensaje": "Vehículo autorizado" if (vehiculo.autorizado_combustible and not cupo_excedido) else 
                       ("Límite de combustible de entidad excedido" if cupo_excedido else "Vehículo no autorizado permanentemente")
        }

    async def registrar_solicitud_emergencia(
        self, 
        db: AsyncSession, 
        bombero_id: uuid.UUID,
        datos: Dict[str, Any]
    ) -> SolicitudCombustible:
        """
        Crea una solicitud de aprobación de combustible por emergencia.
        """
        placa = datos["placa"].strip().upper()
        
        # Buscar si el vehículo ya existe
        query_v = select(Vehiculo).where(Vehiculo.placa == placa)
        res_v = await db.execute(query_v)
        vehiculo = res_v.scalar_one_or_none()
        
        vehiculo_id = vehiculo.id if vehiculo else None
        entidad_id = vehiculo.entidad_id if vehiculo else None
        
        tipo_solicitud = TipoSolicitudCombustible.vehiculo_no_autorizado
        if not vehiculo:
            tipo_solicitud = TipoSolicitudCombustible.vehiculo_no_registrado
        else:
            # Si el vehículo existe, validar si es por cupo excedido de entidad
            if entidad_id:
                consumo = await self.verificar_consumo_semanal_entidad(db, entidad_id)
                query_ent = select(EntidadCivil).where(EntidadCivil.id == entidad_id)
                res_ent = await db.execute(query_ent)
                ent = res_ent.scalar_one_or_none()
                if ent and ent.limite_combustible_semanal > 0 and consumo >= ent.limite_combustible_semanal:
                    tipo_solicitud = TipoSolicitudCombustible.limite_entidad_excedido

        solicitud = SolicitudCombustible(
            id=uuid.uuid4(),
            placa=placa,
            vehiculo_id=vehiculo_id,
            entidad_id=entidad_id,
            bombero_id=bombero_id,
            cantidad_solicitada=datos["cantidad_solicitada"],
            tipo_solicitud=tipo_solicitud,
            motivo=datos["motivo"],
            estado=EstadoSolicitudCombustible.pendiente,
            nombre_conductor_manual=datos.get("nombre_conductor_manual"),
            cedula_conductor_manual=datos.get("cedula_conductor_manual"),
            marca_manual=datos.get("marca_manual"),
            modelo_manual=datos.get("modelo_manual"),
            color_manual=datos.get("color_manual")
        )
        
        db.add(solicitud)
        await db.flush()
        
        # Disparar alerta push al Comandante y Admin de la Base
        try:
            await notificacion_service.notificar_solicitud_combustible_pendiente(db, solicitud)
        except Exception as e:
            logging.error(f"Error al enviar push de solicitud combustible: {e}")
            
        return solicitud

    async def resolver_solicitud(
        self,
        db: AsyncSession,
        solicitud_id: uuid.UUID,
        aprobado_por_id: uuid.UUID,
        estado: EstadoSolicitudCombustible,
        entidad_id: Optional[uuid.UUID] = None
    ) -> SolicitudCombustible:
        """
        Resuelve una solicitud de combustible (Aprobar o Rechazar).
        Si se aprueba una solicitud de vehículo no registrado, se crea el vehículo automáticamente.
        """
        query = select(SolicitudCombustible).where(SolicitudCombustible.id == solicitud_id)
        res = await db.execute(query)
        solicitud = res.scalar_one_or_none()
        
        if not solicitud:
            raise ValueError("Solicitud no encontrada")
            
        if solicitud.estado != EstadoSolicitudCombustible.pendiente:
            raise ValueError("La solicitud ya ha sido resuelta")
            
        solicitud.estado = estado
        solicitud.aprobado_por_id = aprobado_por_id
        solicitud.fecha_aprobacion = datetime.now(ZoneInfo("America/Caracas"))
        
        if estado == EstadoSolicitudCombustible.aprobada:
            # Caso 1: Vehículo no registrado
            if solicitud.tipo_solicitud == TipoSolicitudCombustible.vehiculo_no_registrado:
                # Si el comandante asignó una entidad, la usamos, sino buscamos la de tránsito
                entidad_defecto_id = entidad_id
                if not entidad_defecto_id:
                    entidad_ext = await self.obtener_entidad_transito(db)
                    entidad_defecto_id = entidad_ext.id
                
                # Crear el vehículo de forma asíncrona
                nuevo_vehiculo = Vehiculo(
                    id=uuid.uuid4(),
                    placa=solicitud.placa,
                    marca=solicitud.marca_manual or "S/M",
                    modelo=solicitud.modelo_manual or "S/M",
                    color=solicitud.color_manual or "S/C",
                    tipo="sedan", # Valor por defecto
                    entidad_id=entidad_defecto_id,
                    uso_vehiculo=UsoVehiculo.servicio, # Uso temporal / servicio por defecto
                    autorizado_combustible=False,      # Autorización temporal (suministro único)
                    capacidad_tanque=50.0,             # Capacidad promedio
                    asignacion_combustible_semanal=0.0,
                    ultimo_kilometraje=0,
                    activo=True
                )
                db.add(nuevo_vehiculo)
                await db.flush()
                
                # Vincular el ID del vehículo a la solicitud
                solicitud.vehiculo_id = nuevo_vehiculo.id
                solicitud.entidad_id = entidad_defecto_id
                
            # Caso 2: Si el vehículo existe pero se le asigna otra entidad al aprobar
            elif solicitud.vehiculo_id and entidad_id:
                query_v = select(Vehiculo).where(Vehiculo.id == solicitud.vehiculo_id)
                res_v = await db.execute(query_v)
                veh = res_v.scalar_one_or_none()
                if veh:
                    veh.entidad_id = entidad_id
                    solicitud.entidad_id = entidad_id

        # Disparar alerta push al Bombero
        try:
            await notificacion_service.notificar_solicitud_combustible_resuelta(db, solicitud.bombero_id, estado.value, solicitud.placa)
        except Exception as e:
            logging.error(f"Error al enviar push de resolución al bombero: {e}")

        # AUDITORÍA: Si quien aprueba es el Supervisor de Bomberos, notificar al Comandante y Admin Base
        try:
            aprobador_query = select(Usuario).where(Usuario.id == aprobado_por_id)
            aprobador_res = await db.execute(aprobador_query)
            aprobador = aprobador_res.scalar_one_or_none()
            if aprobador and aprobador.rol == RolTipo.SUPERVISOR_BOMBEROS and estado == EstadoSolicitudCombustible.aprobada:
                await notificacion_service.notificar_auditoria_aprobacion_supervisor(
                    db, aprobador, solicitud
                )
        except Exception as e:
            logging.error(f"Error al enviar notificación de auditoría al comando: {e}")

        return solicitud

    async def registrar_abastecimiento(
        self,
        db: AsyncSession,
        bombero_id: uuid.UUID,
        datos: Dict[str, Any]
    ) -> Abastecimiento:
        """
        Registra una carga de combustible reduciendo inventario del tanque y auditando kilometraje.
        """
        placa = datos["placa"].strip().upper()
        tanque_id = uuid.UUID(str(datos["tanque_id"]))
        kilometraje_actual = int(datos["kilometraje_actual"])
        cantidad_abastecida = float(datos["cantidad_abastecida"])
        solicitud_id = uuid.UUID(str(datos["solicitud_aprobacion_id"])) if datos.get("solicitud_aprobacion_id") else None
        
        # 1. Obtener vehículo
        query_v = select(Vehiculo).where(Vehiculo.placa == placa, Vehiculo.activo == True)
        res_v = await db.execute(query_v)
        vehiculo = res_v.scalar_one_or_none()
        
        if not vehiculo:
            raise ValueError(f"El vehículo con placa {placa} no está registrado en el censo.")
            
        # 2. Validar autorización de combustible (Permanente vs Solicitud Única)
        solicitud_aprobada = None
        if not vehiculo.autorizado_combustible:
            if not solicitud_id:
                raise ValueError("El vehículo no está autorizado para recibir combustible. Requiere solicitud remota.")
                
            query_sol = select(SolicitudCombustible).where(
                SolicitudCombustible.id == solicitud_id,
                SolicitudCombustible.placa == placa
            )
            res_sol = await db.execute(query_sol)
            solicitud_aprobada = res_sol.scalar_one_or_none()
            
            if not solicitud_aprobada:
                raise ValueError("Solicitud de autorización no encontrada.")
            if solicitud_aprobada.estado == EstadoSolicitudCombustible.consumida:
                raise ValueError("Esta solicitud ya fue consumida en un suministro anterior.")
            if solicitud_aprobada.estado != EstadoSolicitudCombustible.aprobada:
                raise ValueError(f"La solicitud no está en estado aprobada (Estado: {solicitud_aprobada.estado.value}).")
        
        # 3. Validar límite de la entidad si no tiene bypass
        if vehiculo.entidad_id and not solicitud_id:
            query_ent = select(EntidadCivil).where(EntidadCivil.id == vehiculo.entidad_id)
            res_ent = await db.execute(query_ent)
            entidad = res_ent.scalar_one_or_none()
            if entidad:
                consumo = await self.verificar_consumo_semanal_entidad(db, entidad.id)
                if entidad.limite_combustible_semanal > 0 and (consumo + cantidad_abastecida) > entidad.limite_combustible_semanal:
                    # Enviar alerta automática push al Comandante
                    try:
                        await notificacion_service.notificar_limite_combustible_entidad(db, entidad.nombre, consumo, entidad.limite_combustible_semanal)
                    except Exception as e:
                        logging.error(f"Error al enviar push de limite de entidad: {e}")
                    raise ValueError(f"El cupo semanal de la entidad '{entidad.nombre}' fue excedido ({consumo:.1f}/{entidad.limite_combustible_semanal:.1f} L). Requiere solicitud remota.")

        # 4. Validar kilometraje
        kilometraje_anterior = vehiculo.ultimo_kilometraje
        tiene_alerta = False
        
        if kilometraje_actual <= kilometraje_anterior and kilometraje_anterior > 0:
            # Si es menor o igual y tiene odómetro previo, bloqueamos excepto si hay solicitud
            if not solicitud_id:
                raise ValueError(f"Kilometraje inválido. El odómetro actual ({kilometraje_actual} km) debe ser mayor al anterior ({kilometraje_anterior} km).")
            else:
                tiene_alerta = True # Registra alerta pero lo permite por el bypass aprobado

        # 5. Calcular rendimiento de la carga previa
        # Buscamos la última recarga realizada
        query_prev = select(Abastecimiento).where(Abastecimiento.vehiculo_id == vehiculo.id).order_by(Abastecimiento.fecha.desc()).limit(1)
        res_prev = await db.execute(query_prev)
        abastecimiento_prev = res_prev.scalar_one_or_none()
        
        distancia = 0
        rendimiento = 0.0
        
        if abastecimiento_prev and kilometraje_anterior > 0:
            distancia = kilometraje_actual - kilometraje_anterior
            litros_previos = abastecimiento_prev.cantidad_abastecida
            
            if litros_previos > 0:
                rendimiento = distancia / litros_previos
                
                # Consultar los últimos 10 abastecimientos para calcular el promedio histórico
                stmt_hist = select(Abastecimiento).where(Abastecimiento.vehiculo_id == vehiculo.id).order_by(Abastecimiento.fecha.desc()).limit(10)
                res_hist = await db.execute(stmt_hist)
                hist_ab = res_hist.scalars().all()
                
                rendimientos_hist = []
                for i in range(len(hist_ab) - 1):
                    ab_act = hist_ab[i]
                    ab_prev = hist_ab[i+1]
                    d = ab_act.kilometraje_actual - ab_act.kilometraje_anterior
                    l = ab_prev.cantidad_abastecida
                    if d > 0 and l > 0:
                        rendimientos_hist.append(d / l)
                
                # Si hay al menos 2 abastecimientos en el historial, usamos el promedio
                if len(rendimientos_hist) >= 2:
                    promedio_rendimiento = sum(rendimientos_hist) / len(rendimientos_hist)
                else:
                    promedio_rendimiento = 3.5 if vehiculo.uso_vehiculo == UsoVehiculo.servicio else 8.0
                
                limite_sospecha = promedio_rendimiento * 0.70
                
                if rendimiento < limite_sospecha:
                    tiene_alerta = True
                    # Disparar alerta push al comandante en segundo plano
                    try:
                        datos_alerta = {
                            "placa": vehiculo.placa,
                            "motivo": f"Sospecha de extracción: rendimiento de {rendimiento:.2f} km/L es inferior al 70% del esperado ({promedio_rendimiento:.2f} km/L)"
                        }
                        await notificacion_service.notificar_discrepancia_combustible(db, datos_alerta)
                    except Exception as e:
                        logging.error(f"Error al enviar push de sospecha de rendimiento: {e}")

        # 6. Descontar litros del inventario del tanque
        query_t = select(TanqueCombustible).where(TanqueCombustible.id == tanque_id, TanqueCombustible.activo == True)
        res_t = await db.execute(query_t)
        tanque = res_t.scalar_one_or_none()
        
        if not tanque:
            raise ValueError("Tanque de combustible no encontrado o inactivo.")
        if tanque.cantidad_actual < cantidad_abastecida:
            raise ValueError(f"Inventario insuficiente en el tanque ({tanque.cantidad_actual:.1f} L disponibles).")
            
        tanque.cantidad_actual -= cantidad_abastecida

        # 7. Crear el registro de abastecimiento
        abastecimiento = Abastecimiento(
            id=uuid.uuid4(),
            vehiculo_id=vehiculo.id,
            bombero_id=bombero_id,
            tanque_id=tanque_id,
            kilometraje_anterior=kilometraje_anterior,
            kilometraje_actual=kilometraje_actual,
            cantidad_abastecida=cantidad_abastecida,
            distancia_recorrida=distancia,
            rendimiento_tramo=rendimiento,
            foto_kilometraje_url=datos.get("foto_kilometraje_url") or "",
            foto_maquina_url=datos["foto_maquina_url"],
            datos_ia_ocr=datos.get("datos_ia_ocr"),
            tiene_alerta=tiene_alerta,
            solicitud_aprobacion_id=solicitud_id,
            conductor=datos.get("conductor")
        )
        
        # 8. Actualizar kilometraje del vehículo
        vehiculo.ultimo_kilometraje = kilometraje_actual
        
        # 9. Si se usó una solicitud, marcarla como consumida
        if solicitud_aprobada:
            solicitud_aprobada.estado = EstadoSolicitudCombustible.consumida
            
        db.add(abastecimiento)
        await db.flush()
        
        return abastecimiento

    async def registrar_lectura_inicial_tanques(
        self,
        db: AsyncSession,
        bombero_id: uuid.UUID,
        tanque_id: uuid.UUID,
        cantidad_medida: float,
        observaciones: Optional[str] = None,
        tipo: TipoLecturaTanque = TipoLecturaTanque.apertura_dia
    ) -> LecturaTanque:
        """
        Permite al bombero o supervisor de bomberos declarar los litros de un tanque.
        Soporta apertura_dia, cierre_dia, recarga_externa y ajuste_auditoria.
        """
        query_t = select(TanqueCombustible).where(TanqueCombustible.id == tanque_id)
        res_t = await db.execute(query_t)
        tanque = res_t.scalar_one_or_none()
        
        if not tanque:
            raise ValueError("Tanque no encontrado")
            
        if cantidad_medida > tanque.capacidad_maxima:
            raise ValueError(f"La cantidad ingresada ({cantidad_medida} L) supera la capacidad máxima del tanque ({tanque.capacidad_maxima} L).")
        
        # Validación: no permitir duplicar apertura del día para el mismo tanque
        if tipo == TipoLecturaTanque.apertura_dia:
            tiene_apertura = await self.verificar_apertura_dia(db, tanque_id)
            if tiene_apertura:
                raise ValueError(f"Ya existe una lectura de apertura del día para este tanque. Use el ajuste de auditoría para corregir.")
            
        lectura = LecturaTanque(
            id=uuid.uuid4(),
            tanque_id=tanque_id,
            bombero_id=bombero_id,
            tipo_lectura=tipo,
            cantidad_medida=cantidad_medida,
            observaciones=observaciones
        )
        
        # Actualizar cantidad actual en el tanque (aplica a apertura, cierre y recargas)
        tanque.cantidad_actual = cantidad_medida
        
        db.add(lectura)
        await db.flush()
        return lectura

    async def verificar_apertura_dia(self, db: AsyncSession, tanque_id: Optional[uuid.UUID] = None, fecha_str: Optional[str] = None) -> bool:
        """
        Verifica si hay una lectura de apertura registrada hoy.
        Si se pasa tanque_id, verifica sólo para ese tanque; si no, verifica cualquier tanque.
        """
        inicio, fin = await self.obtener_rango_dia(fecha_str)
        
        query = select(func.count(LecturaTanque.id)).where(
            LecturaTanque.tipo_lectura == TipoLecturaTanque.apertura_dia,
            LecturaTanque.fecha.between(inicio, fin)
        )
        if tanque_id:
            query = query.where(LecturaTanque.tanque_id == tanque_id)
        
        res = await db.execute(query)
        conteo = res.scalar() or 0
        return conteo > 0

    async def verificar_cierre_dia(self, db: AsyncSession, tanque_id: Optional[uuid.UUID] = None, fecha_str: Optional[str] = None) -> bool:
        """
        Verifica si hay una lectura de cierre registrada hoy.
        Si se pasa tanque_id, verifica sólo para ese tanque; si no, verifica cualquier tanque.
        """
        inicio, fin = await self.obtener_rango_dia(fecha_str)
        
        query = select(func.count(LecturaTanque.id)).where(
            LecturaTanque.tipo_lectura == TipoLecturaTanque.cierre_dia,
            LecturaTanque.fecha.between(inicio, fin)
        )
        if tanque_id:
            query = query.where(LecturaTanque.tanque_id == tanque_id)
        
        res = await db.execute(query)
        conteo = res.scalar() or 0
        return conteo > 0

    async def verificar_lectura_inicial_semanal(self, db: AsyncSession) -> bool:
        """
        Verifica si todos los tanques activos tienen una lectura de apertura_dia registrada hoy.
        Retorna True si todos están aperturados hoy, False si falta alguno.
        """
        try:
            from app.models.tanque_combustible import TanqueCombustible
            # Contar total de tanques activos
            q_tanques = select(func.count(TanqueCombustible.id)).where(TanqueCombustible.activo == True)
            res_t = await db.execute(q_tanques)
            total_tanques = res_t.scalar() or 0
            
            if total_tanques == 0:
                return True
                
            # Contar cuántos de esos tanques activos tienen lectura de apertura registrada hoy
            inicio, fin = await self.obtener_rango_dia()
            q_aperturas = select(func.count(func.distinct(LecturaTanque.tanque_id))).join(
                TanqueCombustible, LecturaTanque.tanque_id == TanqueCombustible.id
            ).where(
                TanqueCombustible.activo == True,
                LecturaTanque.tipo_lectura == TipoLecturaTanque.apertura_dia,
                LecturaTanque.fecha.between(inicio, fin)
            )
            res_a = await db.execute(q_aperturas)
            tanques_aperturados = res_a.scalar() or 0
            
            return tanques_aperturados >= total_tanques
        except Exception as e:
            logging.error(f"Error en verificar_lectura_inicial_semanal: {e}")
            return False

    async def obtener_reporte_combustible(
        self,
        db: AsyncSession,
        fecha_inicio: datetime,
        fecha_fin: datetime,
        entidad_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """
        Genera consolidados de suministros y consumos diarios/semanales.
        """
        # Sumas totales
        query_totales = select(
            func.coalesce(func.sum(Abastecimiento.cantidad_abastecida), 0.0),
            func.count(Abastecimiento.id)
        ).where(
            Abastecimiento.fecha.between(fecha_inicio, fecha_fin)
        )
        if entidad_id:
            query_totales = query_totales.join(Vehiculo).where(Vehiculo.entidad_id == entidad_id)
            
        res_totales = await db.execute(query_totales)
        total_litros, total_cargas = res_totales.fetchone()
        
        # Consumo por Tipo de Combustible
        query_tipo = select(
            TanqueCombustible.tipo_combustible,
            func.coalesce(func.sum(Abastecimiento.cantidad_abastecida), 0.0)
        ).join(
            TanqueCombustible, Abastecimiento.tanque_id == TanqueCombustible.id
        ).where(
            Abastecimiento.fecha.between(fecha_inicio, fecha_fin)
        ).group_by(TanqueCombustible.tipo_combustible)
        
        if entidad_id:
            query_tipo = query_tipo.join(Vehiculo, Abastecimiento.vehiculo_id == Vehiculo.id).where(Vehiculo.entidad_id == entidad_id)
            
        res_tipo = await db.execute(query_tipo)
        consumo_por_combustible = {row[0].value: float(row[1]) for row in res_tipo.all()}

        # Consumo por Entidad
        query_entidad = select(
            EntidadCivil.nombre,
            func.coalesce(func.sum(Abastecimiento.cantidad_abastecida), 0.0),
            func.count(Abastecimiento.id)
        ).join(
            Vehiculo, Abastecimiento.vehiculo_id == Vehiculo.id
        ).join(
            EntidadCivil, Vehiculo.entidad_id == EntidadCivil.id
        ).where(
            Abastecimiento.fecha.between(fecha_inicio, fecha_fin)
        )
        if entidad_id:
            query_entidad = query_entidad.where(EntidadCivil.id == entidad_id)
            
        query_entidad = query_entidad.group_by(EntidadCivil.nombre).order_by(func.sum(Abastecimiento.cantidad_abastecida).desc())
        
        res_entidad = await db.execute(query_entidad)
        consumo_por_entidad = [
            {"entidad": row[0], "litros": float(row[1]), "cargas": row[2]}
            for row in res_entidad.all()
        ]

        # Alertas de discrepancias
        query_alertas = select(
            Vehiculo.placa,
            Usuario.nombre,
            Abastecimiento.kilometraje_anterior,
            Abastecimiento.kilometraje_actual,
            Abastecimiento.cantidad_abastecida,
            Abastecimiento.fecha,
            Abastecimiento.distancia_recorrida,
            Abastecimiento.rendimiento_tramo
        ).join(
            Vehiculo, Abastecimiento.vehiculo_id == Vehiculo.id
        ).join(
            Usuario, Abastecimiento.bombero_id == Usuario.id
        ).where(
            Abastecimiento.tiene_alerta == True,
            Abastecimiento.fecha.between(fecha_inicio, fecha_fin)
        )
        if entidad_id:
            query_alertas = query_alertas.where(Vehiculo.entidad_id == entidad_id)
            
        query_alertas = query_alertas.order_by(Abastecimiento.fecha.desc())
        res_alertas = await db.execute(query_alertas)
        alertas = [
            {
                "placa": row[0],
                "bombero": row[1],
                "km_anterior": row[2],
                "km_actual": row[3],
                "litros": float(row[4]),
                "fecha": row[5].isoformat(),
                "distancia_recorrida": row[6],
                "rendimiento_tramo": row[7]
            } for row in res_alertas.all()
        ]

        return {
            "total_litros": float(total_litros or 0.0),
            "total_cargas": total_cargas or 0,
            "consumo_por_combustible": consumo_por_combustible,
            "consumo_por_entidad": consumo_por_entidad,
            "alertas_sospechosas": alertas
        }

    async def registrar_abastecimiento_excepcional(
        self,
        db: AsyncSession,
        usuario_id: uuid.UUID,
        datos: Dict[str, Any]
    ) -> Abastecimiento:
        """
        Registra un abastecimiento excepcional retroactivo vinculándolo a la fecha indicada.
        Descuenta inventario y actualiza odómetro con lógica retroactiva.
        """
        placa = datos["placa"].strip().upper()
        tanque_id = uuid.UUID(str(datos["tanque_id"]))
        kilometraje_actual = int(datos["kilometraje_actual"])
        cantidad_abastecida = float(datos["cantidad_abastecida"])
        conductor = datos["conductor"].strip().upper()
        fecha_registro = datos["fecha_registro"]
        
        # 1. Obtener o crear vehículo
        query_v = select(Vehiculo).where(Vehiculo.placa == placa, Vehiculo.activo == True)
        res_v = await db.execute(query_v)
        vehiculo = res_v.scalar_one_or_none()
        
        if not vehiculo:
            # Crear vehículo automáticamente bajo entidad Tránsito / Externo
            entidad_ext = await self.obtener_entidad_transito(db)
            vehiculo = Vehiculo(
                id=uuid.uuid4(),
                placa=placa,
                marca=datos.get("marca_manual") or "S/M",
                modelo=datos.get("modelo_manual") or "S/M",
                color=datos.get("color_manual") or "S/C",
                tipo="sedan",
                entidad_id=entidad_ext.id,
                uso_vehiculo=UsoVehiculo.servicio,
                autorizado_combustible=False,
                capacidad_tanque=50.0,
                asignacion_combustible_semanal=0.0,
                ultimo_kilometraje=kilometraje_actual,
                activo=True
            )
            db.add(vehiculo)
            await db.flush()
            
        # 2. Obtener kilometraje anterior del vehículo en esa fecha retroactiva
        # Buscamos el último abastecimiento del vehículo cuya fecha sea menor o igual a fecha_registro
        query_prev = select(Abastecimiento).where(
            Abastecimiento.vehiculo_id == vehiculo.id,
            Abastecimiento.fecha <= fecha_registro
        ).order_by(Abastecimiento.fecha.desc()).limit(1)
        res_prev = await db.execute(query_prev)
        abastecimiento_prev = res_prev.scalar_one_or_none()
        
        kilometraje_anterior = abastecimiento_prev.kilometraje_actual if abastecimiento_prev else 0
        distancia = 0
        rendimiento = 0.0
        
        if kilometraje_anterior > 0:
            distancia = kilometraje_actual - kilometraje_anterior
            litros_previos = abastecimiento_prev.cantidad_abastecida
            if litros_previos > 0 and distancia > 0:
                rendimiento = distancia / litros_previos

        # 3. Descontar litros del inventario del tanque
        query_t = select(TanqueCombustible).where(TanqueCombustible.id == tanque_id, TanqueCombustible.activo == True)
        res_t = await db.execute(query_t)
        tanque = res_t.scalar_one_or_none()
        
        if not tanque:
            raise ValueError("Tanque de combustible no encontrado o inactivo.")
        if tanque.cantidad_actual < cantidad_abastecida:
            raise ValueError(f"Inventario insuficiente en el tanque ({tanque.cantidad_actual:.1f} L disponibles).")
            
        tanque.cantidad_actual -= cantidad_abastecida
        
        # 4. Fotos opcionales (marcador de posición si no se envían)
        foto_k = datos.get("foto_kilometraje_url") or "placeholder_excepcional"
        foto_m = datos.get("foto_maquina_url") or "placeholder_excepcional"

        # 5. Crear el registro de abastecimiento
        abastecimiento = Abastecimiento(
            id=uuid.uuid4(),
            vehiculo_id=vehiculo.id,
            bombero_id=usuario_id,
            tanque_id=tanque_id,
            kilometraje_anterior=kilometraje_anterior,
            kilometraje_actual=kilometraje_actual,
            cantidad_abastecida=cantidad_abastecida,
            distancia_recorrida=distancia,
            rendimiento_tramo=rendimiento,
            foto_kilometraje_url=foto_k,
            foto_maquina_url=foto_m,
            tiene_alerta=False,
            conductor=conductor,
            fecha=fecha_registro
        )
        
        # 6. Actualizar kilometraje del vehículo solo si el nuevo es mayor que su kilometraje actual registrado
        if kilometraje_actual > vehiculo.ultimo_kilometraje:
            vehiculo.ultimo_kilometraje = kilometraje_actual
            
        db.add(abastecimiento)
        await db.flush()
        
        return abastecimiento

    async def editar_abastecimiento_litraje(
        self,
        db: AsyncSession,
        abastecimiento_id: uuid.UUID,
        nuevo_litraje: float,
        nuevo_kilometraje: Optional[int] = None,
        nuevo_conductor: Optional[str] = None
    ) -> Abastecimiento:
        """
        Edita un abastecimiento existente, reajustando el inventario del tanque de combustible.
        """
        # 1. Obtener el abastecimiento
        query_ab = select(Abastecimiento).where(Abastecimiento.id == abastecimiento_id)
        res_ab = await db.execute(query_ab)
        abastecimiento = res_ab.scalar_one_or_none()
        
        if not abastecimiento:
            raise ValueError("Abastecimiento no encontrado")
            
        # 2. Reajustar inventario del tanque
        query_t = select(TanqueCombustible).where(TanqueCombustible.id == abastecimiento.tanque_id)
        res_t = await db.execute(query_t)
        tanque = res_t.scalar_one_or_none()
        
        if not tanque:
            raise ValueError("Tanque asociado no encontrado")
            
        diferencia = nuevo_litraje - abastecimiento.cantidad_abastecida
        
        if diferencia != 0:
            if diferencia > 0 and tanque.cantidad_actual < diferencia:
                raise ValueError(f"Inventario insuficiente en el tanque para realizar este ajuste ({tanque.cantidad_actual:.1f} L disponibles, requiere {diferencia:.1f} L adicionales).")
            tanque.cantidad_actual -= diferencia
            abastecimiento.cantidad_abastecida = nuevo_litraje

        # 3. Editar kilometraje y recalcular distancia si aplica
        if nuevo_kilometraje is not None and nuevo_kilometraje != abastecimiento.kilometraje_actual:
            abastecimiento.kilometraje_actual = nuevo_kilometraje
            # Si el kilometraje cambió, recalculamos la distancia del tramo actual
            abastecimiento.distancia_recorrida = nuevo_kilometraje - abastecimiento.kilometraje_anterior
            
            # Recalcular rendimiento del tramo si es válido
            query_prev = select(Abastecimiento).where(
                Abastecimiento.vehiculo_id == abastecimiento.vehiculo_id,
                Abastecimiento.fecha < abastecimiento.fecha
            ).order_by(Abastecimiento.fecha.desc()).limit(1)
            res_prev = await db.execute(query_prev)
            abastecimiento_prev = res_prev.scalar_one_or_none()
            if abastecimiento_prev and abastecimiento_prev.cantidad_abastecida > 0 and abastecimiento.distancia_recorrida > 0:
                abastecimiento.rendimiento_tramo = abastecimiento.distancia_recorrida / abastecimiento_prev.cantidad_abastecida
            
            # Si es el abastecimiento más reciente del vehículo, actualizamos su último odómetro
            query_v = select(Vehiculo).where(Vehiculo.id == abastecimiento.vehiculo_id)
            res_v = await db.execute(query_v)
            vehiculo = res_v.scalar_one_or_none()
            if vehiculo:
                # Comprobar si no hay abastecimientos posteriores
                query_post = select(func.count(Abastecimiento.id)).where(
                    Abastecimiento.vehiculo_id == vehiculo.id,
                    Abastecimiento.fecha > abastecimiento.fecha
                )
                res_post = await db.execute(query_post)
                cuenta_post = res_post.scalar() or 0
                if cuenta_post == 0:
                    vehiculo.ultimo_kilometraje = nuevo_kilometraje
                    
        # 4. Editar conductor
        if nuevo_conductor is not None:
            abastecimiento.conductor = nuevo_conductor.strip().upper()
            
        await db.flush()
        return abastecimiento

    async def purgar_fotos_antiguas(self, db: AsyncSession, dias_retencion: int = 7) -> int:
        """
        Purga la evidencia fotográfica en Base64 de los abastecimientos con antigüedad mayor a 'dias_retencion'.
        Mantiene todos los datos de auditoría e historial intactos (litros, odómetro, fecha, conductor).
        """
        limite_fecha = datetime.now(ZoneInfo("America/Caracas")) - timedelta(days=dias_retencion)
        
        query = select(Abastecimiento).where(
            Abastecimiento.fecha < limite_fecha,
            ((Abastecimiento.foto_maquina_url != "") | (Abastecimiento.foto_kilometraje_url != ""))
        )
        res = await db.execute(query)
        registros = res.scalars().all()
        
        conteo = 0
        for ab in registros:
            ab.foto_maquina_url = ""
            ab.foto_kilometraje_url = ""
            conteo += 1
            
        await db.flush()
        return conteo

abastecimiento_service = AbastecimientoService()
