"""
Modelo DestinoAlcabala.

Catálogo cerrado de destinos que el guardia toca en su dispositivo para cerrar el
registro de un vehículo (Club de Pádel, Pizzería, Parque, una unidad militar...).

Es tabla propia y no `EntidadCivil` porque los destinos no son solo entidades
civiles: hay unidades militares, oficinas de trámite y un "Otro" que no corresponde
a ninguna organización. Cuando el destino sí es una entidad civil registrada,
`entidad_id` lo enlaza y así los reportes pueden cruzar visitas contra la capacidad
y los cupos que ya administra esa entidad.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class DestinoAlcabala(Base):
    __tablename__ = "destinos_alcabala"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    slug = Column(String(50), nullable=False, unique=True, index=True)

    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="SET NULL"), nullable=True)

    # Orden e icono controlan la grilla de botones del guardia. El destino más
    # frecuente debe quedar arriba a la izquierda: en una fila de vehículos, la
    # posición del botón es la diferencia entre un toque y una búsqueda visual.
    orden = Column(Integer, default=100, nullable=False)
    icono = Column(String(50), nullable=True)

    # Marca el destino "Otro", el único que pide texto libre. Es un flag y no una
    # comparación por slug para que el Comandante pueda renombrarlo sin romper el flujo.
    requiere_texto_libre = Column(Boolean, default=False, nullable=False)

    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    entidad = relationship("EntidadCivil", foreign_keys=[entidad_id], lazy="selectin")
