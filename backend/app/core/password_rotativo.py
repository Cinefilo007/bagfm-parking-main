import hashlib
from datetime import datetime, time, timedelta
import zoneinfo

# Zona horaria de Caracas
VET = zoneinfo.ZoneInfo("America/Caracas")

def obtener_fecha_tactica():
    """
    Retorna la fecha que define el turno actual.
    El turno cambia a las 08:30 AM Caracas.
    Si son las 07:00 AM del 05-Abr, la fecha táctica sigue siendo 04-Abr.
    """
    ahora_vet = datetime.now(VET)
    limite = time(8, 30)
    
    if ahora_vet.time() < limite:
        return (ahora_vet - timedelta(days=1)).date()
    return ahora_vet.date()

def generar_password_diario(secret_key: str, salt: str = None) -> str:
    """
    Genera una clave de 6 dígitos basada en la semilla de la alcabala y la fecha táctica.
    """
    fecha_tactica = obtener_fecha_tactica()
    semilla = f"{secret_key}-{fecha_tactica}-{salt or ''}"
    
    # Hash SHA256
    hash_obj = hashlib.sha256(semilla.encode())
    res_hex = hash_obj.hexdigest()
    
    # Extraer 6 dígitos de forma determinista
    # Tomamos los últimos 6 caracteres del hash convertido a entero
    num = int(res_hex[:8], 16)
    password = str(num % 1000000).zfill(6)
    
    return password
