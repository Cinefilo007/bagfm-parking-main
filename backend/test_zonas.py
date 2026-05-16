
import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.core.database import FabricaSesion
from app.services.zona_service import zona_service

async def test_zonas():
    async with FabricaSesion() as db:
        try:
            zonas = await zona_service.obtener_zonas(db, skip=0, limit=10)
            print(f"Éxito: {len(zonas)} zonas obtenidas")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_zonas())
