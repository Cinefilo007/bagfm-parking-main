
import asyncio
import os
import sys
from sqlalchemy import select

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.usuario import Usuario
from app.models.enums import RolTipo

async def check():
    async with FabricaSesion() as db:
        print("=== TODOS LOS PARQUEROS Y SUS ZONAS ===")
        query = select(Usuario).where(Usuario.rol == RolTipo.PARQUERO)
        res = await db.execute(query)
        usrs = res.scalars().all()
        
        for u in usrs:
            print(f"Parquero: {u.nombre} {u.apellido} (ID: {u.id})")
            print(f"  -> Zona Asignada: {u.zona_asignada_id}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(check())
