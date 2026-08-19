"""
Modelo PerfilMilitar.

Lo que `usuarios` no sabía decir de una persona. Esa tabla nació alrededor del socio de
club —cédula, nombre, teléfono, rol— y no tiene sitio para grado, unidad ni cadena de
mando; tanto es así que `guardias_turno` guarda grado y unidad sueltos en cada relevo
porque no había dónde ponerlos de forma permanente.

Va aparte y no como columnas nuevas en `usuarios` por dos motivos: la mayoría de las
filas de `usuarios` (socios de los clubes, portadores de pases) nunca van a tener grado
militar, y así el módulo de dormitorios crece sin tocar la tabla de la que depende todo
el sistema de autenticación.

Es una relación uno a uno: `usuario_id` es UNIQUE. La persona sigue siendo una sola
fila en `usuarios`, que es justo lo que hace que registrar a alguien aquí lo asocie
automáticamente a los vehículos que ya tenga a su nombre.
"""
import uuid

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class PerfilMilitar(Base):
    __tablename__ = "perfiles_militares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    grado = Column(String(100), nullable=True)
    unidad = Column(String(200), nullable=True)

    # El jefe directo se guarda como texto y no como FK a `usuarios` a propósito: en la
    # práctica el jefe muchas veces no está registrado en el sistema, y exigir que lo
    # esté convertiría el alta de un residente en un alta en cadena que nadie completa.
    jefe_nombre = Column(String(200), nullable=True)
    jefe_telefono = Column(String(50), nullable=True)

    # Lo que la persona DECLARA. La verdad está en `vehiculos.socio_id`, y las dos se
    # muestran juntas: quien declara no tener vehículo y aparece con placas a su nombre
    # es exactamente el patrón que este módulo existe para hacer visible.
    tiene_vehiculo = Column(Boolean, default=False, nullable=False)

    habitacion_id = Column(UUID(as_uuid=True), ForeignKey("habitaciones.id", ondelete="SET NULL"), nullable=True, index=True)
    fecha_ingreso_dormitorio = Column(DateTime(timezone=True), nullable=True)

    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    usuario = relationship("Usuario", foreign_keys=[usuario_id], lazy="selectin")
    habitacion = relationship("Habitacion", back_populates="ocupantes", lazy="selectin")
