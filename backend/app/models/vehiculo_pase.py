"""
Modelo VehiculoPase.
Para manejar los pases multi-vehículo, permitiendo a VIPS o miembros del Staff registrar varios vehículos bajo un solo pase (QR).
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class VehiculoPase(Base):
    __tablename__ = "vehiculos_pase"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    qr_id = Column(UUID(as_uuid=True), ForeignKey("codigos_qr.id", ondelete="CASCADE"), nullable=True, index=True)  # nullable para registros manuales por placa
    
    placa = Column(String(20), nullable=False)
    marca = Column(String(50), nullable=True)
    modelo = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    
    zona_asignada_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="RESTRICT"), nullable=True)
    puesto_asignado_id = Column(UUID(as_uuid=True), ForeignKey("puestos_estacionamiento.id", ondelete="SET NULL"), nullable=True)
    
    ingresado = Column(Boolean, default=False, nullable=False)
    hora_ingreso = Column(DateTime(timezone=True), nullable=True)
    hora_salida = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    puesto_asignado = relationship("PuestoEstacionamiento", foreign_keys=[puesto_asignado_id], lazy="selectin")
    codigo_qr = relationship("CodigoQR", lazy="selectin", back_populates="vehiculos_adicionales")

    @property
    def tipo_pase(self):
        if not self.codigo_qr:
            return "SOCIO PERMANENTE" if not self.qr_id else "GENERAL"
        if self.codigo_qr.tipo_acceso_custom:
            return self.codigo_qr.tipo_acceso_custom.nombre.upper()
        return self.codigo_qr.tipo_acceso.value.upper() if self.codigo_qr.tipo_acceso else "GENERAL"
