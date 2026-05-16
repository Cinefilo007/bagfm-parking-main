
import asyncio
import os
import sys
from uuid import UUID, uuid4

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.models.codigo_qr import CodigoQR
from app.models.enums import QRTipo, AccesoTipo
from app.services.acceso_service import acceso_service
from app.schemas.acceso import AccesoRegistrar

async def test_full_cycle():
    # Zona de Juan Garcia: Est Club de Futbol
    zona_id = UUID('51a3f031-47d5-4a83-82cf-38ba441db3a0')
    
    async with FabricaSesion() as db:
        # 1. Crear un QR de prueba
        qr = CodigoQR(
            id=uuid4(),
            tipo=QRTipo.temporal,
            token="TEST_TOKEN_" + str(uuid4()),
            zona_asignada_id=zona_id,
            vehiculo_placa="PLACA-DIAG",
            nombre_portador="TEST DIAGNOSTICO",
            activo=True
        )
        db.add(qr)
        await db.commit()
        await db.refresh(qr)
        print(f"QR creado: {qr.id} con zona {qr.zona_asignada_id}")
        
        # 2. Registrar acceso
        datos = AccesoRegistrar(
            qr_id=qr.id,
            tipo=AccesoTipo.entrada,
            punto_acceso="ALCABALA DIAGNOSTICO",
            vehiculo_placa="PLACA-DIAG"
        )
        
        # ID de un usuario administrador para registrado_por
        admin_id = UUID('0c103a50-697a-4ee4-83c0-b243cebd4004') # Tomado de los logs previos
        
        print("Registrando acceso...")
        try:
            nuevo_acceso = await acceso_service.registrar_acceso(db, datos, admin_id)
            print(f"Acceso registrado: {nuevo_acceso.id}")
            print(f"Zona en nuevo_acceso: {nuevo_acceso.zona_id}")
            
            if nuevo_acceso.zona_id is None:
                print("FALLA DETECTADA: La zona en el acceso es None")
            else:
                print("EXITO: La zona se persistio correctamente")
                
        except Exception as e:
            print(f"Error en registrar_acceso: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_full_cycle())
