
import asyncio
import os
import sys
from uuid import UUID

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import app.models.base
from app.core.database import FabricaSesion
from app.services.notificacion_service import notificacion_service

async def test_notif():
    # Zona de Juan Garcia: Est Club de Futbol
    zona_id = UUID('51a3f031-47d5-4a83-82cf-38ba441db3a0')
    
    async with FabricaSesion() as db:
        print(f"Enviando notificacion de prueba a zona {zona_id}...")
        await notificacion_service.notificar_entrada_vehiculo(
            db,
            zona_id=zona_id,
            placa="TEST-123",
            detalles_vehiculo="Vehiculo de Prueba - AEGIS TACTICAL",
            nombre_socio="PRUEBA SISTEMA"
        )
        print("Hecho.")

if __name__ == "__main__":
    asyncio.run(test_notif())
