"""
Las ingestas ANPR que NO llegaron a convertirse en una detección.

Existe por el momento de poner una cámara nueva en marcha. Hasta ahora, cuando algo
fallaba ahí, el sistema no lo contaba: un token mal copiado devolvía 404, una IP fuera
de la allowlist devolvía 403 y un evento con un XML inesperado se descartaba con un
`print`. Desde el panel del Comandante los tres casos se ven igual —la cámara no
transmite— y para distinguirlos había que entrar al VPS a leer los logs del contenedor,
que es justo lo que no se puede hacer estando de pie en la garita con el instalador
esperando.

Se guarda **en memoria y a propósito**:

  - Un rechazo por token inválido no tiene cámara a la que atribuirse, así que tampoco
    tiene fila donde vivir sin inventarse una tabla.
  - Es información de puesta en marcha, no del historial de quién entró a la base. Que se
    pierda al reiniciar es correcto: si la cámara ya transmite, no hace falta.
  - Escribir en la base cada POST rechazado convertiría el endpoint sin sesión en una vía
    para llenar el disco desde fuera.

La contrapartida honesta: con más de un worker cada uno tiene su propia lista, así que un
rechazo puede no aparecer en la primera consulta. Ver el mismo fallo dos veces seguidas
basta para confirmarlo.

**Aquí no entran bytes de imagen ni tokens completos.** Del cuerpo se guarda un extracto
de texto acotado —el XML suele caber entero— y del token solo los cuatro últimos
caracteres, los mismos que el panel ya muestra para poder distinguirlo sin revelarlo.
"""
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional

# Suficiente para cubrir una sesión de instalación entera sin que la memoria del proceso
# dependa de cuántos POST mande alguien contra el endpoint sin sesión.
MAX_INTENTOS = 40

# El XML de un evento Hikvision ronda el kilobyte, así que esto se lo lleva completo en
# el caso normal y aun así acota lo que un POST hostil puede hacer ocupar.
MAX_EXTRACTO = 3000

# Motivos posibles. Se nombran para que el panel pueda decir qué hacer con cada uno en
# vez de mostrar un error crudo.
TOKEN_INVALIDO = "token_invalido"
IP_RECHAZADA = "ip_rechazada"
CUERPO_ENORME = "cuerpo_enorme"
SIN_ALCABALA = "sin_alcabala"
SIN_PLACA = "sin_placa"
# El evento llegó bien pero no era una lectura: un latido del Socket de escucha ISAPI, o
# cualquier otro evento armado en la cámara. Se separa de SIN_PLACA porque no es un fallo
# de configuración sino la prueba de que la cámara alcanza el servidor.
OTRO_EVENTO = "otro_evento"

# `deque` con `maxlen` descarta el más viejo al llegar al tope, que es exactamente lo que
# se quiere, y su `append` es atómico: no hace falta un lock alrededor.
_intentos: Deque[Dict[str, Any]] = deque(maxlen=MAX_INTENTOS)


def _extracto_seguro(cuerpo: Optional[bytes]) -> Optional[str]:
    """
    Un trozo del cuerpo que se pueda leer en pantalla sin arrastrar una foto.

    Los bytes de un JPEG decodificados son ilegibles y ensucian la vista, así que todo lo
    que no sea imprimible se sustituye por un punto. Lo que sobrevive es justo lo que
    sirve para diagnosticar: el boundary del multipart, los Content-Type de cada parte y
    el XML del evento.
    """
    if not cuerpo:
        return None

    texto = cuerpo[:MAX_EXTRACTO].decode("utf-8", "replace")
    limpio = "".join(c if c.isprintable() or c in "\r\n\t" else "." for c in texto)

    if len(cuerpo) > MAX_EXTRACTO:
        limpio += f"\n… [recortado, el cuerpo tenía {len(cuerpo)} bytes]"
    return limpio


def registrar_rechazo(
    motivo: str,
    *,
    ip: Optional[str] = None,
    content_type: Optional[str] = None,
    tamano: Optional[int] = None,
    pista_token: Optional[str] = None,
    camara_nombre: Optional[str] = None,
    detalle: Optional[str] = None,
    cuerpo: Optional[bytes] = None,
    etiquetas: Optional[List[str]] = None,
) -> None:
    """
    Anota una ingesta que no prosperó.

    `etiquetas` son los nombres de etiqueta que se encontraron dentro del XML. Es el dato
    que más rápido resuelve el caso difícil: si la lista viene llena pero sin
    `licensePlate`, la cámara está enviando y el problema es de formato; si viene vacía,
    lo que llegó no era XML y hay que mirar el modo de subida configurado en la cámara.
    """
    _intentos.append({
        "momento": datetime.now(timezone.utc),
        "motivo": motivo,
        "ip": ip,
        "content_type": content_type,
        "tamano": tamano,
        "pista_token": pista_token,
        "camara_nombre": camara_nombre,
        "detalle": detalle,
        "etiquetas": etiquetas,
        "extracto": _extracto_seguro(cuerpo),
    })


def ultimos(limite: int = 20) -> List[Dict[str, Any]]:
    """Los rechazos más recientes primero: al depurar interesa el último intento."""
    return list(_intentos)[-limite:][::-1]


def limpiar() -> int:
    """
    Vacía la lista. Se usa desde el panel antes de una prueba, para que lo que aparezca
    después sea sin duda de esa prueba y no de un intento de hace media hora.
    """
    cuantos = len(_intentos)
    _intentos.clear()
    return cuantos
