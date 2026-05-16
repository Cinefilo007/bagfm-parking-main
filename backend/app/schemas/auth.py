from pydantic import BaseModel

class LoginEntrada(BaseModel):
    cedula: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class CambioPasswordEntrada(BaseModel):
    nueva_password: str
