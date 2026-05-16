
import asyncio
from sqlalchemy import text
from app.core.database import SessionLocal

async def clear_accesos():
    async with SessionLocal() as db:
        print("Eliminando registros de la tabla 'accesos'...")
        await db.execute(text("DELETE FROM accesos"))
        await db.commit()
        print("Limpieza completada con éxito.")

if __name__ == "__main__":
    asyncio.run(clear_accesos())
