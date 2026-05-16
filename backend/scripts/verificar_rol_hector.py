
import asyncio
import os
import sys
from sqlalchemy import select
from uuid import UUID

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.usuario import Usuario

async def check():
    h_id = UUID("d1058b96-c570-4a14-b15c-d3a99584240e")
    async with FabricaSesion() as db:
        usr = await db.get(Usuario, h_id)
        if usr:
            print(f"Usuario: {usr.nombre} {usr.apellido}")
            print(f"Rol: {usr.rol} (Type: {type(usr.rol)})")
            print(f"Zona: {usr.zona_asignada_id}")

if __name__ == "__main__":
    asyncio.run(check())
