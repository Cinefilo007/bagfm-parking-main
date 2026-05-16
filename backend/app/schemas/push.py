from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    dispositivo: Optional[str] = None

class PushSubscriptionSchema(BaseModel):
    id: UUID
    usuario_id: UUID
    endpoint: str
    p256dh: str
    auth: str
    dispositivo: Optional[str] = None
    activo: bool

    class Config:
        from_attributes = True
