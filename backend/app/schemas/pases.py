from pydantic import BaseModel, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime, date
from typing import Optional, List, Any
from app.models.enums import PasseTipo
from app.schemas.zona_estacionamiento import ZonaEstacionamientoSalida

class LotePaseMasivoBase(BaseModel):
    nombre_evento: str
    tipo_pase: PasseTipo
    fecha_inicio: date
    fecha_fin: date
    cantidad_pases: int
    max_accesos_por_pase: Optional[int] = None

class LotePaseMasivoCrear(LotePaseMasivoBase):
    tipo_acceso: Optional[str] = "general"
    tipo_acceso_custom_id: Optional[UUID] = None
    zona_id: Optional[UUID] = None
    zona_asignada_id: Optional[UUID] = None # Alias para compatibilidad frontend
    puesto_id: Optional[UUID] = None
    puesto_asignado_id: Optional[UUID] = None # Alias para compatibilidad frontend
    multi_vehiculo: bool = False
    max_vehiculos: Optional[int] = 1
    excel_data: Optional[List[List[Any]]] = None
    distribucion_automatic: Optional[bool] = False # Deprecated but kept for safety
    distribucion_automatica: Optional[bool] = False

    @field_validator('tipo_acceso_custom_id', 'zona_id', 'zona_asignada_id', 'puesto_id', 'puesto_asignado_id', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v

class LotePaseMasivoSalida(LotePaseMasivoBase):
    id: UUID
    codigo_serial: str
    creado_por: UUID
    created_at: datetime
    zip_generado: bool
    zip_url: Optional[str] = None
    zip_listo_at: Optional[datetime] = None
    tipo_acceso: str = "general"
    tipo_acceso_custom_id: Optional[UUID] = None
    zona_nombre: Optional[str] = None
    tipo_custom_label: Optional[str] = None
    pases_usados: Optional[int] = 0
    zona_asignada: Optional[ZonaEstacionamientoSalida] = None

    
    model_config = ConfigDict(from_attributes=True)

class VehiculoPaseBase(BaseModel):
    qr_id: UUID
    placa: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    zona_asignada_id: Optional[UUID] = None
    puesto_asignado_id: Optional[UUID] = None
    ingresado: bool = False
    hora_ingreso: Optional[datetime] = None

class VehiculoPaseSalida(VehiculoPaseBase):
    id: UUID
    tipo_pase: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class LotePaseMasivoEnvioCorreo(BaseModel):
    asunto: str
    cuerpo: str
    adjuntar_pdf: bool = False
    tipo_envio: str = "solo_qr" # solo_qr, carnet_pdf
    estilo_carnet: Optional[dict] = None
    formato_carnet: Optional[str] = "colgante"
