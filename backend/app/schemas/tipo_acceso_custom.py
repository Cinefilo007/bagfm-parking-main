from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class TipoAccesoCustomBase(BaseModel):
    nombre: str
    color_hex: Optional[str] = "#FFFFFF"
    nivel_prioridad: Optional[int] = 0
    plantilla_layout: Optional[str] = "qr"
    color_preset: Optional[str] = "aegis"
    activo: Optional[bool] = True

    model_config = ConfigDict(from_attributes=True)

class TipoAccesoCustomCrear(TipoAccesoCustomBase):
    pass

class TipoAccesoCustomActualizar(BaseModel):
    nombre: Optional[str] = None
    color_hex: Optional[str] = None
    nivel_prioridad: Optional[int] = None
    plantilla_layout: Optional[str] = None
    color_preset: Optional[str] = None
    activo: Optional[bool] = None

class TipoAccesoCustomSalida(TipoAccesoCustomBase):
    id: UUID
    entidad_id: UUID
    created_at: datetime
