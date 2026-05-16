"""
Conexión a base de datos — BAGFM
SQLAlchemy async + PostgreSQL (Supabase).
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import obtener_config

config = obtener_config()

# Motor de base de datos async
motor = create_async_engine(
    config.database_url,
    echo=config.app_env == "development",  # SQL logging solo en dev
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Fábrica de sesiones
FabricaSesion = async_sessionmaker(
    bind=motor,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Clase base para todos los modelos SQLAlchemy."""
    pass


async def obtener_db() -> AsyncSession:
    """
    Dependencia FastAPI — provee una sesión de BD por request.
    Se cierra automáticamente al finalizar.
    """
    async with FabricaSesion() as sesion:
        try:
            yield sesion
            await sesion.commit()
        except Exception:
            await sesion.rollback()
            raise
        finally:
            await sesion.close()
