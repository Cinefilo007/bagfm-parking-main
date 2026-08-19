"""
Servicio del módulo Dormitorios.

Aquí vive la única regla que no puede quedarse en la capa HTTP: **el integrante no es
una tabla nueva de personas**. Cada alta busca primero en `usuarios` por cédula y, si
la persona ya está, le cuelga el perfil militar en vez de duplicarla. Ese es el motivo
de existir del módulo: que registrar a alguien porque duerme en la base lo ate al
vehículo que ya tenía a su nombre, sin que nadie cruce nada a mano.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.excepciones import CapacidadExcedida, EntidadDuplicada, EntidadNoEncontrada
from app.core.security import crear_token_qr, hashear_password
from app.core.tokens import generar_token, hashear_token
from app.models.codigo_qr import CodigoQR
from app.models.dormitorio import Dormitorio, Habitacion
from app.models.enums import QRTipo, RolTipo
from app.models.perfil_militar import PerfilMilitar
from app.models.usuario import Usuario
from app.models.vehiculo import Vehiculo
from app.schemas.dormitorio import (
    HabitacionPublica,
    IntegranteCrear,
    IntegranteEditar,
    IntegranteSalida,
    OcupantePublico,
    VehiculoResumen,
)

logger = logging.getLogger(__name__)


class DormitorioService:

    # ─── Consultas de apoyo ────────────────────────────────────────────────────

    async def obtener_dormitorio(self, db: AsyncSession, dormitorio_id: UUID) -> Dormitorio:
        dormitorio = await db.get(Dormitorio, dormitorio_id)
        if not dormitorio:
            raise EntidadNoEncontrada("Dormitorio no encontrado")
        return dormitorio

    async def obtener_habitacion(self, db: AsyncSession, habitacion_id: UUID) -> Habitacion:
        habitacion = await db.get(Habitacion, habitacion_id)
        if not habitacion:
            raise EntidadNoEncontrada("Habitación no encontrada")
        return habitacion

    async def obtener_perfil(self, db: AsyncSession, usuario_id: UUID) -> PerfilMilitar:
        res = await db.execute(
            select(PerfilMilitar).where(PerfilMilitar.usuario_id == usuario_id)
        )
        perfil = res.scalars().first()
        if not perfil:
            raise EntidadNoEncontrada("Este usuario no tiene perfil de integrante")
        return perfil

    # ─── Ficha del integrante ──────────────────────────────────────────────────

    async def construir_integrante(self, db: AsyncSession, perfil: PerfilMilitar) -> IntegranteSalida:
        """
        Une las tres fuentes que describen a un residente: su fila de `usuarios`, su
        perfil militar y los vehículos que constan realmente a su nombre.
        """
        usuario = perfil.usuario or await db.get(Usuario, perfil.usuario_id)

        res_veh = await db.execute(
            select(Vehiculo).where(
                Vehiculo.socio_id == perfil.usuario_id,
                Vehiculo.activo == True,  # noqa: E712
            )
        )
        vehiculos = [VehiculoResumen.model_validate(v) for v in res_veh.scalars().all()]

        # ¿Tiene ya carnet peatonal emitido? Sirve para no reimprimir sin querer.
        res_qr = await db.execute(
            select(func.count(CodigoQR.id)).where(
                CodigoQR.usuario_id == perfil.usuario_id,
                CodigoQR.tipo == QRTipo.permanente,
                CodigoQR.activo == True,  # noqa: E712
            )
        )
        tiene_qr = (res_qr.scalar() or 0) > 0

        habitacion = perfil.habitacion
        dormitorio = habitacion.dormitorio if habitacion else None

        return IntegranteSalida(
            usuario_id=perfil.usuario_id,
            cedula=usuario.cedula if usuario else "",
            nombre=usuario.nombre if usuario else "",
            apellido=usuario.apellido if usuario else "",
            telefono=usuario.telefono if usuario else None,
            email=usuario.email if usuario else None,
            grado=perfil.grado,
            unidad=perfil.unidad,
            jefe_nombre=perfil.jefe_nombre,
            jefe_telefono=perfil.jefe_telefono,
            tiene_vehiculo=perfil.tiene_vehiculo,
            vehiculos=vehiculos,
            habitacion_id=perfil.habitacion_id,
            habitacion_numero=habitacion.numero if habitacion else None,
            dormitorio_id=dormitorio.id if dormitorio else None,
            dormitorio_nombre=dormitorio.nombre if dormitorio else None,
            tiene_qr_peatonal=tiene_qr,
            activo=perfil.activo,
        )

    async def listar_integrantes_habitacion(
        self, db: AsyncSession, habitacion_id: UUID
    ) -> List[IntegranteSalida]:
        res = await db.execute(
            select(PerfilMilitar)
            .options(selectinload(PerfilMilitar.usuario))
            .where(PerfilMilitar.habitacion_id == habitacion_id, PerfilMilitar.activo == True)  # noqa: E712
        )
        return [await self.construir_integrante(db, p) for p in res.scalars().all()]

    # ─── Alta y edición de integrantes ─────────────────────────────────────────

    async def crear_integrante(
        self, db: AsyncSession, datos: IntegranteCrear, creador_id: Optional[UUID] = None
    ) -> PerfilMilitar:
        cedula = datos.cedula.strip().upper()

        res = await db.execute(select(Usuario).where(Usuario.cedula == cedula))
        usuario = res.scalars().first()

        if usuario:
            # La persona ya está en el sistema (socio de un club, guardia, quien sea).
            # Se completa, no se duplica: ese es todo el objetivo del módulo.
            #
            # El ROL no se toca. Si la cédula resulta ser la del Comandante porque
            # alguien lo apuntó en un dormitorio, degradarlo a SOCIO lo dejaría fuera
            # de su propio panel.
            usuario.nombre = datos.nombre.strip()
            usuario.apellido = datos.apellido.strip()
            if datos.telefono:
                usuario.telefono = datos.telefono.strip()
            if datos.email:
                usuario.email = datos.email.strip()
            usuario.is_deleted = False
            usuario.activo = True
        else:
            if datos.email:
                res_email = await db.execute(
                    select(Usuario).where(func.lower(Usuario.email) == datos.email.strip().lower())
                )
                if res_email.scalars().first():
                    raise EntidadDuplicada(f"El correo {datos.email} ya está registrado por otro usuario")

            usuario = Usuario(
                cedula=cedula,
                nombre=datos.nombre.strip(),
                apellido=datos.apellido.strip(),
                email=datos.email.strip() if datos.email else None,
                telefono=datos.telefono.strip() if datos.telefono else None,
                # SOCIO es el rol "persona sin panel" que el sistema ya usa. No se crea
                # un rol nuevo: `rol_tipo` es un ENUM nativo de Postgres y alterarlo ya
                # costó caro una vez (ver fix_enum.py en la raíz del repo).
                rol=RolTipo.SOCIO,
                password_hash=hashear_password(cedula),
                debe_cambiar_password=True,
            )
            db.add(usuario)
            await db.flush()

        # Un integrante no lleva membresía: no es socio de ningún club, duerme aquí.

        res_perfil = await db.execute(
            select(PerfilMilitar).where(PerfilMilitar.usuario_id == usuario.id)
        )
        perfil = res_perfil.scalars().first()

        if perfil is None:
            perfil = PerfilMilitar(usuario_id=usuario.id)
            db.add(perfil)

        perfil.grado = datos.grado
        perfil.unidad = datos.unidad
        perfil.jefe_nombre = datos.jefe_nombre
        perfil.jefe_telefono = datos.jefe_telefono
        perfil.tiene_vehiculo = datos.tiene_vehiculo
        perfil.activo = True

        if datos.habitacion_id:
            habitacion = await self.obtener_habitacion(db, datos.habitacion_id)
            await self._verificar_camas(db, habitacion, excluir_usuario_id=usuario.id)
            perfil.habitacion_id = habitacion.id
            perfil.fecha_ingreso_dormitorio = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(perfil)
        return perfil

    async def editar_integrante(
        self, db: AsyncSession, usuario_id: UUID, datos: IntegranteEditar
    ) -> PerfilMilitar:
        perfil = await self.obtener_perfil(db, usuario_id)
        usuario = await db.get(Usuario, usuario_id)

        cambios = datos.model_dump(exclude_unset=True)

        for campo in ("nombre", "apellido", "telefono", "email"):
            if campo in cambios and usuario:
                setattr(usuario, campo, cambios[campo])

        for campo in ("grado", "unidad", "jefe_nombre", "jefe_telefono", "tiene_vehiculo", "activo"):
            if campo in cambios:
                setattr(perfil, campo, cambios[campo])

        # Dar de baja al integrante libera la cama: dejarlo ocupando una plaza que ya no
        # usa falsearía la capacidad del dormitorio entero.
        if cambios.get("activo") is False:
            perfil.habitacion_id = None

        await db.commit()
        await db.refresh(perfil)
        return perfil

    # ─── Camas ─────────────────────────────────────────────────────────────────

    async def _verificar_camas(
        self, db: AsyncSession, habitacion: Habitacion, excluir_usuario_id: Optional[UUID] = None
    ) -> None:
        """
        La ocupación se cuenta contra la base y no sobre la relación ya cargada: dos
        administradores asignando a la vez verían cada uno su propia copia en memoria.
        """
        condiciones = [
            PerfilMilitar.habitacion_id == habitacion.id,
            PerfilMilitar.activo == True,  # noqa: E712
        ]
        if excluir_usuario_id:
            condiciones.append(PerfilMilitar.usuario_id != excluir_usuario_id)

        res = await db.execute(select(func.count(PerfilMilitar.id)).where(*condiciones))
        ocupacion = res.scalar() or 0

        if ocupacion >= habitacion.camas:
            raise CapacidadExcedida(
                f"La habitación {habitacion.numero} tiene {habitacion.camas} cama(s) y "
                f"{ocupacion} ocupada(s). Cambia el número de camas o libera una plaza "
                f"antes de asignar."
            )

    async def asignar_habitacion(
        self, db: AsyncSession, habitacion_id: UUID, usuario_id: UUID
    ) -> PerfilMilitar:
        habitacion = await self.obtener_habitacion(db, habitacion_id)
        perfil = await self.obtener_perfil(db, usuario_id)

        if perfil.habitacion_id == habitacion.id:
            return perfil

        await self._verificar_camas(db, habitacion, excluir_usuario_id=usuario_id)

        perfil.habitacion_id = habitacion.id
        perfil.fecha_ingreso_dormitorio = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(perfil)
        return perfil

    async def desasignar_habitacion(self, db: AsyncSession, usuario_id: UUID) -> PerfilMilitar:
        perfil = await self.obtener_perfil(db, usuario_id)
        perfil.habitacion_id = None
        await db.commit()
        await db.refresh(perfil)
        return perfil

    # ─── QR de la puerta ───────────────────────────────────────────────────────

    async def generar_token_habitacion(
        self, db: AsyncSession, habitacion_id: UUID
    ) -> tuple[Habitacion, str]:
        """
        Genera (o rota) el token del QR pegado en la puerta.

        Rotar invalida el QR impreso anterior en el acto: hay que imprimir el nuevo y
        cambiarlo físicamente. Es el precio de poder cortar el acceso a la ficha en el
        momento en que se sepa que alguien fotografió la puerta.
        """
        habitacion = await self.obtener_habitacion(db, habitacion_id)
        token = generar_token()
        habitacion.token_hash = hashear_token(token)
        habitacion.token_pista = token[:6]
        habitacion.token_generado_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(habitacion)
        return habitacion, token

    async def revocar_token_habitacion(self, db: AsyncSession, habitacion_id: UUID) -> Habitacion:
        habitacion = await self.obtener_habitacion(db, habitacion_id)
        habitacion.token_hash = None
        habitacion.token_pista = None
        habitacion.token_generado_at = None
        await db.commit()
        await db.refresh(habitacion)
        return habitacion

    async def ficha_publica(self, db: AsyncSession, token: str) -> HabitacionPublica:
        """
        Lo que ve quien escanea el QR de la puerta. Sin sesión.

        Un token inexistente, uno revocado y una habitación desactivada dan todos el
        mismo error: distinguirlos convertiría el endpoint en un oráculo para averiguar
        qué tokens existen.
        """
        res = await db.execute(
            select(Habitacion)
            .options(selectinload(Habitacion.dormitorio))
            .where(Habitacion.token_hash == hashear_token(token))
        )
        habitacion = res.scalars().first()

        if not habitacion or not habitacion.activo:
            raise EntidadNoEncontrada("Habitación no encontrada")
        if habitacion.dormitorio and not habitacion.dormitorio.activo:
            raise EntidadNoEncontrada("Habitación no encontrada")

        res_ocup = await db.execute(
            select(PerfilMilitar)
            .options(selectinload(PerfilMilitar.usuario))
            .where(PerfilMilitar.habitacion_id == habitacion.id, PerfilMilitar.activo == True)  # noqa: E712
        )
        perfiles = res_ocup.scalars().all()

        ocupantes = []
        for p in perfiles:
            u = p.usuario
            if not u:
                continue
            ocupantes.append(
                OcupantePublico(
                    grado=p.grado,
                    nombre=u.nombre,
                    apellido=u.apellido,
                    unidad=p.unidad,
                    telefono=u.telefono,
                    jefe_nombre=p.jefe_nombre,
                    jefe_telefono=p.jefe_telefono,
                )
            )

        return HabitacionPublica(
            dormitorio=habitacion.dormitorio.nombre if habitacion.dormitorio else "",
            habitacion=habitacion.numero,
            piso=habitacion.piso,
            camas=habitacion.camas,
            ocupacion=len(ocupantes),
            ocupantes=ocupantes,
        )

    # ─── QR peatonal ───────────────────────────────────────────────────────────

    async def generar_qr_peatonal(
        self, db: AsyncSession, usuario_id: UUID, creador_id: Optional[UUID] = None
    ) -> tuple[Usuario, PerfilMilitar, str]:
        """
        Carnet QR para quien entra a pie.

        Va en `codigos_qr` como cualquier otro pase —mismo escáner, misma bitácora— con
        `vehiculo_id` en nulo porque no hay vehículo que registrar, y sin membresía: lo
        que lo valida es la rama de perfil militar de `acceso_service.validar_qr`.
        """
        perfil = await self.obtener_perfil(db, usuario_id)
        usuario = await db.get(Usuario, usuario_id)
        if not usuario:
            raise EntidadNoEncontrada("Usuario no encontrado")

        # Un carnet nuevo deja sin valor al anterior: si no, quien perdió la credencial
        # sigue teniendo una válida circulando por ahí.
        await db.execute(
            update(CodigoQR)
            .where(CodigoQR.usuario_id == usuario_id, CodigoQR.activo == True)  # noqa: E712
            .values(activo=False)
        )

        token = crear_token_qr(str(usuario_id))
        qr = CodigoQR(
            usuario_id=usuario_id,
            tipo=QRTipo.permanente,
            token=token,
            activo=True,
            nombre_portador=f"{usuario.nombre} {usuario.apellido}",
            cedula_portador=usuario.cedula,
            telefono_portador=usuario.telefono,
            created_by=creador_id,
        )
        db.add(qr)
        await db.commit()
        return usuario, perfil, token


dormitorio_service = DormitorioService()
