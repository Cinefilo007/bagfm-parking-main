import asyncio
import sys
import os
import uuid
from datetime import datetime, timedelta

sys.path.append(os.getcwd())

import app.models.base
from app.core.database import FabricaSesion
from app.services.abastecimiento_service import abastecimiento_service
from app.models.vehiculo import Vehiculo
from app.models.abastecimiento import Abastecimiento
from app.models.tanque_combustible import TanqueCombustible
from app.models.enums import TipoCombustible, UsoVehiculo
from sqlalchemy import select, delete

async def test_excepcional_y_edicion():
    print("INICIANDO PRUEBAS TÁCTICAS DE REGISTRO EXCEPCIONAL Y EDICIÓN DE LITRAJES...")
    
    async with FabricaSesion() as db:
        placa_prueba = "EXC999"
        
        # 1. Limpieza inicial
        print("\n[1] Purgando datos previos de prueba...")
        query_v = select(Vehiculo).where(Vehiculo.placa == placa_prueba)
        res_v = await db.execute(query_v)
        veh_existente = res_v.scalar_one_or_none()
        if veh_existente:
            await db.execute(delete(Abastecimiento).where(Abastecimiento.vehiculo_id == veh_existente.id))
            await db.execute(delete(Vehiculo).where(Vehiculo.id == veh_existente.id))
            await db.commit()
            print(" -> Datos previos eliminados.")

        # Obtener o crear tanque de gasolina
        res_t = await db.execute(select(TanqueCombustible).where(TanqueCombustible.activo == True).limit(1))
        tanque = res_t.scalar_one_or_none()
        
        if not tanque:
            print(" -> Creando tanque de prueba...")
            tanque = TanqueCombustible(
                id=uuid.uuid4(),
                nombre="Tanque Prueba",
                tipo_combustible=TipoCombustible.gasolina,
                capacidad_maxima=10000.0,
                cantidad_actual=5000.0,
                activo=True
            )
            db.add(tanque)
            await db.flush()
            
        litros_iniciales = tanque.cantidad_actual
        print(f" -> Tanque de prueba: {tanque.nombre} (Stock inicial: {litros_iniciales:.2f} L)")

        # 2. Registrar Abastecimiento Excepcional (Retroactivo)
        # Obtenemos primer ID de usuario para bombero
        from app.models.usuario import Usuario
        res_u = await db.execute(select(Usuario.id).limit(1))
        usuario_id = res_u.scalar()
        if not usuario_id:
            usuario_id = uuid.uuid4()

        fecha_cierre = datetime.now() - timedelta(days=1) # ayer
        print(f"\n[2] Registrando abastecimiento excepcional retroactivo para ayer...")
        
        datos_excepcional = {
            "placa": placa_prueba,
            "tanque_id": str(tanque.id),
            "kilometraje_actual": 15000,
            "cantidad_abastecida": 40.0,
            "conductor": "AUDITOR TÁCTICO",
            "fecha_registro": fecha_cierre,
            "marca_manual": "Ford",
            "modelo_manual": "Ranger",
            "color_manual": "Gris"
        }
        
        ab = await abastecimiento_service.registrar_abastecimiento_excepcional(db, usuario_id, datos_excepcional)
        await db.commit()
        
        assert ab.cantidad_abastecida == 40.0, "La cantidad surtida no coincide"
        assert ab.conductor == "AUDITOR TÁCTICO", "El conductor no coincide"
        
        # Verificar descuento de stock del tanque
        await db.refresh(tanque)
        assert tanque.cantidad_actual == litros_iniciales - 40.0, "El stock del tanque no se descontó correctamente"
        print(f" -> ÉXITO: Abastecimiento excepcional registrado. Nuevo stock del tanque: {tanque.cantidad_actual:.2f} L.")

        # Verificar que el vehículo fue creado en tránsito automáticamente
        query_v2 = select(Vehiculo).where(Vehiculo.placa == placa_prueba)
        res_v2 = await db.execute(query_v2)
        vehiculo_creado = res_v2.scalar_one_or_none()
        assert vehiculo_creado is not None, "El vehículo debió crearse de manera automática"
        assert vehiculo_creado.ultimo_kilometraje == 15000, "El kilometraje no coincide"
        print(f" -> ÉXITO: Vehículo {placa_prueba} creado automáticamente en tránsito con odómetro de {vehiculo_creado.ultimo_kilometraje} km.")

        # 3. Editar Registro (Disminuir litros a 25 L)
        print("\n[3] Editando litraje del registro a 25.0 L (Disminución de 15.0 L)...")
        await abastecimiento_service.editar_abastecimiento_litraje(
            db, ab.id, nuevo_litraje=25.0, nuevo_kilometraje=15050, nuevo_conductor="AUDITOR TÁCTICO EDITADO"
        )
        await db.commit()
        
        await db.refresh(ab)
        await db.refresh(tanque)
        await db.refresh(vehiculo_creado)
        
        assert ab.cantidad_abastecida == 25.0, "El litraje editado no se actualizó"
        assert ab.kilometraje_actual == 15050, "El kilometraje editado no se actualizó"
        assert ab.conductor == "AUDITOR TÁCTICO EDITADO", "El conductor editado no se actualizó"
        assert tanque.cantidad_actual == litros_iniciales - 25.0, "El stock del tanque no se reajustó de forma correcta"
        assert vehiculo_creado.ultimo_kilometraje == 15050, "El kilometraje del vehículo no se actualizó"
        
        print(f" -> ÉXITO: Registro editado. Nuevo stock del tanque reajustado a: {tanque.cantidad_actual:.2f} L.")

        # 4. Limpieza final
        print("\n[4] Limpiando base de datos...")
        await db.execute(delete(Abastecimiento).where(Abastecimiento.id == ab.id))
        await db.execute(delete(Vehiculo).where(Vehiculo.id == vehiculo_creado.id))
        await db.commit()
        print(" -> ÉXITO: Limpieza completada.")
        
        print("\n¡TODAS LAS PRUEBAS DE ABASTECIMIENTO EXCEPCIONAL Y EDICIÓN FUERON EXITOSAS!")

if __name__ == "__main__":
    asyncio.run(test_excepcional_y_edicion())
