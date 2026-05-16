"""
Modelo Infraccion.
Infracciones registradas a los vehículos por los Supervisores/Comando.
"""
import uuid
from sqlalchemy import Column, Boolean, Text, DateTime, ForeignKey, Enum as SQLEnum, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import InfraccionTipo, InfraccionEstado, GravedadInfraccion

class Infraccion(Base):
    __tablename__ = "infracciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehiculo_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos.id", ondelete="RESTRICT"), nullable=False, index=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True, index=True)
    
    reportado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    
    tipo = Column(SQLEnum(InfraccionTipo, name="infraccion_tipo", native_enum=True), nullable=False)
    gravedad = Column(SQLEnum(GravedadInfraccion, name="gravedad_infraccion", native_enum=True), default=GravedadInfraccion.moderada, nullable=False)
    
    descripcion = Column(Text, nullable=False)
    foto_url = Column(Text, nullable=True) # Legacy o foto principal
    fotos_evidencia = Column(JSON, default=list, nullable=False)
    
    bloquea_salida = Column(Boolean, default=True, nullable=False)
    bloquea_acceso_futuro = Column(Boolean, default=False, nullable=False)
    suspendido_hasta = Column(DateTime(timezone=True), nullable=True)
    
    zona_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="RESTRICT"), nullable=True)
    puesto_id = Column(UUID(as_uuid=True), ForeignKey("puestos_estacionamiento.id", ondelete="SET NULL"), nullable=True)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="RESTRICT"), nullable=True)
    
    latitud_infraccion = Column(Numeric(10, 8), nullable=True)
    longitud_infraccion = Column(Numeric(11, 8), nullable=True)
    
    estado = Column(SQLEnum(InfraccionEstado, name="infraccion_estado", native_enum=True), nullable=False, index=True)
    
    resuelta_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)
    resuelta_at = Column(DateTime(timezone=True), nullable=True)
    observaciones_resolucion = Column(Text, nullable=True)
    notas_internas = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    vehiculo = relationship("Vehiculo", backref="infracciones_asociadas")
    infractor = relationship("Usuario", foreign_keys=[usuario_id])
    reportero = relationship("Usuario", foreign_keys=[reportado_por])
    resolutor = relationship("Usuario", foreign_keys=[resuelta_por])
