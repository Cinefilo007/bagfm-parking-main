"""
Modelo TanqueCombustible.
Registra el inventario de los tanques de combustible de la bomba.
"""
import uuid
from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.enums import TipoCombustible

class TanqueCombustible(Base):
    __tablename__ = "tanques_combustible"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    tipo_combustible = Column(SQLEnum(TipoCombustible, name="tipo_combustible_tanque", native_enum=True), nullable=False)
    capacidad_maxima = Column(Float, nullable=False)
    cantidad_actual = Column(Float, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
