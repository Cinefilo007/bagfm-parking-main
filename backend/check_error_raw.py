
import asyncio
from sqlalchemy import text
from app.core.database import motor

async def check():
    async with motor.connect() as conn:
        res = await conn.execute(text("SELECT serial_legible, email_portador, email_ultimo_error FROM codigos_qr WHERE email_ultimo_error IS NOT NULL LIMIT 5"))
        print(f"Errores encontrados: {res.fetchall()}")

if __name__ == "__main__":
    asyncio.run(check())
