"""
Excepciones del dominio — BAGFM
Excepciones propias del negocio. Los endpoints las convierten a HTTPException.
"""


class BagfmError(Exception):
    """Clase base para todas las excepciones del sistema BAGFM."""
    pass


# ——— Autenticación / Autorización ———

class CredencialesInvalidas(BagfmError):
    """Cédula o contraseña incorrectos."""
    pass


class TokenInvalido(BagfmError):
    """Token JWT inválido o expirado."""
    pass


class AccesoDenegado(BagfmError):
    """El usuario no tiene permisos para esta operación."""
    pass


class UsuarioInactivo(BagfmError):
    """El usuario existe pero está desactivado."""
    pass


# ——— Entidades y Recursos ———

class EntidadNoEncontrada(BagfmError):
    """El recurso solicitado no existe en la base de datos."""
    pass


class EntidadDuplicada(BagfmError):
    """Ya existe un registro con los mismos datos únicos."""
    pass


class EntidadInactiva(BagfmError):
    """La entidad civil está desactivada."""
    pass


# ——— Control de Acceso ———

class QRInvalido(BagfmError):
    """El código QR no existe, está revocado o expiró."""
    pass


class MembresiaInactiva(BagfmError):
    """El socio no tiene membresía activa vigente."""
    pass


class InfraccionActiva(BagfmError):
    """El vehículo tiene una infracción activa que bloquea el acceso."""
    mensaje: str = ""

    def __init__(self, descripcion: str = ""):
        self.mensaje = descripcion
        super().__init__(descripcion)


class CapacidadExcedida(BagfmError):
    """La zona o entidad ha alcanzado su capacidad máxima de vehículos."""
    pass


# ——— Importación Excel ———

class ArchivoExcelInvalido(BagfmError):
    """El archivo Excel no tiene el formato esperado."""
    pass


class FilaExcelInvalida(BagfmError):
    """Una fila del Excel tiene datos incorrectos."""
    fila: int = 0

    def __init__(self, fila: int, detalle: str = ""):
        self.fila = fila
        super().__init__(f"Fila {fila}: {detalle}")
