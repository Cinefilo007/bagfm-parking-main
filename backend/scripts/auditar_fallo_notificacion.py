
import asyncio
import os
import sys
from sqlalchemy import select
from uuid import UUID

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.acceso import Acceso
from app.models.codigo_qr import CodigoQR

async def check():
    ids = [
        UUID("7db0e653-3d51-4311-93a3-d34760821ae9"),
        UUID("38b3841a-a75f-4c2d-8c96-8c4ad1d52d87")
    ]
    async with FabricaSesion() as db:
        for aid in ids:
            a = await db.get(Acceso, aid)
            if a:
                print(f"Acceso: {a.id} | Placa: {a.vehiculo_placa} | Zona: {a.zona_id}")
                print(f"  -> QR ID: {a.qr_id}")
                if a.qr_id:
                    qr = await db.get(CodigoQR, a.qr_id)
                    if qr:
                        print(f"  -> QR Zona: {qr.zona_asignada_id} | QR Placa: {qr.vehiculo_placa}")
                print("-" * 50)

if __name__ == "__main__":
    asyncio.run(check())
