
import asyncio
import os
import sys
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.acceso import Acceso
from app.models.codigo_qr import CodigoQR
from app.models.alcabala_evento import LotePaseMasivo

async def check():
    async with FabricaSesion() as db:
        print("=== ULTIMOS 50 ACCESOS CON PASE TEMPORAL ===")
        query = select(Acceso).where(Acceso.qr_id != None).order_by(Acceso.timestamp.desc()).limit(50)
        res = await db.execute(query)
        accesos = res.scalars().all()
        
        for a in accesos:
            qr = await db.get(CodigoQR, a.qr_id)
            lote_id = qr.lote_id if qr else "N/A"
            zona_qr = qr.zona_asignada_id if qr else "N/A"
            
            lote_zona = "N/A"
            if qr and qr.lote_id:
                lote = await db.get(LotePaseMasivo, qr.lote_id)
                if lote:
                    lote_zona = lote.zona_estacionamiento_id
            
            print(f"Acceso: {a.timestamp} | Placa: {a.vehiculo_placa} | Zona: {a.zona_id}")
            print(f"  -> Punto: {a.punto_acceso} | Registrado por: {a.registrado_por}")
            print(f"  -> QR ID: {a.qr_id} | Lote: {lote_id}")
            print(f"  -> Zona en QR: {zona_qr} | Zona en Lote: {lote_zona}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(check())
