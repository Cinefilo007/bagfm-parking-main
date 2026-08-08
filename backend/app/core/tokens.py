"""
Tokens de dispositivo.

Los usan los aparatos que no pueden iniciar sesión como una persona: las cámaras
ANPR, que postean eventos, y las pantallas de las garitas, que solo leen.

En la base solo se guarda el hash. Se usa SHA-256 y no bcrypt a propósito: no son
contraseñas elegidas por alguien, son 32 bytes aleatorios imposibles de adivinar por
fuerza bruta, y hace falta que el hash sea determinista porque la autenticación
consiste en buscar el dispositivo por el hash del token que llega en la petición.
"""
import hashlib
import secrets


def generar_token() -> str:
    """Token nuevo. Seguro para ir en una URL o en una cabecera."""
    return secrets.token_urlsafe(32)


def hashear_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
