
import asyncio
import os
import sys
from sqlalchemy import select
from uuid import UUID
import json

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.usuario import Usuario
from app.models.push_subscription import PushSubscription
from app.models.enums import RolTipo
from app.services.webpush_service import webpush_service

async def test():
    zona_id = UUID("1845d708-c776-4bac-bb10-6d3ef848a1f5")
    placa = "LB128T"
    
    async with FabricaSesion() as db:
        print(f"=== AUDITANDO SUBS PARA ZONA {zona_id} ===")
        
        query_destinatarios = select(Usuario).where(
            Usuario.activo == True,
            (Usuario.rol == RolTipo.PARQUERO) & (Usuario.zona_asignada_id == zona_id)
        )
        res = await db.execute(query_destinatarios)
        usrs = res.scalars().all()
        ids = [u.id for u in usrs]
        print(f"Usuarios encontrados: {[u.nombre for u in usrs]}")
        
        query_subs = select(PushSubscription).where(
            PushSubscription.usuario_id.in_(ids),
            PushSubscription.activo == True
        )
        res_subs = await db.execute(query_subs)
        subs = res_subs.scalars().all()
        
        print(f"Suscripciones activas: {len(subs)}")
        
        payload = {
            "title": "Prueba Diagnostica",
            "body": "Si recibes esto, el sistema funciona.",
            "data": {"url": "/"}
        }
        
        for s in subs:
            print(f"Enviando a {s.usuario_id} (Endpoint: {s.endpoint[:30]}...)")
            sub_info = {
                "endpoint": s.endpoint,
                "keys": {"p256dh": s.p256dh, "auth": s.auth}
            }
            try:
                webpush_service.send_notification(sub_info, payload)
                print("  -> ENVIO EXITOSO (segun pywebpush)")
            except Exception as e:
                print(f"  -> ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test())
