
import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.core.database import FabricaSesion
from app.models.zona_estacionamiento import ZonaEstacionamiento
from sqlalchemy import select

async def check():
    print("ZONAS EN DATABASE:", flush=True)
    async with FabricaSesion() as db:
        rs = await db.execute(select(ZonaEstacionamiento))
        zones = rs.scalars().all()
        for z in zones:
            print(f"- {z.nombre} (ID: {z.id}) Cap: {z.capacidad_total} Ocu: {z.ocupacion_actual}", flush=True)

if __name__ == "__main__":
    asyncio.run(check())
