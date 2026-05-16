from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.configuracion import ConfiguracionSistema
from typing import Optional, Dict, Any

class ConfiguracionService:
    """
    SOP: Gestión de Parámetros Globales.
    Permite persistir y recuperar configuraciones que afectan el comportamiento del sistema.
    """

    async def get_valor(self, db: AsyncSession, clave: str, default: Any = None) -> Any:
        """Obtiene el valor de una configuración por su clave."""
        query = select(ConfiguracionSistema).where(ConfiguracionSistema.clave == clave)
        result = await db.execute(query)
        config = result.scalar_one_or_none()
        return config.valor if config else default

    async def get_config_salidas(self, db: AsyncSession) -> Dict[str, Any]:
        """Obtiene el bloque de configuración para salidas de base."""
        sync_parquero = await self.get_valor(db, "BASE_EXIT_SYNC_PARKING", "false")
        mass_time = await self.get_valor(db, "BASE_EXIT_MASS_TIME", "")
        
        return {
            "sync_parquero": sync_parquero.lower() == "true",
            "mass_time": mass_time if mass_time else None
        }

    async def set_valor(self, db: AsyncSession, clave: str, valor: str, descripcion: Optional[str] = None):
        """Crea o actualiza una configuración."""
        query = select(ConfiguracionSistema).where(ConfiguracionSistema.clave == clave)
        result = await db.execute(query)
        config = result.scalar_one_or_none()

        if config:
            config.valor = str(valor)
            if descripcion:
                config.descripcion = descripcion
        else:
            config = ConfiguracionSistema(clave=clave, valor=str(valor), descripcion=descripcion)
            db.add(config)
        
        await db.commit()
        return config

configuracion_service = ConfiguracionService()
