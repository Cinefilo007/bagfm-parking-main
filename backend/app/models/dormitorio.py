"""
Modelos Dormitorio y Habitacion.

La base tiene alojamiento para su personal y hasta ahora el sistema no sabía nada de
él: sabía cómo se desplaza la gente (placas, QR, accesos) pero no dónde duerme. Estas
dos tablas cierran ese hueco y son el ancla del censo de personas — cada integrante que
se registra en una habitación termina siendo una fila de `usuarios`, que es lo que
permite atarlo después a sus vehículos.

La habitación lleva su propio token porque en su puerta va pegado un QR: quien lo
escanea abre la ficha de quienes la ocupan sin necesidad de tener cuenta. El token se
guarda hasheado, igual que el de las pantallas de garita y por el mismo motivo — se
revoca desde el panel y deja de servir en la petición siguiente.
"""
import uuid

from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Dormitorio(Base):
    __tablename__ = "dormitorios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    nombre = Column(String(150), nullable=False)
    codigo = Column(String(50), unique=True, index=True, nullable=True)
    descripcion = Column(Text, nullable=True)

    # Mismos tipos que `entidades_civiles` y `puntos_acceso`: el mapa táctico los pinta
    # con el mismo código y una precisión distinta se notaría al arrastrar el pin.
    latitud = Column(Numeric(10, 8), nullable=True)
    longitud = Column(Numeric(11, 8), nullable=True)

    responsable_usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    habitaciones = relationship(
        "Habitacion",
        back_populates="dormitorio",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    responsable = relationship("Usuario", foreign_keys=[responsable_usuario_id], lazy="selectin")

    @property
    def total_habitaciones(self) -> int:
        return len([h for h in self.habitaciones if h.activo])

    @property
    def camas_totales(self) -> int:
        return sum(h.camas for h in self.habitaciones if h.activo)

    @property
    def ocupacion(self) -> int:
        return sum(h.ocupacion for h in self.habitaciones if h.activo)


class Habitacion(Base):
    __tablename__ = "habitaciones"
    __table_args__ = (
        # Dos "104" en el mismo dormitorio no son dos habitaciones, son un error de
        # tecleo: el número es lo único que el guardia y el residente usan para nombrarla.
        UniqueConstraint("dormitorio_id", "numero", name="uq_habitacion_dormitorio_numero"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    dormitorio_id = Column(UUID(as_uuid=True), ForeignKey("dormitorios.id", ondelete="CASCADE"), nullable=False, index=True)
    numero = Column(String(20), nullable=False)
    piso = Column(String(20), nullable=True)

    # Capacidad física. La ocupación no puede pasarla: si hace falta una cama más, se
    # cambia el número aquí, no se mete a alguien de más sin que quede constancia.
    camas = Column(Integer, nullable=False, default=1)
    notas = Column(Text, nullable=True)

    # QR de la puerta. Mismo esquema que `pantallas_monitor`: solo el hash vive en la
    # base, el token en claro se enseña una vez al generarlo.
    token_hash = Column(String(64), nullable=True, unique=True, index=True)
    token_pista = Column(String(8), nullable=True)
    token_generado_at = Column(DateTime(timezone=True), nullable=True)

    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    dormitorio = relationship("Dormitorio", back_populates="habitaciones", lazy="selectin")
    ocupantes = relationship(
        "PerfilMilitar",
        back_populates="habitacion",
        lazy="selectin",
    )

    @property
    def ocupacion(self) -> int:
        return len([p for p in self.ocupantes if p.activo])

    @property
    def camas_libres(self) -> int:
        return max(0, self.camas - self.ocupacion)

    @property
    def tiene_token(self) -> bool:
        return bool(self.token_hash)
