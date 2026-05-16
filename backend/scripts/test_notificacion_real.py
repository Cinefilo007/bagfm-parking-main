
import asyncio
import os
import sys
from sqlalchemy import select
from uuid import UUID

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.services.notificacion_service import notificacion_service

async def test():
    # Datos del último acceso fallido
    zona_id = UUID("1845d708-c776-4bac-bb10-6d3ef848a1f5")
    placa = "LB128T"
    detalles = "COROLLA BLANCO"
    nombre = "VICTORIA"
    
    async with FabricaSesion() as db:
        print(f"=== SIMULANDO NOTIFICACION EN ZONA {zona_id} ===")
        await notificacion_service.notificar_entrada_vehiculo(
            db, 
            zona_id=zona_id,
            placa=placa,
            detalles_vehiculo=detalles,
            nombre_socio=nombre
        )
        print("Simulación completada (revisar logs de arriba si los hay)")

if __name__ == "__main__":
    asyncio.run(test())
