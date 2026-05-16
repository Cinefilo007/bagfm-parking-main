
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
import sys

# Añadir el path del backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.core.config import obtener_config

async def cleanup_db_raw():
    config = obtener_config()
    engine = create_async_engine(config.database_url)

    async with engine.begin() as conn:
        print("--- INICIANDO LIMPIEZA TÁCTICA (SQL DIRECTO) ---")
        
        # 1. Limpiar logs de trazabilidad
        print("Limpiando logs de acceso y eventos...")
        await conn.execute(text("DELETE FROM accesos"))
        await conn.execute(text("DELETE FROM infracciones"))
        await conn.execute(text("DELETE FROM solicitudes_evento"))
        await conn.execute(text("DELETE FROM lotes_pase_masivo"))
        await conn.execute(text("DELETE FROM guardias_turno"))
        
        # 2. Identificar y eliminar Socios y Temporales
        print("Eliminando perfiles de SOCIO y pases temporales...")
        # Eliminamos dependencias primero para evitar errores de FK
        await conn.execute(text("""
            DELETE FROM codigos_qr 
            WHERE usuario_id IN (
                SELECT id FROM usuarios WHERE rol = 'SOCIO' OR cedula LIKE 'BAGFM-%' OR cedula LIKE 'TEMP-%'
            )
        """))
        
        await conn.execute(text("""
            DELETE FROM membresias 
            WHERE socio_id IN (
                SELECT id FROM usuarios WHERE rol = 'SOCIO' OR cedula LIKE 'BAGFM-%' OR cedula LIKE 'TEMP-%'
            )
        """))
        
        await conn.execute(text("""
            DELETE FROM vehiculos 
            WHERE socio_id IN (
                SELECT id FROM usuarios WHERE rol = 'SOCIO' OR cedula LIKE 'BAGFM-%' OR cedula LIKE 'TEMP-%'
            )
        """))
        
        # Finalmente los usuarios
        await conn.execute(text("""
            DELETE FROM usuarios 
            WHERE rol = 'SOCIO' OR cedula LIKE 'BAGFM-%' OR cedula LIKE 'TEMP-%'
        """))
        
        print("--- LIMPIEZA COMPLETADA EXITOSAMENTE ---")

if __name__ == "__main__":
    asyncio.run(cleanup_db_raw())
