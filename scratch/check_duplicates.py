
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.core.config import obtener_config

async def run():
    config = obtener_config()
    engine = create_async_engine(config.database_url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, cedula, rol, email FROM usuarios WHERE cedula IN ('V117373381', 'V32438373', 'V30715014')"))
        print(res.mappings().all())
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run())
