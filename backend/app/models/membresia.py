"""
Modelo Membresia.
Representa la relación (concesión de cupo) entre un Socio y una EntidadCivil.
"""
import uuid
from sqlalchemy import Column, Integer, Date, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import MembresiaEstado

class Membresia(Base):
    __tablename__ = "membresias"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    socio_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    vehiculo_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos.id", ondelete="RESTRICT"), nullable=True)
    
    # Campo opcional para puestos pre-asignados
    cupo_numero = Column(Integer, nullable=True)
    # Puestos de estacionamiento simultáneos asignados a este socio
    puestos_asignados = Column(Integer, nullable=False, default=1, server_default="1")
    
    # Zona de estacionamiento asignada a este socio específicamente (override).
    # Si es NULL, el sistema resuelve la zona de la entidad automáticamente.
    # Si la entidad tiene solo 1 zona activa → se usa esa. Si tiene varias → requiere asignación explícita.
    zona_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="SET NULL"), nullable=True)
    
    estado = Column(SQLEnum(MembresiaEstado, name="membresia_estado", native_enum=True), nullable=False)
    
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=True)  # Null = Indefinida
    
    observaciones = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relaciones
    # socio = relationship("Usuario", foreign_keys=[socio_id], back_populates="membresias")
    # entidad = relationship("EntidadCivil", back_populates="membresias")
    # vehiculo = relationship("Vehiculo", back_populates="membresias")
    # creador = relationship("Usuario", foreign_keys=[created_by])
    # codigos_qr = relationship("CodigoQR", back_populates="membresia")
