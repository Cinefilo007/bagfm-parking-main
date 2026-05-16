"""
Modelo CodigoQR.
Representa un código asociado a un socio, vehículo o acceso temporal.
"""
import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import QRTipo, TipoAccesoPase

class CodigoQR(Base):
    __tablename__ = "codigos_qr"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True, index=True)
    vehiculo_id = Column(UUID(as_uuid=True), ForeignKey("vehiculos.id", ondelete="RESTRICT"), nullable=True)
    membresia_id = Column(UUID(as_uuid=True), ForeignKey("membresias.id", ondelete="RESTRICT"), nullable=True)
    
    tipo = Column(SQLEnum(QRTipo, name="qr_tipo", native_enum=True), nullable=False)
    
    token = Column(Text, unique=True, index=True, nullable=False)  # El JWT firmado cifrado en BD
    fecha_expiracion = Column(DateTime(timezone=True), nullable=True)
    
    activo = Column(Boolean, default=True, nullable=False)
    
    # Manejo de Eventos Masivos
    solicitud_id = Column(UUID(as_uuid=True), ForeignKey("solicitudes_evento.id", ondelete="CASCADE"), nullable=True)
    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes_pase_masivo.id", ondelete="CASCADE"), nullable=True)
    serial_legible = Column(String(50), nullable=True) # BAGFM-26ABR-003-0042
    
    # Campos v2.0 Pases y Accesos
    tipo_acceso = Column(SQLEnum(TipoAccesoPase, name="tipo_acceso_pase", native_enum=True), default=TipoAccesoPase.general, nullable=False)
    tipo_acceso_custom_id = Column(UUID(as_uuid=True), ForeignKey("tipos_acceso_custom.id", ondelete="RESTRICT"), nullable=True)
    zona_asignada_id = Column(UUID(as_uuid=True), ForeignKey("zonas_estacionamiento.id", ondelete="RESTRICT"), nullable=True)
    puesto_asignado_id = Column(UUID(as_uuid=True), ForeignKey("puestos_estacionamiento.id", ondelete="RESTRICT"), nullable=True)
    nombre_portador = Column(String(200), nullable=True)
    cedula_portador = Column(String(20), nullable=True)
    email_portador = Column(String(200), nullable=True)
    telefono_portador = Column(String(50), nullable=True)
    vehiculo_placa = Column(String(20), nullable=True)
    vehiculo_marca = Column(String(100), nullable=True)
    vehiculo_modelo = Column(String(100), nullable=True)
    vehiculo_color = Column(String(50), nullable=True)
    multi_vehiculo = Column(Boolean, default=False, nullable=False)
    max_vehiculos = Column(Integer, default=1, nullable=False)
    datos_completos = Column(Boolean, default=False, nullable=False)
    verificado_por_parquero = Column(Boolean, default=False, nullable=False)
    hora_entrada_base = Column(DateTime(timezone=True), nullable=True)
    hora_llegada_zona = Column(DateTime(timezone=True), nullable=True)
    
    # Restricciones operativas
    accesos_usados = Column(Integer, default=0, nullable=False)
    max_accesos = Column(Integer, nullable=True) # Si es NULL, es ilimitado
    
    # Trazabilidad de Correo
    email_enviado = Column(Boolean, default=False, nullable=False)
    email_ultimo_error = Column(Text, nullable=True)
    fecha_envio_email = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=True)

    # Relaciones
    usuario = relationship("Usuario", foreign_keys=[usuario_id], lazy="selectin")
    vehiculo = relationship("Vehiculo", foreign_keys=[vehiculo_id], lazy="selectin")
    zona_asignada = relationship("ZonaEstacionamiento", foreign_keys=[zona_asignada_id], lazy="selectin")
    puesto_asignado = relationship("PuestoEstacionamiento", foreign_keys=[puesto_asignado_id], lazy="selectin")
    tipo_acceso_custom = relationship("TipoAccesoCustom", foreign_keys=[tipo_acceso_custom_id], lazy="selectin")
    vehiculos_adicionales = relationship("VehiculoPase", back_populates="codigo_qr", cascade="all, delete-orphan", lazy="selectin")

    @property
    def zona_asignada_nombre(self):
        return self.zona_asignada.nombre if self.zona_asignada else None

    @property
    def puesto_asignado_codigo(self):
        return self.puesto_asignado.numero_puesto if self.puesto_asignado else None
