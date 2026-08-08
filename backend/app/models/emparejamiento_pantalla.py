"""
Modelo EmparejamientoPantalla.

Vincula un televisor a una alcabala sin que nadie teclee credenciales en él: el TV
muestra un código, el guardia lo escanea con su teléfono —donde ya tiene sesión— y
confirma. Es el mismo flujo que usan Netflix o HBO para entrar en un televisor, y
está descrito en la RFC 8628 (Device Authorization Grant).

Dos secretos distintos, con papeles distintos:

  - `codigo`: corto y legible, pensado para verse en pantalla y viajar en un QR. No
    autentica nada; solo sirve para que el guardia sepa qué está autorizando.
  - `secreto`: largo y opaco, lo conoce ÚNICAMENTE el televisor que inició el
    emparejamiento. Es lo que le permite recoger su credencial cuando el guardia
    confirma.

Esa separación es la que hace que enseñar el código en una pantalla sea inofensivo:
quien lo vea no puede reclamar la credencial, porque no tiene el secreto del aparato.

El token de la pantalla NO se guarda aquí en ningún momento. Al confirmar solo se
anota qué pantalla se creó; el token se genera cuando el televisor viene a
recogerlo y de él solo queda el hash. Así no hay ninguna ventana en la que una
credencial en claro esté escrita en la base.
"""
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class EmparejamientoPantalla(Base):
    __tablename__ = "emparejamientos_pantalla"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    codigo = Column(String(10), nullable=False, unique=True, index=True)
    secreto_hash = Column(String(64), nullable=False, unique=True, index=True)

    # Se llena al confirmar. Mientras siga en nulo, el emparejamiento está pendiente.
    pantalla_id = Column(UUID(as_uuid=True), ForeignKey("pantallas_monitor.id", ondelete="CASCADE"), nullable=True)
    confirmado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    confirmado_at = Column(DateTime(timezone=True), nullable=True)

    # Corto a propósito: un código que se queda válido durante horas en la pantalla
    # de una garita es un código que alguien puede fotografiar y usar más tarde.
    expira_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
