from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AsignacionZonaBase(BaseModel):
    entidad_id: UUID
    cupo_asignado: int
    cupo_reservado_base: int = 0
    distribucion_cupos: dict = {}
    notas: Optional[str] = None
    activa: bool = True
    fecha_fin: Optional[datetime] = None

class AsignacionZonaCrear(AsignacionZonaBase):
    zona_id: UUID

class AsignacionZonaActualizar(BaseModel):
    cupo_asignado: Optional[int] = None
    cupo_reservado_base: Optional[int] = None
    distribucion_cupos: Optional[dict] = None
    notas: Optional[str] = None
    activa: Optional[bool] = None
    fecha_fin: Optional[datetime] = None

class AsignacionZonaSalida(AsignacionZonaBase):
    id: UUID
    zona_id: UUID
    fecha_inicio: datetime
    zona_nombre: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        data = super().model_validate(obj, *args, **kwargs)
        if hasattr(obj, 'zona') and obj.zona:
            data.zona_nombre = obj.zona.nombre
        return data
