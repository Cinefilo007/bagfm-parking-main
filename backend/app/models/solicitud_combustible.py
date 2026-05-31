"""
Modelo SolicitudCombustible.
Registra las solicitudes de suministro de combustible para vehículos no registrados, no autorizados o con límite excedido.
"""
import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import EstadoSolicitudCombustible, TipoSolicitudCombustible

class SolicitudCombustible(Base):
    __tablename__ = "solicitudes_combustible"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    placa = Column(String(20), nullable=False)
    vehiculo_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos.id", ondelete="SET NULL"), nullable=True)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="SET NULL"), nullable=True)
    bombero_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    
    cantidad_solicitada = Column(Float, nullable=False)
    tipo_solicitud = Column(SQLEnum(TipoSolicitudCombustible, name="tipo_solicitud_comb_enum", native_enum=True), nullable=False)
    motivo = Column(Text, nullable=False)
    estado = Column(SQLEnum(EstadoSolicitudCombustible, name="estado_solicitud_comb_enum", native_enum=True), default=EstadoSolicitudCombustible.pendiente, nullable=False)
    
    nombre_conductor_manual = Column(String(200), nullable=True)
    cedula_conductor_manual = Column(String(100), nullable=True)
    marca_manual = Column(String(100), nullable=True)
    modelo_manual = Column(String(100), nullable=True)
    color_manual = Column(String(50), nullable=True)
    
    aprobado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    fecha_aprobacion = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    vehiculo = relationship("Vehiculo", foreign_keys=[vehiculo_id], backref="solicitudes_combustible")
    entidad = relationship("EntidadCivil", foreign_keys=[entidad_id], backref="solicitudes_combustible")
    bombero = relationship("Usuario", foreign_keys=[bombero_id], backref="solicitudes_combustible_creadas")
    aprobado_por = relationship("Usuario", foreign_keys=[aprobado_por_id], backref="solicitudes_combustible_aprobadas")
