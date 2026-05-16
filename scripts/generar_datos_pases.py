import pandas as pd
from faker import Faker
import random

# Inicializar Faker en español (Regionalizado para mayor realismo, aunque usemos es_ES)
fake = Faker('es_ES')

def generar_datos_prueba(cantidad_pases=10, max_vehiculos=4):
    """
    Genera un archivo Excel de prueba compatible con BAGFM v2.2 (20 columnas).
    """
    data = []
    
    marcas = ["TOYOTA", "CHEVROLET", "FORD", "HYUNDAI", "MITSUBISHI", "JEEP"]
    colores = ["BLANCO", "NEGRO", "GRIS", "PLATA", "AZUL", "ROJO", "VERDE"]
    
    for i in range(cantidad_pases):
        fila = {
            "NOMBRE COMPLETO": fake.name().upper(),
            "CEDULA": f"V{random.randint(10000000, 30000000)}",
            "EMAIL": fake.email().lower(),
            "TELEFONO": fake.phone_number()
        }
        
        # Generar hasta 4 vehículos
        num_vehiculos = random.randint(1, max_vehiculos)
        for v in range(1, 5):
            if v <= num_vehiculos:
                fila[f"V{v}_PLACA"] = f"{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}{random.randint(100, 999)}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}"
                fila[f"V{v}_MARCA"] = random.choice(marcas)
                fila[f"V{v}_MODELO"] = "MODELO_TEST"
                fila[f"V{v}_COLOR"] = random.choice(colores)
            else:
                fila[f"V{v}_PLACA"] = ""
                fila[f"V{v}_MARCA"] = ""
                fila[f"V{v}_MODELO"] = ""
                fila[f"V{v}_COLOR"] = ""
        
        data.append(fila)
    
    df = pd.DataFrame(data)
    
    # Asegurar el orden de las columnas según la plantilla v2.2
    cols = [
        "NOMBRE COMPLETO", "CEDULA", "EMAIL", "TELEFONO", 
        "V1_PLACA", "V1_MARCA", "V1_MODELO", "V1_COLOR",
        "V2_PLACA", "V2_MARCA", "V2_MODELO", "V2_COLOR",
        "V3_PLACA", "V3_MARCA", "V3_MODELO", "V3_COLOR",
        "V4_PLACA", "V4_MARCA", "V4_MODELO", "V4_COLOR"
    ]
    df = df[cols]
    
    filename = f"registros_prueba_{cantidad_pases}_pases.xlsx"
    df.to_excel(filename, index=False)
    print(f"✅ Archivo '{filename}' generado con éxito.")

if __name__ == "__main__":
    import sys
    num_pases = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    generar_datos_prueba(num_pases)
