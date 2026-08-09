"""
Modelo EventoAnpr.

Bitácora cruda de todo lo que ve la cámara de lectura de placas en las alcabalas.

A diferencia de `Acceso`, que solo existe cuando un acceso quedó formalmente
registrado, aquí se guarda **toda** detección: la que el guardia resolvió, la que
descartó y la que nunca atendió. Ese conjunto completo es el que sirve para detectar
patrones — un vehículo que pasa todos los martes a las 7pm es información aunque
ningún guardia haya tocado nunca su tarjeta.
"""
import uuid
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.enums import AnprDireccion, AnprEstado


class EventoAnpr(Base):
    __tablename__ = "eventos_anpr"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Origen físico de la detección
    punto_acceso_id = Column(UUID(as_uuid=True), ForeignKey("puntos_acceso.id", ondelete="RESTRICT"), nullable=False, index=True)
    # Qué cámara registrada mandó el evento. Nullable porque una cámara puede
    # eliminarse del inventario sin que sus detecciones dejen de ser válidas.
    camara_id = Column(UUID(as_uuid=True), ForeignKey("camaras_anpr.id", ondelete="SET NULL"), nullable=True, index=True)
    camara_serial = Column(String(100), nullable=True)
    canal = Column(Integer, nullable=True)

    # Lo que leyó la cámara
    placa = Column(String(20), nullable=False, index=True)
    placa_confianza = Column(Integer, nullable=True)   # 0-100 si la cámara lo reporta
    pais_placa = Column(String(50), nullable=True)
    direccion = Column(
        SQLEnum(AnprDireccion, name="anpr_direccion", native_enum=False),
        default=AnprDireccion.desconocida,
        nullable=False,
    )

    # Atributos del vehículo que la propia cámara reconoce (no requieren al guardia)
    tipo_vehiculo = Column(String(50), nullable=True)
    color_vehiculo = Column(String(50), nullable=True)
    marca_vehiculo = Column(String(50), nullable=True)

    # Fotos en el volumen privado, guardadas como referencia 'file:<ruta>'
    # (mismo formato que la evidencia de combustible — ver services/storage_local.py)
    foto_placa_path = Column(Text, nullable=True)
    foto_escena_path = Column(Text, nullable=True)

    # La cámara puede tener el reloj corrido; se guardan los dos tiempos por separado
    # para poder detectar desfases sin perder el orden real de llegada.
    timestamp_camara = Column(DateTime(timezone=True), nullable=True, index=True)
    timestamp_recibido = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Veredicto de placa_lookup.verificar_placa() en el momento de la detección.
    # Se persiste en vez de recalcularse: importa qué sabía el sistema entonces,
    # no qué sabe hoy.
    coincidencia = Column(String(30), nullable=True, index=True)

    estado = Column(
        SQLEnum(AnprEstado, name="anpr_estado", native_enum=False),
        default=AnprEstado.pendiente,
        nullable=False,
        index=True,
    )
    acceso_id = Column(UUID(as_uuid=True), ForeignKey("accesos.id", ondelete="SET NULL"), nullable=True, index=True)
    resuelto_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    resuelto_at = Column(DateTime(timezone=True), nullable=True)

    # Identificación del conductor: quién la hizo, cuándo y a qué persona se ató la
    # placa. Se guarda en la detección y no solo en `vehiculos.socio_id` porque el
    # dato que hace falta medir es el TRABAJO del turno: cuántos conductores
    # identificó este guardia entre las 08:30 de hoy y las de mañana. Mirando el
    # vehículo eso no se puede saber, porque el vehículo no recuerda cuándo ni quién
    # lo identificó.
    conductor_identificado_at = Column(DateTime(timezone=True), nullable=True, index=True)
    conductor_identificado_por = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    conductor_usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    # XML original de la cámara. Ocupa poco y permite reprocesar detecciones si más
    # adelante se descubre que se estaba ignorando un campo útil.
    payload_raw = Column(Text, nullable=True)

    __table_args__ = (
        # La consulta de la cola del guardia: pendientes de un punto, más recientes primero.
        Index("ix_eventos_anpr_punto_estado_ts", "punto_acceso_id", "estado", "timestamp_recibido"),
        # La consulta de dedupe y la de recurrencia por placa.
        Index("ix_eventos_anpr_placa_ts", "placa", "timestamp_recibido"),
    )
