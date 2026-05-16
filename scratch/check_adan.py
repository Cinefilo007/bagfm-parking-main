import asyncio
import os
from uuid import UUID
from sqlalchemy import select
from dotenv import load_dotenv

# Cargar variables de entorno antes de importar core
load_dotenv("backend/.env")

from app.core.database import FabricaSesion
from app.models.usuario import Usuario
from app.models.membresia import Membresia
from app.models.vehiculo import Vehiculo
from app.models.entidad_civil import EntidadCivil

async def check_user_state():
    async with FabricaSesion() as db:
        # Buscar Adán Molina
        q = select(Usuario).where(Usuario.nombre == "ADÁN", Usuario.apellido == "MOLINA PERALES")
        res = await db.execute(q)
        user = res.scalar_one_or_none()
        
        if not user:
            print("Usuario no encontrado")
            return
            
        print(f"Usuario: {user.nombre_completo} ({user.id})")
        print(f"Rol: {user.rol}")
        
        # Membresía
        qm = select(Membresia).where(Membresia.socio_id == user.id)
        rm = await db.execute(qm)
        mems = rm.scalars().all()
        print(f"Membresías: {len(mems)}")
        for m in mems:
            print(f"  - ID: {m.id}, Estado: {m.estado}, Fin: {m.fecha_fin}")
            
        # Vehículos
        qv = select(Vehiculo).where(Vehiculo.socio_id == user.id)
        rv = await db.execute(qv)
        vehs = rv.scalars().all()
        print(f"Vehículos: {len(vehs)}")
        for v in vehs:
            print(f"  - ID: {v.id}, Placa: {v.placa}, Activo: {v.activo}")

        # Buscar placa específica
        qp = select(Vehiculo).where(Vehiculo.placa == "AC255LB")
        rp = await db.execute(qp)
        vp = rp.scalar_one_or_none()
        if vp:
            print(f"PLACA AC255LB encontrada: Registrada a socio_id={vp.socio_id}")
        else:
            print("PLACA AC255LB no encontrada en DB")

if __name__ == "__main__":
    asyncio.run(check_user_state())
