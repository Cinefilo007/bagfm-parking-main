import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlalchemy import text

async def fix_enum():
    from app.core.database import motor
    async with motor.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            await conn.execute(text("ALTER TYPE rol_tipo ADD VALUE 'BOMBERO';"))
            print("Enum 'BOMBERO' añadido a rol_tipo con éxito.")
        except Exception as e:
            print(f"Error en rol_tipo (puede que ya exista): {e}")

        try:
            await conn.execute(text("ALTER TYPE tipo_acceso_pase ADD VALUE 'base';"))
            print("Enum 'base' añadido a tipo_acceso_pase con éxito.")
        except Exception as e:
            print(f"Error en tipo_acceso_pase (puede que ya exista): {e}")

if __name__ == "__main__":
    asyncio.run(fix_enum())
