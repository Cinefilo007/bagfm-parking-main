import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

# Cargar variables de entorno desde el .env del backend
load_dotenv(dotenv_path='backend/.env')

DATABASE_URL = os.getenv("DATABASE_URL")

async def update_schema():
    if not DATABASE_URL:
        print("DATABASE_URL no encontrada en .env")
        return

    print(f"Conectando a: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        try:
            print("Agregando columna config_branding a entidades_civiles...")
            await conn.execute(text("ALTER TABLE entidades_civiles ADD COLUMN IF NOT EXISTS config_branding TEXT;"))
            print("¡Columna agregada exitosamente!")
        except Exception as e:
            print(f"Error al actualizar el esquema: {e}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(update_schema())
