"""
Modelo Vehiculo.
Los vehículos registrados de los usuarios.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import UsoVehiculo, TipoCombustible

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
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="RESTRICT"), nullable=True)
    
    uso_vehiculo = Column(SQLEnum(UsoVehiculo, name="uso_vehiculo_tipo", native_enum=True), default=UsoVehiculo.particular, nullable=False)
    autorizado_combustible = Column(Boolean, default=False, nullable=False)
    tipo_combustible = Column(SQLEnum(TipoCombustible, name="tipo_combustible_enum", native_enum=True), default=TipoCombustible.gasolina, nullable=False)
    capacidad_tanque = Column(Float, default=0.0, nullable=False)
    asignacion_combustible_semanal = Column(Float, default=0.0, nullable=False)
    ultimo_kilometraje = Column(Integer, default=0, nullable=False)
    
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    socio = relationship("Usuario", foreign_keys=[socio_id], backref="vehiculos_asociados")
    entidad = relationship("EntidadCivil", foreign_keys=[entidad_id], backref="vehiculos_asociados_entidad")
