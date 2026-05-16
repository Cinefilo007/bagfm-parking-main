
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
        # Carlos Diaz
        res = await db.execute(select(PushSubscription).where(PushSubscription.usuario_id == UUID('b1ff2084-230e-4632-92d5-3b0bcc5ffd9a'), PushSubscription.activo == True))
        print(f"Carlos Diaz subs: {len(res.scalars().all())}")

if __name__ == "__main__":
    asyncio.run(check())
