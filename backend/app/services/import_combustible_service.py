"""
Servicio ImportCombustibleService.
Permite procesar archivos Excel para cargar masivamente vehículos autorizados por entidad.
"""
import openpyxl
from io import BytesIO
from typing import List, Dict, Any, Optional
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.vehiculo import Vehiculo
from app.models.entidad_civil import EntidadCivil
from app.models.enums import UsoVehiculo, TipoCombustible
from app.core.notify_manager import manager

logger = logging.getLogger(__name__)

class ImportCombustibleService:
    
    async def procesar_excel_parque_automotor(
        self,
        db: AsyncSession,
        file_content: bytes,
        usuario_creador_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Procesa el archivo Excel del parque automotor de las entidades.
        Columnas:
          A (0): PLACA (Obligatorio)
          B (1): MARCA (Opcional, default "S/M")
          C (2): MODELO (Opcional, default "S/M")
          D (3): COLOR (Opcional, default "S/C")
          E (4): TIPO (Opcional, ej: sedan, camion, suv)
          F (5): ENTIDAD (Obligatorio - nombre de la entidad en el sistema)
          G (6): USO (particular | protocolar | servicio)
          H (7): AUTORIZADO_COMBUSTIBLE (SI | NO)
          I (8): TIPO_COMBUSTIBLE (gasolina | diesel)
          J (9): CAPACIDAD_TANQUE (Litros - numérico)
          K (10): ASIGNACION_SEMANAL (Litros - numérico)
        """
        try:
            wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
            sheet = wb.active
            
            resumen = {
                "total": 0,
                "exitosos": 0,
                "actualizados": 0,
                "errores": []
            }
            
            rows = list(sheet.iter_rows(min_row=2, values_only=True))
            resumen["total"] = len(rows)
            
            # Cache de entidades por nombre (para evitar queries repetidas por cada fila)
            entidades_cache = {}
            
            for index, row in enumerate(rows, start=2):
                if not any(row) or not row[0]: # Fila vacía o sin placa
                    continue
                
                try:
                    placa = str(row[0]).strip().upper()
                    marca = str(row[1]).strip().upper() if row[1] else "S/M"
                    modelo = str(row[2]).strip().upper() if row[2] else "S/M"
                    color = str(row[3]).strip().upper() if row[3] else "S/C"
                    tipo_vehic = str(row[4]).strip().lower() if row[4] else "sedan"
                    entidad_nombre = str(row[5]).strip() if row[5] else None
                    uso_str = str(row[6]).strip().lower() if row[6] else "particular"
                    aut_comb_str = str(row[7]).strip().upper() if row[7] else "NO"
                    comb_str = str(row[8]).strip().lower() if row[8] else "gasolina"
                    capacidad = float(row[9]) if row[9] is not None else 0.0
                    asignacion = float(row[10]) if row[10] is not None else 0.0
                    
                    # 1. Validar campos críticos
                    if not entidad_nombre:
                        raise ValueError(f"Fila {index}: El nombre de la entidad es obligatorio.")
                        
                    # 2. Buscar entidad en cache/BD
                    entidad = entidades_cache.get(entidad_nombre)
                    if not entidad:
                        # Buscar de forma insensible a mayúsculas
                        query_ent = select(EntidadCivil).where(
                            func.lower(EntidadCivil.nombre) == entidad_nombre.lower()
                        )
                        res_ent = await db.execute(query_ent)
                        entidad = res_ent.scalar_one_or_none()
                        
                        if not entidad:
                            raise ValueError(f"La entidad '{entidad_nombre}' no está registrada en el sistema. Regístrela primero.")
                        
                        entidades_cache[entidad_nombre] = entidad
                        
                    # 3. Parsear Enums
                    try:
                        uso_vehiculo = UsoVehiculo(uso_str)
                    except ValueError:
                        uso_vehiculo = UsoVehiculo.particular
                        
                    try:
                        tipo_combustible = TipoCombustible(comb_str)
                    except ValueError:
                        tipo_combustible = TipoCombustible.gasolina
                        
                    autorizado_combustible = True if aut_comb_str in ["SI", "S", "YES", "TRUE", "1"] else False
                    
                    # 4. Buscar si el vehículo ya existe
                    query_v = select(Vehiculo).where(Vehiculo.placa == placa)
                    res_v = await db.execute(query_v)
                    vehiculo = res_v.scalar_one_or_none()
                    
                    if vehiculo:
                        # Si existe, actualizamos sus datos (incluyendo la autorización)
                        vehiculo.marca = marca
                        vehiculo.modelo = modelo
                        vehiculo.color = color
                        vehiculo.tipo = tipo_vehic
                        vehiculo.entidad_id = entidad.id
                        vehiculo.uso_vehiculo = uso_vehiculo
                        vehiculo.autorizado_combustible = autorizado_combustible
                        vehiculo.tipo_combustible = tipo_combustible
                        vehiculo.capacidad_tanque = capacidad
                        vehiculo.asignacion_combustible_semanal = asignacion
                        resumen["actualizados"] += 1
                    else:
                        # Crear nuevo vehículo
                        vehiculo = Vehiculo(
                            id=uuid.uuid4(),
                            placa=placa,
                            marca=marca,
                            modelo=modelo,
                            color=color,
                            tipo=tipo_vehic,
                            entidad_id=entidad.id,
                            uso_vehiculo=uso_vehiculo,
                            autorizado_combustible=autorizado_combustible,
                            tipo_combustible=tipo_combustible,
                            capacidad_tanque=capacidad,
                            asignacion_combustible_semanal=asignacion,
                            ultimo_kilometraje=0,
                            activo=True
                        )
                        db.add(vehiculo)
                        resumen["exitosos"] += 1
                        
                    # 5. Flush periódico para detectar errores SQL rápido sin abortar todo
                    await db.flush()
                    
                    # Broadcast progreso en el canal global de la base
                    if index % 10 == 0 or index == len(rows) + 1:
                        await manager.broadcast(
                            {
                                "tipo": "PROGRESO_IMPORTACION_VEHICULOS",
                                "actual": index - 1,
                                "total": len(rows),
                                "exitosos": resumen["exitosos"],
                                "actualizados": resumen["actualizados"],
                                "errores": len(resumen["errores"])
                            },
                            channels=["MANDO_BASE"]
                        )
                        
                except Exception as e:
                    await db.rollback()
                    logger.error(f"Error procesando fila {index}: {str(e)}")
                    resumen["errores"].append({
                        "fila": index,
                        "error": str(e)
                    })
                    
            return resumen
            
        except Exception as e:
            logger.error(f"Error fatal en importación del parque automotor: {str(e)}")
            raise ValueError(f"No se pudo procesar la plantilla de Excel: {str(e)}")

import_combustible_service = ImportCombustibleService()
