"""
Modelo de Credenciales Biométricas (WebAuthn).
Permite vincular múltiples dispositivos (Passkeys) a un solo usuario.
"""
import uuid
from sqlalchemy import Column, String, Integer, LargeBinary, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base

class CredencialBiometrica(Base):
    __tablename__ = "credenciales_biometricas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    
    # ID de la credencial enviado por el navegador (unigue por dispositivo)
    credential_id = Column(String(255), unique=True, index=True, nullable=False)
    
    # Clave pública en formato bytes para verificación de firmas
    public_key = Column(LargeBinary, nullable=False)
    
    # Contador de uso para prevenir clonación de llaves
    sign_count = Column(Integer, default=0, nullable=False)
    
    # Nombre amigable para el dispositivo (ej: "iPhone de Juan", "Chrome en Windows")
    nombre_dispositivo = Column(String(100), nullable=True)
    
    # Transportes permitidos (internal, usb, nfc, ble) almacenados como texto
    transports = Column(Text, nullable=True) 

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relación
    usuario = relationship("Usuario", backref="credenciales_biometricas")
