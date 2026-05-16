"""
Seguridad — BAGFM
Manejo de contraseñas (bcrypt) y tokens JWT.
"""
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import JWTError, jwt
import bcrypt
from app.core.config import obtener_config

config = obtener_config()

def hashear_password(password: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verificar_password(password_plano: str, password_hash: str) -> bool:
    """Verifica si un password coincide con su hash."""
    return bcrypt.checkpw(password_plano.encode('utf-8'), password_hash.encode('utf-8'))


def crear_token_acceso(datos: dict[str, Any]) -> str:
    """
    Crea un JWT firmado con los datos proporcionados.
    Agrega 'exp' automáticamente.
    """
    payload = datos.copy()
    expira_en = datetime.now(timezone.utc) + timedelta(
        minutes=config.jwt_expiracion_minutos
    )
    payload.update({"exp": expira_en})
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algoritmo)


def decodificar_token(token: str) -> dict[str, Any]:
    """
    Decodifica y valida un JWT.
    Lanza JWTError si el token es inválido o expiró.
    """
    return jwt.decode(
        token,
        config.jwt_secret,
        algorithms=[config.jwt_algoritmo],
    )


def crear_token_qr(usuario_id: str, vehiculo_id: str | None = None) -> str:
    """
    Crea un JWT especial para códigos QR de acceso.
    Incluye iat para asegurar unicidad en la base de datos.
    """
    payload = {
        "sub": usuario_id,
        "tipo": "qr_acceso",
        "iat": datetime.now(timezone.utc)
    }
    if vehiculo_id:
        payload["vehiculo_id"] = vehiculo_id
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algoritmo)


def crear_token_evento(solicitud_id: str, expira_at: datetime) -> str:
    """
    Crea un JWT para pases de eventos masivos.
    """
    payload = {
        "sub": solicitud_id,
        "tipo": "pase_evento",
        "exp": expira_at
    }
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algoritmo)
