from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import QRTipo

class VehiculoPaseSalida(BaseModel):
    id: UUID
    placa: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    ingresado: bool
    hora_ingreso: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class CodigoQRBase(BaseModel):
    tipo: QRTipo
    activo: bool = True

class CodigoQRCrear(CodigoQRBase):
    usuario_id: UUID
    vehiculo_id: Optional[UUID] = None
    membresia_id: Optional[UUID] = None
    solicitud_id: Optional[UUID] = None
    fecha_expiracion: Optional[datetime] = None

class CodigoQRSalida(CodigoQRBase):
    id: UUID
    usuario_id: Optional[UUID] = None
    vehiculo_id: Optional[UUID] = None
    serial_legible: Optional[str] = None
    token: str
    fecha_expiracion: Optional[datetime] = None
    tipo_acceso: Optional[str] = "general"
    nombre_portador: Optional[str] = None
    cedula_portador: Optional[str] = None
    email_portador: Optional[str] = None
    telefono_portador: Optional[str] = None
    vehiculo_placa: Optional[str] = None
    vehiculo_marca: Optional[str] = None
    vehiculo_modelo: Optional[str] = None
    vehiculo_color: Optional[str] = None
    multi_vehiculo: bool = False
    vehiculos_adicionales: List["VehiculoPaseSalida"] = []
    zona_asignada_id: Optional[UUID] = None
    zona_asignada_nombre: Optional[str] = None
    puesto_asignado_id: Optional[UUID] = None
    puesto_asignado_codigo: Optional[str] = None
    hora_entrada_base: Optional[datetime] = None
    hora_llegada_zona: Optional[datetime] = None
    email_enviado: bool = False
    email_ultimo_error: Optional[str] = None
    fecha_envio_email: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class CodigoQRUpdate(BaseModel):
    nombre_portador: Optional[str] = None
    cedula_portador: Optional[str] = None
    email_portador: Optional[str] = None
    telefono_portador: Optional[str] = None
    vehiculo_placa: Optional[str] = None
    vehiculo_marca: Optional[str] = None
    vehiculo_modelo: Optional[str] = None
    vehiculo_color: Optional[str] = None
    activo: Optional[bool] = None
    vehiculos_adicionales: Optional[List[dict]] = None

    model_config = ConfigDict(from_attributes=True)
