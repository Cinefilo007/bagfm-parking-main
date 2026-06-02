"""
Modelo Abastecimiento.
Registra la bitácora e histórico de cada suministro de combustible realizado.
"""
import uuid
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Text, Boolean, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class Abastecimiento(Base):
    __tablename__ = "abastecimientos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehiculo_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos.id", ondelete="RESTRICT"), nullable=False)
    bombero_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    tanque_id = Column(UUID(as_uuid=True), ForeignKey("tanques_combustible.id", ondelete="RESTRICT"), nullable=False)
    
    kilometraje_anterior = Column(Integer, nullable=False)
    kilometraje_actual = Column(Integer, nullable=False)
    cantidad_abastecida = Column(Float, nullable=False)
    
    foto_kilometraje_url = Column(Text, nullable=False)
    foto_maquina_url = Column(Text, nullable=False)
    datos_ia_ocr = Column(JSON, nullable=True)
    tiene_alerta = Column(Boolean, default=False, nullable=False)
    
    solicitud_aprobacion_id = Column(UUID(as_uuid=True), ForeignKey("solicitudes_combustible.id", ondelete="SET NULL"), nullable=True)
    conductor = Column(String(100), nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    vehiculo = relationship("Vehiculo", foreign_keys=[vehiculo_id], backref="abastecimientos")
    bombero = relationship("Usuario", foreign_keys=[bombero_id], backref="abastecimientos_realizados")
    tanque = relationship("TanqueCombustible", foreign_keys=[tanque_id], backref="abastecimientos")
    solicitud_aprobacion = relationship("SolicitudCombustible", foreign_keys=[solicitud_aprobacion_id], backref="abastecimiento_vinculado")
