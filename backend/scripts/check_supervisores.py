
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
        query = select(Usuario).where(
            Usuario.activo == True,
            Usuario.rol == RolTipo.SUPERVISOR_PARQUEROS
        )
        res = await db.execute(query)
        usrs = res.scalars().all()
        print(f"Supervisores de Parqueros activos: {len(usrs)}")
        for u in usrs:
            print(f"  - {u.nombre} {u.apellido}")

if __name__ == "__main__":
    asyncio.run(check())
