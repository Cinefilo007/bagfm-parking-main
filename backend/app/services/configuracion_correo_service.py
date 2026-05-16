from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from typing import Optional

from app.models.configuracion_correo import ConfiguracionCorreo
from app.schemas.configuracion_correo import ConfiguracionCorreoCreate, ConfiguracionCorreoUpdate

class ConfiguracionCorreoService:
    async def obtener_por_entidad(self, db: AsyncSession, entidad_id: UUID) -> Optional[ConfiguracionCorreo]:
        result = await db.execute(select(ConfiguracionCorreo).where(ConfiguracionCorreo.entidad_id == entidad_id))
        return result.scalars().first()

    async def obtener_general(self, db: AsyncSession) -> Optional[ConfiguracionCorreo]:
        result = await db.execute(select(ConfiguracionCorreo).where(ConfiguracionCorreo.entidad_id == None))
        return result.scalars().first()

    async def crear_o_actualizar(self, db: AsyncSession, datos: ConfiguracionCorreoCreate, entidad_id: Optional[UUID] = None) -> ConfiguracionCorreo:
        # Busca si ya existe
        stmt = select(ConfiguracionCorreo).where(
            ConfiguracionCorreo.entidad_id == entidad_id
        )
        result = await db.execute(stmt)
        config = result.scalars().first()

        if config:
            # Actualiza
            update_data = datos.model_dump(exclude_unset=True)
            for k, v in update_data.items():
                setattr(config, k, v)
        else:
            # Crea
            config = ConfiguracionCorreo(**datos.model_dump())
            config.entidad_id = entidad_id
            db.add(config)
        
        await db.commit()
        await db.refresh(config)
        return config

configuracion_correo_service = ConfiguracionCorreoService()
