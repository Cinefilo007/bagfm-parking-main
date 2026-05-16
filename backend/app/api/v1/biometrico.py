from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual
from app.models.usuario import Usuario
from app.models.credencial_biometrica import CredencialBiometrica
from app.schemas.biometrico import (
    BiometricoOptionsRequest,
    WebAuthnRegistrationVerify,
    WebAuthnLoginVerify,
    CredencialBiometricaSchema
)
from app.schemas.auth import Token
from app.services.biometrico_service import biometrico_service
from sqlalchemy import select

router = APIRouter()

# --- REGISTRO (Requiere estar logueado) ---

@router.get("/registro-options")
async def get_registro_options(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Genera las opciones para que un usuario logueado vincule un nuevo dispositivo."""
    return await biometrico_service.generar_opciones_registro(db, usuario_actual)

@router.post("/registro-verify")
async def verify_registro(
    datos: WebAuthnRegistrationVerify,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Verifica y guarda la nueva credencial biométrica."""
    exito = await biometrico_service.verificar_registro(db, usuario_actual, datos)
    return {"mensaje": "Dispositivo vinculado exitosamente", "exito": exito}


# --- LOGIN (Público, pero requiere cédula para saber qué llaves permitir) ---

@router.post("/login-options")
async def get_login_options(
    solicitud: BiometricoOptionsRequest,
    db: AsyncSession = Depends(obtener_db)
):
    """Genera el desafío de autenticación para el usuario indicado por su cédula."""
    if not solicitud.cedula:
        raise HTTPException(status_code=400, detail="Se requiere la cédula para iniciar sesión biométrica")
    return await biometrico_service.generar_opciones_login(db, solicitud.cedula)

@router.post("/login-verify", response_model=Token)
async def verify_login(
    datos: WebAuthnLoginVerify,
    db: AsyncSession = Depends(obtener_db)
):
    """Verifica la firma biométrica y emite el token de acceso."""
    return await biometrico_service.verificar_login(db, datos)

@router.get("/check-usuario/{cedula}")
async def check_biometria_disponible(
    cedula: str,
    db: AsyncSession = Depends(obtener_db)
):
    """Verifica si un usuario tiene biometría configurada."""
    disponible = await biometrico_service.verificar_disponibilidad(db, cedula)
    return {"disponible": disponible}

@router.get("/credenciales", response_model=List[CredencialBiometricaSchema])
async def listar_credenciales(
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Lista todos los dispositivos registrados para el usuario actual."""
    result = await db.execute(
        select(CredencialBiometrica).where(CredencialBiometrica.usuario_id == usuario_actual.id)
    )
    return result.scalars().all()

@router.delete("/credenciales/{credencial_id}")
async def eliminar_credencial(
    credencial_id: str,
    db: AsyncSession = Depends(obtener_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual)
):
    """Elimina/desvincula un dispositivo biométrico."""
    result = await db.execute(
        select(CredencialBiometrica).where(
            CredencialBiometrica.id == credencial_id,
            CredencialBiometrica.usuario_id == usuario_actual.id
        )
    )
    credencial = result.scalar_one_or_none()
    
    if not credencial:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
        
    await db.delete(credencial)
    await db.commit()
    
    return {"mensaje": "Dispositivo eliminado correctamente", "exito": True}
