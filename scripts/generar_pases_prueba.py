import pandas as pd
from faker import Faker
import random
import sys

# Configuración de Faker con localización para español general (usaremos custom para VE)
fake = Faker('es_ES')

def generar_placa():
    """Genera una placa con formato venezolano (3 letras - 3 números o 7 letras/nums)"""
    letras = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=3))
    numeros = "".join(random.choices("0123456789", k=3))
    modos = [f"{letras}{numeros}", f"{letras}-{numeros}", f"AC{random.randint(100,999)}BA"]
    return random.choice(modos)

def generar_cedula():
    """Genera una cédula venezolana realista"""
    tipo = random.choice(["V", "E"])
    numero = random.randint(5000000, 32000000)
    return f"{tipo}-{numero}"

def generar_telefono():
    """Genera un teléfono venezolano realista"""
    cod = random.choice(["0412", "0414", "0424", "0416", "0426", "0212"])
    num = "".join(random.choices("0123456789", k=7))
    return f"{cod}{num}"

def script_generador(n_pases=10, n_vehiculos=1):
    print(f"--- GENERADOR TÁCTICO DE DATOS (BAGFM v2.2) ---")
    print(f"Generando {n_pases} registros con {n_vehiculos} vehículos por pase...")

    marcas = ["TOYOTA", "CHEVROLET", "FORD", "HYUNDAI", "MITSUBISHI", "JEEP", "RENAULT"]
    modelos = {
        "TOYOTA": ["COROLLA", "HILUX", "FORTUNER", "YARIS"],
        "CHEVROLET": ["AVEO", "OPTRA", "SILVERADO", "CRUZE"],
        "FORD": ["FIESTA", "EXPLORER", "F-150", "ECOSPORT"],
        "HYUNDAI": ["GETZ", "TUCSON", "ELANTRA"],
        "MITSUBISHI": ["LANCER", "MONTERO"],
        "JEEP": ["CHEROKEE", "WRANGLER"],
        "RENAULT": ["LOGAN", "DUSTER"]
    }
    colores = ["BLANCO", "NEGRO", "GRIS", "PLATA", "AZUL", "ROJO", "VERDE"]

    data = []
    for _ in range(n_pases):
        row = {
            "NOMBRE COMPLETO": fake.name().upper(),
            "CEDULA": generar_cedula(),
            "EMAIL": fake.email().lower(),
            "TELEFONO": generar_telefono()
        }
        
        # Generar hasta 4 vehículos
        for i in range(1, 5):
            if i <= n_vehiculos:
                marca = random.choice(marcas)
                row[f"PLACA V{i}"] = generar_placa()
                row[f"MARCA V{i}"] = marca
                row[f"MODELO V{i}"] = random.choice(modelos[marca])
                row[f"COLOR V{i}"] = random.choice(colores)
            else:
                row[f"PLACA V{i}"] = ""
                row[f"MARCA V{i}"] = ""
                row[f"MODELO V{i}"] = ""
                row[f"COLOR V{i}"] = ""
        
        data.append(row)

    df = pd.DataFrame(data)
    
    # Asegurar orden exacto de columnas para el backend
    columnas_orden = [
        "NOMBRE COMPLETO", "CEDULA", "EMAIL", "TELEFONO",
        "PLACA V1", "MARCA V1", "MODELO V1", "COLOR V1",
        "PLACA V2", "MARCA V2", "MODELO V2", "COLOR V2",
        "PLACA V3", "MARCA V3", "MODELO V3", "COLOR V3",
        "PLACA V4", "MARCA V4", "MODELO V4", "COLOR V4"
    ]
    df = df[columnas_orden]

    filename = f"pruebas_pases_{n_pases}_pax.xlsx"
    df.to_excel(filename, index=False)
    print(f"ARCHIVO GENERADO CON ÉXITO: {filename}")

if __name__ == "__main__":
    pases = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    vehs = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    script_generador(pases, vehs)
