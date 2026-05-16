import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from app.models.usuario import Usuario
from app.models.push_subscription import PushSubscription
from app.models.enums import RolTipo
from app.services.webpush_service import webpush_service

class NotificacionService:
    async def notificar_entrada_vehiculo(
        self, 
        db: AsyncSession, 
        zona_id: UUID, 
        placa: str, 
        detalles_vehiculo: str,
        nombre_socio: str
    ):
        """
        Notifica al Supervisor de Parqueros y a los Parqueros asignados a la zona.
        """
        # 1. Buscar a los destinatarios
        # Parqueros de la zona + Supervisores de Parqueros de la misma entidad
        
        # Primero obtenemos la zona para saber de qué entidad es (asumiendo que los parqueros están filtrados por entidad)
        # En este sistema, los parqueros tienen entidad_id y zona_asignada_id.
        
        query_destinatarios = select(Usuario).where(
            Usuario.activo == True,
            (
                # Parqueros asignados a la zona
                (Usuario.rol == RolTipo.PARQUERO) & (Usuario.zona_asignada_id == zona_id)
            ) | (
                # Supervisores de Parqueros (ellos ven global, pero aquí filtramos por los de la entidad si aplica)
                # NOTA: Si el supervisor es global de la entidad, debería recibirlo.
                (Usuario.rol == RolTipo.SUPERVISOR_PARQUEROS)
            )
        )
        
        result = await db.execute(query_destinatarios)
        usuarios = result.scalars().all()
        ids_usuarios = [u.id for u in usuarios]
        
        if not ids_usuarios:
            logging.info(f"No hay parqueros o supervisores activos para notificar en zona {zona_id}")
            return

        # 2. Buscar sus suscripciones push
        query_subs = select(PushSubscription).where(
            PushSubscription.usuario_id.in_(ids_usuarios),
            PushSubscription.activo == True
        )
        result_subs = await db.execute(query_subs)
        suscripciones = result_subs.scalars().all()

        # 3. Enviar notificaciones
        payload = {
            "title": "🚗 Vehículo en camino",
            "body": f"{placa} ({detalles_vehiculo}) - Socio: {nombre_socio}",
            "data": {
                "url": "/parquero/dashboard",
                "zona_id": str(zona_id),
                "tipo": "entrada_vehiculo"
            },
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/badge-96x96.png"
        }

        for sub in suscripciones:
            sub_info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth
                }
            }
            try:
                webpush_service.send_notification(sub_info, payload)
            except Exception as e:
                # Si la suscripción ha expirado o es inválida (410 Gone), la desactivamos
                error_msg = str(e)
                if "410 Gone" in error_msg or "404 Not Found" in error_msg:
                    logging.warning(f"Desactivando suscripción inválida {sub.id} para usuario {sub.usuario_id}")
                    sub.activo = False
                    # No hacemos commit aquí, el commit vendrá del flujo principal (acceso_service)
                    # o si es un flujo independiente, el session lo manejará al finalizar si está configurado.
                    # Sin embargo, para asegurar que se guarde el cambio de estado 'activo', 
                    # lo ideal es que el session que se pasa sea el mismo que el del commit.

    async def notificar_excepcion_alcabala(self, db: AsyncSession, acceso):
        """
        Alerta Táctica: Vehículo no identificado o ingreso bajo excepción/intimidación.
        SOP: Aegis Tactical v2.2 - Seguridad Integral.
        """
        query_destinatarios = select(Usuario).where(
            Usuario.activo == True,
            Usuario.rol.in_([
                RolTipo.COMANDANTE, 
                RolTipo.ADMIN_BASE, 
                RolTipo.SUPERVISOR_PARQUEROS
            ])
        )
        
        result = await db.execute(query_destinatarios)
        usuarios = result.scalars().all()
        ids_usuarios = [u.id for u in usuarios]
        
        if not ids_usuarios: return

        query_subs = select(PushSubscription).where(
            PushSubscription.usuario_id.in_(ids_usuarios),
            PushSubscription.activo == True
        )
        result_subs = await db.execute(query_subs)
        suscripciones = result_subs.scalars().all()

        payload = {
            "title": "⚠️ ALERTA TÁCTICA: Acceso Excepcional",
            "body": f"Placa: {acceso.vehiculo_placa or 'SIN PLACA'} - Destino: {acceso.observaciones or 'NO DECLARADO'}",
            "data": {
                "url": "/admin/bitacora",
                "acceso_id": str(acceso.id),
                "tipo": "alerta_excepcion"
            },
            "icon": "/icons/ghost-vehiculo.png"
        }

        for sub in suscripciones:
            try:
                sub_info = {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}
                webpush_service.send_notification(sub_info, payload)
            except Exception as e:
                error_msg = str(e)
                if "410 Gone" in error_msg or "404 Not Found" in error_msg:
                    logging.warning(f"Desactivando suscripción inválida {sub.id} para usuario {sub.usuario_id}")
                    sub.activo = False
                else:
                    logging.error(f"Error enviando push de excepción a {sub.usuario_id}: {e}")

    async def notificar_infraccion_socio(self, db: AsyncSession, socio_id: UUID, vehiculo_placa: str, infraccion_tipo: str, infraccion_gravedad: str):
        """
        Alerta Táctica: Notificar a un socio cuando su vehículo ha cometido una infracción.
        """
        query_subs = select(PushSubscription).where(
            PushSubscription.usuario_id == socio_id,
            PushSubscription.activo == True
        )
        result_subs = await db.execute(query_subs)
        suscripciones = result_subs.scalars().all()

        if not suscripciones:
            return

        payload = {
            "title": f"🚨 Infracción Registrada ({infraccion_gravedad.upper()})",
            "body": f"El vehículo {vehiculo_placa or 'N/A'} ha sido reportado por: {infraccion_tipo.replace('_', ' ').capitalize()}.",
            "data": {
                "url": "/socio/infracciones",
                "tipo": "alerta_infraccion"
            },
            "icon": "/icons/ghost-vehiculo.png"
        }

        for sub in suscripciones:
            try:
                sub_info = {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}
                webpush_service.send_notification(sub_info, payload)
            except Exception as e:
                error_msg = str(e)
                if "410 Gone" in error_msg or "404 Not Found" in error_msg:
                    logging.warning(f"Desactivando suscripción inválida {sub.id} para usuario {sub.usuario_id}")
                    sub.activo = False
                else:
                    logging.error(f"Error enviando push de infraccion al socio {socio_id}: {e}")

    async def notificar_vehiculo_perdido(self, db: AsyncSession, zona_id: UUID, placa: str, minutos: int):
        """
        Alerta Táctica: Notifica que un vehículo ha excedido el tiempo de llegada.
        """
        query_destinatarios = select(Usuario).where(
            Usuario.activo == True,
            (Usuario.rol == RolTipo.PARQUERO) & (Usuario.zona_asignada_id == zona_id) |
            (Usuario.rol == RolTipo.SUPERVISOR_PARQUEROS)
        )
        
        result = await db.execute(query_destinatarios)
        usuarios = result.scalars().all()
        ids_usuarios = [u.id for u in usuarios]
        
        if not ids_usuarios: return

        query_subs = select(PushSubscription).where(
            PushSubscription.usuario_id.in_(ids_usuarios),
            PushSubscription.activo == True
        )
        result_subs = await db.execute(query_subs)
        suscripciones = result_subs.scalars().all()

        payload = {
            "title": "🚨 VEHÍCULO PERDIDO",
            "body": f"El vehículo {placa} tiene +{minutos} min en ruta. Verifique su ubicación.",
            "data": {
                "url": "/parquero/perdidos",
                "zona_id": str(zona_id),
                "tipo": "vehiculo_perdido"
            },
            "icon": "/icons/shield-alert.png"
        }

        for sub in suscripciones:
            try:
                sub_info = {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}
                webpush_service.send_notification(sub_info, payload)
            except Exception as e:
                error_msg = str(e)
                if "410 Gone" in error_msg or "404 Not Found" in error_msg:
                    sub.activo = False
                else:
                    logging.error(f"Error enviando push de vehiculo perdido: {error_msg}")

    async def notificar_acceso_entidad(self, db: AsyncSession, entidad_id: UUID, acceso):
        """
        Notifica a los administradores y supervisores de una entidad sobre un nuevo acceso manual registrado.
        """
        query_destinatarios = select(Usuario).where(
            Usuario.activo == True,
            Usuario.entidad_id == entidad_id,
            Usuario.rol.in_([RolTipo.ADMIN_ENTIDAD, RolTipo.SUPERVISOR_PARQUEROS])
        )
        
        result = await db.execute(query_destinatarios)
        usuarios = result.scalars().all()
        ids_usuarios = [u.id for u in usuarios]
        
        if not ids_usuarios: return

        query_subs = select(PushSubscription).where(
            PushSubscription.usuario_id.in_(ids_usuarios),
            PushSubscription.activo == True
        )
        result_subs = await db.execute(query_subs)
        suscripciones = result_subs.scalars().all()

        if not suscripciones: return

        payload = {
            "title": "✅ Nuevo Acceso Autorizado",
            "body": f"Vehículo {acceso.vehiculo_placa or 'S/P'} - Conductor: {acceso.nombre_manual or 'N/A'}",
            "data": {
                "url": "/entidad/dashboard",
                "tipo": "acceso_autorizado"
            },
            "icon": "/icons/icon-192x192.png"
        }

        for sub in suscripciones:
            try:
                sub_info = {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}
                webpush_service.send_notification(sub_info, payload)
            except Exception as e:
                error_msg = str(e)
                if "410 Gone" in error_msg or "404 Not Found" in error_msg:
                    sub.activo = False
                else:
                    logging.error(f"Error enviando push de acceso a entidad: {error_msg}")

    async def notificar_saturacion_zona(
        self, 
        db: AsyncSession, 
        zona_id: UUID, 
        entidad_id: UUID, 
        entidad_nombre: str, 
        porcentaje: int, 
        info_ocupacion: dict
    ):
        """
        Alerta Táctica: Notifica a los administradores de la entidad y a los parqueros
        que la zona ha alcanzado un nivel crítico de ocupación.
        SOP: Aegis v4.0 - Monitoreo de Capacidad.
        """
        # 1. Destinatarios: Admin Entidad + Parqueros de la zona + Supervisores
        query_destinatarios = select(Usuario).where(
            Usuario.activo == True,
            (
                (Usuario.entidad_id == entidad_id) & (Usuario.rol == RolTipo.ADMIN_ENTIDAD)
            ) | (
                (Usuario.rol == RolTipo.PARQUERO) & (Usuario.zona_asignada_id == zona_id)
            ) | (
                Usuario.rol == RolTipo.SUPERVISOR_PARQUEROS)
        )
        
        result = await db.execute(query_destinatarios)
        usuarios = result.scalars().all()
        ids_usuarios = [u.id for u in usuarios]
        
        if not ids_usuarios: return

        query_subs = select(PushSubscription).where(
            PushSubscription.usuario_id.in_(ids_usuarios),
            PushSubscription.activo == True
        )
        result_subs = await db.execute(query_subs)
        suscripciones = result_subs.scalars().all()

        emoji = "🔴" if porcentaje >= 100 else "🟠"
        payload = {
            "title": f"{emoji} Alerta de Capacidad: {porcentaje}%",
            "body": f"La entidad {entidad_nombre} alcanzó {porcentaje}% de su cupo ({info_ocupacion['ocupacion_actual']}/{info_ocupacion['cupo_total']}). Verifique vehículos por salir.",
            "data": {
                "url": "/entidad/dashboard",
                "tipo": "alerta_saturacion",
                "zona_id": str(zona_id)
            },
            "icon": "/icons/shield-alert.png"
        }

        for sub in suscripciones:
            try:
                sub_info = {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}
                webpush_service.send_notification(sub_info, payload)
            except Exception as e:
                if "410 Gone" in str(e) or "404 Not Found" in str(e):
                    sub.activo = False

notificacion_service = NotificacionService()
