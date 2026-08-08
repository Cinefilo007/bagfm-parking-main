from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from typing import Optional
from jose import JWTError

from app.core.notify_manager import manager
from app.core.security import decodificar_token
from app.core.config import obtener_config

router = APIRouter()
config = obtener_config()


async def _resolver_punto_de_guardia(usuario_id: Optional[str]) -> Optional[str]:
    """Devuelve el id del punto de acceso asignado a la cuenta de guardia, si lo hay."""
    if not usuario_id:
        return None
    from sqlalchemy import select
    from app.core.database import FabricaSesion
    from app.models.alcabala_evento import PuntoAcceso

    try:
        async with FabricaSesion() as db:
            punto_id = (await db.execute(
                select(PuntoAcceso.id).where(
                    PuntoAcceso.usuario_id == usuario_id,
                    PuntoAcceso.activo == True,
                )
            )).scalars().first()
            return str(punto_id) if punto_id else None
    except Exception as e:
        # Un fallo aquí no debe tumbar la conexión: el guardia queda sin canal de
        # punto pero sigue recibiendo las notificaciones por rol.
        print(f"WS: no se pudo resolver el punto de acceso del guardia: {e}")
        return None

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    Endpoint WebSocket para notificaciones.
    El cliente debe enviar el JWT en el query parameter 'token'.
    """
    rol = "OTRO"
    entidad_id = None
    zona_id = None
    punto_id = None
    try:
        # Validar Token
        payload = decodificar_token(token)
        rol = payload.get("rol", "OTRO")
        entidad_id = payload.get("entidad_id")
        zona_id = payload.get("zona_id")

        # El guardia de alcabala se suscribe al canal de SU punto de acceso, para que
        # las detecciones de una alcabala no le lleguen al guardia de la otra.
        # Se resuelve contra la BD y no desde el token para no invalidar las sesiones
        # ya emitidas: la cuenta de cada alcabala es fija (ver PuntoAcceso.usuario_id).
        if rol == "ALCABALA":
            punto_id = await _resolver_punto_de_guardia(payload.get("sub"))

        # Conectar al gestor
        await manager.conectar(websocket, rol, entidad_id, zona_id, punto_id)

        # Mantener conexión activa
        while True:
            # Esperar mensajes del cliente (opcional, mayormente enviamos nosotros)
            data = await websocket.receive_text()
            # Podríamos manejar pings o comandos simples aquí si fuera necesario
            
    except WebSocketDisconnect:
        manager.desconectar(websocket, rol, entidad_id, zona_id, punto_id)
    except (JWTError, Exception) as e:
        # Si el token falla o hay error, cerramos
        print(f"WS Auth Error: {str(e)}")
        await websocket.close(code=1008) # Policy Violation
