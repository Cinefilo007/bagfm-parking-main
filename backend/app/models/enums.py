"""
Definición de Enums comunes para la aplicación.
Mapean directamente a los ENUM de PostgreSQL.
"""
import enum

class RolTipo(str, enum.Enum):
    COMANDANTE = "COMANDANTE"
    ADMIN_BASE = "ADMIN_BASE"
    SUPERVISOR = "SUPERVISOR"
    ALCABALA = "ALCABALA"
    ADMIN_ENTIDAD = "ADMIN_ENTIDAD"
    SUPERVISOR_PARQUEROS = "SUPERVISOR_PARQUEROS"
    PARQUERO = "PARQUERO"
    SOCIO = "SOCIO"
    BOMBERO = "BOMBERO"
    SUPERVISOR_BOMBEROS = "SUPERVISOR_BOMBEROS"

class MembresiaEstado(str, enum.Enum):
    activa = "activa"
    suspendida = "suspendida"
    vencida = "vencida"
    exonerada = "exonerada"

class PasseTipo(str, enum.Enum):
    simple = "simple"
    identificado = "identificado"
    portal = "portal"

class TipoAccesoPase(str, enum.Enum):
    logistica = "logistica"
    prensa = "prensa"
    vip = "vip"
    general = "general"
    staff = "staff"
    artista = "artista"
    produccion = "produccion"
    base = "base"
    custom = "custom"

class QRTipo(str, enum.Enum):
    permanente = "permanente"
    temporal = "temporal"
    evento_simple = "evento_simple"
    evento_identificado = "evento_identificado"
    evento_portal = "evento_portal"

class AccesoTipo(str, enum.Enum):
    entrada = "entrada"
    salida = "salida"

class OrigenRegistro(str, enum.Enum):
    """Cómo se originó un registro de acceso. Permite separar poblaciones en los reportes."""
    qr = "qr"                # el guardia escaneó un código QR
    anpr = "anpr"            # lo detectó la cámara de lectura de placas
    manual = "manual"        # lo tecleó el guardia
    # El sistema cerró una estancia que se quedó abierta: el vehículo aparece entrando
    # otra vez sin haber salido nunca, así que la salida existió y no se detectó. La
    # HORA de estos registros no es real y por eso se marcan aparte — sin esto, o se
    # acumulan vehículos fantasma dentro de la base, o se falsean horas de salida.
    deducido = "deducido"

class AnprDireccion(str, enum.Enum):
    entrada = "entrada"
    salida = "salida"
    desconocida = "desconocida"

class AnprEstado(str, enum.Enum):
    pendiente = "pendiente"    # detectada, esperando que el guardia marque destino
    resuelto = "resuelto"      # ya generó un registro en `accesos`
    descartado = "descartado"  # falso positivo, peatón, vehículo que se devolvió
    duplicado = "duplicado"    # misma placa y punto dentro de la ventana de dedupe

class CamaraSentido(str, enum.Enum):
    """
    Qué registra una cámara por su sitio en la alcabala.

    Una alcabala tiene la puerta de entrada y la de salida separadas: ahí el sentido lo
    dice la puerta y no hay nada que deducir. La otra tiene un solo carril compartido
    por el que se entra y se sale, y esas cámaras van en `mixto`.

    La geografía manda sobre el firmware a propósito. El campo `direction` que envía la
    cámara depende de la versión y de cómo esté configurada la zona de detección; el
    lado de la garita en el que está atornillado el equipo, no.
    """
    entrada = "entrada"
    salida = "salida"
    mixto = "mixto"      # el mismo carril sirve para entrar y para salir


class CamaraRol(str, enum.Enum):
    """
    Qué extremo del vehículo mira cada cámara.

    En cada alcabala hay dos: una lee la placa delantera y otra la trasera, y las dos
    ven el mismo paso. Saber cuál es cuál importa por dos motivos:

      - Una moto lleva una sola placa, así que solo una de las dos la va a leer. Sin el
        rol, "llegó una sola lectura" es indistinguible de "una cámara está fallando".
      - Cuando ambas leen, la segunda confirma a la primera. Si discrepan en un
        carácter, saber de dónde vino cada lectura es lo que permite explicarlo.
    """
    delantera = "delantera"
    trasera = "trasera"
    unica = "unica"        # instalación de una sola cámara, o rol sin definir todavía

class InfraccionTipo(str, enum.Enum):
    mal_estacionado = "mal_estacionado"
    exceso_velocidad = "exceso_velocidad"
    conducta_indebida = "conducta_indebida"
    documentos_vencidos = "documentos_vencidos"
    colision = "colision"
    zona_prohibida = "zona_prohibida"
    acceso_no_autorizado = "acceso_no_autorizado"
    daño_propiedad = "daño_propiedad"
    abandono_vehiculo = "abandono_vehiculo"
    ruido_excesivo = "ruido_excesivo"
    vehiculo_fantasma = "vehiculo_fantasma"
    otro = "otro"

class GravedadInfraccion(str, enum.Enum):
    leve = "leve"
    moderada = "moderada"
    grave = "grave"
    critica = "critica"

class InfraccionEstado(str, enum.Enum):
    activa = "activa"
    resuelta = "resuelta"
    perdonada = "perdonada"
    en_revision = "en_revision"
    apelada = "apelada"

class SolicitudEstado(str, enum.Enum):
    pendiente = "pendiente"
    aprobada = "aprobada"
    aprobada_parcial = "aprobada_parcial"
    denegada = "denegada"

class EstadoPuesto(str, enum.Enum):
    libre = "libre"
    ocupado = "ocupado"
    reservado = "reservado"
    reservado_base = "reservado_base"
    mantenimiento = "mantenimiento"

class TipoIncentivo(str, enum.Enum):
    bono_eficiencia = "bono_eficiencia"
    reconocimiento = "reconocimiento"
    dia_libre = "dia_libre"
    ascenso = "ascenso"

class TipoSancion(str, enum.Enum):
    amonestacion = "amonestacion"
    suspension_temporal = "suspension_temporal"
    relevo_inmediato = "relevo_inmediato"
    reportar_autoridades = "reportar_autoridades"

class EstadoSancion(str, enum.Enum):
    activa = "activa"
    cumplida = "cumplida"
    apelada = "apelada"

class TipoCarnet(str, enum.Enum):
    colgante = "colgante"
    cartera = "cartera"
    ticket = "ticket"
    credencial = "credencial"

class TipoCombustible(str, enum.Enum):
    gasolina = "gasolina"
    diesel = "diesel"

class UsoVehiculo(str, enum.Enum):
    particular = "particular"
    protocolar = "protocolar"
    servicio = "servicio"

class TipoLecturaTanque(str, enum.Enum):
    inicial_semana = "inicial_semana"   # Legado: conservado por compatibilidad histórica
    apertura_dia = "apertura_dia"        # Nuevo: lectura de apertura diaria obligatoria
    cierre_dia = "cierre_dia"            # Nuevo: lectura de cierre diaria obligatoria
    recarga_externa = "recarga_externa"
    ajuste_auditoria = "ajuste_auditoria"

class EstadoSolicitudCombustible(str, enum.Enum):
    pendiente = "pendiente"
    aprobada = "aprobada"
    rechazada = "rechazada"
    consumida = "consumida"

class TipoSolicitudCombustible(str, enum.Enum):
    limite_entidad_excedido = "limite_entidad_excedido"
    vehiculo_no_autorizado = "vehiculo_no_autorizado"
    vehiculo_no_registrado = "vehiculo_no_registrado"
