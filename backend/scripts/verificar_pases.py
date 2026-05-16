
import asyncio
import os
import sys
from sqlalchemy import select

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.codigo_qr import CodigoQR
from app.models.enums import QRTipo

async def check():
    async with FabricaSesion() as db:
        print("=== ULTIMOS 10 PASES TEMPORALES ===")
        query = select(CodigoQR).where(CodigoQR.tipo == QRTipo.temporal).order_by(CodigoQR.created_at.desc()).limit(10)
        res = await db.execute(query)
        qrs = res.scalars().all()
        
        for qr in qrs:
            print(f"QR: {qr.id} | Creado: {qr.created_at}")
            print(f"  -> Zona: {qr.zona_asignada_id} | Placa: {qr.vehiculo_placa}")
            print(f"  -> Lote: {qr.lote_id} | Activo: {qr.activo}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(check())
