
import asyncio
import os
import sys
from sqlalchemy import select
from uuid import UUID

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.usuario import Usuario
from app.models.push_subscription import PushSubscription

async def check():
    async with FabricaSesion() as db:
        print("=== AUDITANDO USUARIO: HECTOR LOPEZ ===")
        # ID de Hector Lopez de los logs: d1058b96-c570-4a14-b15c-d3a99584240e
        h_id = UUID("d1058b96-c570-4a14-b15c-d3a99584240e")
        usr = await db.get(Usuario, h_id)
        
        if not usr:
            print("Usuario no encontrado")
            return
            
        print(f"Usuario: {usr.nombre} {usr.apellido} | Rol: {usr.rol} | Activo: {usr.activo}")
        print(f"Zona Asignada: {usr.zona_asignada_id}")
        
        query = select(PushSubscription).where(PushSubscription.usuario_id == h_id)
        res = await db.execute(query)
        subs = res.scalars().all()
        
        print(f"Suscripciones encontradas: {len(subs)}")
        for s in subs:
            print(f"  ID: {s.id} | Activo: {s.activo} | Created: {s.created_at}")
            # Verificamos si los campos keys están presentes (p256dh, auth)
            print(f"  Endpoint: {s.endpoint[:30]}...")
            print(f"  P256DH: {'OK' if s.p256dh else 'MISSING'} | Auth: {'OK' if s.auth else 'MISSING'}")
        
        print("-" * 50)
        
        print("=== AUDITANDO USUARIO: VICTOR ACOSTA ===")
        # ID de Victor Acosta de los logs: e3ae33ca-85fd-40d8-9b75-3983a31a70a6
        v_id = UUID("e3ae33ca-85fd-40d8-9b75-3983a31a70a6")
        usr_v = await db.get(Usuario, v_id)
        if usr_v:
            print(f"Usuario: {usr_v.nombre} {usr_v.apellido} | Rol: {usr_v.rol} | Activo: {usr_v.activo}")
            print(f"Zona Asignada: {usr_v.zona_asignada_id}")
            
            res_v = await db.execute(select(PushSubscription).where(PushSubscription.usuario_id == v_id))
            subs_v = res_v.scalars().all()
            print(f"Suscripciones: {len(subs_v)}")
            for s in subs_v:
                print(f"  ID: {s.id} | Activo: {s.activo}")

if __name__ == "__main__":
    asyncio.run(check())
