from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class ConfiguracionCorreoBase(BaseModel):
    proveedor: str = Field(default="RESEND", description="Proveedor SMTP o API a utilizar: 'RESEND' o 'SMTP'")
    api_key_resend: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    nombre_remitente: Optional[str] = None
    email_remitente: EmailStr
    activo: bool = True

class ConfiguracionCorreoCreate(ConfiguracionCorreoBase):
    entidad_id: Optional[UUID] = None

class ConfiguracionCorreoUpdate(BaseModel):
    proveedor: Optional[str] = None
    api_key_resend: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    nombre_remitente: Optional[str] = None
    email_remitente: Optional[EmailStr] = None
    activo: Optional[bool] = None

class ConfiguracionCorreoResponse(ConfiguracionCorreoBase):
    id: UUID
    entidad_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
