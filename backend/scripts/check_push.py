
import asyncio
from sqlalchemy import select
from app.core.database import motor
from app.models.push_subscription import PushSubscription

async def check():
    async with motor.connect() as conn:
        res = await conn.execute(select(PushSubscription).where(PushSubscription.activo == True))
        subs = res.all()
        print(f"Suscripciones activas: {len(subs)}")
        for s in subs:
            print(f"Usuario: {s.usuario_id} - Endpoint: {s.endpoint[:30]}...")

if __name__ == "__main__":
    asyncio.run(check())
