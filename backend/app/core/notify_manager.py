from typing import List, Dict
from fastapi import WebSocket
import json

class NotifyManager:
    """
    Gestor de conexiones WebSocket para notificaciones en tiempo real.
    Permite el broadcast de alertas sobre infracciones a los actores correspondientes.
    """
    def __init__(self):
        # Conexiones activas agrupadas por rol para broadcast selectivo
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Conexiones adicionales agrupadas por ID (entidad_id, zona_id, etc)
        self.channel_connections: Dict[str, List[WebSocket]] = {}

    def _canales_de(self, entidad_id: str = None, zona_id: str = None, punto_id: str = None) -> List[str]:
        claves = []
        if entidad_id:
            claves.append(f"ENTIDAD_{entidad_id}")
        if zona_id:
            claves.append(f"ZONA_{zona_id}")
        if punto_id:
            claves.append(f"PUNTO_{punto_id}")
        return claves

    async def conectar(self, websocket: WebSocket, rol: str, entidad_id: str = None, zona_id: str = None, punto_id: str = None):
        await websocket.accept()

        if rol not in self.active_connections:
            self.active_connections[rol] = []
        self.active_connections[rol].append(websocket)

        for ch_key in self._canales_de(entidad_id, zona_id, punto_id):
            if ch_key not in self.channel_connections:
                self.channel_connections[ch_key] = []
            self.channel_connections[ch_key].append(websocket)

    def desconectar(self, websocket: WebSocket, rol: str, entidad_id: str = None, zona_id: str = None, punto_id: str = None):
        if rol in self.active_connections and websocket in self.active_connections[rol]:
            self.active_connections[rol].remove(websocket)

        for ch_key in self._canales_de(entidad_id, zona_id, punto_id):
            if ch_key in self.channel_connections and websocket in self.channel_connections[ch_key]:
                self.channel_connections[ch_key].remove(websocket)

    async def enviar_mensaje_personal(self, mensaje: str, websocket: WebSocket):
        await websocket.send_text(mensaje)

    async def broadcast(self, mensaje: dict, roles: List[str] = None, channels: List[str] = None):
        """
        Envía un mensaje a los roles y/o canales indicados.

        Cuando se pasan `channels`, NO se hace difusión por rol: un evento dirigido a
        una alcabala concreta no debe aparecerle al guardia de la otra. Pasar `roles`
        junto a `channels` combina ambos destinos.

        Una conexión suscrita a varios destinos recibe el mensaje una sola vez.
        """
        if roles is None and channels is None:
            roles = ["ALCABALA", "COMANDANTE", "ADMIN_BASE", "SUPERVISOR"]

        destinatarios = []
        for rol in (roles or []):
            destinatarios.extend(self.active_connections.get(rol, []))
        for canal in (channels or []):
            destinatarios.extend(self.channel_connections.get(canal, []))

        mensaje_json = json.dumps(mensaje, default=str)

        enviados = set()
        for connection in destinatarios:
            if id(connection) in enviados:
                continue
            enviados.add(id(connection))
            try:
                await connection.send_text(mensaje_json)
            except Exception:
                # Si una conexión falla (browser cerrado abruptamente), se ignora aquí
                # y se limpiará en el endpoint del WS
                pass

# Instancia global del gestor
manager = NotifyManager()
