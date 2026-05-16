import openpyxl
from io import BytesIO
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks
from app.schemas.socio import SocioCrear
from app.schemas.vehiculo import VehiculoCrear
from app.services.socio_service import socio_service
from app.core.security import hashear_password
from app.core.excepciones import EntidadNoEncontrada
import logging
from app.core.notify_manager import manager

logger = logging.getLogger(__name__)

class ImportService:
    async def procesar_excel_socios(
        self, 
        db: AsyncSession, 
        file_content: bytes, 
        entidad_id: UUID, 
        creador_id: UUID,
        fecha_expiracion: Optional[date] = None,
        background_tasks: Optional[BackgroundTasks] = None
    ) -> Dict[str, Any]:
        """
        Procesa un archivo Excel para importar socios masivamente.
        Columnas esperadas: cedula, nombre, apellido, email, telefono, placa, marca, modelo, color
        """
        try:
            wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
            sheet = wb.active
            
            resumen = {
                "total": 0,
                "exitosos": 0,
                "errores": []
            }
            
            rows = list(sheet.iter_rows(min_row=2, values_only=True))
            resumen["total"] = len(rows)
            
            for index, row in enumerate(rows, start=2):
                if not any(row): # Fila vacía
                    continue
                
                try:
                    # Columnas: A=cedula, B=nombre, C=apellido, D=email, E=telefono
                    # Vehículos: 
                    # V1: F=placa, G=marca, H=modelo, I=color
                    # V2: J=placa, K=marca, L=modelo, M=color
                    # V3: N=placa, O=marca, P=modelo, Q=color
                    # V4: R=placa, S=marca, T=modelo, U=color
                    
                    cedula, nombre, apellido, email, telefono = row[:5]
                    
                    # LÓGICA DE FLEXIBILIDAD (Aegis Tactical v2.3)
                    # Si faltan datos críticos, asignamos temporales para permitir que el socio complete su perfil luego.
                    if not cedula:
                        import uuid
                        cedula = f"TEMP-{uuid.uuid4().hex[:8].upper()}"
                    
                    if not nombre:
                        nombre = "MIEMBRO"
                    
                    if not apellido:
                        apellido = "PENDIENTE"
                    
                    # Limpieza básica
                    cedula = str(cedula).strip().upper()
                    nombre = str(nombre).strip().upper()
                    apellido = str(apellido).strip().upper()
                    email = str(email).replace(" ", "").lower() if email else None
                    telefono = str(telefono).strip() if telefono else None
                    
                    # La contraseña por defecto será la cédula (incluso si es la temporal)
                    datos_socio = SocioCrear(
                        cedula=cedula,
                        nombre=nombre,
                        apellido=apellido,
                        email=email,
                        telefono=telefono,
                        entidad_id=entidad_id,
                        password=cedula,
                        vehiculos=[],
                        fecha_expiracion=fecha_expiracion
                    )
                    
                    # Procesar hasta 4 vehículos (Deduplicación interna v2.5)
                    placas_procesadas = set()
                    for i in range(4):
                        start_idx = 5 + (i * 4)
                        if len(row) > start_idx:
                            v_placa = row[start_idx]
                            v_marca = row[start_idx + 1] if len(row) > start_idx + 1 else None
                            v_modelo = row[start_idx + 2] if len(row) > start_idx + 2 else None
                            v_color = row[start_idx + 3] if len(row) > start_idx + 3 else None
                            
                            if v_placa and str(v_placa).strip():
                                placa_clean = str(v_placa).strip().upper()
                                if placa_clean not in placas_procesadas:
                                    datos_socio.vehiculos.append(VehiculoCrear(
                                        placa=placa_clean,
                                        marca=str(v_marca).strip().upper() if v_marca else "S/M",
                                        modelo=str(v_modelo).strip().upper() if v_modelo else "S/M",
                                        color=str(v_color).strip().upper() if v_color else "S/C"
                                    ))
                                    placas_procesadas.add(placa_clean)
                    
                    await socio_service.crear_socio_con_membresia(db, datos_socio, creador_id, background_tasks)
                    resumen["exitosos"] += 1
                    
                    # Emitir progreso táctico (Aegis v2.6)
                    if (index - 1) % 5 == 0 or (index - 1) == len(rows):
                        await manager.broadcast(
                            {
                                "tipo": "PROGRESO_IMPORTACION", 
                                "actual": index - 1, 
                                "total": len(rows), 
                                "exitosos": resumen["exitosos"],
                                "errores": len(resumen["errores"])
                            },
                            channels=[f"ENTIDAD_{entidad_id}"]
                        )
                    
                except Exception as e:
                    # CRITICAL: Si una fila falla (ej: placa duplicada), debemos hacer rollback
                    # para que la sesión pueda procesar la siguiente fila.
                    await db.rollback()
                    logger.error(f"Error procesando fila {index}: {str(e)}")
                    resumen["errores"].append({
                        "fila": index,
                        "error": str(e)
                    })
            
            return resumen
            
        except Exception as e:
            logger.error(f"Error fatal en importación: {str(e)}")
            raise ValueError(f"No se pudo procesar el archivo Excel: {str(e)}")

import_service = ImportService()
