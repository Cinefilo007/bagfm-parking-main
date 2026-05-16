
import asyncio
import sys
import os

# Añadir el path del proyecto
sys.path.append(os.getcwd())

from app.core.database import FabricaSesion
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.codigo_qr import VehiculoPase
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from sqlalchemy import select, func

async def check():
    print("Conectando a la base de datos...", flush=True)
    async with FabricaSesion() as db:
        try:
            # Zonas
            rs = await db.execute(select(ZonaEstacionamiento))
            zones = rs.scalars().all()
            print(f"Total Zonas: {len(zones)}", flush=True)
            
            for z in zones:
                # Vehiculos ingresados
                rs_v = await db.execute(select(func.count(VehiculoPase.id)).where(VehiculoPase.zona_asignada_id == z.id, VehiculoPase.ingresado == True))
                v_count = rs_v.scalar() or 0
                
                # Puestos físicos
                rs_p = await db.execute(select(func.count(PuestoEstacionamiento.id)).where(PuestoEstacionamiento.zona_id == z.id))
                p_count = rs_p.scalar() or 0
                
                print(f"Zona: {z.nombre} (ID: {z.id})", flush=True)
                print(f"  - Capacidad: {z.capacidad_total}", flush=True)
                print(f"  - Ocupacion Actual (DB col): {z.ocupacion_actual}", flush=True)
                print(f"  - Vehiculos Reales (VehiculoPase.ingresado=True): {v_count}", flush=True)
                print(f"  - Puestos Físicos: {p_count}", flush=True)
                
            # Verificar si hay algún VehiculoPase ingresado en general
            rs_global = await db.execute(select(func.count(VehiculoPase.id)).where(VehiculoPase.ingresado == True))
            total_v = rs_global.scalar() or 0
            print(f"\nTOTAL VEHICULOS INGRESADOS EN TODA LA BASE: {total_v}", flush=True)

        except Exception as e:
            print(f"Error: {e}", flush=True)
        finally:
            await db.close()

if __name__ == "__main__":
    asyncio.run(check())
