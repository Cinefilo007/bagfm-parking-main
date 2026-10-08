"""Convierte los dos Excel de la carrera en datos.json.

Se corre en local, nunca en el servidor: los Excel no se suben al repo (es
público). datos.json no guarda cédulas sino su HMAC con una clave secreta
(.pimienta), así que publicarlo no expone a nadie. Las cédulas venezolanas son
números de 7-8 cifras: un hash sin clave se revertiría probándolas todas en
minutos.

Uso:
    python generar_datos.py
La primera vez crea .pimienta; su contenido va en Coolify como CARRERA_PIMIENTA.
Si cambian las listas, se vuelve a correr y se sube el nuevo datos.json.
"""
import glob
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import unicodedata
from datetime import datetime, timezone

import openpyxl

AQUI = os.path.dirname(os.path.abspath(__file__))
RUTA_PIMIENTA = os.path.join(AQUI, ".pimienta")


def normalizar_cedula(valor):
    """'V- 17.482.109', '19,553,596' y 17482109 son la misma cédula."""
    if valor is None:
        return None
    digitos = re.sub(r"\D", "", str(valor)).lstrip("0")
    # Fuera de 6-9 cifras es basura de la planilla: un teléfono en la columna
    # de cédula, un "7 años", o el 0 que pusieron a los familiares sin cédula.
    return digitos if 6 <= len(digitos) <= 9 else None


def normalizar_modalidad(valor):
    texto = sin_acentos(str(valor or "")).upper()
    if "CAMINATA" in texto:
        return "Caminata 5K"
    # "CARRERA 5K" no existe como modalidad y no se sabe qué quisieron poner:
    # mejor no mostrar nada que mandar a alguien a la salida equivocada.
    if "CARRERA" in texto and "5" not in texto:
        return "Carrera 10K"
    return None


def sin_acentos(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def leer_planilla(patron, columna_modalidad):
    archivos = glob.glob(os.path.join(AQUI, patron))
    if len(archivos) != 1:
        sys.exit(f"Esperaba un archivo para {patron!r} y hay {len(archivos)}")
    return leer_archivo(archivos[0], columna_modalidad)


def leer_archivo(ruta, columna_modalidad):
    """Busca las columnas por su título, no por posición: las dos planillas
    tienen el orden distinto y una versión corregida podría moverlo otra vez."""
    hoja = openpyxl.load_workbook(ruta, read_only=True, data_only=True).worksheets[0]
    filas = hoja.iter_rows(values_only=True)

    for fila in filas:
        titulos = [sin_acentos(str(c or "")).upper().strip() for c in fila]
        if any(t.startswith("CEDULA") for t in titulos):
            col_cedula = next(i for i, t in enumerate(titulos) if t.startswith("CEDULA"))
            col_modalidad = next(i for i, t in enumerate(titulos) if t.startswith(columna_modalidad))
            break
    else:
        sys.exit(f"No encontré la fila de títulos en {ruta}")

    registros = {}
    for fila in filas:
        cedula = normalizar_cedula(fila[col_cedula])
        if cedula:
            registros.setdefault(cedula, set()).add(normalizar_modalidad(fila[col_modalidad]))
    return registros


def cargar_pimienta():
    if not os.path.exists(RUTA_PIMIENTA):
        with open(RUTA_PIMIENTA, "w", encoding="ascii") as f:
            f.write(secrets.token_hex(32))
        print(f"Clave nueva creada en {RUTA_PIMIENTA}")
    with open(RUTA_PIMIENTA, encoding="ascii") as f:
        return f.read().strip()


def clave(pimienta, cedula):
    # Debe coincidir con servidor.py. 128 bits sobran para ~2.000 registros.
    return hmac.new(pimienta.encode(), cedula.encode(), hashlib.sha256).hexdigest()[:32]


def main():
    inscritos = leer_planilla("*DEFINITIVO*.xlsx", "PARTICIPACI")
    # Las altas sueltas que se sumaron después con agregar_inscritos.py: sin
    # esto, regenerar desde la lista definitiva las borraría sin avisar.
    for ruta in sorted(glob.glob(os.path.join(AQUI, "adicionales", "*.xlsx"))):
        for cedula, modalidades in leer_archivo(ruta, "PARTICIPACI").items():
            inscritos.setdefault(cedula, set()).update(modalidades)
    excluidos = leer_planilla("*EXCLUIDOS*.xlsx", "MODALIDAD")
    pimienta = cargar_pimienta()

    registros = {}
    # Quien aparece en las dos listas está inscrito: la definitiva es la
    # palabra final, y la de excluidos recoge también intentos repetidos.
    for cedula in excluidos.keys() - inscritos.keys():
        registros[clave(pimienta, cedula)] = ["excluido"]
    for cedula, modalidades in inscritos.items():
        modalidades.discard(None)
        # Inscrito dos veces en modalidades distintas: no se sabe cuál vale.
        modalidad = modalidades.pop() if len(modalidades) == 1 else None
        registros[clave(pimienta, cedula)] = ["inscrito", modalidad] if modalidad else ["inscrito"]

    salida = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "registros": dict(sorted(registros.items())),
    }
    with open(os.path.join(AQUI, "datos.json"), "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))

    en_ambas = len(inscritos.keys() & excluidos.keys())
    print(f"Inscritos: {len(inscritos)} cédulas · Excluidos: {len(excluidos)} cédulas "
          f"· En ambas (cuentan como inscritos): {en_ambas} · Total en datos.json: {len(registros)}")


if __name__ == "__main__":
    main()
