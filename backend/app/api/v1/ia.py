from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual
from app.models.usuario import Usuario
from app.services.ia_service import ia_service
from app.services.ia_placa_service import ia_placa_service, crear_job, obtener_job

router = APIRouter()


class IARequest(BaseModel):
    image_base64: Optional[str] = None
    tipo: Optional[str] = None  # 'cedula' o 'vehiculo'
    texto: Optional[str] = None
    contexto: Optional[str] = None


class IAPlacaRequest(BaseModel):
    image_base64: str
    zona_id: Optional[str] = None
    tipo_operador: Optional[str] = "parquero"  # 'parquero' | 'alcabala'


@router.post("/extraer-datos")
async def extraer_datos(
    request: IARequest,
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Endpoint táctico para extraer datos de documentos usando Gemini IA.
    """
    if not request.image_base64 or request.tipo not in ['cedula', 'vehiculo', 'odometro', 'surtidor']:
        raise HTTPException(status_code=400, detail="Faltan datos de imagen o tipo inválido")

    try:
        datos = await ia_service.extraer_datos_documento(request.image_base64, request.tipo)
        return {"status": "success", "data": datos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el motor de IA: {str(e)}")


@router.post("/refinar-correo")
async def refinar_correo(
    request: IARequest,
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Endpoint para profesionalizar el cuerpo de un correo usando IA.
    """
    if not request.texto:
        raise HTTPException(status_code=400, detail="No se proporcionó texto para refinar")

    try:
        refinado = await ia_service.refinar_mensaje_correo(request.contexto or "", request.texto)
        return {"status": "success", "data": refinado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el motor de IA: {str(e)}")


# ──────────────────────────────────────────────────────────────────────────────
# MÓDULO: Análisis Asíncrono de Placas (Aegis IA Táctica v3.0)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/analizar-placa-async")
async def analizar_placa_async(
    request: IAPlacaRequest,
    background_tasks: BackgroundTasks,
    db=Depends(obtener_db),
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Registra una foto para análisis de placa en segundo plano.

    Flujo:
      1. Recibe la imagen base64 del operador.
      2. Crea un job_id único y retorna INMEDIATAMENTE (no bloquea).
      3. El análisis IA + verificación BD corre en background.
      4. El cliente consulta el resultado con GET /ia/resultado-placa/{job_id}.

    Esto permite al operador tomar múltiples fotos sin esperar.
    Cada dispositivo/operador recibe job_ids únicos (sin conflictos).
    """
    if not request.image_base64:
        raise HTTPException(status_code=400, detail="Se requiere image_base64")

    # Crear job y retornar job_id inmediatamente
    job_id = crear_job(
        image_base64=request.image_base64,
        zona_id=request.zona_id,
        tipo_operador=request.tipo_operador or "parquero",
    )

    # Lanzar procesamiento en background (no bloquea el response)
    background_tasks.add_task(ia_placa_service.procesar_job, job_id, db)

    return {
        "job_id": job_id,
        "status": "pendiente",
        "mensaje": "Imagen recibida. Procesando en segundo plano..."
    }


@router.get("/resultado-placa/{job_id}")
async def obtener_resultado_placa(
    job_id: str,
    usuario: Usuario = Depends(obtener_usuario_actual)
):
    """
    Consulta el resultado de un análisis de placa por job_id.

    Estados posibles:
      - pendiente: aún no comenzó
      - procesando: Gemini analizando
      - completado: resultado disponible en campo 'resultado'
      - error: fallo interno (ver campo 'resultado.mensaje')

    El cliente debe hacer polling cada 1-2 segundos hasta estado completado/error.
    El job expira automáticamente a los 15 minutos.
    """
    job = obtener_job(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job no encontrado o expirado (TTL: 15 minutos)"
        )
    return job
