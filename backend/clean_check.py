
import asyncio
import sys
import os
import logging

# Desactivar logs de sqlalchemy
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

sys.path.append(os.getcwd())

from app.core.database import FabricaSesion
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.vehiculo_pase import VehiculoPase
from sqlalchemy import select, func

async def check():
    print("RESULTADOS:", flush=True)
    async with FabricaSesion() as db:
        # Zonas
        rs = await db.execute(select(ZonaEstacionamiento))
        for z in rs.scalars().all():
            rv = await db.execute(select(func.count(VehiculoPase.id)).where(VehiculoPase.zona_asignada_id == z.id, VehiculoPase.ingresado == True))
            c = rv.scalar() or 0
            print(f"ZONA: {z.nombre} | OCU_COL: {z.ocupacion_actual} | REAL_VP: {c}", flush=True)

if __name__ == "__main__":
    asyncio.run(check())
