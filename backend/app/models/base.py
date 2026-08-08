"""
Base y registro para SQLAlchemy.
Importar todos los modelos aquí para que Alembic los detecte correctamente
cuando importe `Base.metadata`.
"""
from app.core.database import Base

from app.models.enums import RolTipo, MembresiaEstado, QRTipo, AccesoTipo, InfraccionTipo, InfraccionEstado, SolicitudEstado
from app.models.configuracion import ConfiguracionSistema
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.entidad_civil import EntidadCivil
from app.models.usuario import Usuario
from app.models.vehiculo import Vehiculo
from app.models.membresia import Membresia
from app.models.codigo_qr import CodigoQR
from app.models.acceso import Acceso
from app.models.infraccion import Infraccion
from app.models.alcabala_evento import PuntoAcceso, SolicitudEvento, LotePaseMasivo, GuardiaTurno

# Modelos v2.0
from app.models.tipo_acceso_custom import TipoAccesoCustom
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from app.models.asignacion_zona import AsignacionZona
from app.models.plantilla_carnet import PlantillaCarnet
from app.models.mensaje_broadcast import MensajeBroadcast
from app.models.vehiculo_pase import VehiculoPase
from app.models.incentivo_parquero import IncentivoParquero
from app.models.sancion_parquero import SancionParquero
from app.models.credencial_biometrica import CredencialBiometrica
from app.models.challenge_biometrico import ChallengeBiometrico
from app.models.push_subscription import PushSubscription
from app.models.configuracion_correo import ConfiguracionCorreo

# Modelos ANPR — control de acceso por lectura de placas en alcabalas
from app.models.evento_anpr import EventoAnpr
from app.models.destino_alcabala import DestinoAlcabala
from app.models.camara_anpr import CamaraAnpr
from app.models.pantalla_monitor import PantallaMonitor

# Modelos Combustible Aegis Fuel v8.0
from app.models.tanque_combustible import TanqueCombustible
from app.models.lectura_tanque import LecturaTanque
from app.models.solicitud_combustible import SolicitudCombustible
from app.models.abastecimiento import Abastecimiento
