import asyncio
import sys
import os
import uuid

sys.path.append(os.getcwd())

from app.core.database import FabricaSesion
import app.models.base
from app.services.abastecimiento_service import abastecimiento_service
from app.models.vehiculo import Vehiculo
from app.models.abastecimiento import Abastecimiento
from app.models.solicitud_combustible import SolicitudCombustible
from app.models.enums import EstadoSolicitudCombustible, TipoCombustible, UsoVehiculo
from sqlalchemy import select, delete

async def test_combustible_flujo():
    print("INICIANDO PRUEBAS TÁCTICAS DEL MÓDULO DE COMBUSTIBLE (AEGIS FUEL)...")
    
    async with FabricaSesion() as db:
        # Placa ficticia para prueba controlada
        placa_prueba = "TEST999"
        
        # 1. Limpiar registros previos de prueba si existen para evitar conflictos de clave única
        print("\n[1] Purgando datos previos de prueba...")
        query_v = select(Vehiculo).where(Vehiculo.placa == placa_prueba)
        res_v = await db.execute(query_v)
        veh_existente = res_v.scalar_one_or_none()
        if veh_existente:
            # Borrar abastecimientos asociados primero
            await db.execute(delete(Abastecimiento).where(Abastecimiento.vehiculo_id == veh_existente.id))
            await db.execute(delete(SolicitudCombustible).where(SolicitudCombustible.placa == placa_prueba))
            await db.execute(delete(Vehiculo).where(Vehiculo.id == veh_existente.id))
            await db.commit()
            print(f" -> Vehículo y registros previos de placa {placa_prueba} eliminados.")
        
        # 2. Consultar vehículo no registrado
        print("\n[2] Consultando vehículo no registrado...")
        consulta_no_reg = await abastecimiento_service.consultar_vehiculo_combustible(db, placa_prueba)
        assert consulta_no_reg["registrado"] is False, "El vehículo no debería estar registrado"
        assert consulta_no_reg["autorizado"] is False, "El vehículo no debería estar autorizado"
        print(" -> ÉXITO: El sistema reportó correctamente el vehículo como no registrado.")

        # 3. Crear vehículo de prueba no autorizado
        print("\n[3] Creando vehículo de prueba en base de datos (Inhabilitado por defecto)...")
        entidad_ext = await abastecimiento_service.obtener_entidad_transito(db)
        
        nuevo_veh = Vehiculo(
            id=uuid.uuid4(),
            placa=placa_prueba,
            marca="Toyota",
            modelo="Hilux",
            color="Negro",
            tipo="pickup",
            entidad_id=entidad_ext.id,
            uso_vehiculo=UsoVehiculo.servicio,
            autorizado_combustible=False, # Inhabilitado
            capacidad_tanque=80.0,
            asignacion_combustible_semanal=40.0,
            ultimo_kilometraje=12000,
            activo=True
        )
        db.add(nuevo_veh)
        await db.commit()
        print(f" -> Vehículo {placa_prueba} insertado correctamente.")

        # 4. Consultar vehículo registrado pero inhabilitado
        print("\n[4] Consultando vehículo registrado (inhabilitado)...")
        consulta_reg = await abastecimiento_service.consultar_vehiculo_combustible(db, placa_prueba)
        assert consulta_reg["registrado"] is True, "El vehículo debería estar registrado"
        assert consulta_reg["autorizado"] is False, "El vehículo no debería estar autorizado aún"
        print(f" -> ÉXITO: Vehículo detectado. Estado: Registrado={consulta_reg['registrado']}, Autorizado={consulta_reg['autorizado']}.")

        # 5. Elevar solicitud de emergencia
        print("\n[5] Elevando solicitud de emergencia para vehículo inhabilitado...")
        # Obtenemos un ID de bombero ficticio (primer usuario o generamos uno)
        from app.models.usuario import Usuario
        res_u = await db.execute(select(Usuario.id).limit(1))
        bombero_id = res_u.scalar()
        if not bombero_id:
            bombero_id = uuid.uuid4() # Ficticio si la base está vacía

        datos_sol = {
            "placa": placa_prueba,
            "cantidad_solicitada": 35.0,
            "motivo": "Misión de patrullaje de frontera urgente",
            "nombre_conductor_manual": "Sargento Pérez",
            "cedula_conductor_manual": "V-12345678"
        }
        
        solicitud = await abastecimiento_service.registrar_solicitud_emergencia(db, bombero_id, datos_sol)
        await db.commit()
        
        assert solicitud.placa == placa_prueba, "La placa de la solicitud no coincide"
        assert solicitud.estado == EstadoSolicitudCombustible.pendiente, "La solicitud debe crearse como PENDIENTE"
        print(f" -> ÉXITO: Solicitud creada con ID {solicitud.id} en estado PENDIENTE.")

        # 6. Aprobar la solicitud de emergencia
        print("\n[6] Resolviendo y aprobando la solicitud por parte del comando...")
        # Aprobado por el mismo usuario de prueba
        sol_resuelta = await abastecimiento_service.resolver_solicitud(
            db, solicitud.id, bombero_id, EstadoSolicitudCombustible.aprobada
        )
        await db.commit()
        
        assert sol_resuelta.estado == EstadoSolicitudCombustible.aprobada, "La solicitud debe estar aprobada"
        print(" -> ÉXITO: Solicitud marcada como APROBADA.")

        # 7. Registrar abastecimiento utilizando la aprobación temporal
        print("\n[7] Registrando suministro utilizando la autorización de suministro único...")
        # Buscamos el primer tanque activo disponible
        from app.models.tanque_combustible import TanqueCombustible
        res_t = await db.execute(select(TanqueCombustible).where(TanqueCombustible.activo == True).limit(1))
        tanque = res_t.scalar_one_or_none()
        
        if not tanque:
            # Crear tanque de prueba si no existe
            print(" -> Creando tanque de combustible de prueba temporal...")
            tanque = TanqueCombustible(
                id=uuid.uuid4(),
                nombre="Tanque Gasolina Principal",
                tipo_combustible=TipoCombustible.gasolina,
                capacidad_maxima=10000.0,
                cantidad_actual=5000.0,
                activo=True
            )
            db.add(tanque)
            await db.flush()

        # Simulamos los datos enviados por la cámara y el odómetro
        datos_abast = {
            "placa": placa_prueba,
            "tanque_id": str(tanque.id),
            "kilometraje_actual": 12150, # Incremento correcto de kilometraje (12000 -> 12150)
            "cantidad_abastecida": 35.0,
            "foto_kilometraje_url": "http://minio.bagfm/odometro_test.jpg",
            "foto_maquina_url": "http://minio.bagfm/dispensador_test.jpg",
            "solicitud_aprobacion_id": str(solicitud.id)
        }
        
        abastecimiento = await abastecimiento_service.registrar_abastecimiento(db, bombero_id, datos_abast)
        await db.commit()
        
        assert abastecimiento.cantidad_abastecida == 35.0, "La cantidad surtida no coincide"
        assert abastecimiento.kilometraje_actual == 12150, "El kilometraje no se actualizó en la carga"
        
        # Verificar que el vehículo actualizó su odómetro
        await db.refresh(nuevo_veh)
        assert nuevo_veh.ultimo_kilometraje == 12150, "El kilometraje del vehículo no se actualizó"
        
        # Verificar que la solicitud pasó a consumida
        await db.refresh(solicitud)
        assert solicitud.estado == EstadoSolicitudCombustible.consumida, "La solicitud debe estar en estado CONSUMIDA"
        
        print(" -> ÉXITO: Suministro completado.")
        print(" -> ÉXITO: El odómetro del vehículo se actualizó correctamente.")
        print(" -> ÉXITO: La solicitud de emergencia fue marcada como CONSUMIDA.")

        # 8. Intentar abastecer nuevamente sin autorización (debe fallar)
        print("\n[8] Intentando abastecer por segunda vez sin nueva solicitud (debe fallar)...")
        try:
            await abastecimiento_service.registrar_abastecimiento(db, bombero_id, datos_abast)
            assert False, "Se esperaba un error por no estar autorizado"
        except ValueError as ve:
            print(f" -> ÉXITO: El sistema denegó la segunda carga con el mensaje: '{ve}'")

        # 9. Limpiar datos de prueba
        print("\n[9] Limpiando base de datos...")
        await db.execute(delete(Abastecimiento).where(Abastecimiento.id == abastecimiento.id))
        await db.execute(delete(SolicitudCombustible).where(SolicitudCombustible.id == solicitud.id))
        await db.execute(delete(Vehiculo).where(Vehiculo.id == nuevo_veh.id))
        await db.commit()
        print(" -> ÉXITO: Limpieza final completada.")
        
        print("\n¡TODAS LAS PRUEBAS UNITARIAS DE COMBUSTIBLE FUERON EXITOSAS!")

if __name__ == "__main__":
    asyncio.run(test_combustible_flujo())
