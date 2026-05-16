
import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.core.database import FabricaSesion
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.vehiculo_pase import VehiculoPase
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from sqlalchemy import select, func

async def check():
    print("ANALISIS DE BASE DE DATOS...", flush=True)
    async with FabricaSesion() as db:
        try:
            # Zonas
            rs = await db.execute(select(ZonaEstacionamiento))
            zones = rs.scalars().all()
            print(f"Zonas encontradas: {len(zones)}", flush=True)
            
            for z in zones:
                # Contar VehiculoPase ingresados
                rs_v = await db.execute(select(func.count(VehiculoPase.id)).where(VehiculoPase.zona_asignada_id == z.id, VehiculoPase.ingresado == True))
                v_count = rs_v.scalar() or 0
                
                # Contar VehiculoPase NO ingresados (pero con esta zona asignada)
                rs_nv = await db.execute(select(func.count(VehiculoPase.id)).where(VehiculoPase.zona_asignada_id == z.id, VehiculoPase.ingresado == False))
                nv_count = rs_nv.scalar() or 0
                
                print(f"Zona: {z.nombre}")
                print(f"  - Ocupacion Actual (Columna): {z.ocupacion_actual}")
                print(f"  - Vehiculos Ingresados (REAL): {v_count}")
                print(f"  - Vehiculos Pendientes (Pases): {nv_count}")
            
            print("\nULTIMOS VEHICULOS REGISTRADOS:", flush=True)
            rs_last = await db.execute(select(VehiculoPase).order_by(VehiculoPase.created_at.desc()).limit(5))
            last_vps = rs_last.scalars().all()
            for vp in last_vps:
                print(f"  Placa: {vp.placa} | Zona: {vp.zona_asignada_id} | Ingresado: {vp.ingresado}")

        except Exception as e:
            print(f"Error: {e}", flush=True)
        finally:
            await db.close()

if __name__ == "__main__":
    asyncio.run(check())
