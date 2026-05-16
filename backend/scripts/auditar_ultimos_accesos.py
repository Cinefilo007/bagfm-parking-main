
import asyncio
import os
import sys
from sqlalchemy import select
from datetime import datetime, timezone

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.acceso import Acceso
from app.models.codigo_qr import CodigoQR

async def check():
    async with FabricaSesion() as db:
        print(f"=== VERIFICANDO ULTIMOS 5 ACCESOS (UTC) ===")
        query = select(Acceso).order_by(Acceso.timestamp.desc()).limit(5)
        res = await db.execute(query)
        accs = res.scalars().all()
        
        for a in accs:
            print(f"ID: {a.id} | Placa: {a.vehiculo_placa} | Zona: {a.zona_id}")
            print(f"  -> QR ID: {a.qr_id} | Tipo: {a.tipo}")
            print(f"  -> Punto: {a.punto_acceso} | Time: {a.timestamp}")
            
            if a.qr_id:
                qr = await db.get(CodigoQR, a.qr_id)
                if qr:
                    print(f"  -> QR Tipo: {qr.tipo} | QR Zona: {qr.zona_asignada_id}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(check())
