"""
Por que el panel del guardia dice 0 entradas cuando la bitacora si muestra vehiculos.

Se ejecuta DENTRO del contenedor del backend, que es el unico sitio con acceso a la
base. Solo lee: no escribe ni corrige nada.

    docker exec -it <contenedor-backend> python scripts/diagnostico_kpi_turno.py

Comprueba, en este orden, lo que puede dejar el contador en cero mientras la bitacora
se ve llena:

  1. La hora del contenedor. Si el reloj esta corrido, la "fecha tactica" cae en otro
     dia y el corte del turno se va al futuro: todo da cero sin que nada este mal.
  2. El nombre del punto. `accesos.punto_acceso` es texto libre copiado al registrar;
     si un acceso quedo con otro nombre, sale en la bitacora pero no en el contador.
  3. El corte de las 08:30. Cuantos accesos quedan dentro y cuantos justo fuera.
  4. El origen del registro (QR o camara), por si el descuadre viniera de ahi.

Va en SQL directo a proposito: cargar el ORM obliga a importar todos los modelos por
sus relaciones, y una herramienta de diagnostico tiene que arrancar aunque algo del
mapeo este roto — que es justo cuando hace falta.
"""
import asyncio
import os
import sys
from datetime import datetime, time, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text                                           # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine                # noqa: E402

from app.core.config import obtener_config                            # noqa: E402
from app.core.password_rotativo import VET, obtener_fecha_tactica     # noqa: E402


def titulo(texto):
    print(f"\n{'-' * 70}\n{texto}\n{'-' * 70}")


async def main():
    config = obtener_config()
    motor = create_async_engine(config.database_url)

    ahora_vet = datetime.now(VET)
    fecha_t = obtener_fecha_tactica()
    inicio_ciclo = datetime.combine(fecha_t, time(8, 30)).replace(tzinfo=VET)
    inicio_utc = inicio_ciclo.astimezone(timezone.utc)

    titulo("1. RELOJ Y CORTE DEL TURNO")
    print(f"   Hora del contenedor (UTC) : {datetime.now(timezone.utc):%Y-%m-%d %H:%M}")
    print(f"   Hora en Venezuela         : {ahora_vet:%Y-%m-%d %H:%M}")
    print(f"   Fecha tactica             : {fecha_t}")
    print(f"   El turno cuenta desde     : {inicio_ciclo:%Y-%m-%d %H:%M} VET  ({inicio_utc:%H:%M} UTC)")
    if ahora_vet < inicio_ciclo:
        print("   [!] El corte esta en el FUTURO: el reloj del contenedor esta mal.")

    async with motor.connect() as cx:
        tz_sesion = (await cx.execute(text("SHOW timezone"))).scalar()
        print(f"   Zona horaria de Postgres  : {tz_sesion}")

        titulo("2. PUNTOS DE ACCESO REGISTRADOS")
        puntos = (await cx.execute(text(
            "SELECT nombre, activo FROM puntos_acceso ORDER BY nombre"
        ))).all()
        for nombre, activo in puntos:
            print(f"   [{'activo  ' if activo else 'inactivo'}] '{nombre}'")

        titulo("3. NOMBRES TAL COMO ESTAN GUARDADOS EN LOS ACCESOS")
        print("   (si un nombre de aqui no aparece arriba, esos accesos no los cuenta nadie)")
        filas = (await cx.execute(text("""
            SELECT punto_acceso, count(*) AS total, max(timestamp) AS ultimo
            FROM accesos GROUP BY punto_acceso ORDER BY count(*) DESC
        """))).all()
        for punto, total, ultimo in filas:
            cuando = ultimo.astimezone(VET).strftime("%d/%m %H:%M") if ultimo else "-"
            print(f"   '{punto}'  ->  {total} accesos, el ultimo {cuando} VET")

        titulo("4. QUE CUENTA CADA PUNTO EN ESTE TURNO")
        for nombre, _ in puntos:
            fila = (await cx.execute(text("""
                SELECT
                  count(*) FILTER (WHERE tipo = 'entrada' AND timestamp >= :corte) AS entradas,
                  count(*) FILTER (WHERE tipo = 'salida'  AND timestamp >= :corte) AS salidas,
                  count(*) FILTER (WHERE timestamp <  :corte)                     AS antes,
                  count(*)                                                        AS total
                FROM accesos
                WHERE lower(trim(punto_acceso)) = lower(trim(:nombre))
            """), {"corte": inicio_utc, "nombre": nombre})).one()

            print(f"\n   '{nombre}'")
            print(f"     En el turno    : {fila.entradas} entradas, {fila.salidas} salidas")
            print(f"     Antes del corte: {fila.antes} accesos (correcto que NO se cuenten)")
            if fila.total == 0:
                print("     [!] Ningun acceso casa con este nombre. Ver el punto 3.")

        titulo("5. ORIGEN DE LOS ACCESOS DEL TURNO")
        origenes = (await cx.execute(text("""
            SELECT coalesce(origen_registro::text, 'sin origen') AS origen, count(*)
            FROM accesos WHERE timestamp >= :corte GROUP BY 1 ORDER BY 2 DESC
        """), {"corte": inicio_utc})).all()
        if not origenes:
            print("   No hay ningun acceso en este turno, en ninguna alcabala.")
        for origen, total in origenes:
            print(f"   {origen}: {total}")

        titulo("6. LOS 10 ACCESOS MAS RECIENTES")
        ultimos = (await cx.execute(text("""
            SELECT timestamp, tipo::text, punto_acceso, vehiculo_placa
            FROM accesos ORDER BY timestamp DESC LIMIT 10
        """))).all()
        for cuando, tipo, punto, placa in ultimos:
            marca = "dentro" if cuando >= inicio_utc else "fuera "
            print(f"   [{marca}] {cuando.astimezone(VET):%d/%m %H:%M} VET  {tipo:8} "
                  f"'{punto}'  {placa or ''}")

        titulo("7. IDENTIFICACIONES DE CONDUCTOR EN ESTE TURNO")
        ident = (await cx.execute(text("""
            SELECT count(*) FROM eventos_anpr WHERE conductor_identificado_at >= :corte
        """), {"corte": inicio_utc})).scalar()
        print(f"   {ident} conductores identificados desde el corte del turno")

    await motor.dispose()
    print()


if __name__ == "__main__":
    asyncio.run(main())
