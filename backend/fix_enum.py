
import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.core.database import FabricaSesion
from sqlalchemy import text

async def fix():
    async with FabricaSesion() as db:
        # PostgreSQL no permite ejecutar ALTER TYPE en un bloque transaccional
        # Por lo tanto, necesitamos usar el connection subyacente.
        # Alternativamente, podemos atrapar el error transaccional y tratar de usar isolation_level='AUTOCOMMIT'
        pass

async def fix_enum():
    from app.core.database import motor
    async with motor.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            await conn.execute(text("ALTER TYPE tipo_acceso_pase ADD VALUE 'base';"))
            print("Enum 'base' añadido a tipo_acceso_pase")
        except Exception as e:
            print(f"Error o ya existe: {e}")

if __name__ == "__main__":
    asyncio.run(fix_enum())
