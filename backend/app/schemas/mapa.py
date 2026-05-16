from typing import List, Optional
from pydantic import BaseModel
from .entidad_civil import EntidadCivilSalida
from .alcabala_evento import PuntoAccesoSalida
from .zona_estacionamiento import ZonaEstacionamientoSalida

class SituacionBaseSalida(BaseModel):
    entidades: List[EntidadCivilSalida]
    alcabalas: List[PuntoAccesoSalida]
    zonas_estacionamiento: List[ZonaEstacionamientoSalida]
    vehiculos_hoy: int
    alertas_activas: int
