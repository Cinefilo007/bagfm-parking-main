import pandas as pd
from faker import Faker
import random
import sys

# Inicializar Faker en español (es_ES para nombres y formatos realistas)
fake = Faker('es_ES')

def generar_datos_socios(cantidad=10):
    """
    Genera un archivo Excel de prueba para la carga masiva de socios permanentes.
    Formatos basados en la plantilla oficial de BAGFM.
    """
    data = []
    
    marcas = ["TOYOTA", "CHEVROLET", "FORD", "HYUNDAI", "MITSUBISHI", "JEEP", "MAZDA", "HONDA"]
    modelos = ["COROLLA", "AVEO", "F-150", "TUCSON", "LANCER", "CHEROKEE", "MAZDA 3", "CIVIC"]
    colores = ["BLANCO", "NEGRO", "GRIS", "PLATA", "AZUL", "ROJO", "VERDE", "BEIGE"]
    
    print(f"Generando {cantidad} registros de socios permanentes...")

    for i in range(cantidad):
        # Generar nombre y apellido por separado
        nombre_completo = fake.name().upper().split(" ")
        # Manejar nombres compuestos
        nombre = nombre_completo[0]
        apellido = " ".join(nombre_completo[1:]) if len(nombre_completo) > 1 else fake.last_name().upper()

        fila = {
            "CEDULA": f"V{random.randint(10000000, 30000000)}",
            "NOMBRE": nombre,
            "APELLIDO": apellido,
            "EMAIL": fake.email().lower(),
            "TELEFONO": fake.phone_number(),
            "PLACA": f"{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}{random.randint(100, 999)}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}",
            "MARCA": random.choice(marcas),
            "MODELO": random.choice(modelos),
            "COLOR": random.choice(colores)
        }
        data.append(fila)
    
    df = pd.DataFrame(data)
    
    # Asegurar el orden de las columnas según la plantilla
    cols = ["CEDULA", "NOMBRE", "APELLIDO", "EMAIL", "TELEFONO", "PLACA", "MARCA", "MODELO", "COLOR"]
    df = df[cols]
    
    filename = f"pruebas_socios_{cantidad}_pax.xlsx"
    df.to_excel(filename, index=False)
    print(f"Archivo '{filename}' generado con exito.")

if __name__ == "__main__":
    # Obtener cantidad de registros de los argumentos de línea de comandos
    num_registros = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    generar_datos_socios(num_registros)
