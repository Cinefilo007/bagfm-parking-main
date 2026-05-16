from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class PaseBaseCrear(BaseModel):
    zona_id: UUID
    # Si modo_portal=True el comandante no llena estos campos; los completa el portador desde el link
    modo_portal: bool = False
    nombre_portador: Optional[str] = None   # Requerido cuando modo_portal=False (validado en servicio)
    cedula_portador: Optional[str] = None
    telefono_portador: Optional[str] = None
    email_portador: Optional[str] = None
    vehiculo_placa: Optional[str] = None    # Requerido cuando modo_portal=False (validado en servicio)
    vehiculo_marca: Optional[str] = None
    vehiculo_modelo: Optional[str] = None
    vehiculo_color: Optional[str] = None
    es_permanente: bool = False
    dias_vigencia: int = 1
    fecha_inicio: Optional[datetime] = None      # Fecha de inicio de vigencia
    fecha_expiracion: Optional[datetime] = None  # Fecha fin personalizada (override)

class PuestoDetallePase(BaseModel):
    id: str
    nombre_portador: str
    vehiculo_placa: str
    vehiculo_marca: str
    vehiculo_modelo: str
    serial_legible: str
    token: str              # JWT firmado — requerido para generar el QR en el frontend
    fecha_inicio: Optional[datetime] = None      # Inicio de vigencia
    fecha_expiracion: Optional[datetime] = None  # Fin de vigencia

class PuestoReservadoSalida(BaseModel):
    id: str
    numero_puesto: str
    zona_id: str
    zona_nombre: Optional[str] = ""
    estado: str
    virtual: Optional[bool] = False
    detalle_pase: Optional[PuestoDetallePase] = None
    model_config = ConfigDict(from_attributes=True)
