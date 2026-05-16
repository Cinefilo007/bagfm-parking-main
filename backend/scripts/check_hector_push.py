
import asyncio
import os
import sys
from sqlalchemy import select
from uuid import UUID

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.push_subscription import PushSubscription

async def check():
    h_id = UUID("d1058b96-c570-4a14-b15c-d3a99584240e")
    async with FabricaSesion() as db:
        query = select(PushSubscription).where(PushSubscription.usuario_id == h_id)
        res = await db.execute(query)
        subs = res.scalars().all()
        print(f"Suscripciones Hector: {len(subs)}")
        for s in subs:
            print(f"  ID: {s.id} | Activo: {s.activo} | Endpoint: {s.endpoint[:20]}")

if __name__ == "__main__":
    asyncio.run(check())
