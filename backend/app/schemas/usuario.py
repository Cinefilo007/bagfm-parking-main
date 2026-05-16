from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import RolTipo

class UsuarioBase(BaseModel):
    cedula: str
    nombre: str
    apellido: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    rol: RolTipo
    entidad_id: Optional[UUID] = None
    entidad_nombre: Optional[str] = None
    activo: bool = True
    foto_url: Optional[str] = None

class UsuarioCrear(UsuarioBase):
    password: str

class UsuarioSalida(UsuarioBase):
    id: UUID
    zona_asignada_id: Optional[UUID] = None
    zona_nombre: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class UsuarioUpdatePerfil(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    cedula: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None

class UsuarioActualizar(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    cedula: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    rol: Optional[RolTipo] = None
    entidad_id: Optional[UUID] = None
    zona_asignada_id: Optional[UUID] = None
