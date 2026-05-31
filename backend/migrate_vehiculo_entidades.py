import asyncio
from sqlalchemy import text
from app.core.database import motor

async def migrate_vehiculo_entidades():
    async with motor.begin() as conn:
        print("Sincronizando entidades de vehículos con las de sus socios registrados...")
        try:
            # Ejecutar la consulta de actualización basada en la entidad del socio del vehículo
            query = """
            UPDATE vehiculos 
            SET entidad_id = usuarios.entidad_id 
            FROM usuarios 
            WHERE vehiculos.socio_id = usuarios.id 
              AND vehiculos.entidad_id IS NULL 
              AND usuarios.entidad_id IS NOT NULL;
            """
            result = await conn.execute(text(query))
            print(f"Sincronización completada. Registros actualizados.")
        except Exception as e:
            print(f"Error al sincronizar entidades: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_vehiculo_entidades())
