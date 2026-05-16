from pydantic import BaseModel
from typing import Optional

class ConfiguracionSalidasUpdate(BaseModel):
    sync_parquero: Optional[bool] = None
    mass_time: Optional[str] = None # HH:MM o vacío para desactivar
