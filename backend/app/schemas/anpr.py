from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnprDireccion, AnprEstado


class DestinoSalida(BaseModel):
    id: UUID
    nombre: str
    slug: str
    icono: Optional[str] = None
    orden: int
    requiere_texto_libre: bool

    model_config = ConfigDict(from_attributes=True)


class EventoAnprSalida(BaseModel):
    id: UUID
    punto_acceso_id: UUID
    placa: str
    placa_confianza: Optional[int] = None
    direccion: AnprDireccion
    tipo_vehiculo: Optional[str] = None
    color_vehiculo: Optional[str] = None
    marca_vehiculo: Optional[str] = None
    timestamp_camara: Optional[datetime] = None
    timestamp_recibido: datetime
    coincidencia: Optional[str] = None
    estado: AnprEstado
    acceso_id: Optional[UUID] = None

    # URLs de las fotos. No se sirven como estáticos: son enlaces a un endpoint que
    # exige sesión, porque son fotos de civiles.
    foto_placa_url: Optional[str] = None
    foto_escena_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ResolverEvento(BaseModel):
    """Lo que manda el guardia al tocar un destino."""
    destino_id: UUID
    observaciones: Optional[str] = None
    # La cámara acierta ~98.5%; el guardia corrige el resto sin salir de la pantalla.
    placa_corregida: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Administración de cámaras
# ──────────────────────────────────────────────────────────────────────────────

class CamaraCrear(BaseModel):
    nombre: str = Field(min_length=3, max_length=150)
    punto_acceso_id: UUID
    modelo: Optional[str] = Field(default=None, max_length=100)
    serial: Optional[str] = Field(default=None, max_length=100)
    ip_lan: Optional[str] = Field(default=None, max_length=45)
    notas: Optional[str] = Field(default=None, max_length=500)


class CamaraEditar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=3, max_length=150)
    punto_acceso_id: Optional[UUID] = None
    modelo: Optional[str] = Field(default=None, max_length=100)
    serial: Optional[str] = Field(default=None, max_length=100)
    ip_lan: Optional[str] = Field(default=None, max_length=45)
    notas: Optional[str] = Field(default=None, max_length=500)
    activa: Optional[bool] = None


class CamaraSalida(BaseModel):
    id: UUID
    nombre: str
    punto_acceso_id: UUID
    punto_nombre: Optional[str] = None
    modelo: Optional[str] = None
    serial: Optional[str] = None
    ip_lan: Optional[str] = None
    notas: Optional[str] = None
    activa: bool

    # El token nunca sale de aquí: solo si existe y sus últimos caracteres, para
    # poder distinguirlo en pantalla.
    tiene_token: bool = False
    token_pista: Optional[str] = None
    token_generado_at: Optional[datetime] = None

    ultimo_evento_at: Optional[datetime] = None
    total_eventos: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CamaraConToken(BaseModel):
    """
    Respuesta de crear o rotar el token.

    Es la ÚNICA vez que el token viaja en claro. En la base solo queda su hash, así
    que si no se copia ahora, no se recupera: se rota y se vuelve a configurar la
    cámara. Es a propósito.
    """
    camara: CamaraSalida
    token: str
    url_ingesta: str


class PaginatedEventosAnpr(BaseModel):
    items: List[EventoAnprSalida]
    total: int
    page: int
    size: int
