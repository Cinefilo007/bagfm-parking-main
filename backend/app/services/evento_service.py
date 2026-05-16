"""
Servicio de Gestión de Eventos y Pases Masivos (Asíncrono).
Implementa la directiva FL-08: Solicitud, Aprobación Parcial y Generación Masiva.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.alcabala_evento import SolicitudEvento
from app.models.codigo_qr import CodigoQR
from app.models.enums import SolicitudEstado, QRTipo, PasseTipo
from app.schemas.alcabala_evento import SolicitudEventoCrear, SolicitudEventoProcesar
from app.core.security import crear_token_evento
from app.core.config import obtener_config
from app.services.pase_service import pase_service

config = obtener_config()

class EventoService:
    async def crear_solicitud(self, db: AsyncSession, datos: SolicitudEventoCrear, usuario_id: UUID) -> SolicitudEvento:
        """Crea una nueva solicitud de pases masivos para un evento."""
        nueva_solicitud = SolicitudEvento(
            entidad_id=datos.entidad_id,
            solicitado_por=usuario_id,
            nombre_evento=datos.nombre_evento,
            fecha_evento=datos.fecha_evento,
            cantidad_solicitada=datos.cantidad_solicitada,
            motivo=datos.motivo,
            tipo_pase=datos.tipo_pase,
            estado=SolicitudEstado.pendiente
        )
        db.add(nueva_solicitud)
        await db.commit()
        await db.refresh(nueva_solicitud)
        return nueva_solicitud

    async def listar_solicitudes(self, db: AsyncSession, entidad_id: UUID = None):
        """Lista solicitudes, opcionalmente filtradas por entidad."""
        query = select(SolicitudEvento)
        if entidad_id:
            query = query.where(SolicitudEvento.entidad_id == entidad_id)
        
        query = query.order_by(SolicitudEvento.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    async def obtener_solicitud(self, db: AsyncSession, solicitud_id: UUID) -> SolicitudEvento:
        query = select(SolicitudEvento).where(SolicitudEvento.id == solicitud_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def procesar_solicitud(
        self, 
        db: AsyncSession, 
        solicitud_id: UUID, 
        datos: SolicitudEventoProcesar, 
        revisado_por_id: UUID
    ) -> SolicitudEvento:
        """
        El Comandante aprueba (total/parcial) o deniega la solicitud.
        Si es aprobada, genera automáticamente el Lote de Pases Masivos.
        """
        solicitud = await self.obtener_solicitud(db, solicitud_id)
        if not solicitud:
            return None
            
        solicitud.estado = datos.estado
        solicitud.cantidad_aprobada = datos.cantidad_aprobada if datos.estado != SolicitudEstado.denegada else 0
        solicitud.motivo_rechazo = datos.motivo_rechazo
        solicitud.revisado_por = revisado_por_id
        solicitud.revisado_at = datetime.now(timezone.utc)
        
        # Si fue aprobada (total o parcial), crear Lote en PaseService (v2)
        if datos.estado in [SolicitudEstado.aprobada, SolicitudEstado.aprobada_parcial]:
            datos_lote = {
                "nombre_evento": solicitud.nombre_evento,
                "tipo_pase": solicitud.tipo_pase,
                "fecha_inicio": solicitud.fecha_evento,
                "fecha_fin": solicitud.fecha_evento + timedelta(days=1), # El evento dura 1 día por defecto
                "cantidad_pases": solicitud.cantidad_aprobada,
                "max_accesos_por_pase": 1 # Por defecto
            }
            # pase_service.crear_lote hará el commit
            await pase_service.crear_lote(db, datos_lote, revisado_por_id, solicitud_id=solicitud.id)
            
        await db.commit()
        await db.refresh(solicitud)
        return solicitud

    async def obtener_qrs_solicitud(self, db: AsyncSession, solicitud_id: UUID):
        """Retorna QRs asociados al lote vinculado a la solicitud."""
        solicitud = await self.obtener_solicitud(db, solicitud_id)
        if not solicitud or not solicitud.lote_id:
            return []
        
        query = select(CodigoQR).where(CodigoQR.lote_id == solicitud.lote_id, CodigoQR.activo == True)
        result = await db.execute(query)
        return result.scalars().all()

    async def get_stats(self, db: AsyncSession, entidad_id: UUID = None):
        """Calcula estadísticas generales de solicitudes de eventos (Analítica Táctica)."""
        filtros = []
        if entidad_id:
            filtros.append(SolicitudEvento.entidad_id == entidad_id)
            
        async def _count(status_list: list = None):
            query = select(func.count(SolicitudEvento.id))
            if filtros:
                query = query.where(*filtros)
            if status_list:
                query = query.where(SolicitudEvento.estado.in_(status_list))
            result = await db.execute(query)
            return result.scalar() or 0

        total = await _count()
        pendientes = await _count([SolicitudEstado.pendiente])
        aprobadas = await _count([SolicitudEstado.aprobada, SolicitudEstado.aprobada_parcial])
        denegadas = await _count([SolicitudEstado.denegada])

        query_pases = select(func.sum(SolicitudEvento.cantidad_aprobada))
        if filtros:
            query_pases = query_pases.where(*filtros)
        
        result_pases = await db.execute(query_pases)
        pases_otorgados = result_pases.scalar() or 0

        return {
            "total": total,
            "pendientes": pendientes,
            "aprobadas": aprobadas,
            "denegadas": denegadas,
            "pases_otorgados": int(pases_otorgados)
        }

evento_service = EventoService()
