import os
from supabase import create_client, Client
from dotenv import load_dotenv

def verificar_diagnostico():
    # Cargar variables locales
    load_dotenv()
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    bucket_name = "bagfm-pases"

    print("🔍 INICIANDO DIAGNÓSTICO DE CONEXIÓN TÁCTICA...")
    print(f"📡 URL: {url}")
    print(f"🔑 Key detectada: {'SÍ' if key else 'NO'}")
    
    if not url or not key:
        print("❌ ERROR: Faltan credenciales en el archivo .env")
        return

    try:
        supabase: Client = create_client(url, key)
        
        # 1. Probar conexión básica
        print("🛠️  Probando autenticación...")
        # Intentamos listar buckets (requiere service_role)
        buckets = supabase.storage.list_buckets()
        print("✅ Conexión exitosa. Autenticación válida.")
        
        # 2. Verificar existencia del bucket
        bucket_existe = False
        for b in buckets:
            if b.name == bucket_name:
                bucket_existe = True
                break
        
        if bucket_existe:
            print(f"✅ Bucket '{bucket_name}' detectado y listo.")
        else:
            print(f"⚠️  ALERTA: El bucket '{bucket_name}' no existe en Supabase.")
            print("👉 Debes crearlo manualmente en la sección Storage de Supabase.")
            
    except Exception as e:
        print(f"❌ FALLO CRÍTICO DE CONEXIÓN: {e}")
        if "Invalid API key" in str(e):
            print("💡 RECOMENDACIÓN: La clave 'service_role' es incorrecta o está mal copiada.")

if __name__ == "__main__":
    verificar_diagnostico()
