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

    # ── ANPR: cámaras de lectura de placas en las alcabalas ──────────────────
    # OBSOLETA. El token de ingesta dejó de ser único y global: ahora cada cámara
    # tiene el suyo, se administra desde el panel del Comandante y se guarda hasheado
    # (ver app/models/camara_anpr.py). Un token global no se puede revocar por equipo
    # y obliga a reconfigurar todas las cámaras para rotarlo.
    # Se conserva el campo para que un .env que todavía la traiga no rompa el arranque.
    anpr_ingest_token: str = ""
    # Lista separada por comas. Vacía = no se filtra por IP (solo válido en desarrollo).
    anpr_ip_allowlist: str = ""
    # La cámara dispara varias veces por vehículo (LPR multi-frame). Dentro de esta
    # ventana, la misma placa en el mismo punto se marca duplicada.
    anpr_dedupe_segundos: int = 30
    # Días que se conservan las FOTOS de las detecciones. Vencido el plazo se borra la
    # imagen; la detección (placa, hora, sentido, veredicto) no se toca nunca.
    #
    # Este es solo el valor por defecto: el Comandante lo cambia desde el panel de
    # cámaras y ese ajuste, que vive en la tabla `configuracion`, manda sobre este.
    # Ver anpr_service.retencion_fotos_dias().
    anpr_retencion_fotos_dias: int = 7
    # La cámara manda la panorámica del vehículo en la resolución del sensor, y a
    # varios miles de fotos por día eso llenó 13 GB de disco. Se reencodea al entrar.
    # El recorte de la placa NO se toca: pesa poco y es la evidencia que identifica al
    # vehículo, así que no vale la pena arriesgar un carácter ilegible.
    anpr_escena_lado_maximo: int = 1280
    anpr_escena_calidad: int = 75

    # Control del brazo desde el backend (Fase 2). Requiere alcanzar la cámara dentro
    # de la LAN de la base, cosa que hoy no es posible sin túnel. En Fase 1 el brazo
    # trabaja en modo "por cámara" y no depende del servidor.
    hikvision_control_activo: bool = False
    hikvision_usuario: str = ""
    hikvision_password: str = ""

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
    def anpr_ips_permitidas(self) -> list[str]:
        """IPs autorizadas a postear eventos ANPR. Lista vacía = sin filtro."""
        return [ip.strip() for ip in self.anpr_ip_allowlist.split(",") if ip.strip()]

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
