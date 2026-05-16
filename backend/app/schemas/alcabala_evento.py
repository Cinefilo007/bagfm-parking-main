from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict
from app.models.enums import SolicitudEstado, PasseTipo

# --- Punto de Acceso (Alcabala) ---
class PuntoAccesoBase(BaseModel):
    nombre: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None

class PuntoAccesoCrear(PuntoAccesoBase):
    ubicacion: Optional[str] = None

class PuntoAccesoSalida(PuntoAccesoBase):
    id: UUID
    ubicacion: Optional[str] = None
    activo: bool
    clave_hoy: Optional[str] = None # Inyectado por el servicio
    usuario_nombre: Optional[str] = None # Inyectado por el servicio
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Guardia de Turno (Identificación Obligatoria) ---
class GuardiaTurnoCrear(BaseModel):
    punto_id: UUID
    grado: Optional[str] = None
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    unidad: Optional[str] = None

class GuardiaTurnoSalida(BaseModel):
    id: UUID
    punto_id: UUID
    grado: Optional[str] = None
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    unidad: Optional[str] = None
    inicio_turno: datetime
    activo: bool
    
    model_config = ConfigDict(from_attributes=True)

class PersonalActivoSalida(BaseModel):
    alcabala: str
    alcabala_id: UUID
    grado: Optional[str] = None
    nombre: str
    telefono: Optional[str] = None
    unidad: Optional[str] = None
    inicio: datetime

# --- Solicitud de Evento (Pases Masivos) ---
class SolicitudEventoBase(BaseModel):
    nombre_evento: str
    fecha_evento: date
    cantidad_solicitada: int
    motivo: str

class SolicitudEventoCrear(SolicitudEventoBase):
    entidad_id: UUID
    tipo_pase: Optional[PasseTipo] = PasseTipo.simple

class SolicitudEventoProcesar(BaseModel):
    cantidad_aprobada: int
    estado: SolicitudEstado # aprobada, aprobada_parcial, denegada
    motivo_rechazo: Optional[str] = None

class SolicitudEventoSalida(SolicitudEventoBase):
    id: UUID
    entidad_id: UUID
    solicitado_por: UUID
    cantidad_aprobada: Optional[int] = None
    estado: SolicitudEstado
    tipo_pase: PasseTipo
    lote_id: Optional[UUID] = None
    revisado_por: Optional[UUID] = None
    motivo_rechazo: Optional[str] = None
    created_at: datetime
    revisado_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
