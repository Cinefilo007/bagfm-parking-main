
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
    async with FabricaSesion() as db:
        # Hector Lopez
        res = await db.execute(select(PushSubscription).where(PushSubscription.usuario_id == UUID('d1058b96-c570-4a14-b15c-d3a99584240e'), PushSubscription.activo == True))
        subs = res.scalars().all()
        print(f"Hector Lopez subs: {len(subs)}")
        for s in subs:
            print(f"  -> Sub: {s.id} | Device: {s.dispositivo} | Endpoint: {s.endpoint[:50]}...")

if __name__ == "__main__":
    asyncio.run(check())
