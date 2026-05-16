"""
Modelo para almacenar desafíos (challenges) temporales de WebAuthn.
Los desafíos son de un solo uso y expiran rápidamente.
"""
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base

class ChallengeBiometrico(Base):
    __tablename__ = "challenges_biometricos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    
    # El desafío generado aleatoriamente
    challenge = Column(String(255), nullable=False)
    
    # Tipo: 'registro' o 'login'
    tipo = Column(String(20), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
