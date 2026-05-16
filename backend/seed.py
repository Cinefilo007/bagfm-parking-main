import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import FabricaSesion, motor
from app.core.security import hashear_password
from app.models.base import Base # Necesario para registrar todas las tablas y evitar errores FK
from app.models.usuario import Usuario
from app.models.configuracion import ConfiguracionSistema
from app.models.enums import RolTipo

async def seed_inicial():
    """Inyecta el usuario Comandante y configs por defecto a la base de datos."""
    async with FabricaSesion() as db:
        try:
            print("== Iniciando Seed BAGFM ==")
            # 1. Crear usuario Comandante si no existe
            query_cmd = select(Usuario).where(Usuario.cedula == "admin")
            res = await db.execute(query_cmd)
            comandante = res.scalar_one_or_none()

            if not comandante:
                print("Creando usuario Comandante (cedula: admin, password: admin)...")
                nuevo_cmd = Usuario(
                    cedula="admin",
                    nombre="Comandante",
                    apellido="Base Aérea",
                    email="comando@bagfm.mil.ve",
                    rol=RolTipo.COMANDANTE,
                    password_hash=hashear_password("admin"),
                    activo=True
                )
                db.add(nuevo_cmd)
            else:
                print("Usuario Comandante ya existe.")

            # 2. Inyectar configuración
            configs_defaults = [
                ("salida_requerida", "false", "Si la alcabala debe registrar obligatoriamente la salida"),
                ("max_vehiculos_por_evento", "50", "Límite default de cupos temporal solicitados por evento"),
                ("qr_expiracion_temporal_horas", "24", "Tiempo de vida de un QR de evento"),
                ("bloquear_salida_por_infraccion", "true", "Impide salir de la base a un vehículo con multa"),
            ]

            for clave, valor, desc in configs_defaults:
                query_cfg = select(ConfiguracionSistema).where(ConfiguracionSistema.clave == clave)
                res_cfg = await db.execute(query_cfg)
                if not res_cfg.scalar_one_or_none():
                    print(f"Configurando '{clave}'...")
                    db.add(ConfiguracionSistema(clave=clave, valor=valor, descripcion=desc))

            await db.commit()
            print("== Seed finalizado con éxito ==")

        except IntegrityError as e:
            await db.rollback()
            print(f"Error de integridad: {e}")
        except Exception as e:
            await db.rollback()
            print(f"Error inesperado: {e}")
        finally:
            await motor.dispose()

if __name__ == "__main__":
    asyncio.run(seed_inicial())
