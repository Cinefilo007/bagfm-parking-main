#!/usr/bin/env python3
"""
Script de Restablecimiento de Contraseña para Servidor (BAGFM)
Permite a los administradores de sistemas restablecer la contraseña de un usuario (o Comandante)
a su contraseña estándar (su número de cédula) y forzar el cambio en el próximo inicio de sesión.

Uso:
    python reset_password.py <CEDULA>
    python reset_password.py
"""
import os
import sys
import asyncio
from pathlib import Path

# Asegurar que el directorio raíz de backend esté en sys.path
BASE_DIR = Path(__file__).resolve().parent
if (BASE_DIR / "app").exists():
    sys.path.insert(0, str(BASE_DIR))
elif (BASE_DIR.parent / "backend" / "app").exists():
    sys.path.insert(0, str(BASE_DIR.parent / "backend"))
elif (BASE_DIR.parent / "app").exists():
    sys.path.insert(0, str(BASE_DIR.parent))

from sqlalchemy import select
from app.core.database import FabricaSesion
from app.models.usuario import Usuario
from app.models.enums import RolTipo
from app.core.security import hashear_password


async def buscar_usuario_por_cedula(sesion, cedula_limpia: str):
    query = select(Usuario).where(Usuario.cedula.ilike(cedula_limpia))
    res = await sesion.execute(query)
    return res.scalar_one_or_none()


async def listar_comandantes(sesion):
    query = select(Usuario).where(Usuario.rol == RolTipo.COMANDANTE, Usuario.is_deleted == False)
    res = await sesion.execute(query)
    return res.scalars().all()


async def restablecer_password_usuario(cedula: str | None = None, nueva_clave: str | None = None):
    async with FabricaSesion() as sesion:
        usuario = None

        if cedula:
            cedula_limpia = cedula.strip().upper()
            usuario = await buscar_usuario_por_cedula(sesion, cedula_limpia)
            if not usuario:
                # Intentar buscar sin prefijo si aplica o con prefijo
                if cedula_limpia.startswith("V") or cedula_limpia.startswith("E") or cedula_limpia.startswith("J"):
                    sin_prefijo = cedula_limpia[1:]
                    usuario = await buscar_usuario_por_cedula(sesion, sin_prefijo)
                else:
                    usuario = await buscar_usuario_por_cedula(sesion, f"V{cedula_limpia}")
        else:
            print("\n🔍 Buscando usuarios con rol COMANDANTE en el sistema...")
            comandantes = await listar_comandantes(sesion)
            if not comandantes:
                print("❌ No se encontró ningún Comandante registrado en la base de datos.")
                return False
            
            if len(comandantes) == 1:
                usuario = comandantes[0]
                print(f"✅ Se encontró 1 Comandante: {usuario.nombre} {usuario.apellido} (Cédula: {usuario.cedula})")
            else:
                print(f"ℹ️ Se encontraron {len(comandantes)} Comandantes:")
                for idx, c in enumerate(comandantes, 1):
                    print(f"  [{idx}] {c.nombre} {c.apellido} - Cédula: {c.cedula}")
                opcion = input("\nSeleccione el número del Comandante a restablecer (o presione Ctrl+C para cancelar): ")
                try:
                    idx_sel = int(opcion.strip()) - 1
                    if 0 <= idx_sel < len(comandantes):
                        usuario = comandantes[idx_sel]
                    else:
                        print("❌ Opción inválida.")
                        return False
                except ValueError:
                    print("❌ Entrada inválida.")
                    return False

        if not usuario:
            print(f"❌ No se encontró ningún usuario con la cédula proporcionada ('{cedula}').")
            return False

        # Clave a asignar: si no se especifica, se usa su cédula
        password_final = nueva_clave if nueva_clave else usuario.cedula

        print("\n==================================================")
        print("👤 DATOS DEL USUARIO:")
        print(f"   - Nombre:    {usuario.nombre} {usuario.apellido}")
        print(f"   - Cédula:    {usuario.cedula}")
        print(f"   - Rol:       {usuario.rol.value}")
        print(f"   - Email:     {usuario.email or 'No registrado'}")
        print(f"   - Estado:    {'ACTIVO' if usuario.activo else 'INACTIVO'}")
        print("==================================================")
        print(f"🔑 Nueva contraseña temporal: {password_final}")
        print("🔄 Bandera 'debe_cambiar_password': True")
        print("==================================================")

        confirmacion = input("\n¿Desea confirmar el restablecimiento de contraseña? (s/N): ").strip().lower()
        if confirmacion not in ["s", "si", "y", "yes"]:
            print("🚫 Operación cancelada por el usuario.")
            return False

        # Aplicar cambios
        usuario.password_hash = hashear_password(password_final)
        usuario.debe_cambiar_password = True
        usuario.activo = True

        await sesion.commit()

        print("\n✅ ¡CONTRASEÑA RESTABLECIDA CON ÉXITO!")
        print("--------------------------------------------------")
        print(f"👉 El usuario ahora puede iniciar sesión con:")
        print(f"   Usuario:    {usuario.cedula}")
        print(f"   Contraseña: {password_final}")
        print("\n📌 Al iniciar sesión, el sistema le solicitará OBLIGATORIAMENTE")
        print("   definir una nueva contraseña personal.")
        print("--------------------------------------------------\n")
        return True


def main():
    print("==================================================")
    print("🛡️  BAGFM PARKING - UTILIDAD DE RESTABLECIMIENTO")
    print("==================================================")
    
    cedula = None
    if len(sys.argv) > 1:
        cedula = sys.argv[1]
    else:
        entrada = input("Ingrese la Cédula del usuario (o presione ENTER para buscar al Comandante): ").strip()
        if entrada:
            cedula = entrada

    try:
        asyncio.run(restablecer_password_usuario(cedula))
    except KeyboardInterrupt:
        print("\n\n🚫 Proceso interrumpido por el usuario.")
    except Exception as e:
        print(f"\n❌ Error durante el restablecimiento: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
