from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnprDireccion, AnprEstado, CamaraRol, CamaraSentido


class DestinoSalida(BaseModel):
    """
    Un destino posible dentro de la base: una entidad ya registrada en el sistema.

    No hay catálogo aparte a propósito. Mantener dos listas de lo mismo garantiza que
    tarde o temprano se den de alta entidades que la alcabala no ofrece.
    """
    id: UUID
    nombre: str
    slug: str


class EventoAnprSalida(BaseModel):
    id: UUID
    punto_acceso_id: UUID
    placa: str
    placa_confianza: Optional[int] = None
    # Lo que aportó la otra cámara del par (ver services/anpr_service.py).
    camara_rol: Optional[str] = None
    placa_alterna: Optional[str] = None
    confirmada_por_rol: Optional[str] = None
    direccion: AnprDireccion
    sentido_origen: Optional[str] = None
    tipo_vehiculo: Optional[str] = None
    color_vehiculo: Optional[str] = None
    marca_vehiculo: Optional[str] = None
    timestamp_camara: Optional[datetime] = None
    timestamp_recibido: datetime
    coincidencia: Optional[str] = None
    estado: AnprEstado
    acceso_id: Optional[UUID] = None

    # Quién lo capturó, en nombres y no en identificadores. El monitor del Comandante
    # existe sobre todo para ver si las dos cámaras de un paso rinden igual, y para eso
    # "Alcabala Principal · trasera" dice algo y un UUID no. Van sueltos y no como una
    # relación porque el evento guarda la cámara con ON DELETE SET NULL: una cámara
    # retirada deja sus eventos en pie, y entonces esto queda en nulo sin romper nada.
    camara_id: Optional[UUID] = None
    camara_nombre: Optional[str] = None
    punto_nombre: Optional[str] = None

    # URLs de las fotos. No se sirven como estáticos: son enlaces a un endpoint que
    # exige sesión, porque son fotos de civiles.
    foto_placa_url: Optional[str] = None
    foto_escena_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class IdentificarConductor(BaseModel):
    """
    Datos del conductor leídos de su cédula.

    Es opcional y solo tiene sentido en vehículos particulares: los de servicio y
    protocolares los maneja gente distinta cada día, así que asociarles una persona
    sería falsear el dato.
    """
    nombre: str = Field(min_length=2, max_length=100)
    apellido: str = Field(min_length=2, max_length=100)
    cedula: str = Field(min_length=4, max_length=50)
    telefono: Optional[str] = Field(default=None, max_length=50)


class ResolverEvento(BaseModel):
    """
    Lo que manda el guardia al tocar un destino.

    Sin `destino_entidad_id` el destino se toma como "Otro" y entonces
    `observaciones` es obligatorio: un registro sin destino no aporta nada.
    """
    destino_entidad_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    # La cámara acierta ~98.5%; el guardia corrige el resto sin salir de la pantalla.
    placa_corregida: Optional[str] = None
    # Igual con el sentido: en la alcabala de carril compartido el sistema propone y el
    # guardia confirma. Solo se manda cuando lo cambia.
    sentido_corregido: Optional[AnprDireccion] = None


# ──────────────────────────────────────────────────────────────────────────────
# Administración de cámaras
# ──────────────────────────────────────────────────────────────────────────────

class CamaraCrear(BaseModel):
    nombre: str = Field(min_length=3, max_length=150)
    punto_acceso_id: UUID
    # Qué extremo del vehículo mira. En cada alcabala hay dos cámaras sobre el mismo
    # paso; sin esto no se puede distinguir una moto —que lleva una sola placa— de una
    # cámara que dejó de leer.
    rol: CamaraRol = CamaraRol.unica
    # Qué registra por su sitio en la alcabala: puerta de entrada, de salida, o carril
    # compartido (`mixto`), que es el que obliga a deducir el sentido.
    sentido: CamaraSentido = CamaraSentido.mixto
    modelo: Optional[str] = Field(default=None, max_length=100)
    serial: Optional[str] = Field(default=None, max_length=100)
    ip_lan: Optional[str] = Field(default=None, max_length=45)
    notas: Optional[str] = Field(default=None, max_length=500)


class CamaraEditar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=3, max_length=150)
    punto_acceso_id: Optional[UUID] = None
    rol: Optional[CamaraRol] = None
    sentido: Optional[CamaraSentido] = None
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
    rol: CamaraRol = CamaraRol.unica
    sentido: CamaraSentido = CamaraSentido.mixto
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


# ──────────────────────────────────────────────────────────────────────────────
# Pantallas de garita (TV)
# ──────────────────────────────────────────────────────────────────────────────

class PantallaCrear(BaseModel):
    nombre: str = Field(min_length=3, max_length=150)
    punto_acceso_id: UUID
    notas: Optional[str] = Field(default=None, max_length=500)


class PantallaEditar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=3, max_length=150)
    punto_acceso_id: Optional[UUID] = None
    notas: Optional[str] = Field(default=None, max_length=500)
    activa: Optional[bool] = None


class PantallaSalida(BaseModel):
    id: UUID
    nombre: str
    punto_acceso_id: UUID
    punto_nombre: Optional[str] = None
    notas: Optional[str] = None
    activa: bool

    tiene_token: bool = False
    token_pista: Optional[str] = None
    token_generado_at: Optional[datetime] = None
    ultimo_acceso_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PantallaConToken(BaseModel):
    """
    Respuesta de crear o rotar el token de una pantalla.

    Igual que con las cámaras, es la única vez que el token viaja en claro. La URL
    lleva el token dentro para poder dejarla como página de inicio del televisor y
    que arranque sola al encenderlo.
    """
    pantalla: PantallaSalida
    token: str
    url_monitor: str


# ──────────────────────────────────────────────────────────────────────────────
# Emparejamiento de pantallas (el televisor muestra un código, el guardia confirma)
# ──────────────────────────────────────────────────────────────────────────────

class EmparejamientoIniciado(BaseModel):
    """Lo que recibe el televisor al pedir un código."""
    codigo: str
    secreto: str          # solo lo conoce este televisor; con él recoge su credencial
    url_confirmacion: str  # lo que se codifica en el QR
    expira_at: datetime


class EmparejamientoEstado(BaseModel):
    estado: str                     # pendiente | confirmado | expirado
    token: Optional[str] = None     # solo cuando pasa a confirmado, y una sola vez
    punto_nombre: Optional[str] = None


class EmparejamientoInfo(BaseModel):
    """Lo que ve el guardia en su teléfono antes de confirmar."""
    codigo: str
    punto_nombre: Optional[str] = None
    expira_at: datetime


class EmparejamientoConfirmar(BaseModel):
    nombre: Optional[str] = Field(default=None, max_length=150)


class PaginatedEventosAnpr(BaseModel):
    items: List[EventoAnprSalida]
    total: int
    page: int
    size: int
