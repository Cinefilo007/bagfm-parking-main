from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
import os

from app.core.database import obtener_db
from app.services.cron_service import cron_service

router = APIRouter()

# Secreto para disparar el cron desde Railway u otro servicio externo
CRON_SECRET = os.getenv("CRON_SECRET", "bagfm_internal_secret_2024")

@router.post("/run")
async def ejecutar_cron(
    x_cron_secret: str = Header(None),
    db: AsyncSession = Depends(obtener_db)
):
    """
    Disparador manual de las tareas de fondo.
    Debe ser llamado periódicamente por un scheduler externo.
    """
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=403, detail="No autorizado para ejecutar tareas de sistema")
    
    try:
        resultado = await cron_service.ejecutar_ciclo_seguridad(db)
        return {
            "estado": "completado",
            "detalles": resultado
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en ciclo de seguridad: {str(e)}")
