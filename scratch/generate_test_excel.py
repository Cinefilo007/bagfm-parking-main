import pandas as pd
import os

def generate_partial_test_excel(filename="PRUEBA_PASES_PARCIALES.xlsx"):
    # Estructura de columnas basada en el backend (20 columnas)
    # [NOMBRE, CEDULA, EMAIL, TELEFONO, V1_PLACA, V1_MARCA, V1_MODELO, V1_COLOR, ...]
    
    data = [
        # 1. Datos Completos (Debe marcarse como completo)
        ["JUAN COMPLETO", "V-12345678", "juan@ejemplo.com", "04141112233", "ABC123", "TOYOTA", "COROLLA", "BLANCO"],
        
        # 2. Falta Color del Vehículo (Debe marcarse como incompleto)
        ["PEDRO SIN COLOR", "V-87654321", "pedro@ejemplo.com", "04245556677", "XYZ789", "CHEVROLET", "AVEO", None],
        
        # 3. Falta Cédula (Debe marcarse como incompleto)
        ["MARIA SIN CEDULA", None, "maria@ejemplo.com", "04128889900", "QWE456", "FORD", "FIESTA", "GRIS"],
        
        # 4. Falta Marca y Modelo (Debe marcarse como incompleto)
        ["LUIS SOLO PLACA", "V-11223344", "luis@ejemplo.com", "04163334455", "JKL012", None, None, "NEGRO"],
        
        # 5. Solo Nombre (Casi todo vacío, debe marcarse como incompleto)
        ["ANONIMO CON PASE", None, None, None, None, None, None, None],
        
        # 6. Datos de vehículo vacíos pero cédula presente (Incompleto)
        ["RENE SIN CARRO", "V-99887766", "rene@ejemplo.com", "04140001122", None, None, None, None]
    ]

    # Rellenar con None hasta completar las 20 columnas por fila
    full_data = []
    for row in data:
        full_row = (row + [None] * 20)[:20]
        full_data.append(full_row)

    columns = [
        "NOMBRE COMPLETO", "CEDULA", "EMAIL", "TELEFONO",
        "PLACA V1", "MARCA V1", "MODELO V1", "COLOR V1",
        "PLACA V2", "MARCA V2", "MODELO V2", "COLOR V2",
        "PLACA V3", "MARCA V3", "MODELO V3", "COLOR V3",
        "PLACA V4", "MARCA V4", "MODELO V4", "COLOR V4"
    ]

    df = pd.DataFrame(full_data, columns=columns)
    
    # Guardar el archivo
    df.to_excel(filename, index=False)
    print(f"Archivo de prueba generado: {os.path.abspath(filename)}")
    print("\nResumen de casos incluidos:")
    print("1. Juan Completo: Todos los datos (Debe mostrar QR directo)")
    print("2. Pedro Sin Color: Falta color (Debe pedir completar en portal)")
    print("3. Maria Sin Cedula: Falta cédula (Debe pedir completar en portal)")
    print("4. Luis Solo Placa: Falta marca/modelo (Debe pedir completar en portal)")
    print("5. Anonimo: Solo nombre (Debe pedir completar en portal)")
    print("6. Rene Sin Carro: Sin datos de vehículo (Debe pedir completar en portal)")

if __name__ == "__main__":
    generate_partial_test_excel()
