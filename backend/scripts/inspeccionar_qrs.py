
import asyncio
import os
import sys
from sqlalchemy import select
from datetime import datetime, timedelta

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.codigo_qr import CodigoQR

async def check():
    async with FabricaSesion() as db:
        # En Railway/Servidor, datetime.now() podría tener problemas de zona horaria si no se usa UTC
        # Pero probaremos con los últimos 100 independientemente de la fecha
        print("=== ULTIMOS 100 QRS CREADOS (Cualquier tipo) ===")
        query = select(CodigoQR).order_by(CodigoQR.created_at.desc()).limit(100)
        res = await db.execute(query)
        qrs = res.scalars().all()
        
        count = 0
        for qr in qrs:
            if count < 10: # Mostrar detalles de los primeros 10
                print(f"QR: {qr.id} | Tipo: {qr.tipo} | Creado: {qr.created_at}")
                print(f"  -> Zona: {qr.zona_asignada_id} | Lote: {qr.lote_id}")
            count += 1
        
        print(f"Total mostrados en lista: {count}")

if __name__ == "__main__":
    asyncio.run(check())
