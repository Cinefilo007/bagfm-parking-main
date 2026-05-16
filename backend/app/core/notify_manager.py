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

    async def conectar(self, websocket: WebSocket, rol: str, entidad_id: str = None, zona_id: str = None):
        await websocket.accept()
        
        if rol not in self.active_connections:
            self.active_connections[rol] = []
        self.active_connections[rol].append(websocket)
        
        if entidad_id:
            ch_key = f"ENTIDAD_{entidad_id}"
            if ch_key not in self.channel_connections:
                self.channel_connections[ch_key] = []
            self.channel_connections[ch_key].append(websocket)
            
        if zona_id:
            ch_key = f"ZONA_{zona_id}"
            if ch_key not in self.channel_connections:
                self.channel_connections[ch_key] = []
            self.channel_connections[ch_key].append(websocket)

    def desconectar(self, websocket: WebSocket, rol: str, entidad_id: str = None, zona_id: str = None):
        if rol in self.active_connections and websocket in self.active_connections[rol]:
            self.active_connections[rol].remove(websocket)
            
        if entidad_id:
            ch_key = f"ENTIDAD_{entidad_id}"
            if ch_key in self.channel_connections and websocket in self.channel_connections[ch_key]:
                self.channel_connections[ch_key].remove(websocket)
                
        if zona_id:
            ch_key = f"ZONA_{zona_id}"
            if ch_key in self.channel_connections and websocket in self.channel_connections[ch_key]:
                self.channel_connections[ch_key].remove(websocket)

    async def enviar_mensaje_personal(self, mensaje: str, websocket: WebSocket):
        await websocket.send_text(mensaje)

    async def broadcast(self, mensaje: dict, roles: List[str] = None, channels: List[str] = None):
        """
        Envía un mensaje a todos los usuarios con los roles o canales especificados.
        """
        objetivos = roles if roles else ["ALCABALA", "COMANDANTE", "ADMIN_BASE", "SUPERVISOR"]
        canales = channels if channels else []
        
        mensaje_json = json.dumps(mensaje)
        
        for rol in objetivos:
            if rol in self.active_connections:
                for connection in self.active_connections[rol]:
                    try:
                        await connection.send_text(mensaje_json)
                    except Exception:
                        # Si una conexión falla (browser cerrado abruptamente), se ignora aquí
                        # y se limpiará en el endpoint del WS
                        pass

# Instancia global del gestor
manager = NotifyManager()
