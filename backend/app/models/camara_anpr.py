"""
Modelo CamaraAnpr.

Cada cámara de lectura de placas instalada en una alcabala, con su propio token de
ingesta administrable desde el panel del Comandante.

El token se guarda **hasheado**, nunca en claro. Se muestra una sola vez, en el
momento de generarlo: si se filtra el volcado de la base, nadie puede postear eventos
falsos al sistema. La contrapartida es que un token perdido no se recupera, se rota —
que es exactamente el comportamiento que se quiere.

Se usa SHA-256 y no bcrypt a propósito. El token no es una contraseña elegida por una
persona: son 32 bytes aleatorios, imposibles de adivinar por fuerza bruta, así que no
hace falta un hash lento. Y sí hace falta que sea determinista, porque la ingesta tiene
que encontrar la cámara buscando por el hash del token que viene en la URL.
"""
import hashlib
import secrets
import uuid

from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


def generar_token() -> str:
    """Token de ingesta nuevo. Seguro para ir en un segmento de URL."""
    return secrets.token_urlsafe(32)


def hashear_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class CamaraAnpr(Base):
    __tablename__ = "camaras_anpr"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    nombre = Column(String(150), nullable=False)
    punto_acceso_id = Column(UUID(as_uuid=True), ForeignKey("puntos_acceso.id", ondelete="RESTRICT"), nullable=False, index=True)

    # Datos de inventario. Sirven para que quien vaya a la garita sepa a qué equipo
    # va a conectarse sin tener que abrir el NVR.
    modelo = Column(String(100), nullable=True)
    serial = Column(String(100), nullable=True)
    ip_lan = Column(String(45), nullable=True)
    notas = Column(String(500), nullable=True)

    # ── Token de ingesta ──────────────────────────────────────────────────────
    token_hash = Column(String(64), nullable=True, unique=True, index=True)
    # Últimos caracteres del token, para poder distinguirlo en pantalla sin revelarlo.
    token_pista = Column(String(8), nullable=True)
    token_generado_at = Column(DateTime(timezone=True), nullable=True)
    token_generado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    activa = Column(Boolean, default=True, nullable=False)

    # Telemetría ligera para que el panel muestre si la cámara está viva. Se actualiza
    # en cada ingesta aceptada; es la única forma de saberlo, porque la comunicación
    # es de una sola dirección y el servidor nunca le pregunta nada a la cámara.
    ultimo_evento_at = Column(DateTime(timezone=True), nullable=True)
    total_eventos = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    punto_acceso = relationship("PuntoAcceso", foreign_keys=[punto_acceso_id], lazy="selectin")

    @property
    def punto_nombre(self) -> str | None:
        return self.punto_acceso.nombre if self.punto_acceso else None

    @property
    def tiene_token(self) -> bool:
        return bool(self.token_hash)
