"""
Simula una cámara ANPR Hikvision posteando un evento al backend.

Sirve para probar la ingesta de punta a punta sin tener que ir a la alcabala:
construye el mismo multipart que manda la cámara (XML EventNotificationAlert +
dos JPEG) y lo envía al endpoint real.

El token es el de la cámara, el que entrega el panel de Cámaras ANPR al crearla o al
rotarlo. Identifica también a qué alcabala pertenece, así que la URL no lleva nada más.

Uso:
    python scripts/simular_camara_anpr.py \
        --url https://api.bagfm.app \
        --token <TOKEN_DE_LA_CAMARA> \
        --placa AB123CD

OJO: contra producción esto crea un registro real en `eventos_anpr` y le hace sonar
la tarjeta al guardia que tenga la pantalla de Puerta abierta. Para pruebas de
verdad, usa una placa reconocible como PRUEBA1 y descarta el evento después.
"""
import argparse
import sys
import urllib.request
import uuid
from datetime import datetime, timezone

PLANTILLA_XML = """<?xml version="1.0" encoding="UTF-8"?>
<EventNotificationAlert version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<ipAddress>192.168.1.64</ipAddress>
<portNo>80</portNo>
<protocol>HTTP</protocol>
<macAddress>a4:14:37:{mac}</macAddress>
<channelID>1</channelID>
<dateTime>{fecha}</dateTime>
<activePostCount>1</activePostCount>
<eventType>ANPR</eventType>
<eventState>active</eventState>
<eventDescription>ANPR</eventDescription>
<channelName>{punto}</channelName>
<ANPR>
<country>VEN</country>
<licensePlate>{placa}</licensePlate>
<line>1</line>
<direction>{direccion}</direction>
<confidenceLevel>{confianza}</confidenceLevel>
<plateType>unknown</plateType>
<plateColor>white</plateColor>
<vehicleType>vehicle</vehicleType>
<vehicleInfo>
<index>0</index>
<colorDepth>0</colorDepth>
<color>{color}</color>
<vehicleType>{tipo}</vehicleType>
<vehicleLogoRecog>12</vehicleLogoRecog>
</vehicleInfo>
</ANPR>
</EventNotificationAlert>
"""


def extraer_token(valor: str) -> str:
    """
    Acepta el token pelado, la ruta o la URL completa y devuelve solo el token.

    El panel entrega la ruta ya armada, así que es natural pegarla entera aquí. Sin
    esto, el script la codificaría como si fuera el token y el servidor respondería
    un 404 que no dice en qué se falló. Un token nunca lleva '/' —es base64 url-safe—
    así que quedarse con el último segmento es seguro.
    """
    valor = valor.strip().strip('"').strip("'")
    if "/" in valor:
        valor = valor.rstrip("/").rsplit("/", 1)[-1]
    return valor


def jpeg_falso(relleno: bytes, tamano: int) -> bytes:
    """JPEG mínimo válido en cabecera y cierre: basta para ejercitar el guardado."""
    return b"\xff\xd8\xff\xe0" + relleno * tamano + b"\xff\xd9"


def construir_multipart(xml: bytes, foto_placa: bytes, foto_escena: bytes) -> tuple[str, bytes]:
    boundary = f"MIME_boundary_{uuid.uuid4().hex[:16]}"
    sep = f"--{boundary}".encode()

    cuerpo = b""
    cuerpo += sep + b"\r\nContent-Type: application/xml\r\n\r\n" + xml + b"\r\n"
    cuerpo += (
        sep
        + b'\r\nContent-Disposition: form-data; name="licensePlatePicture"; filename="plate.jpg"'
        + b"\r\nContent-Type: image/jpeg\r\n\r\n"
        + foto_placa
        + b"\r\n"
    )
    cuerpo += (
        sep
        + b'\r\nContent-Disposition: form-data; name="detectionPicture"; filename="scene.jpg"'
        + b"\r\nContent-Type: image/jpeg\r\n\r\n"
        + foto_escena
        + b"\r\n"
    )
    cuerpo += sep + b"--\r\n"

    return f"multipart/form-data; boundary={boundary}", cuerpo


def main() -> int:
    p = argparse.ArgumentParser(description="Simula un evento de cámara ANPR Hikvision")
    p.add_argument("--url", default="http://localhost:8000", help="Base del backend")
    p.add_argument("--token", required=True,
                   help="Token de la cámara. Acepta también la ruta o la URL completa "
                        "que muestra el panel; se queda con el token.")
    p.add_argument("--punto", default="Alcabala",
                   help="Solo cosmético: va en el campo channelName del XML")
    p.add_argument("--placa", default="PRUEBA1")
    p.add_argument("--direccion", default="forward", choices=["forward", "reverse", "unknown"])
    p.add_argument("--tipo", default="saloonCar")
    p.add_argument("--color", default="white")
    p.add_argument("--confianza", type=int, default=95)
    p.add_argument("--repetir", type=int, default=1,
                   help="Cuántos POST seguidos. Útil para comprobar la deduplicación.")
    args = p.parse_args()

    xml = PLANTILLA_XML.format(
        mac=uuid.uuid4().hex[:5],
        fecha=datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        punto=args.punto,
        placa=args.placa,
        direccion=args.direccion,
        confianza=args.confianza,
        color=args.color,
        tipo=args.tipo,
    ).encode("utf-8")

    content_type, cuerpo = construir_multipart(
        xml,
        jpeg_falso(b"P", 300),     # recorte de la placa: pequeño
        jpeg_falso(b"E", 9000),    # foto de escena: grande
    )

    from urllib.parse import quote
    # El token identifica a la cámara y con ella su alcabala: la URL no lleva el
    # punto de acceso aparte.
    token = extraer_token(args.token)
    destino = f"{args.url.rstrip('/')}/api/v1/anpr/ingesta/{quote(token, safe='')}"
    print(f"POST {args.url.rstrip('/')}/api/v1/anpr/ingesta/<token>")
    print(f"     token ...{token[-4:]}  ({len(token)} caracteres)")
    print(f"     placa={args.placa}  {len(cuerpo)} bytes\n")

    fallos = 0
    for intento in range(1, args.repetir + 1):
        peticion = urllib.request.Request(
            destino, data=cuerpo, method="POST", headers={"Content-Type": content_type}
        )
        try:
            with urllib.request.urlopen(peticion, timeout=30) as respuesta:
                print(f"  {intento}/{args.repetir}  HTTP {respuesta.status} — aceptado")
        except urllib.error.HTTPError as e:
            fallos += 1
            print(f"  {intento}/{args.repetir}  HTTP {e.code} — {e.read()[:200].decode('utf-8', 'replace')}")
        except Exception as e:
            fallos += 1
            print(f"  {intento}/{args.repetir}  ERROR — {e}")

    if args.repetir > 1:
        print(f"\nSolo el primero debería aparecerle al guardia; el resto quedan como "
              f"'duplicado' dentro de la ventana de ANPR_DEDUPE_SEGUNDOS.")

    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
