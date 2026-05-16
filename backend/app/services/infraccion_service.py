from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.infraccion import Infraccion
from app.models.enums import InfraccionEstado
from app.schemas.infraccion import InfraccionCrear, InfraccionResolver
from app.core.notify_manager import manager as notify_manager

class InfraccionService:
    """
    🧠 Lógica de Negocio (SOP) para la Gestión de Infracciones.
    Notifica en tiempo real a los actores pertinentes.
    """
    
    async def registrar(self, db: AsyncSession, datos: InfraccionCrear, reportado_por_id: UUID) -> Infraccion:
        """
        Crea una nueva infracción y dispara notificación WebSocket.
        """
        nueva_infraccion = Infraccion(
            vehiculo_id = datos.vehiculo_id,
            usuario_id = datos.usuario_id,
            reportado_por = reportado_por_id,
            tipo = datos.tipo,
            gravedad = datos.gravedad,
            descripcion = datos.descripcion,
            foto_url = datos.foto_url,
            fotos_evidencia = datos.fotos_evidencia or [],
            bloquea_salida = datos.bloquea_salida,
            bloquea_acceso_futuro = datos.bloquea_acceso_futuro,
            zona_id = datos.zona_id,
            puesto_id = datos.puesto_id,
            entidad_id = datos.entidad_id,
            latitud_infraccion = datos.latitud_infraccion,
            longitud_infraccion = datos.longitud_infraccion,
            notas_internas = datos.notas_internas,
            estado = InfraccionEstado.activa
        )
        
        db.add(nueva_infraccion)
        await db.commit()
        await db.refresh(nueva_infraccion)
        
        # 🔔 Broadcast en tiempo real via WebSocket
        # Notificar a ALCABALA y COMANDANTE
        mensaje_notificacion = {
            "evento": "INFRACCION_REGISTRADA",
            "datos": {
                "id": str(nueva_infraccion.id),
                "tipo": str(nueva_infraccion.tipo.value),
                "gravedad": str(nueva_infraccion.gravedad.value) if hasattr(nueva_infraccion, "gravedad") else "leve",
                "descripcion": nueva_infraccion.descripcion,
                "bloquea_salida": nueva_infraccion.bloquea_salida,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        await notify_manager.broadcast(mensaje_notificacion, roles=["ALCABALA", "COMANDANTE", "ADMIN_BASE", "SUPERVISOR"])
        
        return nueva_infraccion

    async def resolver(self, db: AsyncSession, infraccion_id: UUID, datos: InfraccionResolver, resuelta_por_usuario) -> Infraccion:
        """
        Marca una infracción como resuelta o perdonada.
        """
        query = select(Infraccion).where(Infraccion.id == infraccion_id)
        result = await db.execute(query)
        infraccion = result.scalar_one_or_none()
        
        if not infraccion:
            raise ValueError("Infracción no encontrada")
            
        # Verificación de permisos según la gravedad de la infracción
        from app.models.enums import GravedadInfraccion, RolTipo
        if infraccion.gravedad in [GravedadInfraccion.moderada, GravedadInfraccion.grave]:
            if resuelta_por_usuario.rol not in [RolTipo.ADMIN_BASE, RolTipo.COMANDANTE]:
                raise ValueError("Permisos insuficientes: Las infracciones moderadas o graves solo pueden ser resueltas por el Comando de Base.")

        infraccion.estado = datos.estado
        infraccion.observaciones_resolucion = datos.observaciones_resolucion
        infraccion.resuelta_por = resuelta_por_usuario.id
        infraccion.resuelta_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(infraccion)
        
        # 🔔 Notificar resolución (para limpiar alertas en UI)
        await notify_manager.broadcast({
            "evento": "INFRACCION_RESUELTA",
            "datos": {"id": str(infraccion.id), "estado": str(infraccion.estado.value)}
        })
        
        return infraccion

    async def obtener_activas(self, db: AsyncSession):
        """Lista todas las infracciones que siguen activas."""
        from sqlalchemy.orm import selectinload
        query = select(Infraccion).options(selectinload(Infraccion.vehiculo), selectinload(Infraccion.infractor)).where(Infraccion.estado == InfraccionEstado.activa).order_by(Infraccion.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

infraccion_service = InfraccionService()
