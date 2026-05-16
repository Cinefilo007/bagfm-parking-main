"""
Modelo Vehiculo.
Los vehículos registrados de los usuarios.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class Vehiculo(Base):
    __tablename__ = "vehiculos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    placa = Column(String(20), unique=True, index=True, nullable=False)
    marca = Column(String(100), nullable=False)
    modelo = Column(String(100), nullable=False)
    color = Column(String(50), nullable=False)
    año = Column(Integer, nullable=True)
    tipo = Column(String(50), nullable=True) # sedan, suv, moto...
    
    socio_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    socio = relationship("Usuario", foreign_keys=[socio_id], backref="vehiculos_asociados")
