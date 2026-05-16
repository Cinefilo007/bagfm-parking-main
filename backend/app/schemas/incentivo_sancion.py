"""
Schemas Pydantic para incentivos y sanciones de parqueros.
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.enums import TipoIncentivo, TipoSancion, EstadoSancion


# ─── INCENTIVOS ───────────────────────────────────────────────────────────────

class IncentivoCrear(BaseModel):
    tipo: TipoIncentivo
    descripcion: str

class IncentivoSalida(BaseModel):
    id: UUID
    parquero_id: UUID
    tipo: TipoIncentivo
    descripcion: str
    otorgado_por: UUID
    otorgado_por_nombre: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── SANCIONES ────────────────────────────────────────────────────────────────

class SancionCrear(BaseModel):
    tipo: TipoSancion
    motivo: str
    ejecutar_inmediato: bool = False

class SancionActualizar(BaseModel):
    estado: EstadoSancion

class SancionSalida(BaseModel):
    id: UUID
    parquero_id: UUID
    tipo: TipoSancion
    motivo: str
    estado: EstadoSancion
    ejecutar_inmediato: bool
    sancionado_por: UUID
    sancionado_por_nombre: Optional[str] = None
    resuelto_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── KPIs ─────────────────────────────────────────────────────────────────────

class KPIsOperativo(BaseModel):
    total_incentivos: int = 0
    total_sanciones: int = 0
    sanciones_activas: int = 0
    zona_nombre: Optional[str] = None
    zona_id: Optional[str] = None
    dias_activo: int = 0
    ultimo_incentivo: Optional[str] = None
    ultima_sancion: Optional[str] = None
    asignaciones_manuales: int = 0
