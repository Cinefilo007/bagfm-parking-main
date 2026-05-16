
import asyncio
from sqlalchemy import select
from app.core.database import motor
from app.models.codigo_qr import CodigoQR

async def check_errors():
    lote_id = "fd2300f3-1959-426f-a34e-6955e6dc1c0d"
    async with motor.connect() as conn:
        result = await conn.execute(
            select(CodigoQR.serial_legible, CodigoQR.email_portador, CodigoQR.email_ultimo_error)
            .where(CodigoQR.lote_id == lote_id)
        )
        rows = result.fetchall()
        print(f"Resultados para lote {lote_id}:")
        for row in rows:
            print(f"Pase: {row[0]} | Email: {row[1]} | Error: {row[2]}")

if __name__ == "__main__":
    asyncio.run(check_errors())
