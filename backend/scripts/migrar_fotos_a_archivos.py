"""
Convierte las fotos de abastecimientos guardadas en base64 dentro de la base de datos
a archivos en el volumen privado, dejando en la columna una referencia 'file:<ruta>'.

Es idempotente: los registros ya convertidos se saltean, así que se puede correr
varias veces sin duplicar archivos.

Uso, dentro del contenedor del backend (PYTHONPATH hace falta porque el script se
ejecuta por ruta y su carpeta, no /app, es la que entra al path):
    PYTHONPATH=/app python scripts/migrar_fotos_a_archivos.py --simular  # solo informa
    PYTHONPATH=/app python scripts/migrar_fotos_a_archivos.py            # convierte
"""
import asyncio
import sys

from sqlalchemy import select, update

# Registrar TODOS los modelos antes de usar cualquiera: las relaciones entre ellos se
# resuelven por nombre, y si falta alguno SQLAlchemy falla al configurar el mapper.
# Es la misma razón por la que main.py hace este import antes que nada.
from app.models import base  # noqa: F401

from app.core.database import FabricaSesion
from app.models.abastecimiento import Abastecimiento
from app.services.storage_local import PREFIJO_ARCHIVO, guardar_imagen_base64

LOTE = 25
SIMULAR = "--simular" in sys.argv

CAMPOS = ("foto_maquina_url", "foto_kilometraje_url")


def _hay_que_convertir(valor) -> bool:
    if not valor:
        return False
    if valor.startswith(PREFIJO_ARCHIVO):
        return False
    if valor == "placeholder_excepcional":
        return False
    return True


async def main() -> None:
    convertidas = 0
    salteadas = 0
    fallidas = 0
    bytes_liberados = 0

    async with FabricaSesion() as db:
        res = await db.execute(
            select(
                Abastecimiento.id,
                Abastecimiento.foto_maquina_url,
                Abastecimiento.foto_kilometraje_url,
            )
        )
        filas = res.all()

    print(f"Registros de abastecimiento: {len(filas)}")
    if SIMULAR:
        print(">>> MODO SIMULACIÓN: no se escribe nada\n")

    pendientes = []
    for fila in filas:
        cambios = {}
        for campo, valor in zip(CAMPOS, (fila[1], fila[2])):
            if _hay_que_convertir(valor):
                cambios[campo] = valor
            elif valor:
                salteadas += 1
        if cambios:
            pendientes.append((fila[0], cambios))

    print(f"Fotos a convertir: {sum(len(c) for _, c in pendientes)}")
    print(f"Valores que se dejan como están: {salteadas}\n")

    for inicio in range(0, len(pendientes), LOTE):
        bloque = pendientes[inicio : inicio + LOTE]
        async with FabricaSesion() as db:
            for reg_id, cambios in bloque:
                nuevos = {}
                for campo, valor in cambios.items():
                    if SIMULAR:
                        convertidas += 1
                        bytes_liberados += len(valor)
                        continue
                    try:
                        referencia = guardar_imagen_base64(valor, "abastecimientos")
                    except Exception as e:  # noqa: BLE001 — un registro malo no debe frenar la migración
                        print(f"  FALLO {reg_id} {campo}: {e}")
                        fallidas += 1
                        continue

                    if referencia.startswith(PREFIJO_ARCHIVO):
                        nuevos[campo] = referencia
                        bytes_liberados += len(valor)
                        convertidas += 1
                    else:
                        # No era base64 reconocible; se deja intacto antes que perder el dato.
                        print(f"  SIN CAMBIO {reg_id} {campo}: no se reconoció como imagen")
                        fallidas += 1

                if nuevos and not SIMULAR:
                    await db.execute(
                        update(Abastecimiento).where(Abastecimiento.id == reg_id).values(**nuevos)
                    )
            if not SIMULAR:
                await db.commit()
        print(f"  procesados {min(inicio + LOTE, len(pendientes))}/{len(pendientes)} registros")

    print()
    print(f"Fotos convertidas a archivo : {convertidas}")
    print(f"Fallidas / sin cambio       : {fallidas}")
    print(f"Texto base64 sacado de la BD: {bytes_liberados / 1024 / 1024:.2f} MB")
    if SIMULAR:
        print("\n(simulación: no se escribió ni la base ni el disco)")


if __name__ == "__main__":
    asyncio.run(main())
