from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class BiometricoOptionsRequest(BaseModel):
    """Solicitud inicial para registro o login."""
    cedula: Optional[str] = None # Solo necesario para login si no hay sesion

class WebAuthnRegistrationOptions(BaseModel):
    """Opciones enviadas al frontend para iniciar el registro."""
    rp: Dict[str, str]
    user: Dict[str, Any]
    challenge: str
    pubKeyCredParams: List[Dict[str, Any]]
    timeout: int
    excludeCredentials: Optional[List[Dict[str, Any]]] = None
    authenticatorSelection: Optional[Dict[str, Any]] = None
    attestation: str

class WebAuthnRegistrationVerify(BaseModel):
    """Respuesta del frontend para verificar el registro."""
    registration_response: Dict[str, Any]
    nombre_dispositivo: Optional[str] = "Dispositivo Desconocido"

class WebAuthnLoginOptions(BaseModel):
    """Opciones enviadas al frontend para iniciar el login."""
    challenge: str
    timeout: int
    rpId: str
    allowCredentials: Optional[List[Dict[str, Any]]] = None
    userVerification: str

class WebAuthnLoginVerify(BaseModel):
    """Respuesta del frontend para verificar el login."""
    cedula: str
    authentication_response: Dict[str, Any]

class CredencialBiometricaSchema(BaseModel):
    """Esquema para listar dispositivos registrados."""
    id: UUID
    nombre_dispositivo: str
    creado_en: datetime = Field(validation_alias="created_at")

    class Config:
        from_attributes = True
