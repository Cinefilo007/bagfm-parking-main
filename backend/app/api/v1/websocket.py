from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from typing import Optional
from jose import JWTError

from app.core.notify_manager import manager
from app.core.security import decodificar_token
from app.core.config import obtener_config

router = APIRouter()
config = obtener_config()

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
    try:
        # Validar Token
        payload = decodificar_token(token)
        rol = payload.get("rol", "OTRO")
        entidad_id = payload.get("entidad_id")
        zona_id = payload.get("zona_id")
        
        # Conectar al gestor
        await manager.conectar(websocket, rol, entidad_id, zona_id)
        
        # Mantener conexión activa
        while True:
            # Esperar mensajes del cliente (opcional, mayormente enviamos nosotros)
            data = await websocket.receive_text()
            # Podríamos manejar pings o comandos simples aquí si fuera necesario
            
    except WebSocketDisconnect:
        manager.desconectar(websocket, rol, entidad_id, zona_id)
    except (JWTError, Exception) as e:
        # Si el token falla o hay error, cerramos
        print(f"WS Auth Error: {str(e)}")
        await websocket.close(code=1008) # Policy Violation
