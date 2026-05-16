"""
Modelo IncentivoParquero.
Registro de bonos o reconocimientos positivos otorgados a los parqueros.
"""
import uuid
from sqlalchemy import Column, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import TipoIncentivo

class IncentivoParquero(Base):
    __tablename__ = "incentivos_parquero"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parquero_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    
    tipo = Column(SQLEnum(TipoIncentivo, name="tipo_incentivo", native_enum=True), nullable=False)
    descripcion = Column(Text, nullable=False)
    
    otorgado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
