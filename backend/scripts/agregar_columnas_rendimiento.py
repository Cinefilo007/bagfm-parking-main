import asyncio
import sys
import os
from sqlalchemy import text

# Asegurarnos de que el backend esté en el path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import motor

async def migrar():
    print("Iniciando migración para agregar columnas 'distancia_recorrida' y 'rendimiento_tramo' a la tabla 'abastecimientos'...")
    async with motor.begin() as conn:
        # Agregar columnas a la tabla abastecimientos
        await conn.execute(text("ALTER TABLE abastecimientos ADD COLUMN IF NOT EXISTS distancia_recorrida INTEGER;"))
        await conn.execute(text("ALTER TABLE abastecimientos ADD COLUMN IF NOT EXISTS rendimiento_tramo DOUBLE PRECISION;"))
        print("Columnas 'distancia_recorrida' y 'rendimiento_tramo' agregadas de forma exitosa.")

if __name__ == "__main__":
    asyncio.run(migrar())
