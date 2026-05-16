from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ZonaEstacionamientoBase(BaseModel):
    nombre: str
    capacidad_total: int
    usa_puestos_identificados: bool = False
    tipo: Optional[str] = None
    descripcion_ubicacion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    poligono: Optional[List[Any]] = None
    area_m2: Optional[float] = None
    capacidad_sugerida_ia: Optional[int] = None
    punto_acceso_lat: Optional[float] = None
    punto_acceso_lon: Optional[float] = None
    radio_cobertura: int = 50
    tiempo_limite_llegada_min: int = 15
    activo: bool = True
    config_ia: Optional[dict] = None
    grilla_tactica: Optional[List[Any]] = None

class ZonaEstacionamientoCrear(ZonaEstacionamientoBase):
    pass

class ZonaEstacionamientoActualizar(BaseModel):
    nombre: Optional[str] = None
    capacidad_total: Optional[int] = None
    usa_puestos_identificados: Optional[bool] = None
    tipo: Optional[str] = None
    descripcion_ubicacion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    punto_acceso_lat: Optional[float] = None
    punto_acceso_lon: Optional[float] = None
    poligono: Optional[List[Any]] = None
    area_m2: Optional[float] = None
    capacidad_sugerida_ia: Optional[int] = None
    radio_cobertura: Optional[int] = None
    tiempo_limite_llegada_min: Optional[int] = None
    activo: Optional[bool] = None
    config_ia: Optional[dict] = None
    grilla_tactica: Optional[List[Any]] = None

class ZonaEstacionamientoSalida(ZonaEstacionamientoBase):
    id: UUID
    ocupacion_actual: int
    ocupacion_base: int = 0
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
