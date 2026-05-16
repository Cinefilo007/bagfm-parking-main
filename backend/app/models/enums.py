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
