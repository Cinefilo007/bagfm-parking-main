import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.services.evento_service import evento_service
from app.core.config import obtener_config
import uuid

async def test_stats():
    config = obtener_config()
    engine = create_async_engine(config.database_url)
    FabricaSesion = async_sessionmaker(bind=engine, class_=AsyncSession)
    
    async with FabricaSesion() as db:
        try:
            print(">> Probando get_stats para COMANDANTE (entidad_id=None)...")
            stats = await evento_service.get_stats(db, None)
            print(">> Resultado:", stats)
        except Exception as e:
            import traceback
            print(">> ERROR DETECTADO:")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_stats())
