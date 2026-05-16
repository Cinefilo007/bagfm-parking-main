
import asyncio
import asyncpg
import sys

async def purge():
    # URL extraída de .env (reemplazando asyncpg por el protocolo estándar si fuera necesario, 
    # pero asyncpg.connect acepta la URL tal cual usualmente)
    url = "postgresql://postgres.yvrrokpxmrucqctilsxl:Sam7268357.@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
    
    try:
        print(f"Estableciendo conexión con el núcleo de datos...")
        conn = await asyncpg.connect(url)
        
        print("Ejecutando protocolo de purga en la tabla 'accesos'...")
        await conn.execute("DELETE FROM accesos")
        
        # Opcional: reiniciar secuencias si las hay
        # await conn.execute("ALTER SEQUENCE accesos_id_seq RESTART WITH 1")
        
        await conn.close()
        print("Sincronización de base de datos completada. Todos los registros de acceso han sido eliminados.")
        
    except Exception as e:
        print(f"Fallo en el protocolo de purga: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(purge())
