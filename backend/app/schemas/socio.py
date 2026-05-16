from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.enums import RolTipo, MembresiaEstado
from app.schemas.vehiculo import VehiculoCrear, VehiculoSalida

class SocioBase(BaseModel):
    cedula: str
    nombre: str
    apellido: str
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    activo: bool = True
    foto_url: Optional[str] = None

class SocioCrear(SocioBase):
    password: Optional[str] = None # Si es None, el servicio usará la cédula
    entidad_id: UUID
    vehiculos: Optional[List[VehiculoCrear]] = []
    fecha_expiracion: Optional[date] = None  # Fecha de expiración de la membresía
    puestos_asignados: int = 1  # Número de puestos simultáneos en la zona

class SocioUpdate(BaseModel):
    cedula: Optional[str] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    puestos_asignados: Optional[int] = None
    fecha_expiracion: Optional[date] = None

class MembresiaProgreso(BaseModel):
    dias_restantes: int
    porcentaje: int
    vencida: bool = False
    label: Optional[str] = None

class MembresiaInfo(BaseModel):
    id: UUID
    estado: MembresiaEstado
    fecha_inicio: date
    fecha_fin: Optional[date]
    progreso: MembresiaProgreso
    puestos_asignados: int = 1

class SocioSalida(SocioBase):
    id: UUID
    entidad_id: Optional[UUID] = None
    rol: RolTipo
    nombre_completo: str
    debe_cambiar_password: bool
    created_at: datetime
    vehiculos: List[VehiculoSalida] = []
    membresia: Optional[MembresiaInfo] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Esquemas de Membresía ---

class MembresiaBase(BaseModel):
    entidad_id: UUID
    socio_id: UUID
    vehiculo_id: Optional[UUID] = None
    cupo_numero: Optional[int] = None
    estado: MembresiaEstado = MembresiaEstado.activa
    fecha_inicio: date = date.today()
    fecha_fin: Optional[date] = None
    observaciones: Optional[str] = None

class MembresiaCrear(MembresiaBase):
    pass

class MembresiaSalida(MembresiaBase):
    id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Esquema Compuesto (Socio con su Membresía activa) ---

class SocioDetalle(SocioSalida):
    membresia_activa: Optional[MembresiaSalida] = None

class SocioPortal(BaseModel):
    perfil: SocioSalida
    qr_token: str
    nombre_entidad: str
