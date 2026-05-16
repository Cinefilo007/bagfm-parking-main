from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select, func as sql_func
from sqlalchemy.orm import joinedload, selectinload

from app.models.acceso import Acceso
from app.models.codigo_qr import CodigoQR
from app.models.vehiculo_pase import VehiculoPase
from app.models.vehiculo import Vehiculo
from app.models.puesto_estacionamiento import PuestoEstacionamiento
from app.models.asignacion_zona import AsignacionZona
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.models.usuario import Usuario
from app.models.enums import EstadoPuesto, AccesoTipo
from app.services.configuracion_service import configuracion_service


class ParqueroService:

    # ──────────────────────────────────────────────────────────────────────────
    # AUXILIARES
    # ──────────────────────────────────────────────────────────────────────────

    async def _actualizar_ocupacion_zona(self, db: AsyncSession, zona_id: UUID, delta: int):
        """Incrementa o decrementa la ocupacion_actual de la zona."""
        res = await db.execute(select(ZonaEstacionamiento).where(ZonaEstacionamiento.id == zona_id))
        zona = res.scalars().first()
        if zona:
            # Asegurar que no baje de 0
            zona.ocupacion_actual = max(0, (zona.ocupacion_actual or 0) + delta)
            return zona
        return None

    # ──────────────────────────────────────────────────────────────────────────
    # DATOS DE ZONA
    # ──────────────────────────────────────────────────────────────────────────

    async def get_mi_zona(self, db: AsyncSession, usuario_id: UUID) -> Dict[str, Any]:
        """
        Retorna la zona asignada al parquero con KPIs de precisión táctica.
        Desglosa ocupados por tipo (Base, Entidad/VIP, General).
        """
        res_usr = await db.execute(
            select(Usuario)
            .options(joinedload(Usuario.zona_asignada))
            .where(Usuario.id == usuario_id)
        )
        usuario = res_usr.scalars().first()

        if not usuario or not usuario.zona_asignada_id:
            return None

        zona = usuario.zona_asignada

        # ── 1. Obtener Reservados (Cupos) ──
        res_asig = await db.execute(
            select(AsignacionZona)
            .where(AsignacionZona.zona_id == zona.id, AsignacionZona.activa == True)
        )
        asignaciones = res_asig.scalars().all()
        
        n_reservados_base = 0
        n_reservados_entidad = 0
        for asig in asignaciones:
            n_reservados_base += (asig.cupo_reservado_base or 0)
            if asig.distribucion_cupos:
                for val in asig.distribucion_cupos.values():
                    if isinstance(val, (int, float)):
                        n_reservados_entidad += int(val)

        # ── 2. Analizar Ocupados por Tipo ──
        # Buscamos vehículos activos en la zona y su tipo de acceso
        res_activos = await db.execute(
            select(VehiculoPase, CodigoQR.tipo_acceso)
            .outerjoin(CodigoQR, VehiculoPase.qr_id == CodigoQR.id)
            .where(VehiculoPase.zona_asignada_id == zona.id, VehiculoPase.ingresado == True)
        )
        
        ocupados_base = 0
        ocupados_entidad = 0
        ocupados_general = 0
        
        for vp, tipo_qr in res_activos.all():
            tipo = (tipo_qr or 'general').lower()
            # Clasificación táctica de ocupación
            if tipo == 'base':
                ocupados_base += 1
            elif tipo in ['vip', 'produccion', 'logistica', 'prensa']:
                ocupados_entidad += 1
            else:
                ocupados_general += 1

        # ── 3. Calcular KPIs ──
        total = zona.capacidad_total or 0
        reservados_totales = n_reservados_base + n_reservados_entidad
        ocupados_totales = ocupados_base + ocupados_entidad + ocupados_general
        
        # ── 4. Calcular Perdidos ──
        perdidos_lista = await self.get_vehiculos_perdidos(db, usuario_id)
        n_perdidos = len(perdidos_lista)

        return {
            "id": str(zona.id),
            "nombre": zona.nombre,
            "capacidad_total": total,
            "usa_puestos_identificados": zona.usa_puestos_identificados,
            "kpis": {
                "libres": max(0, total - ocupados_totales), 
                "ocupados": ocupados_totales,
                "ocupados_base": ocupados_base,
                "ocupados_entidad": ocupados_entidad,
                "ocupados_general": ocupados_general,
                "reservados": reservados_totales,
                "reservados_base": n_reservados_base,
                "reservados_entidad": n_reservados_entidad,
                "total": total,
                "perdidos": n_perdidos
            }
        }






    # ──────────────────────────────────────────────────────────────────────────
    # VEHÍCULOS EN ZONA
    # ──────────────────────────────────────────────────────────────────────────

    async def get_vehiculos_en_zona(self, db: AsyncSession, zona_id: UUID) -> List[Dict]:
        """
        Retorna los vehículos actualmente estacionados en la zona (VehiculoPase ingresados).
        """
        res = await db.execute(
            select(VehiculoPase)
            .options(
                joinedload(VehiculoPase.puesto_asignado),
                selectinload(VehiculoPase.codigo_qr).selectinload(CodigoQR.usuario),
                selectinload(VehiculoPase.codigo_qr).selectinload(CodigoQR.vehiculo)
            )
            .where(
                VehiculoPase.zona_asignada_id == zona_id,
                VehiculoPase.ingresado == True
            )
            .order_by(VehiculoPase.hora_ingreso.desc())
        )
        vehiculos = res.scalars().all()

        ahora = datetime.now(timezone.utc)
        resultado = []
        for v in vehiculos:
            tiempo_min = None
            if v.hora_ingreso:
                tiempo_min = int((ahora - v.hora_ingreso.replace(tzinfo=timezone.utc) if v.hora_ingreso.tzinfo is None else ahora - v.hora_ingreso).total_seconds() / 60)

            puesto_codigo = None
            if v.puesto_asignado_id and hasattr(v, 'puesto_asignado') and v.puesto_asignado:
                puesto_codigo = v.puesto_asignado.numero_puesto

            info_v = self._get_tipo_acceso_info(v.codigo_qr) if v.codigo_qr else {"nombre": "GENERAL", "color": "#94a3b8"}
            
            portador = "DESCONOCIDO"
            telefono = None
            marca = v.marca
            modelo = v.modelo
            color = v.color
            
            if v.codigo_qr:
                if not marca: marca = v.codigo_qr.vehiculo_marca
                if not modelo: modelo = v.codigo_qr.vehiculo_modelo
                if not color: color = v.codigo_qr.vehiculo_color
                
                if hasattr(v.codigo_qr, 'vehiculo') and v.codigo_qr.vehiculo:
                    if not marca: marca = v.codigo_qr.vehiculo.marca
                    if not modelo: modelo = v.codigo_qr.vehiculo.modelo
                    if not color: color = v.codigo_qr.vehiculo.color
                    
                if v.codigo_qr.nombre_portador:
                    portador = v.codigo_qr.nombre_portador
                    telefono = v.codigo_qr.telefono_portador
                elif v.codigo_qr.usuario:
                    portador = f"{v.codigo_qr.usuario.nombre} {v.codigo_qr.usuario.apellido}".strip()
                    telefono = v.codigo_qr.usuario.telefono
            
            resultado.append({
                "id": str(v.id),
                "placa": v.placa,
                "marca": marca,
                "modelo": modelo,
                "color": color,
                "tipo_pase": info_v["nombre"],
                "tipo_pase_color": info_v["color"],
                "nombre_portador": portador,
                "telefono_portador": telefono,
                "hora_ingreso": v.hora_ingreso.isoformat() if v.hora_ingreso else None,
                "tiempo_en_zona_min": tiempo_min,
                "puesto_asignado_id": str(v.puesto_asignado_id) if v.puesto_asignado_id else None,
                "puesto_codigo": puesto_codigo,
            })
        return resultado

    # ──────────────────────────────────────────────────────────────────────────
    # LLEGADA POR PLACA (MANUAL)
    # ──────────────────────────────────────────────────────────────────────────

    async def registrar_llegada_placa(
        self, db: AsyncSession, placa: str, zona_id: UUID, parquero_id: UUID,
        nombre: str = None, cedula: str = None, telefono: str = None,
        marca: str = None, modelo: str = None, color: str = None,
        confirmar: bool = True
    ) -> Dict[str, Any]:
        """
        Busca un vehículo por placa siguiendo esta cadena de búsqueda:
          1. VehiculoPase activo en zona → ya registrado (error)
          2. VehiculoPase inactivo en zona → marcar como llegado
          3. Tabla `vehiculos` (socios registrados) → crear VehiculoPase con sus datos
          4. Tabla `codigos_qr` por vehiculo_placa → pases temporales/masivos con datos en el QR
          5. No encontrado → sin_datos=True (registrar datos manualmente)
        """
        placa_norm = placa.strip().upper()

        # ── 1. Verificar si ya hay un VehiculoPase activo con esa placa en la zona ──
        res_vp = await db.execute(
            select(VehiculoPase).where(
                VehiculoPase.placa == placa_norm,
                VehiculoPase.zona_asignada_id == zona_id,
                VehiculoPase.ingresado == True
            )
        )
        vp_activo = res_vp.scalars().first()
        if vp_activo:
            raise ValueError(f"El vehículo {placa_norm} ya está registrado en la zona.")

        # ── 2. VehiculoPase inactivo para esta zona (tiene pase pero no ha llegado) ──
        res_vp2 = await db.execute(
            select(VehiculoPase).options(
                selectinload(VehiculoPase.codigo_qr).selectinload(CodigoQR.usuario),
                selectinload(VehiculoPase.codigo_qr).selectinload(CodigoQR.vehiculo)
            ).where(
                VehiculoPase.placa == placa_norm,
                VehiculoPase.zona_asignada_id == zona_id,
                VehiculoPase.ingresado == False
            )
        )
        vehiculo_pase = res_vp2.scalars().first()

        if vehiculo_pase:
            # ACTUALIZACIÓN DE DATOS EN LA FUENTE SI SE PROPORCIONAN
            if vehiculo_pase.codigo_qr:
                qr = vehiculo_pase.codigo_qr
                if nombre: qr.nombre_portador = nombre.strip().upper()
                if cedula: qr.cedula_portador = cedula.strip().upper()
                if telefono: qr.telefono_portador = telefono.strip()
                if marca: qr.vehiculo_marca = marca.strip().upper()
                if modelo: qr.vehiculo_modelo = modelo.strip().upper()
                if color: qr.vehiculo_color = color.strip().upper()
                qr.datos_completos = True
            else:
                # Si no tiene QR, podría ser un Socio o manual. Buscamos por placa en vehiculos.
                res_v = await db.execute(select(Vehiculo).where(Vehiculo.placa == placa_norm))
                v_db = res_v.scalars().first()
                if v_db:
                    if marca: v_db.marca = marca.strip().upper()
                    if modelo: v_db.modelo = modelo.strip().upper()
                    if color: v_db.color = color.strip().upper()
                    if v_db.socio_id:
                        res_u = await db.execute(select(Usuario).where(Usuario.id == v_db.socio_id))
                        u_db = res_u.scalars().first()
                        if u_db:
                            if nombre:
                                parts = nombre.strip().upper().split(' ', 1)
                                u_db.nombre = parts[0]
                                if len(parts) > 1: u_db.apellido = parts[1]
                            if cedula: u_db.cedula = cedula.strip().upper()
                            if telefono: u_db.telefono = telefono.strip()

            if confirmar:
                vehiculo_pase.ingresado = True
                vehiculo_pase.hora_ingreso = datetime.now(timezone.utc)
                vehiculo_pase.hora_salida = None
                
                # Actualizar también los datos locales del VehiculoPase para consistencia inmediata
                if marca: vehiculo_pase.marca = marca.strip().upper()
                if modelo: vehiculo_pase.modelo = modelo.strip().upper()
                if color: vehiculo_pase.color = color.strip().upper()
                
                # Incrementar ocupación
                await self._actualizar_ocupacion_zona(db, zona_id, 1)
                
                await db.commit()
                await db.refresh(vehiculo_pase)
                
            info_pase = self._get_tipo_acceso_info(vehiculo_pase.codigo_qr) if vehiculo_pase.codigo_qr else {"nombre": "GENERAL", "color": "#94a3b8"}
            
            portador = "DESCONOCIDO"
            cedula_portador = None
            telefono_portador = None
            marca = vehiculo_pase.marca
            modelo = vehiculo_pase.modelo
            color = vehiculo_pase.color
            
            if vehiculo_pase.codigo_qr:
                portador = vehiculo_pase.codigo_qr.nombre_portador
                cedula_portador = vehiculo_pase.codigo_qr.cedula_portador
                telefono_portador = vehiculo_pase.codigo_qr.telefono_portador
            else:
                # Intentar recuperar de vehiculo/socio si no hay QR
                res_v = await db.execute(select(Vehiculo).where(Vehiculo.placa == placa_norm))
                v_db = res_v.scalars().first()
                if v_db and v_db.socio_id:
                    res_u = await db.execute(select(Usuario).where(Usuario.id == v_db.socio_id))
                    u_db = res_u.scalars().first()
                    if u_db:
                        portador = f"{u_db.nombre} {u_db.apellido}".strip()
                        cedula_portador = u_db.cedula
                        telefono_portador = u_db.telefono

            return {
                "sin_datos": False,
                "vehiculo_pase_id": str(vehiculo_pase.id),
                "placa": vehiculo_pase.placa,
                "marca": marca,
                "modelo": modelo,
                "color": color,
                "tipo_pase": info_pase["nombre"],
                "tipo_pase_color": info_pase["color"],
                "nombre_portador": portador,
                "cedula_portador": cedula_portador,
                "telefono_portador": telefono_portador,
                "puesto_asignado_id": str(vehiculo_pase.puesto_asignado_id) if vehiculo_pase.puesto_asignado_id else None,
            }

        # ── 3. Tabla `vehiculos` (socios con registro permanente) ──
        res_veh = await db.execute(
            select(Vehiculo).where(Vehiculo.placa == placa_norm)
        )
        vehiculo_db = res_veh.scalars().first()

        if vehiculo_db:
            # ACTUALIZACIÓN DE DATOS DEL SOCIO / VEHÍCULO SI SE PROPORCIONAN
            if vehiculo_db.socio_id:
                res_u = await db.execute(select(Usuario).where(Usuario.id == vehiculo_db.socio_id))
                usr = res_u.scalars().first()
                if usr:
                    if nombre:
                        parts = nombre.strip().upper().split(' ', 1)
                        usr.nombre = parts[0]
                        if len(parts) > 1: usr.apellido = parts[1]
                    if cedula: usr.cedula = cedula.strip().upper()
                    if telefono: usr.telefono = telefono.strip()
            
            if marca: vehiculo_db.marca = marca.strip().upper()
            if modelo: vehiculo_db.modelo = modelo.strip().upper()
            if color: vehiculo_db.color = color.strip().upper()

            nuevo_vp = VehiculoPase(
                placa=placa_norm,
                marca=vehiculo_db.marca,
                modelo=vehiculo_db.modelo,
                color=vehiculo_db.color,
                zona_asignada_id=zona_id,
                ingresado=confirmar,
                hora_ingreso=datetime.now(timezone.utc) if confirmar else None
            )
            db.add(nuevo_vp)
            
            if confirmar:
                # Incrementar ocupación
                await self._actualizar_ocupacion_zona(db, zona_id, 1)
            
            await db.commit()
            await db.refresh(nuevo_vp)
            
            # Recuperar datos actualizados para la respuesta
            portador_final = "SOCIO PERMANENTE"
            cedula_final = None
            telefono_final = None
            if vehiculo_db.socio_id:
                res_u = await db.execute(select(Usuario).where(Usuario.id == vehiculo_db.socio_id))
                u_final = res_u.scalars().first()
                if u_final:
                    portador_final = f"{u_final.nombre} {u_final.apellido}".strip()
                    cedula_final = u_final.cedula
                    telefono_final = u_final.telefono

            return {
                "sin_datos": False,
                "vehiculo_pase_id": str(nuevo_vp.id),
                "placa": nuevo_vp.placa,
                "marca": nuevo_vp.marca,
                "modelo": nuevo_vp.modelo,
                "color": nuevo_vp.color,
                "tipo_pase": "SOCIO PERMANENTE",
                "tipo_pase_color": "#3b82f6",
                "nombre_portador": portador_final,
                "cedula_portador": cedula_final,
                "telefono_portador": telefono_final,
                "puesto_asignado_id": None,
            }

        # ── 4. CodigoQR con datos de vehículo (pases temporales / pases masivos) ──
        # Buscar QR activo con esa placa de vehículo, sin filtrar por zona
        # ya que el QR puede estar asignado a esta zona o no tener zona aún
        res_qr = await db.execute(
            select(CodigoQR).where(
                CodigoQR.vehiculo_placa == placa_norm,
                CodigoQR.activo == True
            ).order_by(CodigoQR.created_at.desc())
        )
        qr_encontrado = res_qr.scalars().first()

        if qr_encontrado:
            # ── Validar zona asignada del QR (SOP: Control estricto de destino) ──
            if qr_encontrado.zona_asignada_id and qr_encontrado.zona_asignada_id != zona_id:
                res_zona_qr = await db.execute(
                    select(ZonaEstacionamiento).where(ZonaEstacionamiento.id == qr_encontrado.zona_asignada_id)
                )
                zona_qr = res_zona_qr.scalars().first()
                nombre_zona_correcta = zona_qr.nombre if zona_qr else "otra zona"
                raise ValueError(
                    f"Pase Inválido. Este vehículo ({placa_norm}) tiene un pase asignado a la zona "
                    f"'{nombre_zona_correcta}'. Indique al conductor que debe dirigirse a esa zona."
                )

            # Tiene un QR con datos del vehículo. Crear VehiculoPase vinculado al QR.
            nuevo_vp = VehiculoPase(
                qr_id=qr_encontrado.id,
                placa=placa_norm,
                marca=qr_encontrado.vehiculo_marca,
                modelo=qr_encontrado.vehiculo_modelo,
                color=qr_encontrado.vehiculo_color,
                zona_asignada_id=zona_id,
                ingresado=confirmar,
                hora_ingreso=datetime.now(timezone.utc) if confirmar else None
            )
            db.add(nuevo_vp)
            await db.commit()
            await db.refresh(nuevo_vp)

            # Si el QR no tiene datos de la persona (nombre, cédula), pedir al parquero
            # pero pasando los datos del vehículo ya conocidos para no repetirlos
            datos_persona_incompletos = not qr_encontrado.datos_completos or not qr_encontrado.nombre_portador

            if datos_persona_incompletos or nombre or cedula or telefono:
                # ACTUALIZACIÓN DE DATOS DEL QR SI SE PROPORCIONAN
                if nombre: qr_encontrado.nombre_portador = nombre.strip().upper()
                if cedula: qr_encontrado.cedula_portador = cedula.strip().upper()
                if telefono: qr_encontrado.telefono_portador = telefono.strip()
                if marca: qr_encontrado.vehiculo_marca = marca.strip().upper()
                if modelo: qr_encontrado.vehiculo_modelo = modelo.strip().upper()
                if color: qr_encontrado.vehiculo_color = color.strip().upper()
                
                if qr_encontrado.nombre_portador and qr_encontrado.cedula_portador and qr_encontrado.vehiculo_placa:
                    qr_encontrado.datos_completos = True

                # Guardar el VP incompleto para poder referenciarlo
                await db.commit()
                await db.refresh(nuevo_vp)
                
                info_pase = self._get_tipo_acceso_info(qr_encontrado)
                return {
                    "sin_datos": not qr_encontrado.datos_completos,
                    "solo_persona": True,
                    "vehiculo_pase_id": str(nuevo_vp.id),
                    "qr_id": str(qr_encontrado.id),
                    "placa": placa_norm,
                    "marca": qr_encontrado.vehiculo_marca,
                    "modelo": qr_encontrado.vehiculo_modelo,
                    "color": qr_encontrado.vehiculo_color,
                    "tipo_pase": info_pase["nombre"],
                    "tipo_pase_color": info_pase["color"],
                    "nombre_portador": qr_encontrado.nombre_portador,
                    "cedula_portador": qr_encontrado.cedula_portador,
                    "telefono_portador": qr_encontrado.telefono_portador,
                    "zona_id": str(zona_id),
                    "mensaje": "Complete los datos del portador para finalizar el registro." if not qr_encontrado.datos_completos else "Datos actualizados.",
                }

            # QR tiene datos completos → registrar directamente
            if confirmar:
                # Incrementar ocupación
                await self._actualizar_ocupacion_zona(db, zona_id, 1)
            
            await db.commit()
            await db.refresh(nuevo_vp)
            info_pase = self._get_tipo_acceso_info(qr_encontrado)
            return {
                "sin_datos": False,
                "vehiculo_pase_id": str(nuevo_vp.id),
                "placa": placa_norm,
                "marca": qr_encontrado.vehiculo_marca,
                "modelo": qr_encontrado.vehiculo_modelo,
                "color": qr_encontrado.vehiculo_color,
                "tipo_pase": info_pase["nombre"],
                "tipo_pase_color": info_pase["color"],
                "nombre_portador": qr_encontrado.nombre_portador,
                "puesto_asignado_id": None,
            }

        # ── 5. Sin datos en ninguna fuente ──
        if nombre or cedula or marca or modelo or color:
            import string, secrets
            from app.models.enums import QRTipo
            token_qr = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            nuevo_qr = CodigoQR(
                token=token_qr,
                tipo=QRTipo.temporal,
                activo=True,
                vehiculo_placa=placa_norm,
                vehiculo_marca=marca,
                vehiculo_modelo=modelo,
                vehiculo_color=color,
                nombre_portador=nombre,
                cedula_portador=cedula,
                telefono_portador=telefono,
                zona_asignada_id=zona_id,
                created_by=parquero_id,
                datos_completos=True
            )
            db.add(nuevo_qr)
            await db.flush()
            
            nuevo_vp = VehiculoPase(
                qr_id=nuevo_qr.id,
                placa=placa_norm,
                marca=marca,
                modelo=modelo,
                color=color,
                zona_asignada_id=zona_id,
                ingresado=confirmar,
                hora_ingreso=datetime.now(timezone.utc) if confirmar else None
            )
            db.add(nuevo_vp)
            if confirmar:
                await self._actualizar_ocupacion_zona(db, zona_id, 1)
            await db.commit()
            await db.refresh(nuevo_vp)
            
            return {
                "sin_datos": False,
                "vehiculo_pase_id": str(nuevo_vp.id),
                "placa": placa_norm,
                "marca": marca,
                "modelo": modelo,
                "color": color,
                "tipo_pase": "GENERAL",
                "tipo_pase_color": "#94a3b8",
                "nombre_portador": nombre,
                "puesto_asignado_id": None,
            }

        return {
            "sin_datos": True,
            "solo_persona": False,
            "placa": placa_norm,
            "mensaje": "Vehículo no encontrado. Complete los datos para registrarlo.",
        }

    async def completar_datos_portador(
        self, db: AsyncSession, qr_id: UUID, vehiculo_pase_id: UUID,
        nombre: str | None, cedula: str | None, telefono: str | None,
        zona_id: UUID | None = None,
        placa: str | None = None, marca: str | None = None,
        modelo: str | None = None, color: str | None = None
    ) -> Dict[str, Any]:
        """Completa los datos y activa el ingreso (ocupación)."""
        res_qr = await db.execute(select(CodigoQR).where(CodigoQR.id == qr_id))
        qr = res_qr.scalars().first()
        if not qr:
            raise ValueError("QR no encontrado")

        res_vp = await db.execute(select(VehiculoPase).where(VehiculoPase.id == vehiculo_pase_id))
        vp = res_vp.scalars().first()

        # ── 1. Actualizar CodigoQR ──
        if nombre: qr.nombre_portador = nombre.strip().upper()
        if cedula: qr.cedula_portador = cedula.strip().upper()
        if telefono: qr.telefono_portador = telefono.strip()
        
        if placa: qr.vehiculo_placa = placa.strip().upper()
        if marca: qr.vehiculo_marca = marca.strip().upper()
        if modelo: qr.vehiculo_modelo = modelo.strip().upper()
        if color: qr.vehiculo_color = color.strip().upper()
        
        qr.datos_completos = True

        # ── 2. Si es SOCIO (tiene usuario_id), actualizar tabla usuarios y vehiculos ──
        if qr.usuario_id:
            res_u = await db.execute(select(Usuario).where(Usuario.id == qr.usuario_id))
            usr = res_u.scalars().first()
            if usr:
                if nombre:
                    parts = nombre.strip().upper().split(' ', 1)
                    usr.nombre = parts[0]
                    if len(parts) > 1: usr.apellido = parts[1]
                if cedula: usr.cedula = cedula.strip().upper()
                if telefono: usr.telefono = telefono.strip()
            
            # También actualizar el vehículo si está vinculado
            if qr.vehiculo_id:
                res_v = await db.execute(select(Vehiculo).where(Vehiculo.id == qr.vehiculo_id))
                veh = res_v.scalars().first()
                if veh:
                    if marca: veh.marca = marca.strip().upper()
                    if modelo: veh.modelo = modelo.strip().upper()
                    if color: veh.color = color.strip().upper()

        # ── 3. Actualizar VehiculoPase e ingresar ──
        if vp:
            vp.nombre_portador = qr.nombre_portador
            vp.cedula_portador = qr.cedula_portador
            vp.telefono_portador = qr.telefono_portador
            
            if placa: vp.placa = qr.vehiculo_placa
            if marca: vp.marca = qr.vehiculo_marca
            if modelo: vp.modelo = qr.vehiculo_modelo
            if color: vp.color = qr.vehiculo_color
            
            vp.ingresado = True
            vp.hora_ingreso = datetime.now(timezone.utc)
            
            # Incrementar ocupación al finalizar registro de datos
            target_zona = zona_id or vp.zona_asignada_id
            if target_zona:
                await self._actualizar_ocupacion_zona(db, target_zona, 1)

        await db.commit()
        return {"ok": True, "success": True}



    async def _sincronizar_salida_base(self, db: AsyncSession, vehiculo_pase: VehiculoPase, parquero_id: UUID):
        """
        SOP: Sincronización Táctica de Salidas (Aegis v2.3).
        Si la opción está activa, registra automáticamente el egreso de la base.
        """
        config = await configuracion_service.get_config_salidas(db)
        
        if config.get("sync_parquero"):
            # Registrar acceso de salida en sistema central
            nueva_salida = Acceso(
                qr_id = vehiculo_pase.qr_id,
                usuario_id = None,
                vehiculo_id = None,
                vehiculo_pase_id = vehiculo_pase.id,
                tipo = AccesoTipo.salida,
                punto_acceso = "SINCRO PARQUERO",
                registrado_por = parquero_id,
                es_manual = True,
                vehiculo_placa = vehiculo_pase.placa,
                observaciones = "Salida automática sincronizada con parquero."
            )
            # Intentar rellenar usuario_id si el QR lo tiene
            if vehiculo_pase.qr_id:
                qr_db = await db.get(CodigoQR, vehiculo_pase.qr_id)
                if qr_db:
                    nueva_salida.usuario_id = qr_db.usuario_id
                    nueva_salida.vehiculo_id = qr_db.vehiculo_id

            db.add(nueva_salida)

    # ──────────────────────────────────────────────────────────────────────────
    # SALIDA POR PLACA (MANUAL)
    # ──────────────────────────────────────────────────────────────────────────

    async def registrar_salida_placa(
        self, db: AsyncSession, placa: str, zona_id: UUID, parquero_id: UUID
    ) -> Dict[str, Any]:
        """
        Registra la salida de un vehículo buscándolo por placa en la zona activa.
        """
        placa_norm = placa.strip().upper()

        res_vp = await db.execute(
            select(VehiculoPase).where(
                VehiculoPase.placa == placa_norm,
                VehiculoPase.zona_asignada_id == zona_id,
                VehiculoPase.ingresado == True
            )
        )
        vehiculo_pase = res_vp.scalars().first()

        if not vehiculo_pase:
            raise ValueError(f"No se encontró el vehículo {placa_norm} activo en la zona.")

        vehiculo_pase.ingresado = False
        vehiculo_pase.hora_salida = datetime.now(timezone.utc)
        
        # Restar ocupación
        await self._actualizar_ocupacion_zona(db, zona_id, -1)

        if vehiculo_pase.puesto_asignado_id:
            res_p = await db.execute(
                select(PuestoEstacionamiento).where(
                    PuestoEstacionamiento.id == vehiculo_pase.puesto_asignado_id
                )
            )
            puesto = res_p.scalars().first()
            if puesto:
                puesto.estado = EstadoPuesto.libre
                puesto.qr_actual_id = None
                puesto.vehiculo_actual_id = None
                puesto.ocupado_desde = None

        # Sincronización Aegis v2.3
        await self._sincronizar_salida_base(db, vehiculo_pase, parquero_id)

        await db.commit()
        await db.refresh(vehiculo_pase)
        return {
            "placa": vehiculo_pase.placa,
            "vehiculo_pase_id": str(vehiculo_pase.id),
            "mensaje": f"Salida registrada para {vehiculo_pase.placa}",
        }

    # ──────────────────────────────────────────────────────────────────────────
    # TRAZABILIDAD DE ZONA
    # ──────────────────────────────────────────────────────────────────────────

    async def get_trazabilidad_zona(
        self, db: AsyncSession, zona_id: UUID, limite: int = 100, skip: int = 0
    ) -> List[Dict[str, Any]]:
        """
        SOP: Historial de Zona (Aegis v2.4).
        Retorna el historial temporal de vehículos de la zona.
        Combina:
        - Accesos de alcabala con destino confirmado a esta zona (Acceso.zona_id == zona_id).
          Usa el campo persistido en el momento del acceso, NO el QR actual.
          Garantiza estabilidad histórica: si la zona del socio cambia, los accesos
          anteriores NO se mueven al historial de la nueva zona.
        - VehiculoPase (ingresó zona / salió zona)
        Ordena por timestamp desc. Paginación sobre lista combinada.
        """
        eventos = []
        fetch_limit = limite + skip

        # --- Accesos de alcabala usando zona_id persistido en el acceso ---
        # Filtro directo por Acceso.zona_id: estable e independiente del QR actual.
        # Fallback: si el acceso no tiene zona_id (registros previos a v2.4), usar join con QR.
        res_accesos = await db.execute(
            select(Acceso)
            .where(
                Acceso.zona_id == zona_id,
                Acceso.tipo == AccesoTipo.entrada
            )
            .order_by(Acceso.timestamp.desc())
            .limit(fetch_limit)
        )
        for acceso in res_accesos.scalars().all():
            # Intentar resolver datos del vehículo y portador
            placa = acceso.vehiculo_placa
            marca = acceso.vehiculo_marca
            modelo = acceso.vehiculo_modelo
            color = acceso.vehiculo_color
            portador = acceso.nombre_manual

            info_pase = {"nombre": "GENERAL", "color": "#94a3b8"}

            # ── Intenta resolver el portador y vehículo si es un Socio Fijo ──
            if acceso.usuario_id:
                u = await db.get(Usuario, acceso.usuario_id)
                if u:
                    if not portador: portador = f"{u.nombre} {u.apellido}".strip()
                    if not cedula_portador: cedula_portador = u.cedula
                    if not telefono_portador: telefono_portador = u.telefono
                    info_pase = {"nombre": "SOCIO PERMANENTE", "color": "#3b82f6"}
                
                if not placa and acceso.vehiculo_id:
                    v = await db.get(Vehiculo, acceso.vehiculo_id)
                    if v:
                        placa = v.placa
                        marca = v.marca
                        modelo = v.modelo
                        color = v.color

            falta_datos = False
            cedula_portador = acceso.cedula_manual
            telefono_portador = acceso.telefono_manual

            if acceso.qr_id:
                qr = await db.get(CodigoQR, acceso.qr_id)
                if qr:
                    if not placa: placa = qr.vehiculo_placa
                    if not marca: marca = qr.vehiculo_marca
                    if not modelo: modelo = qr.vehiculo_modelo
                    if not color: color = qr.vehiculo_color
                    if not portador: portador = qr.nombre_portador
                    if not cedula_portador: cedula_portador = qr.cedula_portador
                    if not telefono_portador: telefono_portador = qr.telefono_portador
                    info_pase = self._get_tipo_acceso_info(qr)
                    if not qr.datos_completos:
                        falta_datos = True
                        
            if not placa or not portador or portador == "DESCONOCIDO":
                falta_datos = True

            eventos.append({
                "id": acceso.id,
                "qr_id": acceso.qr_id,
                "tipo": "alcabala",
                "placa": placa,
                "marca": marca,
                "modelo": modelo,
                "color": color,
                "nombre_portador": portador,
                "cedula_portador": cedula_portador,
                "telefono_portador": telefono_portador,
                "tipo_pase": info_pase["nombre"],
                "tipo_pase_color": info_pase["color"],
                "descripcion": f"Entrada por alcabala: {acceso.punto_acceso}",
                "timestamp": acceso.timestamp.isoformat() if acceso.timestamp else None,
                "punto": acceso.punto_acceso,
                "es_manual": acceso.es_manual,
                "falta_datos": falta_datos,
            })

        # --- VehiculoPase — ingreso a zona ---
        res_vp_in = await db.execute(
            select(VehiculoPase)
            .options(selectinload(VehiculoPase.codigo_qr))
            .where(
                VehiculoPase.zona_asignada_id == zona_id,
                and_(VehiculoPase.hora_ingreso.isnot(None))
            )
            .order_by(VehiculoPase.hora_ingreso.desc())
            .limit(fetch_limit)
        )
        for vp in res_vp_in.scalars().all():
            # Intentar resolver nombre del portador y contacto
            portador = "DESCONOCIDO"
            cedula_portador = None
            telefono_portador = None

            if vp.codigo_qr:
                portador = vp.codigo_qr.nombre_portador
                cedula_portador = vp.codigo_qr.cedula_portador
                telefono_portador = vp.codigo_qr.telefono_portador
                if not portador and vp.codigo_qr.usuario_id:
                    res_u = await db.execute(select(Usuario).where(Usuario.id == vp.codigo_qr.usuario_id))
                    u = res_u.scalars().first()
                    if u:
                        portador = f"{u.nombre} {u.apellido}".strip()
                        if not cedula_portador: cedula_portador = u.cedula
                        if not telefono_portador: telefono_portador = u.telefono
            else:
                # Fallback Socio Permanente por placa
                res_v = await db.execute(select(Vehiculo).where(Vehiculo.placa == vp.placa))
                v_db = res_v.scalars().first()
                if v_db and v_db.socio_id:
                    res_u = await db.execute(select(Usuario).where(Usuario.id == v_db.socio_id))
                    u_db = res_u.scalars().first()
                    if u_db:
                        portador = f"{u_db.nombre} {u_db.apellido}".strip()
                        cedula_portador = u_db.cedula
                        telefono_portador = u_db.telefono

            info_pase = self._get_tipo_acceso_info(vp.codigo_qr) if vp.codigo_qr else {"nombre": "GENERAL", "color": "#94a3b8"}
            
            eventos.append({
                "tipo": "ingreso_zona",
                "placa": vp.placa,
                "marca": vp.marca,
                "modelo": vp.modelo,
                "color": vp.color,
                "nombre_portador": portador,
                "cedula_portador": cedula_portador,
                "telefono_portador": telefono_portador,
                "tipo_pase": info_pase["nombre"],
                "tipo_pase_color": info_pase["color"],
                "descripcion": "Ingresó a zona",
                "timestamp": vp.hora_ingreso.isoformat() if vp.hora_ingreso else None,
                "puesto_asignado_id": str(vp.puesto_asignado_id) if vp.puesto_asignado_id else None,
                "activo": vp.ingresado,
            })
            
            # Solo agregar evento de salida si el vehículo ya salió
            if vp.hora_salida:
                eventos.append({
                    "tipo": "salida_zona",
                    "placa": vp.placa,
                    "marca": vp.marca,
                    "modelo": vp.modelo,
                    "color": vp.color,
                    "nombre_portador": portador,
                    "tipo_pase": info_pase["nombre"],
                    "tipo_pase_color": info_pase["color"],
                    "descripcion": "Salió de zona",
                    "timestamp": vp.hora_salida.isoformat(),
                    "activo": False,
                })

        # Ordenar por timestamp desc
        def sort_key(e):
            ts = e.get("timestamp")
            if ts:
                try:
                    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    pass
            return datetime.min.replace(tzinfo=timezone.utc)

        eventos.sort(key=sort_key, reverse=True)
        
        # Aplicar skip y limite sobre la lista combinada
        return eventos[skip : skip + limite]

    async def get_vehiculos_perdidos(self, db: AsyncSession, usuario_id: UUID) -> List[Dict]:
        """
        SOP: Seguridad Táctica (Aegis v2.3).
        Identifica vehículos que accedieron por alcabala con destino a esta zona
        pero no han reportado ingreso tras expirar el 'tiempo_limite_llegada_min'.
        """
        # 1. Obtener zona del parquero
        res_usr = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
        usuario = res_usr.scalars().first()
        if not usuario or not usuario.zona_asignada_id:
            return []
        
        zona_id = usuario.zona_asignada_id
        res_zona = await db.execute(select(ZonaEstacionamiento).where(ZonaEstacionamiento.id == zona_id))
        zona = res_zona.scalars().first()
        if not zona:
            return []

        # Tiempos de referencia
        tiempo_limite = (zona.tiempo_limite_llegada_min or 15)
        ahora = datetime.now(timezone.utc)
        hace_12h = ahora - timedelta(hours=12)

        # 2. Buscar accesos de entrada en alcabala con destino a esta zona
        query = (
            select(Acceso, CodigoQR)
            .join(CodigoQR, Acceso.qr_id == CodigoQR.id)
            .where(
                CodigoQR.zona_asignada_id == zona_id,
                Acceso.tipo == AccesoTipo.entrada,
                Acceso.timestamp >= hace_12h
            )
        )
        res = await db.execute(query)
        accesos = res.all()

        perdidos = []
        for acceso, qr in accesos:
            # 3. Verificar si este QR ya reportó llegada a la zona DESPUÉS de este acceso por alcabala
            # SOP: Aegis v2.3 - Si ya ingresó (aunque ya haya salido), no está perdido.
            res_vp = await db.execute(
                select(VehiculoPase).where(
                    VehiculoPase.qr_id == qr.id,
                    VehiculoPase.zona_asignada_id == zona_id,
                    VehiculoPase.hora_ingreso >= acceso.timestamp
                )
            )
            vp = res_vp.scalars().first()

            # 4. Verificar si ya salió por alcabala (Aegis v2.4 Fix)
            # Si ya salió del estacionamiento, no puede estar "perdido" en tránsito a la zona.
            res_salida = await db.execute(
                select(Acceso).where(
                    Acceso.qr_id == qr.id,
                    Acceso.tipo == AccesoTipo.salida,
                    Acceso.timestamp >= acceso.timestamp
                )
            )
            ya_salio = res_salida.scalars().first()

            if not vp and not ya_salio:
                # Validar tiempo transcurrido
                ts_acceso = acceso.timestamp.replace(tzinfo=timezone.utc) if acceso.timestamp.tzinfo is None else acceso.timestamp
                transcurrido_min = int((ahora - ts_acceso).total_seconds() / 60)
                
                if transcurrido_min > tiempo_limite:
                    perdidos.append({
                        "placa": qr.vehiculo_placa,
                        "marca": qr.vehiculo_marca,
                        "modelo": qr.vehiculo_modelo,
                        "color": qr.vehiculo_color,
                        "hora_alcabala": ts_acceso.isoformat(),
                        "punto_alcabala": acceso.punto_acceso,
                        "minutos_transcurridos": transcurrido_min,
                        "tiempo_limite": tiempo_limite,
                        "nombre_conductor": qr.nombre_portador,
                        "telefono_conductor": qr.telefono_portador,
                        "qr_id": str(qr.id)
                    })
        
        # Ordenar por el más antiguo perdido primero para atención prioritaria
        perdidos.sort(key=lambda x: x["minutos_transcurridos"], reverse=True)
        return perdidos

    # ──────────────────────────────────────────────────────────────────────────
    # MÉTODOS ORIGINALES
    # ──────────────────────────────────────────────────────────────────────────

    async def registrar_llegada_qr(
        self, db: AsyncSession, qr_token: str, zona_id: UUID, parquero_id: UUID,
        confirmar: bool = True
    ) -> Dict[str, Any]:
        """
        El parquero escanea un QR para recibir un vehículo en su zona.
        Utiliza el token directamente para garantizar compatibilidad con IDs no-UUID (Base pases).
        """
        # Buscar el QR por su token JWT (es único e indexado)
        resultado = await db.execute(select(CodigoQR).options(selectinload(CodigoQR.usuario), selectinload(CodigoQR.vehiculo)).filter(CodigoQR.token == qr_token))
        qr = resultado.scalars().first()
        
        # Si no se encuentra por token, intentamos buscar por ID directo (caso UUID puro legado)
        if not qr:
            try:
                # Verificar si qr_token es un UUID válido antes de consultar
                UUID(qr_token)
                resultado = await db.execute(select(CodigoQR).options(selectinload(CodigoQR.usuario), selectinload(CodigoQR.vehiculo)).filter(CodigoQR.id == qr_token))
                qr = resultado.scalars().first()
            except ValueError:
                pass

        if not qr:
            raise ValueError("QR no encontrado o no reconocido en el sistema")

        # Validar zona asignada (SOP: Control estricto de destino)
        if qr.zona_asignada_id and qr.zona_asignada_id != zona_id:
            res_zona = await db.execute(select(ZonaEstacionamiento).where(ZonaEstacionamiento.id == qr.zona_asignada_id))
            zona_qr = res_zona.scalars().first()
            nombre_zona = zona_qr.nombre if zona_qr else "otra zona"
            raise ValueError(f"Pase Inválido. Este pase pertenece a la zona '{nombre_zona}'. Indique al conductor que debe dirigirse a esa zona.")

        marca = qr.vehiculo_marca
        modelo = qr.vehiculo_modelo
        color = qr.vehiculo_color
        
        if hasattr(qr, 'vehiculo') and qr.vehiculo:
            if not marca: marca = qr.vehiculo.marca
            if not modelo: modelo = qr.vehiculo.modelo
            if not color: color = qr.vehiculo.color

        resultado_vp = await db.execute(select(VehiculoPase).filter(VehiculoPase.qr_id == qr.id))
        vehiculo_pase = resultado_vp.scalars().first()

        if not vehiculo_pase:
            vehiculo_pase = VehiculoPase(
                qr_id=qr.id,
                placa=qr.vehiculo_placa or "DESCONOCIDO",
                marca=marca,
                modelo=modelo,
                color=color,
                zona_asignada_id=zona_id,
                ingresado=confirmar,
                hora_ingreso=datetime.now(timezone.utc) if confirmar else None
            )
            db.add(vehiculo_pase)
        else:
            if confirmar:
                vehiculo_pase.ingresado = True
                vehiculo_pase.hora_ingreso = datetime.now(timezone.utc)
                vehiculo_pase.zona_asignada_id = zona_id

        # Si el QR no tiene datos de la persona (o le falta la placa en caso de ser requerido), pedir al parquero
        datos_incompletos = not qr.datos_completos or (not qr.nombre_portador and not qr.usuario_id) or not qr.vehiculo_placa

        info_pase = self._get_tipo_acceso_info(qr)

        if datos_incompletos:
            portador = qr.nombre_portador
            if not portador and qr.usuario:
                portador = f"{qr.usuario.nombre} {qr.usuario.apellido}".strip()

            # Guardar el VP para referenciarlo
            await db.commit()
            await db.refresh(vehiculo_pase)

            return {
                "sin_datos": True,
                "solo_persona": bool(qr.vehiculo_placa), # Si tiene placa, solo falta la persona
                "vehiculo_pase_id": str(vehiculo_pase.id),
                "qr_id": str(qr.id),
                "placa": qr.vehiculo_placa or "",
                "marca": marca,
                "modelo": modelo,
                "color": color,
                "tipo_pase": info_pase["nombre"],
                "tipo_pase_color": info_pase["color"],
                "nombre_portador": portador,
                "cedula_portador": qr.cedula_portador or (qr.usuario.cedula if qr.usuario else None),
                "telefono_portador": qr.telefono_portador or (qr.usuario.telefono if qr.usuario else None),
                "zona_id": str(zona_id),
                "mensaje": "El pase tiene datos incompletos. Complete los campos requeridos.",
            }

        if hasattr(qr, 'verificado_por_parquero'):
            qr.verificado_por_parquero = True
        if hasattr(qr, 'hora_llegada_zona'):
            qr.hora_llegada_zona = datetime.now(timezone.utc)

        # Incrementar ocupación solo si no faltan datos y confirmar es True
        if not datos_incompletos and confirmar:
            await self._actualizar_ocupacion_zona(db, zona_id, 1)

        await db.commit()
        await db.refresh(vehiculo_pase)

        portador = qr.nombre_portador
        if not portador and qr.usuario:
            portador = f"{qr.usuario.nombre} {qr.usuario.apellido}".strip()

        return {
            "sin_datos": False,
            "vehiculo_pase_id": str(vehiculo_pase.id),
            "placa": vehiculo_pase.placa,
            "marca": marca,
            "modelo": modelo,
            "color": color,
            "tipo_pase": info_pase["nombre"],
            "tipo_pase_color": info_pase["color"],
            "nombre_portador": portador,
            "puesto_asignado_id": str(vehiculo_pase.puesto_asignado_id) if vehiculo_pase.puesto_asignado_id else None,
        }

    async def asignar_puesto(
        self, db: AsyncSession, vehiculo_pase_id: UUID, puesto_id: UUID
    ) -> VehiculoPase:
        """
        Asignar un puesto físico específico a un vehículo ingresado.
        """
        resultado_vp = await db.execute(select(VehiculoPase).filter(VehiculoPase.id == vehiculo_pase_id))
        vehiculo_pase = resultado_vp.scalars().first()
        if not vehiculo_pase:
            raise ValueError("Vehículo no encontrado")

        resultado_p = await db.execute(select(PuestoEstacionamiento).filter(PuestoEstacionamiento.id == puesto_id))
        puesto = resultado_p.scalars().first()
        if not puesto:
            raise ValueError("Puesto no encontrado")

        if puesto.estado in [EstadoPuesto.ocupado, EstadoPuesto.mantenimiento]:
            raise ValueError("Puesto no disponible")

        if vehiculo_pase.puesto_asignado_id:
            res_panterior = await db.execute(select(PuestoEstacionamiento).filter(
                PuestoEstacionamiento.id == vehiculo_pase.puesto_asignado_id
            ))
            puesto_anterior = res_panterior.scalars().first()
            if puesto_anterior:
                puesto_anterior.estado = EstadoPuesto.libre
                puesto_anterior.vehiculo_actual_id = None
                puesto_anterior.qr_actual_id = None

        puesto.estado = EstadoPuesto.ocupado
        puesto.qr_actual_id = vehiculo_pase.qr_id
        puesto.ocupado_desde = datetime.now(timezone.utc)

        vehiculo_pase.puesto_asignado_id = puesto_id

        await db.commit()
        await db.refresh(vehiculo_pase)
        return vehiculo_pase

    async def registrar_salida(
        self, db: AsyncSession, qr_token: str, parquero_id: UUID
    ) -> VehiculoPase:
        """
        Registrar la salida de la zona de estacionamiento por QR.
        Utiliza el token directamente para garantizar compatibilidad con IDs no-UUID (Base pases).
        """
        # Buscar el QR por su token JWT (es único e indexado)
        resultado = await db.execute(select(CodigoQR).filter(CodigoQR.token == qr_token))
        qr = resultado.scalars().first()
        
        # Si no se encuentra por token, intentamos buscar por ID directo (caso UUID puro legado)
        if not qr:
            try:
                # Verificar si qr_token es un UUID válido antes de consultar
                UUID(qr_token)
                resultado = await db.execute(select(CodigoQR).filter(CodigoQR.id == qr_token))
                qr = resultado.scalars().first()
            except ValueError:
                pass

        if not qr:
            raise ValueError("Pase no encontrado para registrar salida")

        resultado_vp = await db.execute(select(VehiculoPase).filter(VehiculoPase.qr_id == qr.id))
        vehiculo_pase = resultado_vp.scalars().first()
        if not vehiculo_pase:
            raise ValueError("Vehículo no encontrado activo en zona")

        vehiculo_pase.ingresado = False
        vehiculo_pase.hora_salida = datetime.now(timezone.utc)

        # Restar ocupación
        if vehiculo_pase.zona_asignada_id:
            await self._actualizar_ocupacion_zona(db, vehiculo_pase.zona_asignada_id, -1)

        if vehiculo_pase.puesto_asignado_id:
            resultado_p = await db.execute(select(PuestoEstacionamiento).filter(
                PuestoEstacionamiento.id == vehiculo_pase.puesto_asignado_id
            ))
            puesto = resultado_p.scalars().first()
            if puesto:
                puesto.estado = EstadoPuesto.libre
                puesto.qr_actual_id = None
                puesto.vehiculo_actual_id = None
                puesto.ocupado_desde = None

        # Sincronización Aegis v2.3
        await self._sincronizar_salida_base(db, vehiculo_pase, parquero_id)

        await db.commit()
        await db.refresh(vehiculo_pase)
        return vehiculo_pase


    def _get_tipo_acceso_info(self, qr: CodigoQR) -> Dict[str, str]:
        """Helper para obtener el nombre legible y el color del tipo de acceso."""
        if not qr: 
            return {"nombre": "GENERAL", "color": "#94a3b8"}
            
        if qr.tipo_acceso_custom:
            return {
                "nombre": qr.tipo_acceso_custom.nombre.upper(),
                "color": qr.tipo_acceso_custom.color_hex or "#94a3b8"
            }
            
        # Tipos estándar
        nombre = qr.tipo_acceso.value.upper() if qr.tipo_acceso else "GENERAL"
        color = "#94a3b8"
        if nombre == "BASE": color = "#3b82f6" # Azul para la base
        elif nombre == "VIP": color = "#f59e0b" # Ámbar
        elif nombre == "PRODUCCION": color = "#10b981" # Esmeralda
        
        return {"nombre": nombre, "color": color}


    async def confirmar_ingreso_zona(
        self, db: AsyncSession, vehiculo_pase_id: UUID, zona_id: UUID
    ) -> Dict[str, Any]:
        """
        Confirma la recepción de un vehículo en la zona, marcándolo como ingresado y aumentando la ocupación.
        """
        res = await db.execute(select(VehiculoPase).where(VehiculoPase.id == vehiculo_pase_id))
        vp = res.scalars().first()
        if not vp:
            raise ValueError("Vehículo no encontrado")
            
        if vp.ingresado:
            return {"status": "ok", "mensaje": "Ya estaba ingresado."}
            
        vp.ingresado = True
        vp.hora_ingreso = datetime.now(timezone.utc)
        vp.zona_asignada_id = zona_id
        vp.hora_salida = None
        
        await self._actualizar_ocupacion_zona(db, zona_id, 1)
        await db.commit()
        return {"status": "ok", "mensaje": "Ingreso confirmado correctamente."}

parquero_service = ParqueroService()

