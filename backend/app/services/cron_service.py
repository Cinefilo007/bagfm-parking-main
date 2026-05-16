from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, or_
from typing import List

from app.models.codigo_qr import CodigoQR
from app.models.infraccion import Infraccion
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from app.models.enums import InfraccionTipo, InfraccionEstado, GravedadInfraccion, EstadoPuesto
from app.core.notify_manager import manager as notify_manager

class CronService:
    """
    Servicio Centralizado de Tareas de Fondo (Cronjobs).
    Encargado de la vigilancia automática de la base y seguridad.
    """

    async def ejecutar_ciclo_seguridad(self, db: AsyncSession):
        """Ejecuta todas las tareas de vigilancia."""
        ghosts = await self.procesar_vehiculos_fantasma(db)
        timeouts = await self.procesar_excesos_permanencia(db)
        mass_exits = await self.procesar_salidas_masivas(db)
        saturacion = await self.monitorear_saturacion_estacionamientos(db)
        return {
            "vehiculos_fantasma_detectados": ghosts,
            "excesos_tiempo_detectados": timeouts,
            "salidas_masivas_procesadas": mass_exits,
            "saturaciones_detectadas": saturacion,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def procesar_vehiculos_fantasma(self, db: AsyncSession) -> int:
        """
        Detecta vehículos que entraron a la base pero no llegaron a su zona asignada.
        Usa las columnas v2.0: hora_entrada_base y hora_llegada_zona.
        """
        ahora = datetime.now(timezone.utc)
        contador = 0

        # Buscamos accesos de entrada recientes (últimas 12h) con destino a zonas
        hace_12h = ahora - timedelta(hours=12)
        from app.models.acceso import Acceso, AccesoTipo
        from app.models.vehiculo_pase import VehiculoPase
        from app.services.notificacion_service import notificacion_service

        stmt = (
            select(Acceso, CodigoQR)
            .join(CodigoQR, Acceso.qr_id == CodigoQR.id)
            .where(
                Acceso.tipo == AccesoTipo.entrada,
                Acceso.timestamp >= hace_12h,
                CodigoQR.zona_asignada_id != None
            )
        )
        result = await db.execute(stmt)
        accesos_pendientes = result.all()

        for acceso, qr in accesos_pendientes:
            # 1. Verificar si ya llegó a la zona asignada después del acceso
            stmt_vp = select(VehiculoPase).where(
                VehiculoPase.qr_id == qr.id,
                VehiculoPase.zona_asignada_id == qr.zona_asignada_id,
                VehiculoPase.hora_ingreso >= acceso.timestamp
            )
            res_vp = await db.execute(stmt_vp)
            if res_vp.scalars().first():
                continue # Ya llegó, ignorar

            # 1.b Verificar si ya salió por alcabala (Aegis v2.4 Fix)
            stmt_salida = select(Acceso).where(
                Acceso.qr_id == qr.id,
                Acceso.tipo == AccesoTipo.salida,
                Acceso.timestamp >= acceso.timestamp
            )
            res_salida = await db.execute(stmt_salida)
            if res_salida.scalars().first():
                continue # Ya salió, no está perdido

            # 2. Validar tiempo transcurrido
            delta = (ahora - acceso.timestamp.replace(tzinfo=timezone.utc) if acceso.timestamp.tzinfo is None else acceso.timestamp).total_seconds() / 60
            
            tiempo_limite = 15
            res_zona = await db.get(ZonaEstacionamiento, qr.zona_asignada_id)
            if res_zona:
                tiempo_limite = res_zona.tiempo_limite_llegada_min or 15

            if delta > tiempo_limite:
                # 3. Verificar si ya tiene una infracción abierta
                stmt_inf = select(Infraccion).where(
                    and_(
                        Infraccion.vehiculo_id == qr.vehiculo_id,
                        Infraccion.tipo == InfraccionTipo.vehiculo_fantasma,
                        Infraccion.estado == InfraccionEstado.activa
                    )
                )
                res_inf = await db.execute(stmt_inf)
                if not res_inf.scalars().first():
                    # Crear Infracción Automática
                    nueva_inf = Infraccion(
                        vehiculo_id=qr.vehiculo_id,
                        usuario_id=qr.usuario_id or qr.created_by,
                        reportado_por=qr.created_by,
                        tipo=InfraccionTipo.vehiculo_fantasma,
                        gravedad=GravedadInfraccion.moderada,
                        descripcion=f"ALERTA FANTASMA: Retraso de {int(delta)} min desde ingreso en {acceso.punto_acceso}.",
                        bloquea_salida=True,
                        estado=InfraccionEstado.activa,
                        zona_id=qr.zona_asignada_id
                    )
                    db.add(nueva_inf)
                    contador += 1
                    
                    # 4. Notificar vía WebSocket (Comandancia)
                    await notify_manager.broadcast({
                        "evento": "ALERTA_SEGURIDAD",
                        "tipo": "VEHICULO_FANTASMA",
                        "mensaje": f"Vehículo placa {qr.vehiculo_placa} excedió tiempo de ruta.",
                        "gravedad": "ALTA"
                    }, roles=["COMANDANTE", "ADMIN_BASE", "SUPERVISOR"])

                    # 5. Notificar vía PUSH (Parquero de la zona)
                    try:
                        await notificacion_service.notificar_vehiculo_perdido(
                            db,
                            zona_id=qr.zona_asignada_id,
                            placa=qr.vehiculo_placa or "SIN PLACA",
                            minutos=int(delta)
                        )
                    except Exception as e_push:
                        print(f"[CRON] Error push perdido: {e_push}")

        if contador > 0:
            await db.commit()
        return contador

    async def procesar_excesos_permanencia(self, db: AsyncSession) -> int:
        """
        Detecta vehículos que han superado el tiempo razonable de permanencia 
        (ej. pases temporales vencidos o estadía excesiva en zona).
        """
        ahora = datetime.now(timezone.utc)
        contador = 0
        
        # Ejemplo: Puestos ocupados por más de 12 horas (umbral táctico para pases simples)
        umbral_alerta = ahora - timedelta(hours=12)
        
        stmt = select(PuestoEstacionamiento).where(
            and_(
                PuestoEstacionamiento.estado == EstadoPuesto.ocupado,
                PuestoEstacionamiento.ocupado_at < umbral_alerta
            )
        )
        result = await db.execute(stmt)
        puestos_viejos = result.scalars().all()
        
        for puesto in puestos_viejos:
            # Crear infracción de abandono si el tiempo es excesivo
            stmt_inf = select(Infraccion).where(
                and_(
                    Infraccion.puesto_id == puesto.id,
                    Infraccion.tipo == InfraccionTipo.abandono_vehiculo,
                    Infraccion.estado == InfraccionEstado.activa
                )
            )
            res_inf = await db.execute(stmt_inf)
            if not res_inf.scalars().first():
                nueva_inf = Infraccion(
                    vehiculo_id=puesto.vehiculo_actual_id,
                    usuario_id=puesto.usuario_actual_id,
                    reportado_por=puesto.registrado_por,
                    tipo=InfraccionTipo.abandono_vehiculo,
                    gravedad=GravedadInfraccion.leve,
                    descripcion=f"Ocupación prolongada del puesto {puesto.codigo}. Tiempo excedido.",
                    zona_id=puesto.zona_id,
                    puesto_id=puesto.id,
                    estado=InfraccionEstado.activa
                )
                db.add(nueva_inf)
                contador += 1
        
        if contador > 0:
            await db.commit()
        return contador

    async def obtener_historial_fantasmas(self, db: AsyncSession, skip: int = 0, limit: int = 100):
        """Retorna el historial de infracciones tipo fantasma."""
        stmt = select(Infraccion).where(
            Infraccion.tipo == InfraccionTipo.vehiculo_fantasma
        ).order_by(Infraccion.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def procesar_salidas_masivas(self, db: AsyncSession) -> int:
        """
        SOP: Expulsión Masiva Programada (Aegis v2.3/v2.4).
        Cierra todos los ciclos de acceso abiertos a la hora configurada.
        También resetea la ocupación de parqueros y libera puestos físicos asignados.
        """
        from app.services.configuracion_service import configuracion_service
        from app.models.acceso import Acceso
        from app.models.vehiculo_pase import VehiculoPase
        from app.models.enums import AccesoTipo
        
        config = await configuracion_service.get_config_salidas(db)
        mass_time = config.get("mass_time")
        
        if not mass_time:
            return 0
            
        ahora = datetime.now(timezone.utc)
        
        # Validación de rango de tiempo para evitar problemas de desfase de segundos/minutos.
        # mass_time está en HH:MM (Local, pero típicamente manejado aquí de forma simple, 
        # asumimos que la configuración es contra la hora local manejada por el server)
        # Es mejor usar timedelta para dar una ventana de 5 a 10 mins.
        try:
            mass_h, mass_m = map(int, mass_time.split(':'))
            # Extraer hora de ahora (basado en UTC - 4 horas como suele ser en Venezuela, pero
            # por seguridad asumimos que "ahora" aquí coincide en zona horaria con quien configuró el HH:MM)
            # Para ser sólidos, asumiendo que el cron ejecuta en un timezone local, pero "ahora" usa utc:
            # Dado que el servidor podría no compartir el TZ, la forma más robusta es revisar la ventana.
            # Alternativa: el frontend lo envia como UTC o Local? Vamos a seguir la lógica anterior
            # pero expandiendo la ventana (5 minutos).
            import pytz
            caracas_tz = pytz.timezone('America/Caracas')
            ahora_local = ahora.astimezone(caracas_tz)
            
            # Formatear el header time para el timestamp actual
            header_time = ahora_local.strftime("%H:%M")
            
            # Vamos a calcular los minutos del día para ambas variables y ver el delta.
            minutos_actuales = ahora_local.hour * 60 + ahora_local.minute
            minutos_configurados = mass_h * 60 + mass_m
            
            # Ventana de 10 minutos
            if not (-1 <= (minutos_actuales - minutos_configurados) <= 10):
                return 0

        except Exception as e:
            # Fallback a match exacto en la misma hora (lógica antigua revisada)
            header_time = ahora_local.strftime("%H:%M")
            if header_time != mass_time:
                return 0

        # Para no ejectuarlo multiples veces, guardaremos la última vez que corrió exitosamente
        # o confiaremos en que el scheduler correrá solo 1 o 2 veces dentro de esta ventana y encontrará 0 para operar.

        contador_expulsiones = 0

        # ----- FASE 1: Limpiar los Parqueros (VehiculoPase activos) -----
        stmt_vp = select(VehiculoPase).where(VehiculoPase.ingresado == True)
        res_vp = await db.execute(stmt_vp)
        vehiculos_activos = res_vp.scalars().all()
        
        # Procesar salidas de zonas del parquero
        for vp in vehiculos_activos:
            vp.ingresado = False
            vp.hora_salida = ahora
            
            # Restar ocupación de la ZonaEstacionamiento responsable
            if vp.zona_asignada_id:
                res_zona = await db.get(ZonaEstacionamiento, vp.zona_asignada_id)
                if res_zona:
                    res_zona.ocupacion_actual = max(0, (res_zona.ocupacion_actual or 0) - 1)
            
            # Liberar el puesto físico si estaba asignado
            if vp.puesto_asignado_id:
                res_p = await db.get(PuestoEstacionamiento, vp.puesto_asignado_id)
                if res_p:
                    res_p.estado = EstadoPuesto.libre
                    res_p.qr_actual_id = None
                    res_p.vehiculo_actual_id = None
                    res_p.ocupado_desde = None

            # Si el Vehículo ingresó pero nunca reportó entrada general por Alcabala,
            # podríamos generar una 'SALIDA (MASIVA)' genérica, pero mantendremos
            # la Fase 2 para las Alcabalas.

        # ----- FASE 2: Cerrar Entradas Biométricas Activas (Acceso) -----
        # Subquery para obtener el último acceso de cada vehículo (por placa o por ID de Pase/QR)
        from sqlalchemy import func
        subq = select(
            Acceso.vehiculo_placa,
            func.max(Acceso.timestamp).label("max_ts")
        ).group_by(Acceso.vehiculo_placa).subquery()
        
        stmt_ac = select(Acceso).join(
            subq,
            and_(
                Acceso.vehiculo_placa == subq.c.vehiculo_placa,
                Acceso.timestamp == subq.c.max_ts
            )
        ).where(
            and_(
                Acceso.tipo == AccesoTipo.entrada,
                Acceso.vehiculo_placa != None,
                Acceso.vehiculo_placa != ""
            )
        )
        
        res_ac = await db.execute(stmt_ac)
        accesos_abiertos = res_ac.scalars().all()
        
        for acc in accesos_abiertos:
            nueva_salida = Acceso(
                qr_id = acc.qr_id,
                usuario_id = acc.usuario_id,
                vehiculo_id = acc.vehiculo_id,
                vehiculo_pase_id = acc.vehiculo_pase_id,
                tipo = AccesoTipo.salida,
                punto_acceso = "SISTEMA (MASIVA)",
                registrado_por = acc.registrado_por, 
                es_manual = True,
                vehiculo_placa = acc.vehiculo_placa,
                observaciones = f"Expulsión automática base limpia ({mass_time})"
            )
            db.add(nueva_salida)
            contador_expulsiones += 1
            
        if len(vehiculos_activos) > 0 or contador_expulsiones > 0:
            total_expulsados = max(len(vehiculos_activos), contador_expulsiones)
            await db.commit()
            await notify_manager.broadcast({
                "evento": "SISTEMA_SALIDA_MASIVA",
                "mensaje": f"Se procesaron {total_expulsados} desalojos automáticos (Base limpia: {mass_time}).",
                "cantidad": total_expulsados,
                "gravedad": "MODERADA"
            }, roles=["COMANDANTE", "ADMIN_BASE"])
            
        return max(len(vehiculos_activos), contador_expulsiones)

    async def monitorear_saturacion_estacionamientos(self, db: AsyncSession) -> int:
        """
        Monitorea la ocupación de todas las entidades y envía notificaciones
        cuando se alcanza el 90% o 100% de la capacidad.
        """
        from app.models.asignacion_zona import AsignacionZona
        from app.services.zona_service import zona_service
        from app.services.notificacion_service import notificacion_service
        
        # 1. Obtener todas las asignaciones activas
        stmt = select(AsignacionZona).where(AsignacionZona.activa == True)
        res = await db.execute(stmt)
        asignaciones = res.scalars().all()
        
        alertas_enviadas = 0
        for asig in asignaciones:
            # 2. Calcular ocupación real
            info = await zona_service.obtener_ocupacion_real_entidad(db, asig.entidad_id, asig.zona_id)
            porcentaje = info["porcentaje"]
            
            if porcentaje >= 90:
                # 3. Notificar saturación
                # Buscamos nombre de la entidad (asumiendo que está disponible vía relación o cargándolo)
                from app.models.entidad_civil import EntidadCivil
                entidad = await db.get(EntidadCivil, asig.entidad_id)
                entidad_nombre = entidad.nombre if entidad else "Entidad"
                
                # Definir nivel de alerta
                tipo = "CRÍTICO" if porcentaje >= 100 else "ADVERTENCIA"
                mensaje = f"ZONA {asig.zona_nombre} AL {porcentaje}% ({info['ocupacion_actual']}/{info['cupo_total']}) para {entidad_nombre}."
                
                # Notificar a Admin Entidad y Parqueros de la zona
                await notificacion_service.notificar_saturacion_zona(
                    db,
                    zona_id=asig.zona_id,
                    entidad_id=asig.entidad_id,
                    entidad_nombre=entidad_nombre,
                    porcentaje=porcentaje,
                    info_ocupacion=info
                )
                
                # Notificar a Comandancia vía WebSocket
                await notify_manager.broadcast({
                    "evento": "ALERTA_CAPACIDAD",
                    "tipo": tipo,
                    "mensaje": mensaje,
                    "entidad": entidad_nombre,
                    "porcentaje": porcentaje
                }, roles=["COMANDANTE", "ADMIN_BASE", "SUPERVISOR"])
                
                alertas_enviadas += 1
                
        return alertas_enviadas

cron_service = CronService()
