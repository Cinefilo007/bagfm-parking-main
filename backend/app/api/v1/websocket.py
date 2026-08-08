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

async def _resolver_pantalla(token: str) -> Optional[str]:
    """
    Devuelve el punto de acceso de una pantalla de garita a partir de su token.

    Se consulta la base en cada conexión para que revocar la pantalla en el panel
    corte también su WebSocket la próxima vez que reconecte.
    """
    from sqlalchemy import select
    from app.core.database import FabricaSesion
    from app.core.tokens import hashear_token
    from app.models.pantalla_monitor import PantallaMonitor

    try:
        async with FabricaSesion() as db:
            punto_id = (await db.execute(
                select(PantallaMonitor.punto_acceso_id).where(
                    PantallaMonitor.token_hash == hashear_token(token),
                    PantallaMonitor.activa == True,
                )
            )).scalars().first()
            return str(punto_id) if punto_id else None
    except Exception as e:
        print(f"WS: no se pudo resolver la pantalla: {e}")
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    pantalla: Optional[str] = Query(None),
):
    """
    Endpoint WebSocket para notificaciones.

    Dos formas de identificarse: el JWT de una persona en `token`, o el token de una
    pantalla de garita en `pantalla`. La pantalla queda suscrita ÚNICAMENTE al canal
    de su alcabala y a ningún canal de rol, así que solo puede recibir las detecciones
    de su propia puerta.
    """
    rol = "OTRO"
    entidad_id = None
    zona_id = None
    punto_id = None

    # ── Pantalla de garita ────────────────────────────────────────────────────
    if pantalla:
        punto_id = await _resolver_pantalla(pantalla)
        if not punto_id:
            await websocket.close(code=1008)
            return
        rol = "PANTALLA"
        try:
            await manager.conectar(websocket, rol, punto_id=punto_id)
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            manager.desconectar(websocket, rol, punto_id=punto_id)
        except Exception as e:
            print(f"WS Pantalla: {e}")
            manager.desconectar(websocket, rol, punto_id=punto_id)
        return

    if not token:
        await websocket.close(code=1008)
        return

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
