import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import app.models.base
from app.core.database import FabricaSesion, motor
from app.models.usuario import Usuario

async def buscar():
    async with FabricaSesion() as db:
        query = select(Usuario).where(Usuario.cedula.like("%22311322%"))
        res = await db.execute(query)
        usuarios = res.scalars().all()
        if usuarios:
            print(f"Encontrados {len(usuarios)} usuarios:")
            for usuario in usuarios:
                print(f"ID={usuario.id}, Nombre={usuario.nombre} {usuario.apellido}, Cedula={usuario.cedula}, Email={usuario.email}, Rol={usuario.rol}, Activo={usuario.activo}, Debe cambiar password={usuario.debe_cambiar_password}")
        else:
            print("Ningún usuario coincide con la cedula que contiene 22311322")
    await motor.dispose()

if __name__ == "__main__":
    asyncio.run(buscar())
