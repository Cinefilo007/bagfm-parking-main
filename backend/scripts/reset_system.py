import asyncio
import os
import sys
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# No necesitamos los modelos si usamos SQL puro
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_path)

from app.core.config import obtener_config
import httpx

config = obtener_config()

async def reset_system():
    print("🚀 INICIANDO RESET TOTAL DEL SISTEMA BAGFM (MODO RAW SQL)...")
    
    engine = create_async_engine(config.database_url)
    
    async with engine.begin() as conn:
        # 1. IDENTIFICAR AL COMANDANTE FIDEL PACHECO
        print("🔍 Buscando al Comandante Fidel Pacheco...")
        res = await conn.execute(text("SELECT * FROM usuarios WHERE nombre ILIKE '%Fidel%' AND rol = 'COMANDANTE' LIMIT 1"))
        comandante = res.fetchone()

        if not comandante:
            print("❌ ERROR: No se encontró al Comandante Fidel Pacheco. Abortando para evitar bloqueo total.")
            return

        print(f"✅ Comandante encontrado: {comandante.nombre} ({comandante.cedula})")
        
        # Convertir Row a dict (depende de la version de sqlalchemy, usamos _mapping si existe)
        comandante_data = dict(comandante._mapping)

        # 2. LIMPIEZA DE BASE DE DATOS (TRUNCATE CASCADE)
        print("扫 Limpiando todas las tablas...")
        
        # Obtener todas las tablas del esquema public
        res_tables = await conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename != 'alembic_version'"))
        tablas = [r[0] for r in res_tables]

        for tabla in tablas:
            try:
                await conn.execute(text(f"TRUNCATE TABLE {tabla} RESTART IDENTITY CASCADE;"))
                print(f"   - Tabla {tabla} limpia.")
            except Exception as e:
                print(f"   - Error en tabla {tabla}: {e}")

        # 3. RESTAURAR AL COMANDANTE
        print("👑 Restaurando al Comandante Fidel Pacheco...")
        
        # Limpiar campos que no queremos insertar (como id si es generado) 
        # o mejor insertar todo si queremos mantener el mismo ID
        cols = ", ".join(comandante_data.keys())
        params = ", ".join([f":{k}" for k in comandante_data.keys()])
        
        await conn.execute(text(f"INSERT INTO usuarios ({cols}) VALUES ({params})"), comandante_data)
        print("✅ Comandante restaurado con éxito.")

    # 4. LIMPIEZA DE SUPABASE STORAGE
    print("☁️ Limpiando almacenamiento en Supabase...")
    # Usar httpx directamente para listar y borrar si el cliente de python da problemas en script
    headers = {
        "Authorization": f"Bearer {config.supabase_service_key}",
        "apiKey": config.supabase_service_key
    }
    
    storage_url = f"{config.supabase_url}/storage/v1"
    
    async with httpx.AsyncClient() as client:
        try:
            # Listar Buckets
            res_b = await client.get(f"{storage_url}/bucket", headers=headers)
            buckets = res_b.json()
            
            for bucket in buckets:
                b_id = bucket['id']
                print(f"   - Limpiando bucket: {b_id}")
                
                # Listar archivos en el bucket
                res_f = await client.post(f"{storage_url}/object/list/{b_id}", headers=headers, json={"prefix": "", "limit": 100})
                files = res_f.json()
                
                if files:
                    file_names = [f['name'] for f in files if f['name'] != '.emptyFolderPlaceholder']
                    if file_names:
                        await client.delete(f"{storage_url}/object/{b_id}", headers=headers, json={"prefixes": file_names})
                        print(f"     ✅ Eliminados {len(file_names)} archivos.")
                    else:
                        print("     ℹ️ Bucket vacío.")
        except Exception as e:
            print(f"❌ Error limpiando Storage: {e}")

    print("\n✨ RESET COMPLETADO. El sistema está limpio y Fidel Pacheco es el único usuario.")

if __name__ == "__main__":
    asyncio.run(reset_system())
