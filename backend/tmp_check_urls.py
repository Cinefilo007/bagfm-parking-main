import asyncio
import uuid
from app.core.database import SessionLocal
from app.models.alcabala_evento import LotePaseMasivo
from sqlalchemy import select

async def check():
    async with SessionLocal() as db:
        q = await db.execute(select(LotePaseMasivo.nombre_evento, LotePaseMasivo.zip_url, LotePaseMasivo.codigo_serial))
        results = q.all()
        for r in results:
            print(f"Evento: {r.nombre_evento} | Serial: {r.codigo_serial} | URL: {r.zip_url}")

if __name__ == "__main__":
    asyncio.run(check())
