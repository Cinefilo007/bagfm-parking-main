"""
Modelo MensajeBroadcast.
Almacena el historial de mensajes de difusión (Push + WS) enviados por Comandantes o Supervisores.
"""
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON

class MensajeBroadcast(Base):
    __tablename__ = "mensajes_broadcast"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="CASCADE"), nullable=False, index=True)
    enviado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    mensaje = Column(Text, nullable=False)
    destinatarios = Column(String(50), default="todos", nullable=False) # 'todos', 'zona:{id}', 'parquero:{id}'
    leido_por = Column(JSON, default=list, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    # emisor = relationship("Usuario")
