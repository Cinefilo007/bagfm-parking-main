"""
Modelo PantallaMonitor.

Cada TV de garita registrado, con su propio token de solo lectura.

Existe para no dejar la sesión de un guardia abierta indefinidamente en una pantalla
que está a la vista de cualquiera. El token de la pantalla:

  - solo sirve para LEER el monitor de SU alcabala; no puede resolver accesos, ni
    consultar el histórico, ni ver otra garita;
  - no caduca, porque nadie va a estar reintroduciendo credenciales en un televisor;
  - se revoca desde el panel y deja de funcionar en la petición siguiente, sin
    esperar a que expire nada.

Ese último punto es la razón de que la autenticación consulte la base en cada
petición en vez de emitir un JWT de larga duración: un JWT no se puede retirar.
"""
import uuid

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.tokens import generar_token, hashear_token  # noqa: F401


class PantallaMonitor(Base):
    __tablename__ = "pantallas_monitor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    nombre = Column(String(150), nullable=False)
    punto_acceso_id = Column(UUID(as_uuid=True), ForeignKey("puntos_acceso.id", ondelete="RESTRICT"), nullable=False, index=True)
    notas = Column(String(500), nullable=True)

    token_hash = Column(String(64), nullable=True, unique=True, index=True)
    token_pista = Column(String(8), nullable=True)
    token_generado_at = Column(DateTime(timezone=True), nullable=True)

    activa = Column(Boolean, default=True, nullable=False)

    # Última vez que la pantalla pidió datos. Es lo único que delata que un TV se
    # quedó congelado o sin red, porque la pantalla no avisa de nada por sí sola.
    ultimo_acceso_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    creado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    punto_acceso = relationship("PuntoAcceso", foreign_keys=[punto_acceso_id], lazy="selectin")

    @property
    def punto_nombre(self) -> str | None:
        return self.punto_acceso.nombre if self.punto_acceso else None

    @property
    def tiene_token(self) -> bool:
        return bool(self.token_hash)
