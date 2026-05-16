
import asyncio
import os
import sys
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Añadir el directorio backend al path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import motor, FabricaSesion
import app.models.base
from app.models.usuario import Usuario
from app.models.push_subscription import PushSubscription
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.enums import RolTipo
from app.services.webpush_service import webpush_service

async def diagnostico():
    print("=== DIAGNÓSTICO DE NOTIFICACIONES PUSH ===")
    
    async with FabricaSesion() as db:
        # 1. Verificar Parqueros y Supervisores
        print("\n1. Usuarios con roles de notificacion:")
        query_users = select(Usuario).where(
            Usuario.rol.in_([RolTipo.PARQUERO, RolTipo.SUPERVISOR_PARQUEROS]),
            Usuario.activo == True
        ).options(selectinload(Usuario.zona_asignada))
        
        res_users = await db.execute(query_users)
        usuarios = res_users.scalars().all()
        
        if not usuarios:
            print("ERROR: No se encontraron Parqueros o Supervisores activos.")
        else:
            for u in usuarios:
                zona_info = u.zona_asignada.nombre if u.zona_asignada else "SIN ZONA"
                print(f"- [{u.rol.value}] {u.nombre} {u.apellido} (ID: {u.id}) - Zona: {zona_info}")
                
                # Buscar suscripciones para este usuario
                query_subs = select(PushSubscription).where(
                    PushSubscription.usuario_id == u.id,
                    PushSubscription.activo == True
                )
                res_subs = await db.execute(query_subs)
                subs = res_subs.scalars().all()
                
                if not subs:
                    print(f"  AVISO: NO tiene suscripciones push activas.")
                else:
                    for s in subs:
                        print(f"  OK: Suscripcion activa (Endpoint: {s.endpoint[:50]}...)")

        # 2. Verificar Zonas
        print("\n2. Zonas de Estacionamiento:")
        query_zonas = select(ZonaEstacionamiento)
        res_zonas = await db.execute(query_zonas)
        zonas = res_zonas.scalars().all()
        for z in zonas:
            print(f"- Zona: {z.nombre} (ID: {z.id})")

        # 3. Enviar Notificacion de Prueba a TODOS los dispositivos registrados activos
        print("\n3. Enviando notificacion de prueba a todos los dispositivos registrados...")
        query_all_subs = select(PushSubscription).where(PushSubscription.activo == True)
        res_all_subs = await db.execute(query_all_subs)
        all_subs = res_all_subs.scalars().all()
        
        payload = {
            "title": "PRUEBA DE SISTEMA - Aegis Tactical",
            "body": "Esta es una notificacion de prueba para verificar la conectividad de su dispositivo.",
            "data": {
                "url": "/",
                "tipo": "prueba_sistema"
            },
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/badge-96x96.png"
        }
        
        count = 0
        for sub in all_subs:
            try:
                sub_info = {
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                }
                webpush_service.send_notification(sub_info, payload)
                print(f"OK: Notificacion enviada a usuario {sub.usuario_id} (Endpoint: {sub.endpoint[:30]}...)")
                count += 1
            except Exception as e:
                print(f"ERROR enviando a {sub.usuario_id}: {e}")
        
        print(f"\nTotal notificaciones enviadas: {count}")

if __name__ == "__main__":
    asyncio.run(diagnostico())
