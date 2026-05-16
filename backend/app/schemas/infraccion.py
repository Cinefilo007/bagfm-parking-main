from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import InfraccionTipo, InfraccionEstado, GravedadInfraccion

class InfraccionBase(BaseModel):
    vehiculo_id: Optional[UUID] = None
    usuario_id: Optional[UUID] = None
    tipo: InfraccionTipo
    gravedad: GravedadInfraccion = GravedadInfraccion.leve
    descripcion: str
    foto_url: Optional[str] = None
    fotos_evidencia: List[str] = []
    bloquea_salida: bool = True
    bloquea_acceso_futuro: bool = False
    zona_id: Optional[UUID] = None
    puesto_id: Optional[UUID] = None
    entidad_id: Optional[UUID] = None
    latitud_infraccion: Optional[float] = None
    longitud_infraccion: Optional[float] = None
    notas_internas: Optional[str] = None

class InfraccionCrear(InfraccionBase):
    pass

class InfraccionResolver(BaseModel):
    estado: InfraccionEstado
    observaciones_resolucion: str

class VehiculoBasico(BaseModel):
    placa: str
    marca: str
    modelo: str
    model_config = ConfigDict(from_attributes=True)

class UsuarioBasico(BaseModel):
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    rol: str
    model_config = ConfigDict(from_attributes=True)

class InfraccionSalida(InfraccionBase):
    id: UUID
    reportado_por: UUID
    estado: InfraccionEstado
    resuelta_por: Optional[UUID] = None
    resuelta_at: Optional[datetime] = None
    observaciones_resolucion: Optional[str] = None
    created_at: datetime
    
    vehiculo: Optional[VehiculoBasico] = None
    infractor: Optional[UsuarioBasico] = None
    
    model_config = ConfigDict(from_attributes=True)
