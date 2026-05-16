
import asyncio
import os
import sys
from sqlalchemy import select
from datetime import datetime, timezone, timedelta

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.acceso import Acceso

async def check():
    async with FabricaSesion() as db:
        ahora = datetime.now(timezone.utc)
        hace_1h = ahora - timedelta(hours=1)
        print(f"=== BUSCANDO ACCESOS DESDE {hace_1h} (UTC) ===")
        query = select(Acceso).where(Acceso.timestamp >= hace_1h).order_by(Acceso.timestamp.desc())
        res = await db.execute(query)
        accs = res.scalars().all()
        
        print(f"Encontrados: {len(accs)}")
        for a in accs:
            print(f"ID: {a.id} | Placa: {a.vehiculo_placa} | Punto: {a.punto_acceso} | Time: {a.timestamp}")

if __name__ == "__main__":
    asyncio.run(check())
