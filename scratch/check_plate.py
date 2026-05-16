import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT * FROM vehiculos WHERE placa = 'AC255LB'")).first()
        if res:
            print(f"PLACA_ENCONTRADA_SOCIO_ID: {res.socio_id}")
        else:
            print("PLACA_NO_ENCONTRADA")
except Exception as e:
    print(f"ERROR: {str(e)}")
