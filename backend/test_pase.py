
import asyncio
import sys
import os

sys.path.append(os.getcwd())

import app.models.usuario
import app.models.vehiculo
import app.models.membresia
import app.models.infraccion
import app.models.codigo_qr
import app.models.entidad_civil
import app.models.vehiculo_pase
import app.models.puesto_estacionamiento
import app.models.zona_estacionamiento
import app.models.asignacion_zona
import app.models.tipo_acceso_custom
import app.models.alcabala_evento

from app.core.database import FabricaSesion
from app.services.comando_service import comando_service
from sqlalchemy import select
from app.models.zona_estacionamiento import ZonaEstacionamiento

async def test():
    async with FabricaSesion() as db:
        z = (await db.execute(select(ZonaEstacionamiento).limit(1))).scalars().first()
        if not z:
            print("No hay zonas")
            return
            
        print(f"Zona ID: {z.id}")
        
        datos = {
            "nombre_portador": "Test",
            "vehiculo_placa": "ABC1234",
            "es_permanente": False,
            "dias_vigencia": 7
        }
        
        try:
            from uuid import UUID
            dummy_uid = UUID("96476a7e-594b-44a1-ba7e-4623b10a2348")
            pase = await comando_service.generar_pase_base(db, z.id, datos, dummy_uid)
            
            from app.schemas.codigo_qr import CodigoQRSalida
            out = CodigoQRSalida.model_validate(pase)
            import json
            import codecs
            with codecs.open('out.json', 'w', encoding='utf-8') as f:
                f.write(json.dumps(out.model_dump(mode='json'), indent=2))
            print("Escrito a out.json")
        except Exception as e:
            print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test())
