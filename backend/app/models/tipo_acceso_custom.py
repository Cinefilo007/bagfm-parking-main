"""
Modelo TipoAccesoCustom.
Para que cada entidad pueda definir sus propios tipos de acceso (ej: Logística VIP, Staff Tarima).
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class TipoAccesoCustom(Base):
    __tablename__ = "tipos_acceso_custom"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    color_hex = Column(String(7), default="#FFFFFF", nullable=False)
    nivel_prioridad = Column(Integer, default=0, nullable=False)
    
    # Configuración de Identidad Visual para Pases (v2.4)
    plantilla_layout = Column(String(50), default="qr", nullable=False) # qr, colgante, credencial, ticket, cartera
    color_preset = Column(String(50), default="aegis", nullable=False) # aegis, militar, civil, vip, alfa
    
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    # entidad = relationship("EntidadCivil")
