from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from typing import Optional
from pydantic import BaseModel

app = FastAPI()

class ZonaEstacionamientoBase(BaseModel):
    nombre: str
    capacidad_total: int
    usa_puestos_identificados: bool = False
    tipo: Optional[str] = None
    descripcion_ubicacion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    punto_acceso_lat: Optional[float] = None
    punto_acceso_lon: Optional[float] = None
    radio_cobertura: int = 50
    tiempo_limite_llegada_min: int = 15
    activo: bool = True

class ZonaEstacionamientoCrear(ZonaEstacionamientoBase):
    pass

@app.post("/zonas")
async def crear_zona(datos: ZonaEstacionamientoCrear):
    return {"status": "ok"}

client = TestClient(app)

response = client.post("/zonas", json={
    "nombre": "Zona Norte",
    "capacidad_total": 50,
    "descripcion_ubicacion": None,
    "latitud": None,
    "longitud": None,
    "tiempo_limite_llegada_min": 15
})
print("STATUS:", response.status_code)
if response.status_code != 200:
    print("DETAIL:", response.json())
