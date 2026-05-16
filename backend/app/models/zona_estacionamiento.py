"""
Modelo ZonaEstacionamiento.
Áreas físicas de la base.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class ZonaEstacionamiento(Base):
    __tablename__ = "zonas_estacionamiento"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(200), nullable=False)
    capacidad_total = Column(Integer, nullable=False)
    ocupacion_actual = Column(Integer, default=0, nullable=False)
    usa_puestos_identificados = Column(Boolean, default=False, nullable=False)
    tipo = Column(String(50), nullable=True) # abierto/techado/subterraneo
    descripcion_ubicacion = Column(Text, nullable=True)
    latitud = Column(Numeric(10, 8), nullable=True)
    longitud = Column(Numeric(11, 8), nullable=True)
    
    # Soporte para Referencia Avanzada (Aegis Tactical v2.3)
    poligono = Column(JSONB, nullable=True) # Array de coordenadas [[lat, lon], ...]
    area_m2 = Column(Numeric(12, 2), nullable=True) # Superficie calculada
    capacidad_sugerida_ia = Column(Integer, nullable=True) # Sugerencia de la IA

    # Persistencia de diseño Aegis Lab (v3.0)
    config_ia = Column(JSONB, nullable=True) # {angulo, patron, accesos, etc}
    grilla_tactica = Column(JSONB, nullable=True) # GeoJSON o similar con las líneas generadas

    punto_acceso_lat = Column(Numeric(10, 8), nullable=True)
    punto_acceso_lon = Column(Numeric(11, 8), nullable=True)
    radio_cobertura = Column(Integer, default=50, nullable=False)
    tiempo_limite_llegada_min = Column(Integer, default=15, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)

    # Relaciones
    # entidades = relationship("EntidadCivil", back_populates="zona", lazy="selectin")
    # accesos_zona = relationship("AccesoZona", back_populates="zona")
