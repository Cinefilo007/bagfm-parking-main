from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from app.core.database import obtener_db
from app.core.security import decodificar_token
from app.core.excepciones import TokenInvalido, AccesoDenegado, UsuarioInactivo
from app.models.usuario import Usuario
from app.models.enums import RolTipo
from app.services.auth_service import auth_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def obtener_usuario_actual(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(obtener_db)
) -> Usuario:
    try:
        payload = decodificar_token(token)
        usuario_id = payload.get("sub")
        if usuario_id is None:
            raise TokenInvalido("El token no contiene un identificador de usuario válido")
            
        usuario = await auth_service.obtener_usuario_por_id(db, str(usuario_id))
        
        if not usuario:
            raise TokenInvalido("El usuario ya no existe")
            
        if not usuario.activo:
            raise UsuarioInactivo("Usuario desactivado")
            
        return usuario
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (TokenInvalido, UsuarioInactivo) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_rol(roles_permitidos: list[RolTipo]):
    """
    Closure que retorna una dependencia FastAPI para validar roles.
    Uso: Depends(require_rol([RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]))
    """
    async def validador(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
        if usuario.rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes los permisos necesarios para realizar esta acción"
            )
        return usuario
        
    return validador
