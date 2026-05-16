"""
Modelo EntidadCivil.
Las organizaciones civiles que operan dentro de la base (Club de Pádel, Parque Miranda, etc).
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class EntidadCivil(Base):
    __tablename__ = "entidades_civiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(200), nullable=False)
    codigo_slug = Column(String(50), nullable=False, unique=True, index=True)
    zona_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="RESTRICT"), nullable=True)
    capacidad_vehiculos = Column(Integer, nullable=False, default=1)
    cuota_pases_autonoma = Column(Integer, default=0, nullable=False)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    latitud = Column(Numeric(10, 8), nullable=True)
    longitud = Column(Numeric(11, 8), nullable=True)
    config_branding = Column(Text, nullable=True) # Almacenamos JSON como texto por simplicidad o usar JSONB
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)

    # Relaciones
    usuarios = relationship("Usuario", foreign_keys="Usuario.entidad_id", back_populates="entidad_pertenece")
    asignaciones = relationship("AsignacionZona", backref="entidad", cascade="all, delete-orphan")
    # membresias = relationship("Membresia", back_populates="entidad")
    # solicitudes_evento = relationship("SolicitudEvento", back_populates="entidad")
