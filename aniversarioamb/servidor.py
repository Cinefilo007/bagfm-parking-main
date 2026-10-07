"""Consulta de inscripción a la Carrera 10K / Caminata 5K del 106º Aniversario AMB.

Solo biblioteca estándar: es un recurso desechable que se borra después de la
carrera, y sin dependencias no hay nada que actualizar ni que se rompa al
reconstruir.

La consulta pasa por el servidor en vez de bajar la lista al navegador para que
nadie pueda llevarse el listado entero: aquí se responde una cédula a la vez y
con límite por IP.
"""
import hashlib
import hmac
import json
import os
import re
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

AQUI = os.path.dirname(os.path.abspath(__file__))
PUERTO = int(os.environ.get("PORT", "8000"))
PIMIENTA = os.environ.get("CARRERA_PIMIENTA", "").strip()
if not PIMIENTA:
    raise SystemExit("Falta CARRERA_PIMIENTA (el contenido de .pimienta, ver generar_datos.py)")

with open(os.path.join(AQUI, "datos.json"), encoding="utf-8") as f:
    REGISTROS = json.load(f)["registros"]

# Generoso a propósito: en Venezuela las operadoras móviles sacan a miles de
# teléfonos por la misma IP pública (CGNAT), y el día que se publique el enlace
# en los grupos de WhatsApp muchos consultarán a la vez desde la misma.
LIMITE_CONSULTAS = int(os.environ.get("LIMITE_CONSULTAS_MINUTO", "40"))
VENTANA_SEGUNDOS = 60
_consultas = {}
_candado = threading.Lock()

ESTATICOS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/logo-106.png": ("logo-106.png", "image/png"),
    "/fondo.jpg": ("fondo.jpg", "image/jpeg"),
}
CABECERAS_SEGURIDAD = {
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
}


def normalizar_cedula(valor):
    digitos = re.sub(r"\D", "", valor or "").lstrip("0")
    return digitos if 6 <= len(digitos) <= 9 else None


def clave(cedula):
    # Debe coincidir con generar_datos.py.
    return hmac.new(PIMIENTA.encode(), cedula.encode(), hashlib.sha256).hexdigest()[:32]


def permitir(ip):
    ahora = time.monotonic()
    with _candado:
        historial = _consultas.setdefault(ip, deque())
        while historial and ahora - historial[0] > VENTANA_SEGUNDOS:
            historial.popleft()
        if len(historial) >= LIMITE_CONSULTAS:
            return False
        historial.append(ahora)
        # Barrido ocasional para que las IP que ya no vuelven no acumulen memoria.
        if len(_consultas) > 5000:
            for vieja in [k for k, v in _consultas.items() if not v or ahora - v[-1] > VENTANA_SEGUNDOS]:
                del _consultas[vieja]
        return True


class Manejador(BaseHTTPRequestHandler):
    server_version = "consulta"
    sys_version = ""

    def ip_cliente(self):
        # Detrás del proxy de Coolify todo llega desde la IP del proxy. Se toma
        # la ÚLTIMA de X-Forwarded-For, la que añadió el proxy: las anteriores
        # las escribe el cliente y se pueden inventar para saltarse el límite.
        reenviada = self.headers.get("X-Forwarded-For", "")
        return reenviada.split(",")[-1].strip() or self.client_address[0]

    def responder(self, codigo, cuerpo, tipo, extra=None):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        for nombre, valor in {**CABECERAS_SEGURIDAD, **(extra or {})}.items():
            self.send_header(nombre, valor)
        self.end_headers()
        self.wfile.write(cuerpo)

    def json(self, codigo, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode()
        self.responder(codigo, cuerpo, "application/json; charset=utf-8", {"Cache-Control": "no-store"})

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/api/consulta":
            return self.consultar(parse_qs(url.query).get("cedula", [""])[0])
        if url.path == "/salud":
            return self.json(200, {"ok": True, "registros": len(REGISTROS)})
        if url.path in ESTATICOS:
            archivo, tipo = ESTATICOS[url.path]
            with open(os.path.join(AQUI, archivo), "rb") as f:
                return self.responder(200, f.read(), tipo, {"Cache-Control": "public, max-age=300"})
        self.json(404, {"error": "no_existe"})

    def consultar(self, valor):
        if not permitir(self.ip_cliente()):
            return self.json(429, {"error": "demasiadas"})
        cedula = normalizar_cedula(valor)
        if not cedula:
            return self.json(400, {"error": "cedula_invalida"})
        registro = REGISTROS.get(clave(cedula))
        if not registro:
            return self.json(200, {"estado": "no_encontrado"})
        respuesta = {"estado": registro[0]}
        if len(registro) > 1:
            respuesta["modalidad"] = registro[1]
        self.json(200, respuesta)

    def log_message(self, formato, *args):
        # El registro por defecto escribe la URL completa, y en ella va la
        # cédula consultada. Se deja solo la ruta.
        print(f"{self.command} {urlsplit(self.path).path} {args[1] if len(args) > 1 else ''}", flush=True)


if __name__ == "__main__":
    print(f"Escuchando en :{PUERTO} con {len(REGISTROS)} registros", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PUERTO), Manejador).serve_forever()
