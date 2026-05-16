
import asyncio
from sqlalchemy import text
from app.core.database import motor

async def check():
    async with motor.connect() as conn:
        res = await conn.execute(text('SELECT * FROM configuracion_correo'))
        print(f"Configuraciones: {res.fetchall()}")

if __name__ == "__main__":
    asyncio.run(check())
