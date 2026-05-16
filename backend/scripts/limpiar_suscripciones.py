
import asyncio
import os
import sys
import json
import logging
from sqlalchemy import select

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.push_subscription import PushSubscription
from app.services.webpush_service import webpush_service
from pywebpush import WebPushException

async def limpiar():
    async with FabricaSesion() as db:
        print("=== INICIANDO LIMPIEZA DE SUSCRIPCIONES INVALIDAS ===")
        
        # 1. Obtener todas las suscripciones activas
        query = select(PushSubscription).where(PushSubscription.activo == True)
        res = await db.execute(query)
        subs = res.scalars().all()
        
        print(f"Verificando {len(subs)} suscripciones...")
        
        payload = {
            "title": "Verificación de Conectividad",
            "body": "Sincronizando estado de notificaciones...",
            "data": {"tipo": "ping_silent"}
        }
        
        invalidadas = 0
        exitosas = 0
        
        for sub in subs:
            sub_info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth
                }
            }
            
            from app.core.config import obtener_config
            config = obtener_config()
            
            try:
                from pywebpush import webpush
                webpush(
                    subscription_info=sub_info,
                    data=json.dumps(payload),
                    vapid_private_key=config.vapid_private_key,
                    vapid_claims={"sub": f"mailto:{config.vapid_email}"}
                )
                exitosas += 1
            except WebPushException as e:
                error_msg = str(e)
                if "410 Gone" in error_msg or "404 Not Found" in error_msg or "expired" in error_msg.lower():
                    print(f"  [!] INVALIDA: Usuario {sub.usuario_id} (ID: {sub.id}) - Desactivando...")
                    sub.activo = False
                    invalidadas += 1
                else:
                    print(f"  [?] ERROR PUSH: {sub.usuario_id} - {error_msg[:100]}")
            except Exception as e:
                print(f"  [?] ERROR GENERAL: {sub.usuario_id} - {str(e)[:100]}")
        
        if invalidadas > 0:
            await db.commit()
            print(f"\nSe han desactivado {invalidadas} suscripciones obsoletas.")
        else:
            print("\nNo se encontraron suscripciones para desactivar.")
            
        print(f"Suscripciones que permanecen activas: {exitosas}")

if __name__ == "__main__":
    # Configurar logging para no ensuciar la salida
    logging.getLogger('pywebpush').setLevel(logging.CRITICAL)
    asyncio.run(limpiar())
