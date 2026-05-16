
import asyncio
import sys
import os
from pathlib import Path

# Añadir el path del backend para poder importar los módulos
backend_path = Path(__file__).parent.parent / "backend"
sys.path.append(str(backend_path))

# Cargar variables de entorno desde backend/.env ANTES de importar app
from dotenv import load_dotenv
load_dotenv(backend_path / ".env")

from app.core.database import FabricaSesion, motor
from app.models.push_subscription import PushSubscription
from app.services.webpush_service import webpush_service
from sqlalchemy import select

async def test_push_notifications():
    print("🚀 Iniciando prueba de fuego de Notificaciones Push...")
    
    async with FabricaSesion() as db:
        # Obtener todas las suscripciones activas
        result = await db.execute(select(PushSubscription).where(PushSubscription.activo == True))
        subscripciones = result.scalars().all()
        
        if not subscripciones:
            print("❌ No se encontraron suscripciones activas en la base de datos.")
            return

        print(f"📡 Se encontraron {len(subscripciones)} suscripciones activas.")
        
        test_payload = {
            "title": "BAGFM - Alerta de Prueba",
            "body": "Este es un mensaje táctico de verificación. Si ves esto, tu enlace está 100% operativo.",
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/badge-72x72.png",
            "url": "/ajustes",
            "tag": "test-push",
            "data": {
                "tipo": "prueba",
                "timestamp": "ahora"
            }
        }

        for sub in subscripciones:
            info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth
                }
            }
            
            print(f"  - Enviando a dispositivo: {sub.dispositivo or 'Desconocido'}...")
            try:
                # La función send_notification es sincrónica, la ejecutamos en un thread si fuera necesario
                # pero para un script de prueba está bien así
                webpush_service.send_notification(info, test_payload)
                print(f"    ✅ Enviada con éxito.")
            except Exception as e:
                print(f"    ❌ Error: {str(e)}")

    print("\n🏁 Prueba finalizada.")

if __name__ == "__main__":
    asyncio.run(test_push_notifications())
