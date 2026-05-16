from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class EntidadCivilBase(BaseModel):
    nombre: str
    codigo_slug: Optional[str] = Field(default=None)
    zona_id: Optional[UUID] = None
    capacidad_vehiculos: int = 1
    descripcion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    activo: bool = True

class EntidadCivilCrear(EntidadCivilBase):
    # Datos del Administrador de la Entidad
    admin_cedula: str
    admin_nombre: str
    admin_apellido: str
    admin_email: str
    admin_password: str

class EntidadCivilActualizar(BaseModel):
    nombre: Optional[str] = None
    codigo_slug: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None
    admin_cedula: Optional[str] = None
    admin_nombre: Optional[str] = None
    admin_apellido: Optional[str] = None
    admin_email: Optional[str] = None
    admin_password: Optional[str] = None

class EntidadCivilSalida(EntidadCivilBase):
    id: UUID
    codigo_slug: str # En la salida siempre vendrá el slug
    created_at: datetime
    created_by: Optional[UUID] = None
    config_branding: Optional[str] = None
    
    # Métricas Operativas (Opcionales dependiendo del endpoint)
    total_usuarios: Optional[int] = 0
    total_vehiculos: Optional[int] = 0
    total_capacidad: Optional[int] = 0

    # Capacidad en tiempo real (calculada desde AsignacionZona + ZonaEstacionamiento)
    cupo_ocupacion: Optional[int] = 0
    cupo_capacidad: Optional[int] = 0

    # Datos del Administrador
    admin_cedula: Optional[str] = None
    admin_nombre: Optional[str] = None
    admin_apellido: Optional[str] = None
    admin_email: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

