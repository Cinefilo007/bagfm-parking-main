import json
import base64
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers import (
    bytes_to_base64url,
    base64url_to_bytes,
    options_to_json,
    parse_registration_credential_json,
    parse_authentication_credential_json,
)
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AuthenticatorAttachment,
    RegistrationCredential,
    AuthenticationCredential,
    PublicKeyCredentialDescriptor,
)

from app.core.config import obtener_config
from app.models.usuario import Usuario
from app.models.credencial_biometrica import CredencialBiometrica
from app.models.challenge_biometrico import ChallengeBiometrico
from app.schemas.biometrico import (
    WebAuthnRegistrationOptions,
    WebAuthnLoginOptions,
    WebAuthnRegistrationVerify,
    WebAuthnLoginVerify,
)
from app.schemas.auth import Token
from app.core.security import crear_token_acceso
from app.core.excepciones import CredencialesInvalidas, UsuarioInactivo

config = obtener_config()

class BiometricoService:
    async def generar_opciones_registro(self, db: AsyncSession, usuario: Usuario) -> WebAuthnRegistrationOptions:
        """Genera las opciones de desafío para registrar un nuevo dispositivo."""
        
        # Obtener credenciales existentes para excluirlas (evitar duplicados)
        q_existentes = select(CredencialBiometrica.credential_id).where(CredencialBiometrica.usuario_id == usuario.id)
        res_existentes = await db.execute(q_existentes)
        credenciales_excluir = [
            {"id": base64url_to_bytes(row[0]), "type": "public-key"} 
            for row in res_existentes.all()
        ]

        # Generar opciones con pywebauthn
        opciones = generate_registration_options(
            rp_id=config.webauthn_rp_id,
            rp_name=config.webauthn_rp_name,
            user_id=str(usuario.id).encode('utf-8'),
            user_name=usuario.cedula,
            user_display_name=usuario.nombre_completo,
            attestation=AttestationConveyancePreference.NONE,
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=None, # Permite tanto plataforma como roaming
                user_verification=UserVerificationRequirement.PREFERRED,
            ),
            exclude_credentials=credenciales_excluir if credenciales_excluir else [],
        )

        # 1.1 Limpiar desafíos anteriores del mismo tipo para este usuario
        await db.execute(
            delete(ChallengeBiometrico).where(
                ChallengeBiometrico.usuario_id == usuario.id,
                ChallengeBiometrico.tipo == 'registro'
            )
        )

        # 2. Guardar el nuevo challenge
        nuevo_challenge = ChallengeBiometrico(
            usuario_id=usuario.id,
            challenge=bytes_to_base64url(opciones.challenge),
            tipo='registro',
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        db.add(nuevo_challenge)
        await db.commit()

        # Retornar como JSON compatible con el frontend
        return json.loads(options_to_json(opciones))

    async def verificar_registro(self, db: AsyncSession, usuario: Usuario, datos: WebAuthnRegistrationVerify) -> bool:
        """Verifica la respuesta del frontend y guarda la nueva credencial."""
        
        # Buscar el challenge pendiente
        q_challenge = select(ChallengeBiometrico).where(
            ChallengeBiometrico.usuario_id == usuario.id,
            ChallengeBiometrico.tipo == 'registro'
        ).order_by(ChallengeBiometrico.created_at.desc())
        
        res_challenge = await db.execute(q_challenge)
        challenge_db = res_challenge.scalars().first()

        if not challenge_db or challenge_db.expires_at < datetime.now(timezone.utc):
            raise CredencialesInvalidas("El desafío ha expirado o no existe")

        try:
            verificacion = verify_registration_response(
                credential=parse_registration_credential_json(datos.registration_response),
                expected_challenge=base64url_to_bytes(challenge_db.challenge),
                expected_origin=config.webauthn_origin,
                expected_rp_id=config.webauthn_rp_id,
            )
            
            # Guardar la nueva credencial
            nueva_cred = CredencialBiometrica(
                usuario_id=usuario.id,
                credential_id=bytes_to_base64url(verificacion.credential_id),
                public_key=verificacion.credential_public_key,
                sign_count=verificacion.sign_count,
                nombre_dispositivo=datos.nombre_dispositivo,
                transports=json.dumps(datos.registration_response.get("response", {}).get("transports", []))
            )
            db.add(nueva_cred)
            
            # Limpiar el challenge usado
            await db.delete(challenge_db)
            await db.commit()
            
            return True
            
        except Exception as e:
            await db.rollback()
            raise CredencialesInvalidas(f"Error de verificación: {str(e)}")

    async def generar_opciones_login(self, db: AsyncSession, cedula: str) -> dict:
        """Genera opciones de desafío para iniciar sesión."""
        
        # Buscar usuario
        q_usuario = select(Usuario).where(Usuario.cedula == cedula)
        res_usuario = await db.execute(q_usuario)
        usuario = res_usuario.scalar_one_or_none()
        
        if not usuario:
            raise CredencialesInvalidas("Usuario no encontrado")

        # Obtener credenciales permitidas
        q_creds = select(CredencialBiometrica).where(CredencialBiometrica.usuario_id == usuario.id)
        res_creds = await db.execute(q_creds)
        creds_permitidas = [
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id)) 
            for c in res_creds.scalars().all()
        ]

        if not creds_permitidas:
            raise CredencialesInvalidas("No tienes dispositivos biométricos registrados")

        opciones = generate_authentication_options(
            rp_id=config.webauthn_rp_id,
            allow_credentials=creds_permitidas,
            user_verification=UserVerificationRequirement.PREFERRED,
        )

        # 1.1 Limpiar desafíos anteriores de login para este usuario
        await db.execute(
            delete(ChallengeBiometrico).where(
                ChallengeBiometrico.usuario_id == usuario.id,
                ChallengeBiometrico.tipo == 'login'
            )
        )

        # 2. Guardar el nuevo desafío
        nuevo_challenge = ChallengeBiometrico(
            usuario_id=usuario.id,
            challenge=bytes_to_base64url(opciones.challenge),
            tipo='login',
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        db.add(nuevo_challenge)
        await db.commit()

        return json.loads(options_to_json(opciones))

    async def verificar_login(self, db: AsyncSession, datos: WebAuthnLoginVerify) -> Token:
        """Verifica la firma y retorna un token JWT si es exitosa."""
        
        # Buscar usuario
        q_usuario = select(Usuario).where(Usuario.cedula == datos.cedula)
        res_usuario = await db.execute(q_usuario)
        usuario = res_usuario.scalar_one_or_none()
        
        if not usuario:
            raise CredencialesInvalidas("Usuario no encontrado")

        # Buscar challenge
        q_challenge = select(ChallengeBiometrico).where(
            ChallengeBiometrico.usuario_id == usuario.id,
            ChallengeBiometrico.tipo == 'login'
        ).order_by(ChallengeBiometrico.created_at.desc())
        
        res_challenge = await db.execute(q_challenge)
        challenge_db = res_challenge.scalars().first()

        if not challenge_db or challenge_db.expires_at < datetime.now(timezone.utc):
            raise CredencialesInvalidas("El desafío ha expirado")

        # Buscar la credencial específica
        cred_id_recibido = datos.authentication_response.get("id")
        q_cred = select(CredencialBiometrica).where(
            CredencialBiometrica.credential_id == cred_id_recibido,
            CredencialBiometrica.usuario_id == usuario.id
        )
        res_cred = await db.execute(q_cred)
        cred_db = res_cred.scalar_one_or_none()

        if not cred_db:
            raise CredencialesInvalidas("Dispositivo no registrado")

        try:
            verificacion = verify_authentication_response(
                credential=parse_authentication_credential_json(datos.authentication_response),
                expected_challenge=base64url_to_bytes(challenge_db.challenge),
                expected_origin=config.webauthn_origin,
                expected_rp_id=config.webauthn_rp_id,
                credential_public_key=cred_db.public_key,
                credential_current_sign_count=cred_db.sign_count,
            )
            
            # Actualizar contador de firmas para seguridad
            cred_db.sign_count = verificacion.new_sign_count
            
            # Limpiar challenge
            await db.delete(challenge_db)
            await db.commit()

            # Lógica de generación de token idéntica a auth_service
            entidad_nombre = None
            if usuario.entidad_id:
                from app.models.entidad_civil import EntidadCivil
                q_entidad = select(EntidadCivil.nombre).where(EntidadCivil.id == usuario.entidad_id)
                res_entidad = await db.execute(q_entidad)
                entidad_nombre = res_entidad.scalar_one_or_none()

            token_data = {
                "sub": str(usuario.id),
                "rol": usuario.rol.value if hasattr(usuario.rol, 'value') else usuario.rol,
                "entidad_id": str(usuario.entidad_id) if usuario.entidad_id else None,
                "entidad_nombre": entidad_nombre,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "cedula": usuario.cedula,
                "email": usuario.email,
                "telefono": usuario.telefono,
                "debe_cambiar_password": usuario.debe_cambiar_password
            }
            
            token = crear_token_acceso(token_data)
            return Token(access_token=token)

        except Exception as e:
            await db.rollback()
            raise CredencialesInvalidas(f"Falla biométrica: {str(e)}")

    async def verificar_disponibilidad(self, db: AsyncSession, cedula: str) -> bool:
        """Verifica si un usuario tiene al menos una credencial biométrica registrada."""
        q_usuario = select(Usuario).where(Usuario.cedula == cedula)
        res_usuario = await db.execute(q_usuario)
        usuario = res_usuario.scalar_one_or_none()
        
        if not usuario:
            return False
            
        q_creds = select(CredencialBiometrica).where(CredencialBiometrica.usuario_id == usuario.id)
        res_creds = await db.execute(q_creds)
        return len(res_creds.scalars().all()) > 0

biometrico_service = BiometricoService()
