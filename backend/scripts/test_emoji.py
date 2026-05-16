
import asyncio
import os
import sys
from uuid import UUID

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.services.webpush_service import webpush_service
from app.models.push_subscription import PushSubscription
from sqlalchemy import select

async def test_emoji():
    async with FabricaSesion() as db:
        # Buscar la suscripción de Juan Garcia
        res = await db.execute(select(PushSubscription).where(PushSubscription.usuario_id == UUID('2f59a669-bec2-4662-b87b-556496f7f610'), PushSubscription.activo == True))
        sub = res.scalars().first()
        
        if not sub:
            print("No se encontro suscripcion activa para Juan Garcia")
            return
            
        payload = {
            "title": "🛡️ PRUEBA CON EMOJI",
            "body": "Si recibes esto, los emojis funcionan perfectamente. 🛡️✅",
            "data": {"url": "/"}
        }
        
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth}
        }
        
        print("Enviando...")
        try:
            webpush_service.send_notification(sub_info, payload)
            print("Enviado sin errores de red.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_emoji())
