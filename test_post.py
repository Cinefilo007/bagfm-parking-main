import requests
import json

URL = "http://127.0.0.1:8000/api/v1/entidades/"
PAYLOAD = {
    "nombre": "TEST ENTIDAD",
    "capacidad_vehiculos": 10,
    "admin_cedula": "V-999999",
    "admin_nombre": "Test",
    "admin_apellido": "User",
    "admin_email": "test@test.com",
    "admin_password": "password123"
}

# we need a token to test, but let's see if we get a 422 or 401/403
# A 422 happens before auth if the schema is checked by FastAPI
try:
    response = requests.post(URL, json=PAYLOAD)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
