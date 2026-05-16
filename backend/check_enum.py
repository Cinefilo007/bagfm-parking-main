import asyncio
from app.core.database import FabricaSesion
from sqlalchemy import text

async def check_enum():
    async with FabricaSesion() as session:
        nuevos_tipos = [
            'colision', 'zona_prohibida', 'acceso_no_autorizado', 
            'daño_propiedad', 'abandono_vehiculo', 'ruido_excesivo', 'vehiculo_fantasma'
        ]
        for t in nuevos_tipos:
            try:
                await session.execute(text(f"ALTER TYPE infraccion_tipo ADD VALUE IF NOT EXISTS '{t}';"))
            except Exception as e:
                print(f"Error con {t}: {e}")
        await session.commit()
        result = await session.execute(text("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'infraccion_tipo'::regtype;"))
        rows = result.fetchall()
        print([r[0] for r in rows])

asyncio.run(check_enum())
