from pywebpush import webpush, WebPushException
import json
import logging
from app.core.config import obtener_config

class WebPushService:
    def send_notification(self, subscription_info: dict, payload: dict):
        """
        Envía una notificación push a una suscripción específica.
        subscription_info debe contener 'endpoint', 'keys' con 'p256dh' y 'auth'.
        """
        config = obtener_config()
        private_key = config.vapid_private_key
        
        if not private_key:
            logging.warning("VAPID_PRIVATE_KEY no configurado en settings, notificación push ignorada.")
            return

        claims = {
            "sub": f"mailto:{config.vapid_email}"
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=private_key,
                vapid_claims=claims
            )
            logging.info(f"Notificación Push enviada a {subscription_info.get('endpoint')}")
        except WebPushException as ex:
            logging.error(f"Error enviando notificación push: {repr(ex)}")
            if ex.response and hasattr(ex.response, 'json') and ex.response.json():
                logging.error(f"Response: {ex.response.json()}")

webpush_service = WebPushService()
