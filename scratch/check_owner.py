import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        # Dueño de la placa
        res_owner = conn.execute(text("SELECT nombre, apellido, cedula FROM usuarios WHERE id = 'f4c50696-80c6-439d-8477-580fb141ad67'")).first()
        if res_owner:
            print(f"DUEÑO_PLACA: {res_owner.nombre} {res_owner.apellido} (Cédula: {res_owner.cedula})")
        else:
            print("Dueño no encontrado en usuarios")
            
        # Adán Molina
        res_adan = conn.execute(text("SELECT id, nombre, apellido, cedula FROM usuarios WHERE nombre = 'ADÁN' AND apellido = 'MOLINA PERALES'")).first()
        if res_adan:
            print(f"ADAN_ID: {res_adan.id} (Cédula: {res_adan.cedula})")
        else:
            print("Adán Molina no encontrado")

except Exception as e:
    print(f"ERROR: {str(e)}")
