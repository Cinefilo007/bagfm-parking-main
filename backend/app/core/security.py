"""
Seguridad — BAGFM
Manejo de contraseñas (bcrypt) y tokens JWT.
"""
from datetime import datetime, timedelta, timezone
from typing import Any
import secrets
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


def crear_token_qr(usuario_id: str, vehiculo_id: str | None = None, unico: bool = False) -> str:
    """
    Crea un JWT especial para códigos QR de acceso.

    El `iat` da unicidad, pero solo con resolución de SEGUNDO: dos llamadas para la
    misma persona dentro del mismo segundo devuelven exactamente el mismo token y la
    segunda choca contra el índice único de `codigos_qr.token`. Pasa de verdad al
    reemitir un carnet justo después de emitirlo (o con un doble clic).

    `unico=True` añade un identificador aleatorio para que eso no ocurra. Va como
    opción y no por defecto para no cambiar los tokens que ya emiten los otros flujos;
    nada valida este campo, así que el QR se lee igual.
    """
    payload = {
        "sub": usuario_id,
        "tipo": "qr_acceso",
        "iat": datetime.now(timezone.utc)
    }
    if vehiculo_id:
        payload["vehiculo_id"] = vehiculo_id
    if unico:
        payload["jti"] = secrets.token_urlsafe(8)
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


def crear_token_foto(abastecimiento_id: str, tipo: str = "surtidor", horas: int = 72) -> str:
    """
    Crea un JWT de corta duración (72h por defecto) para acceso de solo lectura
    a la foto de un abastecimiento específico sin requerir sesión activa.

    El token incluye un campo 'proposito' = 'foto_auditoria' que evita
    que tokens de sesión normales sean usados para acceder a fotos.

    Args:
        abastecimiento_id: UUID del registro en la tabla abastecimientos.
        tipo: 'surtidor' o 'odometro'.
        horas: Horas de validez del token (default 72h).
    """
    expira = datetime.now(timezone.utc) + timedelta(hours=horas)
    payload = {
        "sub": abastecimiento_id,
        "tipo_foto": tipo,
        "proposito": "foto_auditoria",
        "exp": expira
    }
    return jwt.encode(payload, config.jwt_secret, algorithm=config.jwt_algoritmo)


def validar_token_foto(token: str) -> dict:
    """
    Valida un token de foto y retorna su payload.
    Verifica que el campo 'proposito' sea 'foto_auditoria' para evitar
    que tokens de sesión normales sean reutilizados para ver fotos.

    Raises:
        JWTError: Token expirado o firma inválida.
        ValueError: Token con propósito incorrecto.
    """
    payload = jwt.decode(token, config.jwt_secret, algorithms=[config.jwt_algoritmo])
    if payload.get("proposito") != "foto_auditoria":
        raise ValueError("Token no autorizado para acceso a foto de auditoría")
    return payload
