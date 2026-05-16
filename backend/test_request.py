import urllib.request, json
import sqlite3, jwt, sys
sys.path.append('c:/Users/Admin/Desktop/bagfm/backend')
from app.core.security import crear_token_acceso

token = crear_token_acceso({'sub': '12345678-1234-1234-1234-123456789012', 'rol': 'COMANDANTE'})
data = json.dumps({'nombre': 'Test', 'capacidad_total': 10, 'tiempo_limite_llegada_min': 15}).encode()
req = urllib.request.Request('http://localhost:8001/api/v1/zonas', data=data, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
try:
    print(urllib.request.urlopen(req).read())
except Exception as e:
    print('ERROR:', getattr(e, 'read', lambda: str(e))())
