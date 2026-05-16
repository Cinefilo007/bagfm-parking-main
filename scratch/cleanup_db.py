
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
import os
import sys

# Añadir el path del backend para importar los modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.config import obtener_config
from app.models.entidad_civil import EntidadCivil
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from app.models.usuario import Usuario
from app.models.acceso import Acceso
from app.models.infraccion import Infraccion
from app.models.membresia import Membresia
from app.models.vehiculo import Vehiculo
from app.models.codigo_qr import CodigoQR
from app.models.alcabala_evento import LotePaseMasivo, SolicitudEvento, GuardiaTurno
from app.models.enums import RolTipo

async def cleanup_db():
    config = obtener_config()
    engine = create_async_engine(config.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("--- INICIANDO LIMPIEZA TÁCTICA DE BASE DE DATOS ---")
        
        # 1. Identificar usuarios a eliminar (Socios y Pases Temporales)
        # Los pases temporales suelen tener cedulas que empiezan por BAGFM- o son SOCIO
        q_users = select(Usuario.id).where(
            (Usuario.rol == RolTipo.SOCIO) | 
            (Usuario.cedula.like("BAGFM-%")) |
            (Usuario.cedula.like("TEMP-%"))
        )
        res_users = await db.execute(q_users)
        target_user_ids = res_users.scalars().all()
        
        print(f"Identificados {len(target_user_ids)} usuarios para eliminación.")

        if target_user_ids:
            # 2. Eliminar Logs de Acceso (Entradas/Salidas)
            # Eliminamos TODOS los accesos como solicitó el usuario ("elimina todos los logs de entrada y salida")
            res_acc = await db.execute(delete(Acceso))
            print(f"Eliminados logs de Acceso.")

            # 3. Eliminar Infracciones
            res_inf = await db.execute(delete(Infraccion))
            print(f"Eliminadas infracciones.")
            
            # 4. Eliminar Lotes de Pases y Solicitudes (Pases Temporales Masivos)
            res_sol = await db.execute(delete(SolicitudEvento))
            res_lot = await db.execute(delete(LotePaseMasivo))
            res_gua = await db.execute(delete(GuardiaTurno))
            print(f"Eliminados lotes de pases, solicitudes y guardias de turno.")

            # 5. Eliminar Códigos QR asociados a los usuarios objetivo
            res_qr = await db.execute(delete(CodigoQR).where(CodigoQR.usuario_id.in_(target_user_ids)))
            print(f"Eliminados códigos QR.")

            # 6. Eliminar Membresías asociadas
            res_mem = await db.execute(delete(Membresia).where(Membresia.socio_id.in_(target_user_ids)))
            print(f"Eliminadas membresías.")

            # 7. Eliminar Vehículos asociados
            res_veh = await db.execute(delete(Vehiculo).where(Vehiculo.socio_id.in_(target_user_ids)))
            print(f"Eliminados vehículos.")

            # 8. Finalmente, eliminar los Usuarios
            res_usr = await db.execute(delete(Usuario).where(Usuario.id.in_(target_user_ids)))
            print(f"Eliminados usuarios de rol SOCIO / Temporal.")

        await db.commit()
        print("--- LIMPIEZA COMPLETADA EXITOSAMENTE ---")

if __name__ == "__main__":
    asyncio.run(cleanup_db())
