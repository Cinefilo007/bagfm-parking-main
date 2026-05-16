"""
Modelo AsignacionZona.
Asigna una capacidad específica a una Entidad dentro de una Zona compartida.
"""
import uuid
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class AsignacionZona(Base):
    __tablename__ = "asignaciones_zona"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zona_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="CASCADE"), nullable=False, index=True)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="CASCADE"), nullable=False, index=True)
    
    cupo_asignado = Column(Integer, nullable=False)
    cupo_reservado_base = Column(Integer, default=0, nullable=False)
    distribucion_cupos = Column(JSONB, default='{}', server_default='{}', nullable=False)
    notas = Column(String(500), nullable=True)
    
    fecha_inicio = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    activa = Column(Boolean, default=True, nullable=False)
    
    asignado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    # Relaciones
    zona = relationship("ZonaEstacionamiento", lazy="selectin")
    # entidad = relationship("EntidadCivil")

    @property
    def zona_nombre(self):
        return self.zona.nombre if self.zona else None

