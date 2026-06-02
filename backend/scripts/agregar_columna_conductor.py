import asyncio
import sys
import os
from sqlalchemy import text
# Asegurarnos de que el backend esté en el path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import motor

async def migrar():
    print("Iniciando migración para agregar columna 'conductor' a la tabla 'abastecimientos'...")
    async with motor.begin() as conn:
        # Ejecutar el ALTER TABLE
        await conn.execute(text("ALTER TABLE abastecimientos ADD COLUMN IF NOT EXISTS conductor VARCHAR(100);"))
        print("Columna 'conductor' agregada (o ya existía) en la tabla 'abastecimientos' de forma exitosa.")

if __name__ == "__main__":
    asyncio.run(migrar())
