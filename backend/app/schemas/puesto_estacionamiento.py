from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import EstadoPuesto

class PuestoEstacionamientoBase(BaseModel):
    numero_puesto: str
    estado: EstadoPuesto = EstadoPuesto.libre
    reservado_base: bool = False
    reservado_entidad_id: Optional[UUID] = None
    latitud: Optional[str] = None
    longitud: Optional[str] = None

class PuestoEstacionamientoCrear(PuestoEstacionamientoBase):
    pass

class PuestoEstacionamientoActualizar(BaseModel):
    numero_puesto: Optional[str] = None
    estado: Optional[EstadoPuesto] = None
    reservado_base: Optional[bool] = None
    latitud: Optional[str] = None
    longitud: Optional[str] = None

class PuestoEstacionamientoSalida(PuestoEstacionamientoBase):
    id: UUID
    zona_id: UUID
    zona_nombre: Optional[str] = None
    tipo_acceso_id: Optional[UUID] = None
    tipo_acceso_nombre: Optional[str] = None
    vehiculo_actual_id: Optional[UUID] = None
    qr_actual_id: Optional[UUID] = None
    ocupado_desde: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
