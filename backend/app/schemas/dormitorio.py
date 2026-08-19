"""
Schemas del módulo Dormitorios.

Tres capas: el dormitorio (el edificio, con su sitio en el mapa), la habitación (con
sus camas y el token del QR de la puerta) y el integrante, que es una persona de
`usuarios` con un perfil militar encima.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────────────────────────────────────
# Dormitorios
# ──────────────────────────────────────────────────────────────────────────────

class DormitorioCrear(BaseModel):
    nombre: str = Field(min_length=2, max_length=150)
    codigo: Optional[str] = Field(default=None, max_length=50)
    descripcion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    responsable_usuario_id: Optional[UUID] = None


class DormitorioEditar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=150)
    codigo: Optional[str] = Field(default=None, max_length=50)
    descripcion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    responsable_usuario_id: Optional[UUID] = None
    activo: Optional[bool] = None


class DormitorioSalida(BaseModel):
    id: UUID
    nombre: str
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    responsable_usuario_id: Optional[UUID] = None
    responsable_nombre: Optional[str] = None
    activo: bool
    created_at: datetime

    total_habitaciones: int = 0
    camas_totales: int = 0
    ocupacion: int = 0

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────────────────────
# Integrantes (persona de `usuarios` + perfil militar)
# ──────────────────────────────────────────────────────────────────────────────

class VehiculoResumen(BaseModel):
    id: UUID
    placa: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class IntegranteCrear(BaseModel):
    cedula: str = Field(min_length=3, max_length=100)
    nombre: str = Field(min_length=2, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    telefono: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=255)

    grado: Optional[str] = Field(default=None, max_length=100)
    unidad: Optional[str] = Field(default=None, max_length=200)
    jefe_nombre: Optional[str] = Field(default=None, max_length=200)
    jefe_telefono: Optional[str] = Field(default=None, max_length=50)
    tiene_vehiculo: bool = False

    # Opcional: se puede dar de alta a la persona y asignarle cama después.
    habitacion_id: Optional[UUID] = None


class IntegranteEditar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    apellido: Optional[str] = Field(default=None, min_length=1, max_length=100)
    telefono: Optional[str] = Field(default=None, max_length=20)
    email: Optional[str] = Field(default=None, max_length=255)

    grado: Optional[str] = Field(default=None, max_length=100)
    unidad: Optional[str] = Field(default=None, max_length=200)
    jefe_nombre: Optional[str] = Field(default=None, max_length=200)
    jefe_telefono: Optional[str] = Field(default=None, max_length=50)
    tiene_vehiculo: Optional[bool] = None
    activo: Optional[bool] = None


class IntegranteSalida(BaseModel):
    usuario_id: UUID
    cedula: str
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    email: Optional[str] = None

    grado: Optional[str] = None
    unidad: Optional[str] = None
    jefe_nombre: Optional[str] = None
    jefe_telefono: Optional[str] = None

    # Lo que declaró la persona.
    tiene_vehiculo: bool = False
    # Lo que hay realmente a su nombre en `vehiculos`. Si las dos no coinciden, es un
    # dato en sí mismo y por eso viajan las dos separadas en vez de una sola.
    vehiculos: List[VehiculoResumen] = []

    habitacion_id: Optional[UUID] = None
    habitacion_numero: Optional[str] = None
    dormitorio_id: Optional[UUID] = None
    dormitorio_nombre: Optional[str] = None

    tiene_qr_peatonal: bool = False
    activo: bool = True

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────────────────────
# Habitaciones
# ──────────────────────────────────────────────────────────────────────────────

class HabitacionCrear(BaseModel):
    numero: str = Field(min_length=1, max_length=20)
    piso: Optional[str] = Field(default=None, max_length=20)
    camas: int = Field(default=1, ge=1, le=200)
    notas: Optional[str] = None


class HabitacionEditar(BaseModel):
    numero: Optional[str] = Field(default=None, min_length=1, max_length=20)
    piso: Optional[str] = Field(default=None, max_length=20)
    camas: Optional[int] = Field(default=None, ge=1, le=200)
    notas: Optional[str] = None
    activo: Optional[bool] = None


class HabitacionSalida(BaseModel):
    id: UUID
    dormitorio_id: UUID
    numero: str
    piso: Optional[str] = None
    camas: int
    notas: Optional[str] = None
    activo: bool
    created_at: datetime

    ocupacion: int = 0
    camas_libres: int = 0

    tiene_token: bool = False
    token_pista: Optional[str] = None
    token_generado_at: Optional[datetime] = None

    integrantes: List[IntegranteSalida] = []

    model_config = ConfigDict(from_attributes=True)


class HabitacionConToken(BaseModel):
    """
    Respuesta de generar o rotar el QR de una puerta.

    Como con las cámaras y las pantallas, es la única vez que el token viaja en claro:
    en la base solo queda su hash. `url_publica` es lo que se codifica en el QR que se
    imprime y se pega en la puerta.
    """
    habitacion: HabitacionSalida
    token: str
    url_publica: str


class DormitorioDetalle(DormitorioSalida):
    habitaciones: List[HabitacionSalida] = []


# ──────────────────────────────────────────────────────────────────────────────
# Vista pública de la puerta (sin sesión)
# ──────────────────────────────────────────────────────────────────────────────

class OcupantePublico(BaseModel):
    grado: Optional[str] = None
    nombre: str
    apellido: str
    unidad: Optional[str] = None
    telefono: Optional[str] = None
    jefe_nombre: Optional[str] = None
    jefe_telefono: Optional[str] = None


class HabitacionPublica(BaseModel):
    dormitorio: str
    habitacion: str
    piso: Optional[str] = None
    camas: int
    ocupacion: int
    ocupantes: List[OcupantePublico] = []


# ──────────────────────────────────────────────────────────────────────────────
# QR peatonal del personal sin vehículo
# ──────────────────────────────────────────────────────────────────────────────

class QrPeatonalSalida(BaseModel):
    """
    El QR que identifica en la alcabala a quien entra a pie.

    A diferencia de los tokens de dispositivo, aquí el valor sí se puede volver a
    consultar: es un JWT guardado en `codigos_qr` y el carnet se reimprime tantas veces
    como haga falta sin invalidar el anterior.
    """
    usuario_id: UUID
    nombre_completo: str
    cedula: str
    grado: Optional[str] = None
    token: str
