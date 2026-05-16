"""
Modelo PuestoEstacionamiento.
Para Zonas que usen puestos individuales y no solo capacidad por contadores.
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import EstadoPuesto

class PuestoEstacionamiento(Base):
    __tablename__ = "puestos_estacionamiento"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zona_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="CASCADE"), nullable=False, index=True)
    numero_puesto = Column(String(20), nullable=False)
    
    estado = Column(SQLEnum(EstadoPuesto, name="estado_puesto", native_enum=True), default=EstadoPuesto.libre, nullable=False, index=True)
    
    reservado_base = Column(Boolean, default=False, nullable=False)
    reservado_entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="SET NULL"), nullable=True)
    
    latitud = Column(String(50), nullable=True)
    longitud = Column(String(50), nullable=True)
    
    vehiculo_actual_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos.id", ondelete="SET NULL"), nullable=True)
    qr_actual_id = Column(UUID(as_uuid=True), ForeignKey("codigos_qr.id", ondelete="SET NULL"), nullable=True)
    
    registrado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    reservado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    tipo_acceso_id = Column(UUID(as_uuid=True), ForeignKey("tipos_acceso_custom.id", ondelete="SET NULL"), nullable=True)
    
    ocupado_desde = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    zona = relationship("ZonaEstacionamiento", lazy="selectin")
    tipo_acceso = relationship("TipoAccesoCustom", lazy="selectin")

    @property
    def zona_nombre(self):
        return self.zona.nombre if self.zona else None

    @property
    def tipo_acceso_nombre(self):
        return self.tipo_acceso.nombre if self.tipo_acceso else None
