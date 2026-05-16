"""
personal_service.py — Lógica de negocio para el módulo de Fuerza de Tareas.
Gestiona personal operativo: listado, creación, edición, incentivos, sanciones, zonas.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, and_
from sqlalchemy.orm import joinedload, selectinload
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone

from app.models.usuario import Usuario
from app.models.enums import RolTipo, TipoSancion, TipoIncentivo, EstadoSancion
from app.models.incentivo_parquero import IncentivoParquero
from app.models.sancion_parquero import SancionParquero
from app.models.zona_estacionamiento import ZonaEstacionamiento
from app.schemas.usuario import UsuarioCrear, UsuarioActualizar
from app.schemas.incentivo_sancion import IncentivoCrear, SancionCrear, SancionActualizar, KPIsOperativo
from app.core.security import hashear_password
from app.core.excepciones import EntidadNoEncontrada, EntidadDuplicada, AccesoDenegado


class PersonalService:

    # ─── LISTADO ──────────────────────────────────────────────────────────────

    async def listar_personal(
        self,
        db: AsyncSession,
        usuario_actual: Usuario,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None
    ) -> List[Usuario]:
        """Lista el personal según el rol del usuario que consulta, con búsqueda y paginación."""
        query = (
            select(Usuario)
            .options(
                joinedload(Usuario.entidad_pertenece),
                joinedload(Usuario.zona_asignada)
            )
            .where(Usuario.is_deleted == False)
            .order_by(Usuario.nombre.asc())
        )

        if search:
            search_pattern = f"%{search}%"
            query = query.where(or_(
                Usuario.nombre.ilike(search_pattern),
                Usuario.apellido.ilike(search_pattern),
                Usuario.cedula.ilike(search_pattern)
            ))

        if usuario_actual.rol in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR]:
            query = query.where(Usuario.rol.in_([
                RolTipo.ADMIN_BASE,
                RolTipo.SUPERVISOR,
                RolTipo.ADMIN_ENTIDAD,
                RolTipo.PARQUERO,
                RolTipo.SUPERVISOR_PARQUEROS,
                RolTipo.ALCABALA
            ]))
        elif usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
            query = query.where(
                Usuario.entidad_id == usuario_actual.entidad_id,
                Usuario.rol.in_([RolTipo.PARQUERO, RolTipo.SUPERVISOR_PARQUEROS])
            )
        else:
            raise AccesoDenegado("No tiene permisos para ver la lista de personal")

        query = query.offset(skip).limit(limit)
        res = await db.execute(query)
        usuarios = res.scalars().all()

        # Nota: zona_nombre y entidad_nombre son property en el modelo, no necesitan setteo manual.
        return usuarios

    # ─── CREACIÓN ─────────────────────────────────────────────────────────────

    async def crear_personal(
        self,
        db: AsyncSession,
        datos: UsuarioCrear,
        usuario_actual: Usuario
    ) -> Usuario:
        """Crea un nuevo miembro del personal con validaciones de jerarquía."""
        if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
            if datos.rol not in [RolTipo.PARQUERO, RolTipo.SUPERVISOR_PARQUEROS]:
                raise AccesoDenegado("Como Administrador de Entidad, solo puede registrar Parqueros o Supervisores de su entidad")
            datos.entidad_id = usuario_actual.entidad_id

        elif usuario_actual.rol in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
            if datos.rol == RolTipo.COMANDANTE:
                raise AccesoDenegado("No se pueden crear más Comandantes por esta vía")
            if datos.rol == RolTipo.PARQUERO and not datos.entidad_id:
                raise AccesoDenegado("Debe especificar una entidad para el Parquero")
        else:
            raise AccesoDenegado("No tiene permisos para registrar personal")

        query_existente = select(Usuario).where(Usuario.cedula == datos.cedula)
        res_existente = await db.execute(query_existente)
        if res_existente.scalar_one_or_none():
            raise EntidadDuplicada(f"Ya existe un usuario con la cédula {datos.cedula}")

        nuevo_usuario = Usuario(
            cedula=datos.cedula,
            nombre=datos.nombre.upper(),
            apellido=datos.apellido.upper(),
            email=datos.email.lower() if datos.email else None,
            telefono=datos.telefono,
            rol=datos.rol,
            entidad_id=datos.entidad_id,
            password_hash=hashear_password(datos.password if datos.password else datos.cedula),
            debe_cambiar_password=True,
            activo=True
        )

        db.add(nuevo_usuario)
        await db.commit()
        await db.refresh(nuevo_usuario)
        return nuevo_usuario

    # ─── EDICIÓN ────────────────────────────────────────────────────────────

    async def actualizar_personal(
        self,
        db: AsyncSession,
        usuario_id: UUID,
        datos: UsuarioActualizar,
        usuario_actual: Usuario
    ) -> Usuario:
        """Edita los datos de un operativo."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD]:
            raise AccesoDenegado("Sin permisos para editar personal")

        res = await db.execute(select(Usuario).options(
            joinedload(Usuario.entidad_pertenece),
            joinedload(Usuario.zona_asignada)
        ).where(Usuario.id == usuario_id))
        usuario = res.scalar_one_or_none()

        if not usuario:
            raise EntidadNoEncontrada("Operativo no encontrado")

        # Admin entidad solo puede editar sus propios operativos
        if usuario_actual.rol == RolTipo.ADMIN_ENTIDAD:
            if usuario.entidad_id != usuario_actual.entidad_id:
                raise AccesoDenegado("No puede editar operativos de otra entidad")
            if datos.rol and datos.rol not in [RolTipo.PARQUERO, RolTipo.SUPERVISOR_PARQUEROS]:
                raise AccesoDenegado("Solo puede asignar roles de Parquero o Supervisor")

        campos = datos.model_dump(exclude_unset=True, exclude_none=True)
        for campo, valor in campos.items():
            if campo in ["nombre", "apellido"] and isinstance(valor, str):
                valor = valor.upper()
            setattr(usuario, campo, valor)

        await db.commit()
        await db.refresh(usuario)
        return usuario

    # ─── TOGGLE ACTIVO ────────────────────────────────────────────────────────

    async def toggle_activo(self, db: AsyncSession, usuario_id: UUID, usuario_actual: Usuario) -> Usuario:
        """Cambia el estado activo/suspendido de un miembro del personal."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD]:
            raise AccesoDenegado("Solo el Mando Superior puede suspender personal")

        query = select(Usuario).options(joinedload(Usuario.entidad_pertenece), joinedload(Usuario.zona_asignada)).where(Usuario.id == usuario_id)
        res = await db.execute(query)
        usuario = res.scalar_one_or_none()

        if not usuario:
            raise EntidadNoEncontrada("Usuario no encontrado")
        if usuario.rol == RolTipo.COMANDANTE:
            raise AccesoDenegado("No se puede suspender al Comandante")

        usuario.activo = not usuario.activo
        await db.commit()
        await db.refresh(usuario)
        return usuario

    # ─── ELIMINACIÓN ──────────────────────────────────────────────────────────

    async def eliminar(self, db: AsyncSession, usuario_id: UUID, usuario_actual: Usuario) -> bool:
        """Elimina permanentemente a un miembro del personal."""
        if usuario_actual.rol != RolTipo.COMANDANTE:
            raise AccesoDenegado("Solo el Comandante puede dar de baja definitiva al personal")

        query = select(Usuario).where(Usuario.id == usuario_id)
        res = await db.execute(query)
        usuario = res.scalar_one_or_none()

        if not usuario:
            raise EntidadNoEncontrada("Usuario no encontrado")
        if usuario.rol == RolTipo.COMANDANTE:
            raise AccesoDenegado("No se puede eliminar al Comandante")

        # BORRADO LÓGICO TÁCTICO:
        # 1. Marcamos como eliminado y desactivamos
        usuario.is_deleted = True
        usuario.activo = False
        
        # 2. Liberamos Cédula y Email para futuros re-registros
        ts = int(datetime.now().timestamp())
        usuario.cedula = f"{usuario.cedula}_DEL_{ts}"
        if usuario.email:
            usuario.email = f"DEL_{ts}_{usuario.email}"
        
        # 3. Desasignamos zona si tenía una
        usuario.zona_asignada_id = None

        await db.commit()
        return True

    # ─── ASIGNAR ZONA ─────────────────────────────────────────────────────────

    async def asignar_zona(
        self,
        db: AsyncSession,
        parquero_id: UUID,
        zona_id: Optional[UUID],
        usuario_actual: Usuario
    ) -> Usuario:
        """Asigna o desasigna una zona de estacionamiento a un parquero."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD, RolTipo.SUPERVISOR_PARQUEROS]:
            raise AccesoDenegado("Sin permisos para asignar zonas")

        res = await db.execute(select(Usuario).options(
            joinedload(Usuario.entidad_pertenece),
            joinedload(Usuario.zona_asignada)
        ).where(Usuario.id == parquero_id))
        parquero = res.scalar_one_or_none()

        if not parquero:
            raise EntidadNoEncontrada("Parquero no encontrado")
        if parquero.rol not in [RolTipo.PARQUERO, RolTipo.SUPERVISOR_PARQUEROS]:
            raise AccesoDenegado("Solo se puede asignar zona a Parqueros o Supervisores")

        if zona_id:
            res_zona = await db.execute(select(ZonaEstacionamiento).where(ZonaEstacionamiento.id == zona_id))
            zona = res_zona.scalar_one_or_none()
            if not zona:
                raise EntidadNoEncontrada("Zona de estacionamiento no encontrada")

        parquero.zona_asignada_id = zona_id
        await db.commit()
        await db.refresh(parquero)
        return parquero

    # ─── KPIs DEL OPERATIVO ───────────────────────────────────────────────────

    async def obtener_kpis(
        self,
        db: AsyncSession,
        operativo_id: UUID,
        usuario_actual: Usuario
    ) -> KPIsOperativo:
        """Retorna los KPIs operacionales de un miembro del personal."""
        res = await db.execute(select(Usuario).options(joinedload(Usuario.zona_asignada)).where(Usuario.id == operativo_id))
        operativo = res.scalar_one_or_none()
        if not operativo:
            raise EntidadNoEncontrada("Operativo no encontrado")

        # Contar incentivos
        res_inc = await db.execute(
            select(func.count(IncentivoParquero.id)).where(IncentivoParquero.parquero_id == operativo_id)
        )
        total_incentivos = res_inc.scalar_one() or 0

        # Contar sanciones totales y activas
        res_sanc = await db.execute(
            select(func.count(SancionParquero.id)).where(SancionParquero.parquero_id == operativo_id)
        )
        total_sanciones = res_sanc.scalar_one() or 0

        res_sanc_act = await db.execute(
            select(func.count(SancionParquero.id)).where(
                SancionParquero.parquero_id == operativo_id,
                SancionParquero.estado == EstadoSancion.activa
            )
        )
        sanciones_activas = res_sanc_act.scalar_one() or 0

        # Días activo
        dias_activo = (datetime.now(timezone.utc) - operativo.created_at.replace(tzinfo=timezone.utc)).days if operativo.created_at else 0

        # Ultimo incentivo/sancion
        res_ult_inc = await db.execute(
            select(IncentivoParquero).where(IncentivoParquero.parquero_id == operativo_id)
            .order_by(IncentivoParquero.created_at.desc()).limit(1)
        )
        ult_inc = res_ult_inc.scalar_one_or_none()

        res_ult_sanc = await db.execute(
            select(SancionParquero).where(SancionParquero.parquero_id == operativo_id)
            .order_by(SancionParquero.created_at.desc()).limit(1)
        )
        ult_sanc = res_ult_sanc.scalar_one_or_none()

        # KPIs TÁCTICOS: Monitoreo de Asignaciones Manuales (Anti-Corrupción)
        from app.models.acceso import Acceso
        res_man = await db.execute(
            select(func.count(Acceso.id)).where(
                Acceso.registrado_por == operativo_id,
                Acceso.es_manual == True
            )
        )
        asig_manuales = res_man.scalar_one() or 0

        return KPIsOperativo(
            total_incentivos=total_incentivos,
            total_sanciones=total_sanciones,
            sanciones_activas=sanciones_activas,
            zona_nombre=operativo.zona_asignada.nombre if operativo.zona_asignada else None,
            zona_id=str(operativo.zona_asignada_id) if operativo.zona_asignada_id else None,
            dias_activo=dias_activo,
            ultimo_incentivo=ult_inc.tipo.value if ult_inc else None,
            ultima_sancion=ult_sanc.tipo.value if ult_sanc else None,
            asignaciones_manuales=asig_manuales
        )

    # ─── INCENTIVOS ──────────────────────────────────────────────────────────

    async def listar_incentivos(self, db: AsyncSession, parquero_id: UUID) -> List[IncentivoParquero]:
        """Lista todos los incentivos de un parquero."""
        res = await db.execute(
            select(IncentivoParquero)
            .where(IncentivoParquero.parquero_id == parquero_id)
            .order_by(IncentivoParquero.created_at.desc())
        )
        incentivos = res.scalars().all()

        # Enriquecer con nombre de quien lo otorgó
        for inc in incentivos:
            res_user = await db.execute(select(Usuario).where(Usuario.id == inc.otorgado_por))
            otorgador = res_user.scalar_one_or_none()
            if otorgador:
                inc.otorgado_por_nombre = f"{otorgador.nombre} {otorgador.apellido}"

        return incentivos

    async def agregar_incentivo(
        self,
        db: AsyncSession,
        parquero_id: UUID,
        datos: IncentivoCrear,
        usuario_actual: Usuario
    ) -> IncentivoParquero:
        """Registra un incentivo para un parquero."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD, RolTipo.SUPERVISOR_PARQUEROS]:
            raise AccesoDenegado("Sin permisos para otorgar incentivos")

        res = await db.execute(select(Usuario).where(Usuario.id == parquero_id))
        parquero = res.scalar_one_or_none()
        if not parquero:
            raise EntidadNoEncontrada("Parquero no encontrado")

        incentivo = IncentivoParquero(
            parquero_id=parquero_id,
            tipo=datos.tipo,
            descripcion=datos.descripcion,
            otorgado_por=usuario_actual.id
        )
        db.add(incentivo)
        await db.commit()
        await db.refresh(incentivo)
        incentivo.otorgado_por_nombre = f"{usuario_actual.nombre} {usuario_actual.apellido}"
        return incentivo

    async def eliminar_incentivo(self, db: AsyncSession, incentivo_id: UUID, usuario_actual: Usuario) -> bool:
        """Elimina un incentivo."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD]:
            raise AccesoDenegado("Sin permisos para eliminar incentivos")

        res = await db.execute(select(IncentivoParquero).where(IncentivoParquero.id == incentivo_id))
        incentivo = res.scalar_one_or_none()
        if not incentivo:
            raise EntidadNoEncontrada("Incentivo no encontrado")

        await db.delete(incentivo)
        await db.commit()
        return True

    # ─── SANCIONES ───────────────────────────────────────────────────────────

    async def listar_sanciones(self, db: AsyncSession, parquero_id: UUID) -> List[SancionParquero]:
        """Lista todas las sanciones de un parquero."""
        res = await db.execute(
            select(SancionParquero)
            .where(SancionParquero.parquero_id == parquero_id)
            .order_by(SancionParquero.created_at.desc())
        )
        sanciones = res.scalars().all()

        for sanc in sanciones:
            res_user = await db.execute(select(Usuario).where(Usuario.id == sanc.sancionado_por))
            sancionador = res_user.scalar_one_or_none()
            if sancionador:
                sanc.sancionado_por_nombre = f"{sancionador.nombre} {sancionador.apellido}"

        return sanciones

    async def agregar_sancion(
        self,
        db: AsyncSession,
        parquero_id: UUID,
        datos: SancionCrear,
        usuario_actual: Usuario
    ) -> SancionParquero:
        """Registra una sanción para un parquero."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD, RolTipo.SUPERVISOR_PARQUEROS]:
            raise AccesoDenegado("Sin permisos para aplicar sanciones")

        res = await db.execute(select(Usuario).where(Usuario.id == parquero_id))
        parquero = res.scalar_one_or_none()
        if not parquero:
            raise EntidadNoEncontrada("Parquero no encontrado")

        sancion = SancionParquero(
            parquero_id=parquero_id,
            tipo=datos.tipo,
            motivo=datos.motivo,
            estado=EstadoSancion.activa,
            ejecutar_inmediato=datos.ejecutar_inmediato,
            sancionado_por=usuario_actual.id
        )
        db.add(sancion)

        # Si es relevo inmediato, desactivar al parquero
        if datos.tipo == TipoSancion.relevo_inmediato and datos.ejecutar_inmediato:
            parquero.activo = False

        await db.commit()
        await db.refresh(sancion)
        sancion.sancionado_por_nombre = f"{usuario_actual.nombre} {usuario_actual.apellido}"
        return sancion

    async def actualizar_sancion(
        self,
        db: AsyncSession,
        sancion_id: UUID,
        datos: SancionActualizar,
        usuario_actual: Usuario
    ) -> SancionParquero:
        """Actualiza el estado de una sanción (cumplida, apelada)."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.ADMIN_ENTIDAD]:
            raise AccesoDenegado("Sin permisos para actualizar sanciones")

        res = await db.execute(select(SancionParquero).where(SancionParquero.id == sancion_id))
        sancion = res.scalar_one_or_none()
        if not sancion:
            raise EntidadNoEncontrada("Sanción no encontrada")

        sancion.estado = datos.estado
        if datos.estado == EstadoSancion.cumplida:
            sancion.resuelto_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(sancion)
        return sancion

    async def eliminar_sancion(self, db: AsyncSession, sancion_id: UUID, usuario_actual: Usuario) -> bool:
        """Elimina una sanción."""
        if usuario_actual.rol not in [RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]:
            raise AccesoDenegado("Solo el Mando Superior puede eliminar sanciones")

        res = await db.execute(select(SancionParquero).where(SancionParquero.id == sancion_id))
        sancion = res.scalar_one_or_none()
        if not sancion:
            raise EntidadNoEncontrada("Sanción no encontrada")

        await db.delete(sancion)
        await db.commit()
        return True


personal_service = PersonalService()
