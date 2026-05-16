
import asyncio
import logging
from sqlalchemy import select
from app.core.database import motor
from app.models.push_subscription import PushSubscription
from app.services.webpush_service import webpush_service

logging.basicConfig(level=logging.INFO)

async def test_push():
    async with motor.connect() as conn:
        # Intentar con la primera suscripción activa
        res = await conn.execute(select(PushSubscription).where(PushSubscription.activo == True).limit(1))
        sub = res.first()
        
        if not sub:
            print("No hay suscripciones activas para probar.")
            return

        print(f"Probando con usuario: {sub.usuario_id}")
        
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth
            }
        }
        
        payload = {
            "title": "Prueba de Sistema",
            "body": "Verificando recuperación de notificaciones push.",
            "data": {"url": "/"}
        }
        
        try:
            webpush_service.send_notification(sub_info, payload)
            print("Llamada a send_notification completada. Verifique los logs de arriba.")
        except Exception as e:
            print(f"Error fatal en la prueba: {e}")

if __name__ == "__main__":
    asyncio.run(test_push())
