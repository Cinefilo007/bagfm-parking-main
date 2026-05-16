"""
Modelo SancionParquero.
Registro de infracciones operativas cometidas por los parqueros.
"""
import uuid
from sqlalchemy import Column, Boolean, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import TipoSancion, EstadoSancion

class SancionParquero(Base):
    __tablename__ = "sanciones_parquero"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parquero_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    
    tipo = Column(SQLEnum(TipoSancion, name="tipo_sancion", native_enum=True), nullable=False)
    motivo = Column(Text, nullable=False)
    
    estado = Column(SQLEnum(EstadoSancion, name="estado_sancion", native_enum=True), default=EstadoSancion.activa, nullable=False, index=True)
    ejecutar_inmediato = Column(Boolean, default=False, nullable=False)
    
    sancionado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    
    resuelto_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
