"""
Modelo Usuario.
Todas las personas registradas en el sistema, desde el Comandante hasta los Socios.
"""
import uuid
from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import RolTipo

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cedula = Column(String(100), unique=True, index=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    telefono = Column(String(20), nullable=True)
    
    rol = Column(SQLEnum(RolTipo, name="rol_tipo", native_enum=True), nullable=False)
    
    # Para ADMIN_ENTIDAD, PARQUERO, SOCIO
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="RESTRICT"), nullable=True)
    
    # Para PARQUERO
    zona_asignada_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="RESTRICT"), nullable=True)
    
    is_deleted = Column(Boolean, default=False, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    foto_url = Column(Text, nullable=True)
    password_hash = Column(Text, nullable=False)
    debe_cambiar_password = Column(Boolean, default=False, nullable=False)
    expira_at = Column(DateTime(timezone=True), nullable=True) # Para guardias temporales de 24h
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombre} {self.apellido}"

    # Relaciones
    entidad_pertenece = relationship("EntidadCivil", foreign_keys=[entidad_id], back_populates="usuarios")
    zona_asignada = relationship("ZonaEstacionamiento", foreign_keys=[zona_asignada_id], lazy="selectin")

    # Atributos dinámicos (no persistidos, usados por services para enriquecer respuestas)
    @property
    def zona_nombre(self) -> str:
        return self.zona_asignada.nombre if self.zona_asignada else None
