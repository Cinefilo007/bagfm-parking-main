"""
Modelo LecturaTanque.
Almacena las mediciones e inventarios iniciales de combustible declarados por el bombero.
"""
import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import TipoLecturaTanque

class LecturaTanque(Base):
    __tablename__ = "lecturas_tanque"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tanque_id = Column(UUID(as_uuid=True), ForeignKey("tanques_combustible.id", ondelete="RESTRICT"), nullable=False)
    bombero_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    tipo_lectura = Column(SQLEnum(TipoLecturaTanque, name="tipo_lectura_tanque_enum", native_enum=True), default=TipoLecturaTanque.inicial_semana, nullable=False)
    cantidad_medida = Column(Float, nullable=False)
    observaciones = Column(String(500), nullable=True)
    
    fecha = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Corrección del administrador. cantidad_original es lo que declaró el bombero y
    # solo se rellena la primera vez: ver la apertura existe para auditarle, y
    # sobrescribir sin guardarla borraría justo esa prueba.
    cantidad_original = Column(Float, nullable=True)
    corregida_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    corregida_at = Column(DateTime(timezone=True), nullable=True)
    motivo_correccion = Column(String(300), nullable=True)

    # Relaciones
    tanque = relationship("TanqueCombustible", foreign_keys=[tanque_id], backref="lecturas")
    bombero = relationship("Usuario", foreign_keys=[bombero_id], backref="lecturas_realizadas")
    corregida_por = relationship("Usuario", foreign_keys=[corregida_por_id])
