
import asyncio
import os
import sys
from sqlalchemy import select
from datetime import date

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.acceso import Acceso

async def check():
    async with FabricaSesion() as db:
        today = date.today()
        print(f"=== ACCESOS DESDE {today} ===")
        query = select(Acceso).where(Acceso.timestamp >= today).order_by(Acceso.timestamp.desc())
        res = await db.execute(query)
        accs = res.scalars().all()
        
        print(f"Total accesos hoy: {len(accs)}")
        for a in accs:
            print(f"Acceso: {a.id} | QR: {a.qr_id} | Zona: {a.zona_id}")
            print(f"  -> Punto: {a.punto_acceso} | Timestamp: {a.timestamp}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(check())
