from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class VehiculoBase(BaseModel):
    placa: str
    marca: str
    modelo: str
    color: str
    año: Optional[int] = None
    tipo: Optional[str] = None # sedan, suv, moto...

class VehiculoCrear(VehiculoBase):
    pass

class VehiculoSalida(VehiculoBase):
    id: UUID
    socio_id: UUID
    activo: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
