"""
Configuración global — BAGFM Backend
Carga variables de entorno via Pydantic Settings.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Configuracion(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Aplicación
    app_nombre: str = "BAGFM"
    app_version: str = "0.1.0"
    app_dominio: str = "localhost"
    app_env: str = "development"

    # Base de datos
    database_url: str
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Almacenamiento de archivos (reemplaza a Supabase Storage).
    # Ambos DEBEN ser volúmenes persistentes: si no, cada despliegue borra los archivos.
    # storage_dir se sirve como estático y es público (ZIP y PDF de pases).
    # storage_private_dir NO se sirve como estático: la evidencia fotográfica solo se
    # entrega por endpoints que validan el token del abastecimiento.
    storage_dir: str = "/app/storage"
    storage_url_prefix: str = "/archivos"
    storage_private_dir: str = "/app/privado"

    # JWT
    jwt_secret: str
    jwt_algoritmo: str = "HS256"
    jwt_expiracion_minutos: int = 480  # 8 horas

    # URL pública del backend (usada para generar links absolutos en PDFs y correos)
    # En desarrollo se sobreescribe a http://localhost:8000
    backend_url: str = "https://api.bagfm.app"

    # VAPID Push (opcional en fase 1)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_email: str = "admin@bagfm.mil.ve"

    # CORS
    cors_origins: str = "https://bagfm.app,https://www.bagfm.app,https://bagfm-frontend-production.up.railway.app"
    
    # Inteligencia Artificial
    gemini_api_key: str = ""

    # WebAuthn / Biometría
    webauthn_rp_id: str = "bagfm.app"
    webauthn_rp_name: str = "BAGFM - Sistema Táctico"
    webauthn_origin: str = "https://bagfm.app"

    # Correos
    resend_api_key: str = ""
    mail_from: str = "BAGFM Access <accesos@bagfm.mil.ve>"

    @property
    def cors_lista(self) -> list[str]:
        """Retorna la lista de orígenes CORS permitidos."""
        return [orig.strip() for orig in self.cors_origins.split(",")]

    @property
    def en_produccion(self) -> bool:
        return self.app_env == "production"

    @property
    def frontend_url(self) -> str:
        """Retorna la URL base del frontend para enlaces en correos."""
        return self.cors_lista[0] if self.cors_lista else "http://localhost:5173"

    @property
    def backend_url_base(self) -> str:
        # Construir URL base del backend para los links de foto
        # En desarrollo se sobreescribe a localhost, en producción usa la variable de config
        if self.app_env == "development":
            return "http://localhost:8000"
        return self.backend_url.rstrip("/")


@lru_cache
def obtener_config() -> Configuracion:
    """Retorna la instancia única de configuración (singleton)."""
    return Configuracion()
