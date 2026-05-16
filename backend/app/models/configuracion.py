"""
Modelo Configuración.
Tabla para guardar párametros globales modificables en runtime.
"""
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class ConfiguracionSistema(Base):
    __tablename__ = "configuracion"

    clave = Column(String(100), primary_key=True, index=True)
    valor = Column(Text, nullable=False)
    descripcion = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
