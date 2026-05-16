
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def add_columns():
    async with engine.begin() as conn:
        print("Añadiendo columnas config_ia y grilla_tactica...")
        try:
            await conn.execute(text("ALTER TABLE zonas_estacionamiento ADD COLUMN IF NOT EXISTS config_ia JSONB;"))
            await conn.execute(text("ALTER TABLE zonas_estacionamiento ADD COLUMN IF NOT EXISTS grilla_tactica JSONB;"))
            print("Columnas añadidas con éxito.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(add_columns())
