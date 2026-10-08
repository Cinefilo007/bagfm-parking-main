"""Suma inscritos a datos.json sin regenerarlo.

Para las altas que llegan sueltas después de publicada la lista. No necesita
los Excel originales, solo .pimienta: lee el archivo nuevo (mismo formato que
la lista definitiva) y añade sus cédulas. Lo que ya estaba no se toca, salvo
un excluido que ahora aparece como inscrito, que pasa a inscrito — igual que
cuando una cédula está en las dos listas.

Uso:
    python agregar_inscritos.py "C:/ruta/LISTADO NUEVO.xlsx"

Copia además el archivo a adicionales/, que generar_datos.py también lee:
así, si un día se regenera desde la lista definitiva, estas altas no se pierden.
"""
import json
import os
import shutil
import sys

from generar_datos import AQUI, cargar_pimienta, clave, leer_archivo

RUTA_DATOS = os.path.join(AQUI, "datos.json")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    origen = sys.argv[1]
    nuevos = leer_archivo(origen, "PARTICIPACI")
    if not nuevos:
        sys.exit("El archivo no trae ninguna cédula válida: no se cambió nada.")

    # Sin .pimienta se crearía una clave nueva y las cédulas sumadas no
    # coincidirían con nada de lo que ya hay en datos.json.
    if not os.path.exists(os.path.join(AQUI, ".pimienta")):
        sys.exit("Falta .pimienta: sin la misma clave de Coolify las altas no servirían.")
    pimienta = cargar_pimienta()

    with open(RUTA_DATOS, encoding="utf-8") as f:
        datos = json.load(f)
    registros = datos["registros"]

    for cedula, modalidades in sorted(nuevos.items()):
        modalidades.discard(None)
        modalidad = modalidades.pop() if len(modalidades) == 1 else None
        k = clave(pimienta, cedula)
        anterior = registros.get(k)
        if anterior and anterior[0] == "inscrito":
            print(f"  {cedula}: ya estaba inscrito, se deja igual")
            continue
        registros[k] = ["inscrito", modalidad] if modalidad else ["inscrito"]
        print(f"  {cedula}: {'excluido → inscrito' if anterior else 'añadido'} ({modalidad or 'sin modalidad'})")

    datos["registros"] = dict(sorted(registros.items()))
    with open(RUTA_DATOS, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))

    destino = os.path.join(AQUI, "adicionales")
    os.makedirs(destino, exist_ok=True)
    shutil.copy2(origen, destino)
    print(f"Total en datos.json: {len(registros)}")


if __name__ == "__main__":
    main()
