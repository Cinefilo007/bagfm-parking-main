import re
import unicodedata
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.entidad_civil import EntidadCivil
from app.models.usuario import Usuario
from app.models.membresia import Membresia
from app.models.vehiculo import Vehiculo
from app.models.codigo_qr import CodigoQR
from app.models.alcabala_evento import SolicitudEvento
from app.models.acceso import Acceso
from app.models.asignacion_zona import AsignacionZona
from app.models.enums import RolTipo
from app.schemas.entidad_civil import EntidadCivilCrear, EntidadCivilActualizar
from app.core.excepciones import EntidadDuplicada, EntidadNoEncontrada
from app.core.security import hashear_password
from sqlalchemy import delete

class EntidadCivilService:
    def _generar_slug(self, texto: str) -> str:
        """SOP: Genera un slug simple (ej. 'Mi Entidad' -> 'MI_ENTIDAD')."""
        texto = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
        texto = re.sub(r'[^\w\s-]', '', texto).strip().upper()
        return re.sub(r'[-\s]+', '_', texto)

    async def crear(
        self, db: AsyncSession, datos: EntidadCivilCrear, usuario_actual: Usuario
    ) -> EntidadCivil:
        """
        SOP: Crea una nueva entidad civil y su administrador inicial.
        Operación transaccional completa.
        """
        # 1. Generar slug si no viene
        slug = datos.codigo_slug or self._generar_slug(datos.nombre)
        
        # 2. Extraer datos de la entidad (excluyendo los del administrador)
        entidad_dict = datos.model_dump(exclude={
            "admin_cedula", "admin_nombre", "admin_apellido", 
            "admin_email", "admin_password"
        })
        entidad_dict["codigo_slug"] = slug
        
        entidad = EntidadCivil(
            **entidad_dict,
            created_by=usuario_actual.id
        )
        
        db.add(entidad)
        try:
            await db.flush() # Para obtener el ID de la entidad
            
            # 3. Crear el Usuario Administrador de la Entidad
            admin_usuario = Usuario(
                cedula=datos.admin_cedula,
                nombre=datos.admin_nombre,
                apellido=datos.admin_apellido,
                email=datos.admin_email,
                rol=RolTipo.ADMIN_ENTIDAD,
                entidad_id=entidad.id,
                password_hash=hashear_password(datos.admin_password)
            )
            db.add(admin_usuario)
            
            await db.commit()
            await db.refresh(entidad)
            return entidad
            
        except IntegrityError as e:
            await db.rollback()
            msg = str(e.orig).lower()
            if "entidades_civiles_codigo_slug_key" in msg or "codigo_slug" in msg or "ix_entidades_civiles_codigo_slug" in msg:
                raise EntidadDuplicada(f"El código generado '{slug}' ya está en uso.")
            if "usuarios_email_key" in msg or "ix_usuarios_email" in msg or "email" in msg:
                raise EntidadDuplicada(f"El email '{datos.admin_email}' ya está registrado en el sistema.")
            if "usuarios_cedula_key" in msg or "ix_usuarios_cedula" in msg or "cedula" in msg:
                raise EntidadDuplicada(f"La cédula '{datos.admin_cedula}' ya está registrada en el sistema.")
            raise EntidadDuplicada(f"Error de integridad en base de datos: {msg}")

    async def obtener_todas(
        self, db: AsyncSession, activas_solo: bool = False, skip: int = 0, limit: int = 100
    ) -> list[EntidadCivil]:
        """SOP: Obtiene lista de entidades civiles, con métricas de población y vehículos."""
        from sqlalchemy import func
        from app.models.vehiculo import Vehiculo

        usuarios_sub = select(
            Usuario.entidad_id,
            func.count(Usuario.id).label("total_usuarios")
        ).where(
            Usuario.rol == RolTipo.SOCIO,
            Usuario.activo == True,
            Usuario.is_deleted == False
        ).group_by(Usuario.entidad_id).subquery()

        # Subconsulta para contar vehículos por entidad
        vehiculos_sub = select(
            Usuario.entidad_id,
            func.count(Vehiculo.id).label("total_vehiculos")
        ).join(Vehiculo, Vehiculo.socio_id == Usuario.id
        ).where(
            Vehiculo.activo == True,
            Usuario.activo == True,
            Usuario.is_deleted == False
        ).group_by(Usuario.entidad_id).subquery()

        # Subconsulta para sumar capacidad asignada por entidad
        capacidad_sub = select(
            AsignacionZona.entidad_id,
            func.sum(AsignacionZona.cupo_asignado).label("total_capacidad")
        ).where(AsignacionZona.activa == True).group_by(AsignacionZona.entidad_id).subquery()

        # Consulta principal con JOINS externos
        query = select(
            EntidadCivil,
            func.coalesce(usuarios_sub.c.total_usuarios, 0).label("total_usuarios"),
            func.coalesce(vehiculos_sub.c.total_vehiculos, 0).label("total_vehiculos"),
            func.coalesce(capacidad_sub.c.total_capacidad, 0).label("total_capacidad")
        ).outerjoin(
            usuarios_sub, EntidadCivil.id == usuarios_sub.c.entidad_id
        ).outerjoin(
            vehiculos_sub, EntidadCivil.id == vehiculos_sub.c.entidad_id
        ).outerjoin(
            capacidad_sub, EntidadCivil.id == capacidad_sub.c.entidad_id
        )

        if activas_solo:
            query = query.where(EntidadCivil.activo == True)
            
        # Ordenadas por nombre
        query = query.order_by(EntidadCivil.nombre).offset(skip).limit(limit)
        
        resultado = await db.execute(query)
        rows = resultado.all()
        
        # Obtener zonas asignadas con su ocupación actual
        from app.models.zona_estacionamiento import ZonaEstacionamiento
        q_zonas = select(
            AsignacionZona.entidad_id,
            AsignacionZona.zona_id,
            AsignacionZona.cupo_asignado,
            ZonaEstacionamiento.ocupacion_actual,
            ZonaEstacionamiento.capacidad_total
        ).outerjoin(
            ZonaEstacionamiento, ZonaEstacionamiento.id == AsignacionZona.zona_id
        ).where(AsignacionZona.activa == True)
        res_zonas = await db.execute(q_zonas)
        entidad_zonas_data = {}
        for r in res_zonas.all():
            if r.entidad_id not in entidad_zonas_data:
                entidad_zonas_data[r.entidad_id] = {
                    "zona_id": r.zona_id, # Se usa la primera como referencia si no hay en la raíz
                    "ocupacion": 0,
                    "capacidad": 0
                }
            entidad_zonas_data[r.entidad_id]["ocupacion"] += r.ocupacion_actual or 0
            entidad_zonas_data[r.entidad_id]["capacidad"] += r.cupo_asignado or r.capacidad_total or 0

        entidades = []
        for row in rows:
            ent = row.EntidadCivil
            ent.total_usuarios = row.total_usuarios
            ent.total_vehiculos = row.total_vehiculos
            ent.total_capacidad = row.total_capacidad
            zona_data = entidad_zonas_data.get(ent.id)
            if zona_data:
                if not ent.zona_id:
                    ent.zona_id = zona_data["zona_id"]
                ent.cupo_ocupacion = zona_data["ocupacion"]
                ent.cupo_capacidad = zona_data["capacidad"]
            else:
                ent.cupo_ocupacion = 0
                ent.cupo_capacidad = 0
            entidades.append(ent)
            
        # Obtener administradores
        entidad_ids = [ent.id for ent in entidades]
        if entidad_ids:
            q_admins = select(Usuario).where(
                Usuario.entidad_id.in_(entidad_ids),
                Usuario.rol == RolTipo.ADMIN_ENTIDAD
            )
            res_admins = await db.execute(q_admins)
            admins_por_entidad = {}
            for admin in res_admins.scalars().all():
                if admin.entidad_id not in admins_por_entidad:
                    admins_por_entidad[admin.entidad_id] = admin
            
            for ent in entidades:
                admin = admins_por_entidad.get(ent.id)
                if admin:
                    ent.admin_cedula = admin.cedula
                    ent.admin_nombre = admin.nombre
                    ent.admin_apellido = admin.apellido
                    ent.admin_email = admin.email

        return entidades


    async def obtener_por_id(self, db: AsyncSession, entidad_id: UUID) -> EntidadCivil:
        """SOP: Obtiene entidad específica con sus métricas actualizadas."""
        from sqlalchemy import func
        from app.models.vehiculo import Vehiculo

        query = select(EntidadCivil).where(EntidadCivil.id == entidad_id)
        res = await db.execute(query)
        entidad = res.scalar_one_or_none()
        
        if not entidad:
            raise EntidadNoEncontrada("La entidad solicitada no existe.")
            
        q_u = select(func.count(Usuario.id)).where(
            Usuario.entidad_id == entidad_id,
            Usuario.rol == RolTipo.SOCIO,
            Usuario.activo == True,
            Usuario.is_deleted == False
        )
        entidad.total_usuarios = (await db.execute(q_u)).scalar() or 0
        
        q_v = select(func.count(Vehiculo.id)).join(
            Usuario, Vehiculo.socio_id == Usuario.id
        ).where(
            Usuario.entidad_id == entidad_id,
            Vehiculo.activo == True,
            Usuario.activo == True,
            Usuario.is_deleted == False
        )
        entidad.total_vehiculos = (await db.execute(q_v)).scalar() or 0
        
        q_c = select(func.sum(AsignacionZona.cupo_asignado)).where(
            AsignacionZona.entidad_id == entidad_id,
            AsignacionZona.activa == True
        )
        entidad.total_capacidad = (await db.execute(q_c)).scalar() or 0
        
        # Obtener datos del admin
        q_admin = select(Usuario).where(
            Usuario.entidad_id == entidad_id,
            Usuario.rol == RolTipo.ADMIN_ENTIDAD
        )
        admin = (await db.execute(q_admin)).scalars().first()
        if admin:
            entidad.admin_cedula = admin.cedula
            entidad.admin_nombre = admin.nombre
            entidad.admin_apellido = admin.apellido
            entidad.admin_email = admin.email
        
        return entidad

    async def actualizar(
        self, db: AsyncSession, entidad_id: UUID, datos: EntidadCivilActualizar
    ) -> EntidadCivil:
        """SOP: Actualiza entidad."""
        entidad = await self.obtener_por_id(db, entidad_id)
        
        admin_data = {
            "cedula": datos.admin_cedula,
            "nombre": datos.admin_nombre,
            "apellido": datos.admin_apellido,
            "email": datos.admin_email,
        }
        if datos.admin_password:
            admin_data["password_hash"] = hashear_password(datos.admin_password)
            
        admin_data = {k: v for k, v in admin_data.items() if v is not None}
        
        entidad_dict = datos.model_dump(exclude={
            "admin_cedula", "admin_nombre", "admin_apellido", 
            "admin_email", "admin_password"
        }, exclude_unset=True)
        
        for key, value in entidad_dict.items():
            setattr(entidad, key, value)
            
        admin = None
        if admin_data:
            q_admin = select(Usuario).where(
                Usuario.entidad_id == entidad_id,
                Usuario.rol == RolTipo.ADMIN_ENTIDAD
            )
            admin = (await db.execute(q_admin)).scalars().first()
            if admin:
                for key, value in admin_data.items():
                    setattr(admin, key, value)
            
        try:
            await db.commit()
            await db.refresh(entidad)
            if admin_data and admin:
                entidad.admin_cedula = admin.cedula
                entidad.admin_nombre = admin.nombre
                entidad.admin_apellido = admin.apellido
                entidad.admin_email = admin.email
            return entidad
        except IntegrityError:
            await db.rollback()
            raise EntidadDuplicada("Los datos generan conflicto con otra entidad o el email/cédula del admin ya existe.")

    async def obtener_stats_globales(self, db: AsyncSession) -> dict:
        """SOP: Obtiene estadísticas globales del inventario civil de la base."""
        from sqlalchemy import func
        from app.models.vehiculo import Vehiculo
        
        # Ejecuciones optimizadas
        total_e = (await db.execute(select(func.count(EntidadCivil.id)))).scalar() or 0
        total_in = (await db.execute(select(func.count(EntidadCivil.id)).where(EntidadCivil.activo == False))).scalar() or 0
        total_v = (await db.execute(select(func.count(Vehiculo.id)).where(Vehiculo.activo == True))).scalar() or 0
        total_u = (await db.execute(select(func.count(Usuario.id)).where(
            Usuario.rol == RolTipo.SOCIO,
            Usuario.activo == True,
            Usuario.is_deleted == False
        ))).scalar() or 0
        
        return {
            "total_entidades": total_e,
            "total_inactivas": total_in,
            "total_vehiculos": total_v,
            "total_usuarios": total_u
        }

    async def toggle_estado(self, db: AsyncSession, entidad_id: UUID) -> EntidadCivil:
        """
        SOP: Cambia el estado de activación de la concesión civil.
        Nota: El motor de accesos verificará este estado antes de permitir entradas.
        """
        entidad = await self.obtener_por_id(db, entidad_id)
        entidad.activo = not entidad.activo
        await db.commit()
        await db.refresh(entidad)
        return entidad

    async def actualizar_branding(self, db: AsyncSession, entidad_id: UUID, datos: dict) -> EntidadCivil:
        """SOP: Guarda la configuración de marca (pases base) para la entidad."""
        import json
        entidad = await self.obtener_por_id(db, entidad_id)
        entidad.config_branding = json.dumps(datos)
        await db.commit()
        await db.refresh(entidad)
        return entidad

    async def eliminar(self, db: AsyncSession, entidad_id: UUID) -> bool:
        """
        SOP: Baja Definitiva con Eliminación en Cascada Manual.
        Purga jerárquicamente Accesos -> QR -> Membresías -> Eventos -> Vehículos -> Usuarios -> Entidad.
        """
        # 1. Verificar existencia
        entidad = await self.obtener_por_id(db, entidad_id)
        
        # 2. Identificar a todos los usuarios (socios y admins) de esta entidad
        q_usuarios = select(Usuario.id).where(Usuario.entidad_id == entidad_id)
        res_usuarios = await db.execute(q_usuarios)
        user_ids = [row[0] for row in res_usuarios.all()]
        
        try:
            # 3. Purga secuencial para evitar errores de FK
            if user_ids:
                # Borrar Accesos (donde el usuario es visitante o parquero de la entidad)
                await db.execute(delete(Acceso).where(Acceso.usuario_id.in_(user_ids)))
                # Borrar Códigos QR
                await db.execute(delete(CodigoQR).where(CodigoQR.usuario_id.in_(user_ids)))
                # Borrar Membresías
                await db.execute(delete(Membresia).where(Membresia.entidad_id == entidad_id))
                # Borrar Eventos
                await db.execute(delete(SolicitudEvento).where(SolicitudEvento.entidad_id == entidad_id))
                # Borrar Vehículos asociados a esos usuarios (SOFT DELETE)
                await db.execute(update(Vehiculo).where(Vehiculo.socio_id.in_(user_ids)).values(activo=False))
                # Borrar Usuarios definidos para esta entidad (SOFT DELETE)
                await db.execute(update(Usuario).where(Usuario.entidad_id == entidad_id).values(is_deleted=True, activo=False))
            
            # 4. Finalmente, borrar la entidad
            await db.execute(delete(EntidadCivil).where(EntidadCivil.id == entidad_id))
            
            await db.commit()
            return True
            
        except Exception as e:
            await db.rollback()
            raise e

entidad_service = EntidadCivilService()
