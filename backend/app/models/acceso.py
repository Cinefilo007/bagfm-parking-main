"""
Modelo Acceso.
Log de entradas y salidas de la base (control de alcabala central).
"""
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import AccesoTipo

class Acceso(Base):
    __tablename__ = "accesos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Referencias de quién entró
    qr_id = Column(UUID(as_uuid=True), ForeignKey("codigos_qr.id", ondelete="SET NULL"), nullable=True) # Permite borrar pases manteniendo la bitácora
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True, index=True)
    vehiculo_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos.id", ondelete="RESTRICT"), nullable=True)
    vehiculo_pase_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos_pase.id", ondelete="SET NULL"), nullable=True)
    
    tipo = Column(SQLEnum(AccesoTipo, name="acceso_tipo", native_enum=True), nullable=False)
    
    punto_acceso = Column(String(100), nullable=False) # ej: "Alcabala Principal"
    registrado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True)
    es_manual = Column(Boolean, default=False, nullable=False)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Datos de contingencia / Registro manual (Vehículos Fantasma)
    # SOP: Aegis Tactical v2.2 - Trazabilidad de Contingencia
    nombre_manual = Column(String(200), nullable=True)
    cedula_manual = Column(String(50), nullable=True)
    telefono_manual = Column(String(50), nullable=True)
    
    vehiculo_placa = Column(String(20), nullable=True, index=True)
    vehiculo_marca = Column(String(50), nullable=True)
    vehiculo_modelo = Column(String(50), nullable=True)
    vehiculo_color = Column(String(50), nullable=True)

    observaciones = Column(String(500), nullable=True) # Destino declarado / Motivo excepción
    es_excepcion = Column(Boolean, default=False, nullable=False)
    
    # Zona de destino del acceso — persistida en el momento del registro.
    # Para socios permanentes: resuelta desde membresia.zona_id o asignaciones_zona.
    # Para pases masivos: resuelta desde codigos_qr.zona_asignada_id o lote.zona_estacionamiento_id.
    # Permite filtrar historial de parquero por zona de forma estable (no depende del QR actual).
    zona_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="SET NULL"), nullable=True, index=True) # Flag para alertas tácticas

    # Relaciones

    # Relaciones
    # qr = relationship("CodigoQR", back_populates="accesos")
    # visitante = relationship("Usuario", foreign_keys=[usuario_id])
    # vehiculo = relationship("Vehiculo")
    # registrador = relationship("Usuario", foreign_keys=[registrado_por])
