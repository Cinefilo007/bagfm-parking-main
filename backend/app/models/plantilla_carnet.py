"""
Modelo PlantillaCarnet.
Permite definir plantillas HTML/CSS personalizadas para los pases generados, asociadas a una entidad o tipo de acceso.
"""
import uuid
from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

from app.models.enums import TipoCarnet, PasseTipo

class PlantillaCarnet(Base):
    __tablename__ = "plantillas_carnet"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    tipo_carnet = Column(SQLEnum(TipoCarnet, name="tipo_carnet", native_enum=True), nullable=False)
    tipo_pase = Column(SQLEnum(PasseTipo, name="passe_tipo_enum", native_enum=True), nullable=True)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="CASCADE"), nullable=True, index=True)
    
    color_primario = Column(String(7), default="#4EDEA3", nullable=False)
    color_secundario = Column(String(7), default="#0E1322", nullable=False)
    color_texto = Column(String(7), default="#FFFFFF", nullable=False)
    
    fondo_url = Column(Text, nullable=True)
    logo_url = Column(Text, nullable=True)
    
    mostrar_foto = Column(Boolean, default=True, nullable=False)
    mostrar_vehiculo = Column(Boolean, default=True, nullable=False)
    mostrar_qr = Column(Boolean, default=True, nullable=False)
    
    activo = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    # entidad = relationship("EntidadCivil")
