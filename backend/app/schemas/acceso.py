from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import AccesoTipo
from app.schemas.usuario import UsuarioSalida
from app.schemas.vehiculo import VehiculoSalida
from app.schemas.socio import MembresiaInfo

class AccesoBase(BaseModel):
    tipo: AccesoTipo
    punto_acceso: str = "Alcabala Principal"

class AccesoValidar(BaseModel):
    """Esquema para cuando el guardia escanea el QR"""
    qr_token: str
    tipo: AccesoTipo

class AccesoRegistrar(BaseModel):
    """Confirmación final del acceso"""
    qr_id: Optional[UUID] = None
    usuario_id: Optional[UUID] = None # Puede ser nulo si es 100% manual inicial
    vehiculo_id: Optional[UUID] = None
    vehiculo_pase_id: Optional[UUID] = None
    entidad_id: Optional[UUID] = None
    tipo: AccesoTipo
    punto_acceso: str = "Alcabala Principal"
    es_manual: bool = False

    # Datos manuales de contingencia
    nombre_manual: Optional[str] = None
    cedula_manual: Optional[str] = None
    telefono_manual: Optional[str] = None
    
    # Desglose de vehículo manual
    vehiculo_placa: Optional[str] = None
    vehiculo_marca: Optional[str] = None
    vehiculo_modelo: Optional[str] = None
    vehiculo_color: Optional[str] = None

    # Destino / Motivo (Para vehículos fantasma o excepciones)
    observaciones: Optional[str] = None
    es_excepcion: bool = False

class AccesoSalida(AccesoBase):
    id: UUID
    usuario_id: Optional[UUID] = None  # Puede ser None en pases de visitantes sin registro previo
    vehiculo_id: Optional[UUID] = None
    registrado_por: UUID
    es_manual: bool
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ResultadoValidacion(BaseModel):
    """Datos que se muestran al guardia tras escanear un QR"""
    permitido: bool
    mensaje: str
    tipo_alerta: Optional[str] = "info" # info, warning, error
    
    # Datos para la ficha del socio
    socio: Optional[UsuarioSalida] = None
    vehiculo: Optional[VehiculoSalida] = None
    # Lista de vehículos del socio (para selección cuando tiene más de 1)
    vehiculos: List[VehiculoSalida] = []
    entidad_nombre: Optional[str] = None
    zona_asignada_id: Optional[UUID] = None
    zona_nombre: Optional[str] = None
    puesto_asignado_id: Optional[UUID] = None
    puesto_nombre: Optional[str] = None
    tipo_acceso: Optional[str] = None
    
    # IDs para el registro posterior
    qr_id: Optional[UUID] = None
    usuario_id: Optional[UUID] = None
    vehiculo_id: Optional[UUID] = None
    
    # Campos para pases masivos
    es_pase_masivo: bool = False
    serial_legible: Optional[str] = None
    nombre_evento: Optional[str] = None
    accesos_restantes: Optional[int] = None
    
    # Si hay infracciones relevantes
    infracciones_activas: List[dict] = []
    membresia_info: Optional[MembresiaInfo] = None
    ultima_entrada: Optional[datetime] = None
    ultima_entrada_punto: Optional[str] = None
    mensaje_adicional: Optional[str] = None
    
    # Flags de contingencia
    requiere_datos_manuales: bool = False
    es_pase_adelantado: bool = False
    
    # Control de cupos de estacionamiento (Individual)
    alerta_cupo: bool = False
    cupo_info: Optional[dict] = None  # {cupo_total, cupo_usado, cupo_libre}

    # Control de capacidad de zona (Entidad)
    alerta_capacidad_critica: bool = False
    info_capacidad_zona: Optional[dict] = None # {zona_id, cupo_total, ocupacion_actual, critico}


class EventoTactico(BaseModel):
    id: UUID
    tipo: str
    timestamp: datetime
    usuario: str
    vehiculo: str
    punto: str
    es_manual: bool
    es_pase_temporal: bool = False

class PaginatedEventos(BaseModel):
    items: List[EventoTactico]
    total: int
    page: int
    size: int
