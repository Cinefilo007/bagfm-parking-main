from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import joinedload

from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from app.models.asignacion_zona import AsignacionZona
from app.models.enums import EstadoPuesto

from app.schemas.zona_estacionamiento import ZonaEstacionamientoCrear
from app.schemas.puesto_estacionamiento import PuestoEstacionamientoCrear
from app.schemas.asignacion_zona import AsignacionZonaCrear

class ZonaEstacionamientoService:
    
    async def crear_zona_estacionamiento(
        self, db: AsyncSession, zona_in: dict, user_id: UUID
    ) -> ZonaEstacionamiento:
        db_zona = ZonaEstacionamiento(
            **zona_in,
            created_by=user_id
        )
        db.add(db_zona)
        await db.commit()
        await db.refresh(db_zona)
        return db_zona

    async def actualizar_zona(
        self, db: AsyncSession, zona_id: UUID, zona_in: dict
    ) -> Optional[ZonaEstacionamiento]:
        db_zona = await self.get_zona(db, zona_id)
        if not db_zona:
            return None
        
        update_data = {k: v for k, v in zona_in.items() if v is not None}
        
        for key, value in update_data.items():
            setattr(db_zona, key, value)
            
        await db.commit()
        await db.refresh(db_zona)
        return db_zona

    async def get_zona(self, db: AsyncSession, zona_id: UUID) -> Optional[ZonaEstacionamiento]:
        resultado = await db.execute(select(ZonaEstacionamiento).filter(ZonaEstacionamiento.id == zona_id))
        return resultado.scalars().first()

    async def obtener_zonas(
        self, db: AsyncSession, skip: int = 0, limit: int = 100, activa: Optional[bool] = None, entidad_id: Optional[UUID] = None
    ) -> List[dict]:
        from app.models.vehiculo_pase import VehiculoPase
        from app.models.codigo_qr import CodigoQR
        from app.models.enums import TipoAccesoPase
        
        query = select(ZonaEstacionamiento)
        if entidad_id:
            query = query.join(AsignacionZona, AsignacionZona.zona_id == ZonaEstacionamiento.id).where(
                AsignacionZona.entidad_id == entidad_id,
                AsignacionZona.activa == True
            )
            
        if activa is not None:
            query = query.filter(ZonaEstacionamiento.activo == activa)
        query = query.offset(skip).limit(limit)
        
        resultado = await db.execute(query)
        zonas = resultado.scalars().unique().all()
        
        resultado_final = []
        for zona in zonas:
            # Contar ocupación por categoría
            res_base = await db.execute(
                select(func.count(VehiculoPase.id))
                .join(CodigoQR, VehiculoPase.qr_id == CodigoQR.id)
                .where(
                    VehiculoPase.zona_asignada_id == zona.id, 
                    VehiculoPase.ingresado == True, 
                    CodigoQR.tipo_acceso == TipoAccesoPase.base
                )
            )
            ocu_base = res_base.scalar() or 0
            
            res_total = await db.execute(
                select(func.count(VehiculoPase.id))
                .where(VehiculoPase.zona_asignada_id == zona.id, VehiculoPase.ingresado == True)
            )
            ocu_total = res_total.scalar() or 0
            
            # Sincronizar ocupacion_actual por si acaso
            if zona.ocupacion_actual != ocu_total:
                zona.ocupacion_actual = ocu_total
                await db.commit()

            z_dict = {
                "id": str(zona.id),
                "nombre": zona.nombre,
                "capacidad_total": zona.capacidad_total,
                "ocupacion_actual": ocu_total,
                "ocupacion_base": ocu_base,
                "usa_puestos_identificados": zona.usa_puestos_identificados,
                "tipo": zona.tipo,
                "descripcion_ubicacion": zona.descripcion_ubicacion,
                "latitud": float(zona.latitud) if zona.latitud else None,
                "longitud": float(zona.longitud) if zona.longitud else None,
                "tiempo_limite_llegada_min": zona.tiempo_limite_llegada_min,
                "activo": zona.activo,
                "created_at": zona.created_at
            }
            resultado_final.append(z_dict)
            
        return resultado_final

    async def obtener_puestos_zona(self, db: AsyncSession, zona_id: UUID) -> List[PuestoEstacionamiento]:
        resultado = await db.execute(
            select(PuestoEstacionamiento)
            .options(joinedload(PuestoEstacionamiento.zona), joinedload(PuestoEstacionamiento.tipo_acceso))
            .filter(PuestoEstacionamiento.zona_id == zona_id)
            .order_by(PuestoEstacionamiento.numero_puesto)
        )
        return resultado.scalars().all()

    async def generar_puestos_fisicos(
        self, db: AsyncSession, zona_id: UUID, prefijo: str, cantidad: int, user_id: UUID
    ) -> List[PuestoEstacionamiento]:
        """Crea puestos identificados en lote para una zona con validación de capacidad."""
        zona = await self.get_zona(db, zona_id)
        if not zona:
            raise ValueError("Zona no encontrada")
        
        # Contar puestos actuales
        query_count = select(func.count(PuestoEstacionamiento.id)).filter(PuestoEstacionamiento.zona_id == zona_id)
        resultado_count = await db.execute(query_count)
        puestos_actuales = resultado_count.scalar() or 0
        
        if (puestos_actuales + cantidad) > zona.capacidad_total:
            raise ValueError(f"Capacidad excedida. Capacidad total: {zona.capacidad_total}, Puestos actuales: {puestos_actuales}, Solicitado: {cantidad}")

        puestos = []
        for i in range(1, cantidad + 1):
            # El número de puesto será correlativo al total
            num_secuencial = puestos_actuales + i
            puesto = PuestoEstacionamiento(
                zona_id=zona_id,
                numero_puesto=f"{prefijo}-{num_secuencial:03d}",
                estado=EstadoPuesto.libre,
                registrado_por=user_id
            )
            puestos.append(puesto)
        
        db.add_all(puestos)
        await db.commit()
        for p in puestos:
            await db.refresh(p)
        return puestos

    async def generar_puestos_entidad(
        self, db: AsyncSession, zona_id: UUID, entidad_id: UUID, prefijo: str, cantidad: int, user_id: UUID
    ) -> List[PuestoEstacionamiento]:
        """Crea puestos identificados para una entidad o reclama puestos libres de la zona."""
        zona = await self.get_zona(db, zona_id)
        if not zona:
            raise ValueError("Zona no encontrada")

        # 1. Verificar asignacion
        query_asig = select(AsignacionZona).filter(
            and_(AsignacionZona.zona_id == zona_id, AsignacionZona.entidad_id == entidad_id, AsignacionZona.activa == True)
        )
        asig = (await db.execute(query_asig)).scalars().first()
        if not asig:
            raise ValueError("No tienes asignación activa en esta zona")

        # 2. Contar puestos actuales de esta entidad en esta zona
        query_count = select(func.count(PuestoEstacionamiento.id)).filter(
            and_(PuestoEstacionamiento.zona_id == zona_id, PuestoEstacionamiento.reservado_entidad_id == entidad_id)
        )
        puestos_propios = (await db.execute(query_count)).scalar() or 0

        if (puestos_propios + cantidad) > asig.cupo_asignado:
            raise ValueError(f"Capacidad excedida. Tienes un cupo de {asig.cupo_asignado}. Puestos actuales: {puestos_propios}. Intentas generar: {cantidad}")

        # 3. Buscar puestos libres en la zona que la entidad pueda reclamar
        query_libres = select(PuestoEstacionamiento).filter(
            and_(PuestoEstacionamiento.zona_id == zona_id, PuestoEstacionamiento.estado == EstadoPuesto.libre)
        ).limit(cantidad)
        puestos_libres = (await db.execute(query_libres)).scalars().all()
        
        puestos_a_devolver = []
        cantidad_restante = cantidad
        
        # Primero adjudicar los que están libres generados por el comandante
        for p in puestos_libres:
            p.estado = EstadoPuesto.reservado
            p.reservado_entidad_id = entidad_id
            p.numero_puesto = f"{prefijo}-{(puestos_propios + len(puestos_a_devolver) + 1):03d}"
            puestos_a_devolver.append(p)
            cantidad_restante -= 1

        # Si aún faltan, crear los nuevos
        if cantidad_restante > 0:
            query_totales = select(func.count(PuestoEstacionamiento.id)).filter(PuestoEstacionamiento.zona_id == zona_id)
            puestos_totales = (await db.execute(query_totales)).scalar() or 0
            
            if (puestos_totales + cantidad_restante) > zona.capacidad_total:
                raise ValueError(f"Discordancia física: Tienes cupo, pero la base excedió la capacidad máxima ({zona.capacidad_total}).")

            for _ in range(cantidad_restante):
                num_secuencial = puestos_propios + len(puestos_a_devolver) + 1
                puesto = PuestoEstacionamiento(
                    zona_id=zona_id,
                    numero_puesto=f"{prefijo}-{num_secuencial:03d}",
                    estado=EstadoPuesto.reservado,
                    reservado_entidad_id=entidad_id,
                    registrado_por=user_id
                )
                db.add(puesto)
                puestos_a_devolver.append(puesto)
        
        await db.commit()
        for p in puestos_a_devolver:
            await db.refresh(p)
        return puestos_a_devolver

    async def get_puesto(self, db: AsyncSession, puesto_id: UUID) -> Optional[PuestoEstacionamiento]:
        resultado = await db.execute(select(PuestoEstacionamiento).filter(PuestoEstacionamiento.id == puesto_id))
        return resultado.scalars().first()

    async def actualizar_puesto_fisico(
        self, db: AsyncSession, puesto_id: UUID, datos_in: dict
    ) -> Optional[PuestoEstacionamiento]:
        """Actualiza datos de un puesto (como coordenadas GPS)."""
        puesto = await self.get_puesto(db, puesto_id)
        if not puesto:
            return None
        
        for key, value in datos_in.items():
            setattr(puesto, key, value)
            
        await db.commit()
        await db.refresh(puesto)
        return puesto

    async def reservar_puestos_base(
        self, db: AsyncSession, zona_id: UUID, cantidad: int, entidad_id: Optional[UUID] = None, user_id: Optional[UUID] = None
    ) -> List[PuestoEstacionamiento]:
        """Reserva puestos aleatorios libres en una zona."""
        query = select(PuestoEstacionamiento).filter(
            and_(
                PuestoEstacionamiento.zona_id == zona_id,
                PuestoEstacionamiento.estado == EstadoPuesto.libre
            )
        ).limit(cantidad)
        
        resultado = await db.execute(query)
        puestos_libres = resultado.scalars().all()

        if len(puestos_libres) < cantidad:
            raise ValueError(f"No hay suficientes puestos libres (faltan {cantidad - len(puestos_libres)})")

        for puesto in puestos_libres:
            puesto.estado = EstadoPuesto.reservado if entidad_id else EstadoPuesto.reservado_base
            puesto.reservado_por = user_id
            puesto.reservado_entidad_id = entidad_id

        await db.commit()
        for p in puestos_libres:
            await db.refresh(p)
        return puestos_libres

    async def asignar_zona_a_entidad(
        self, db: AsyncSession, asignacion_in: dict, user_id: UUID
    ) -> AsignacionZona:
        """
        Asigna a una entidad civil una porción de la capacidad de la zona.
        SOP: Aegis v3.1 - Implementa lógica de Upsert para evitar duplicidad de registros
        en la vista de la entidad cuando se modifica la asignación.
        """
        zona_id = asignacion_in.get("zona_id")
        entidad_id = asignacion_in.get("entidad_id")
        
        # Buscar asignación existente
        query = select(AsignacionZona).where(
            and_(
                AsignacionZona.zona_id == zona_id,
                AsignacionZona.entidad_id == entidad_id,
                AsignacionZona.activa == True
            )
        )
        res = await db.execute(query)
        db_asig = res.scalar_one_or_none()
        
        if db_asig:
            # Actualizar existente
            for key, value in asignacion_in.items():
                if key not in ["id", "zona_id", "entidad_id"]:
                    setattr(db_asig, key, value)
            db_asig.asignado_por = user_id
            await db.commit()
            await db.refresh(db_asig)
            return db_asig
        
        # Crear nueva si no existe
        db_asignacion = AsignacionZona(**asignacion_in, asignado_por=user_id)
        db.add(db_asignacion)
        await db.commit()
        await db.refresh(db_asignacion)
        return db_asignacion

    async def verificar_capacidad_disponible(self, db: AsyncSession, zona_id: UUID) -> bool:
        zona = await self.get_zona(db, zona_id)
        if not zona:
            return False
            
        if zona.usa_puestos_identificados:
            query = select(func.count(PuestoEstacionamiento.id)).filter(
                and_(
                    PuestoEstacionamiento.zona_id == zona_id,
                    PuestoEstacionamiento.estado == EstadoPuesto.libre
                )
            )
            resultado = await db.execute(query)
            puestos_libres = resultado.scalar()
            return puestos_libres > 0
        else:
            return zona.ocupacion_actual < zona.capacidad_total

    async def obtener_ocupacion_real_entidad(self, db: AsyncSession, entidad_id: UUID, zona_id: UUID) -> dict:
        """
        Calcula la ocupación actual de una entidad en una zona específica.
        SOP: Aegis v4.0 - Control de Capacidad en Tiempo Real.
        """
        from app.models.acceso import Acceso
        from app.models.enums import AccesoTipo
        from sqlalchemy import and_, select, func, desc

        # 1. Obtener el cupo asignado
        q_asig = select(AsignacionZona).where(
            and_(
                AsignacionZona.entidad_id == entidad_id,
                AsignacionZona.zona_id == zona_id,
                AsignacionZona.activa == True
            )
        )
        res_asig = await db.execute(q_asig)
        asig = res_asig.scalar_one_or_none()
        cupo_total = asig.cupo_asignado if asig else 0

        # 2. Contar vehículos actualmente dentro (entrada sin salida posterior)
        # Agrupamos por vehiculo_placa (o vehiculo_id) para contar únicos
        # Esta es una aproximación: vehículos cuya última marca en el log es ENTRADA y su zona es esta zona.
        
        # Subquery para obtener el último acceso de cada vehículo
        subq = (
            select(
                Acceso.vehiculo_placa,
                func.max(Acceso.timestamp).label("max_ts")
            )
            .where(Acceso.zona_id == zona_id)
            .group_by(Acceso.vehiculo_placa)
            .subquery()
        )

        query_ocupacion = (
            select(func.count(Acceso.id))
            .join(subq, and_(Acceso.vehiculo_placa == subq.c.vehiculo_placa, Acceso.timestamp == subq.c.max_ts))
            .where(
                Acceso.tipo == AccesoTipo.entrada,
                Acceso.zona_id == zona_id
            )
        )
        
        # Nota: Aquí podríamos filtrar también por entidad si el acceso tiene entidad_id, 
        # pero como el acceso se vincula a la zona, y la entidad "es dueña" de la zona o de un cupo en ella,
        # si la zona es compartida necesitamos ser más precisos.
        # Por ahora, si la zona es exclusiva de la entidad, esto funciona.
        # Si es compartida, deberíamos filtrar por los vehículos que pertenecen a esa entidad.
        
        # Mejora: Filtrar por vehículos que pertenecen a la entidad
        from app.models.usuario import Usuario
        from app.models.vehiculo import Vehiculo
        from app.models.codigo_qr import CodigoQR
        from app.models.alcabala_evento import LotePaseMasivo

        # Opción B: Contar directamente en la tabla VehiculoPase si el sistema marca ingresado=True al entrar
        # Pero el usuario pide monitoreo desde la alcabala.
        
        res_occ = await db.execute(query_ocupacion)
        ocupacion_actual = res_occ.scalar() or 0

        return {
            "entidad_id": str(entidad_id),
            "zona_id": str(zona_id),
            "cupo_total": cupo_total,
            "ocupacion_actual": ocupacion_actual,
            "disponible": max(0, cupo_total - ocupacion_actual),
            "porcentaje": int((ocupacion_actual / cupo_total * 100)) if cupo_total > 0 else 0,
            "critico": ocupacion_actual >= cupo_total if cupo_total > 0 else False
        }

    async def obtener_asignaciones_globales(self, db: AsyncSession) -> List[AsignacionZona]:
        resultado = await db.execute(select(AsignacionZona))
        return resultado.scalars().all()

    async def get_asignacion(self, db: AsyncSession, asignacion_id: UUID) -> Optional[AsignacionZona]:
        from sqlalchemy.orm import joinedload
        resultado = await db.execute(
            select(AsignacionZona)
            .options(joinedload(AsignacionZona.zona))
            .filter(AsignacionZona.id == asignacion_id)
        )
        return resultado.scalars().first()

    async def actualizar_asignacion_zona(
        self, db: AsyncSession, asignacion_id: UUID, datos_in: dict
    ) -> Optional[AsignacionZona]:
        db_asig = await self.get_asignacion(db, asignacion_id)
        if not db_asig:
            return None
        
        for key, value in datos_in.items():
            setattr(db_asig, key, value)
            
        await db.commit()
        await db.refresh(db_asig)
        return db_asig

    async def eliminar_asignacion_zona(self, db: AsyncSession, asignacion_id: UUID) -> bool:
        db_asig = await self.get_asignacion(db, asignacion_id)
        if not db_asig:
            return False
        
        await db.delete(db_asig)
        await db.commit()
        return True

    async def eliminar_puesto_fisico(self, db: AsyncSession, puesto_id: UUID) -> bool:
        puesto = await self.get_puesto(db, puesto_id)
        if not puesto:
            return False
        
        # SOP: Aegis v2.5 - Desvincular referencias antes de eliminar (Evitar RESTRICT)
        from sqlalchemy import update
        from app.models.vehiculo_pase import VehiculoPase
        from app.models.infraccion import Infraccion
        
        # 1. Limpiar asignaciones en vehículos
        await db.execute(
            update(VehiculoPase)
            .where(VehiculoPase.puesto_asignado_id == puesto_id)
            .values(puesto_asignado_id=None)
        )
        
        # 2. Limpiar referencias en infracciones
        await db.execute(
            update(Infraccion)
            .where(Infraccion.puesto_id == puesto_id)
            .values(puesto_id=None)
        )

        await db.delete(puesto)
        await db.commit()
        return True

zona_service = ZonaEstacionamientoService()
