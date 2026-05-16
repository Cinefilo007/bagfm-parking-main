from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base

class ConfiguracionCorreo(Base):
    """
    Guarda las credenciales de envío de correo electrónico.
    Si entidad_id es NULL, corresponde a la configuración general del sistema (Comando).
    Si entidad_id tiene valor, es la configuración particular de esa Entidad.
    """
    __tablename__ = "configuracion_correo"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entidad_id = Column(UUID(as_uuid=True), ForeignKey("entidades_civiles.id", ondelete="CASCADE"), nullable=True, unique=True)
    
    # Proveedor: "SMTP" o "RESEND"
    proveedor = Column(String(50), default="RESEND", nullable=False)
    
    # Campos de Resend
    api_key_resend = Column(String(255), nullable=True)
    
    # Campos genéricos / SMTP
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_user = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    
    # Remitente visual (Ej: "Acreditaciones Feria Ganadera")
    nombre_remitente = Column(String(100), nullable=True)
    # Dirección (Ej: "hola@accesosferia.com")
    email_remitente = Column(String(150), nullable=False)
    
    # Configuración activa para pausar envíos si se excede el límite
    activo = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relación a Entidad
    entidad = relationship("EntidadCivil", foreign_keys=[entidad_id])
