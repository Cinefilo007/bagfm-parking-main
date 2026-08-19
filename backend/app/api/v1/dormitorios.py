"""
dormitorios.py — Módulo Dormitorios.

Administración del alojamiento del personal: dormitorios, sus habitaciones con las
camas que tienen y quién las ocupa. Solo el alto mando administrativo entra aquí.

Hay UNA excepción a la sesión obligatoria: `/publico/habitacion/{token}`, la ficha que
abre el QR pegado en la puerta. Va fuera de la dependencia de rol porque quien toca la
puerta no tiene cuenta en el sistema, y se autentica con el token de la habitación
igual que el monitor de garita con el suyo.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import obtener_config
from app.core.database import obtener_db
from app.core.dependencias import require_rol
from app.core.excepciones import CapacidadExcedida, EntidadDuplicada, EntidadNoEncontrada
from app.models.dormitorio import Dormitorio, Habitacion
from app.models.enums import RolTipo
from app.models.perfil_militar import PerfilMilitar
from app.models.usuario import Usuario
from app.schemas.dormitorio import (
    DormitorioCrear,
    DormitorioDetalle,
    DormitorioEditar,
    DormitorioSalida,
    HabitacionConToken,
    HabitacionCrear,
    HabitacionEditar,
    HabitacionPublica,
    HabitacionSalida,
    IntegranteCrear,
    IntegranteEditar,
    IntegranteSalida,
    QrPeatonalSalida,
)
from app.services.dormitorio_service import dormitorio_service

router = APIRouter()
config = obtener_config()

# Mismos roles que el panel de cámaras: es administración de la base, no operación.
DEPENDENCY_ADMIN = Depends(require_rol([RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]))


def _url_publica(token: str) -> str:
    """
    Lo que se codifica en el QR que se imprime y se pega en la puerta.

    El token viaja en la ruta y no en un parámetro para que la URL quede corta: el QR
    se imprime en un adhesivo pequeño y cuantos menos caracteres, menos densa la
    cuadrícula y mejor lee un teléfono con poca luz de pasillo.
    """
    return f"{config.frontend_url.rstrip('/')}/habitacion/{token}"


async def _salida_dormitorio(dormitorio: Dormitorio) -> DormitorioSalida:
    return DormitorioSalida(
        id=dormitorio.id,
        nombre=dormitorio.nombre,
        codigo=dormitorio.codigo,
        descripcion=dormitorio.descripcion,
        latitud=float(dormitorio.latitud) if dormitorio.latitud is not None else None,
        longitud=float(dormitorio.longitud) if dormitorio.longitud is not None else None,
        responsable_usuario_id=dormitorio.responsable_usuario_id,
        responsable_nombre=dormitorio.responsable.nombre_completo if dormitorio.responsable else None,
        activo=dormitorio.activo,
        created_at=dormitorio.created_at,
        total_habitaciones=dormitorio.total_habitaciones,
        camas_totales=dormitorio.camas_totales,
        ocupacion=dormitorio.ocupacion,
    )


async def _salida_habitacion(
    db: AsyncSession, habitacion: Habitacion, con_integrantes: bool = True
) -> HabitacionSalida:
    integrantes: List[IntegranteSalida] = []
    if con_integrantes:
        integrantes = await dormitorio_service.listar_integrantes_habitacion(db, habitacion.id)

    return HabitacionSalida(
        id=habitacion.id,
        dormitorio_id=habitacion.dormitorio_id,
        numero=habitacion.numero,
        piso=habitacion.piso,
        camas=habitacion.camas,
        notas=habitacion.notas,
        activo=habitacion.activo,
        created_at=habitacion.created_at,
        ocupacion=len(integrantes) if con_integrantes else habitacion.ocupacion,
        camas_libres=max(0, habitacion.camas - (len(integrantes) if con_integrantes else habitacion.ocupacion)),
        tiene_token=habitacion.tiene_token,
        token_pista=habitacion.token_pista,
        token_generado_at=habitacion.token_generado_at,
        integrantes=integrantes,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Vista pública de la puerta — SIN SESIÓN
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/publico/habitacion/{token}", response_model=HabitacionPublica)
async def ficha_publica_habitacion(token: str, db: AsyncSession = Depends(obtener_db)):
    """
    Ficha de los ocupantes de una habitación. La abre el QR de la puerta.

    Va deliberadamente el primero del archivo y fuera de `DEPENDENCY_ADMIN`: es el
    único camino de este módulo sin sesión, y tenerlo arriba evita que alguien le
    añada la dependencia de rol por inercia al tocar los endpoints de al lado.
    """
    try:
        return await dormitorio_service.ficha_publica(db, token)
    except EntidadNoEncontrada:
        raise HTTPException(status_code=404, detail="Habitación no encontrada")


# ──────────────────────────────────────────────────────────────────────────────
# Dormitorios
# ──────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[DormitorioSalida])
@router.get("/", response_model=List[DormitorioSalida], include_in_schema=False)
async def listar_dormitorios(
    incluir_inactivos: bool = False,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    consulta = select(Dormitorio).order_by(Dormitorio.nombre)
    if not incluir_inactivos:
        consulta = consulta.where(Dormitorio.activo == True)  # noqa: E712

    res = await db.execute(consulta)
    return [await _salida_dormitorio(d) for d in res.scalars().all()]


@router.post("", response_model=DormitorioSalida, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=DormitorioSalida, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def crear_dormitorio(
    datos: DormitorioCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    if datos.codigo:
        res = await db.execute(select(Dormitorio).where(Dormitorio.codigo == datos.codigo))
        if res.scalars().first():
            raise HTTPException(status_code=400, detail=f"Ya existe un dormitorio con el código {datos.codigo}")

    dormitorio = Dormitorio(**datos.model_dump(), creado_por=usuario.id)
    db.add(dormitorio)
    await db.commit()
    await db.refresh(dormitorio)
    return await _salida_dormitorio(dormitorio)


@router.get("/{dormitorio_id}", response_model=DormitorioDetalle)
async def detalle_dormitorio(
    dormitorio_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        dormitorio = await dormitorio_service.obtener_dormitorio(db, dormitorio_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    res = await db.execute(
        select(Habitacion)
        .where(Habitacion.dormitorio_id == dormitorio_id, Habitacion.activo == True)  # noqa: E712
        .order_by(Habitacion.piso, Habitacion.numero)
    )
    habitaciones = [await _salida_habitacion(db, h) for h in res.scalars().all()]

    base = await _salida_dormitorio(dormitorio)
    return DormitorioDetalle(**base.model_dump(), habitaciones=habitaciones)


@router.patch("/{dormitorio_id}", response_model=DormitorioSalida)
async def editar_dormitorio(
    dormitorio_id: UUID,
    datos: DormitorioEditar,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        dormitorio = await dormitorio_service.obtener_dormitorio(db, dormitorio_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(dormitorio, campo, valor)

    await db.commit()
    await db.refresh(dormitorio)
    return await _salida_dormitorio(dormitorio)


@router.delete("/{dormitorio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_dormitorio(
    dormitorio_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Baja lógica. No se borra: los accesos ya registrados de sus residentes tienen que
    seguir explicándose, y un dormitorio borrado los dejaría colgando.
    """
    try:
        dormitorio = await dormitorio_service.obtener_dormitorio(db, dormitorio_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    dormitorio.activo = False
    await db.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Habitaciones
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/{dormitorio_id}/habitaciones", response_model=HabitacionSalida, status_code=status.HTTP_201_CREATED)
async def crear_habitacion(
    dormitorio_id: UUID,
    datos: HabitacionCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        await dormitorio_service.obtener_dormitorio(db, dormitorio_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    res = await db.execute(
        select(Habitacion).where(
            Habitacion.dormitorio_id == dormitorio_id,
            Habitacion.numero == datos.numero,
        )
    )
    if res.scalars().first():
        raise HTTPException(status_code=400, detail=f"Ya existe la habitación {datos.numero} en este dormitorio")

    habitacion = Habitacion(dormitorio_id=dormitorio_id, **datos.model_dump())
    db.add(habitacion)
    await db.commit()
    await db.refresh(habitacion)
    return await _salida_habitacion(db, habitacion)


@router.patch("/habitaciones/{habitacion_id}", response_model=HabitacionSalida)
async def editar_habitacion(
    habitacion_id: UUID,
    datos: HabitacionEditar,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        habitacion = await dormitorio_service.obtener_habitacion(db, habitacion_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    cambios = datos.model_dump(exclude_unset=True)

    # Bajar las camas por debajo de la gente que ya duerme ahí dejaría la habitación en
    # sobreocupación permanente y ninguna pantalla podría explicarlo. Primero se saca a
    # alguien, después se reduce.
    if "camas" in cambios and cambios["camas"] is not None:
        res = await db.execute(
            select(func.count(PerfilMilitar.id)).where(
                PerfilMilitar.habitacion_id == habitacion_id,
                PerfilMilitar.activo == True,  # noqa: E712
            )
        )
        ocupacion = res.scalar() or 0
        if cambios["camas"] < ocupacion:
            raise HTTPException(
                status_code=400,
                detail=f"No puedes dejar {cambios['camas']} cama(s): hay {ocupacion} integrante(s) asignado(s).",
            )

    for campo, valor in cambios.items():
        setattr(habitacion, campo, valor)

    await db.commit()
    await db.refresh(habitacion)
    return await _salida_habitacion(db, habitacion)


@router.delete("/habitaciones/{habitacion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_habitacion(
    habitacion_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        habitacion = await dormitorio_service.obtener_habitacion(db, habitacion_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    habitacion.activo = False
    # El QR de una habitación dada de baja deja de servir en el acto: el adhesivo sigue
    # pegado en la puerta y no hay nada que impida escanearlo.
    habitacion.token_hash = None
    habitacion.token_pista = None
    habitacion.token_generado_at = None
    await db.commit()


@router.post("/habitaciones/{habitacion_id}/qr", response_model=HabitacionConToken)
async def generar_qr_habitacion(
    habitacion_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Genera o rota el QR de la puerta. Única vez que el token viaja en claro: en la base
    solo queda su hash, así que hay que imprimirlo ahora.
    """
    try:
        habitacion, token = await dormitorio_service.generar_token_habitacion(db, habitacion_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    return HabitacionConToken(
        habitacion=await _salida_habitacion(db, habitacion),
        token=token,
        url_publica=_url_publica(token),
    )


@router.delete("/habitaciones/{habitacion_id}/qr", response_model=HabitacionSalida)
async def revocar_qr_habitacion(
    habitacion_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        habitacion = await dormitorio_service.revocar_token_habitacion(db, habitacion_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))
    return await _salida_habitacion(db, habitacion)


@router.get("/habitaciones/{habitacion_id}/integrantes", response_model=List[IntegranteSalida])
async def listar_integrantes(
    habitacion_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    return await dormitorio_service.listar_integrantes_habitacion(db, habitacion_id)


# ──────────────────────────────────────────────────────────────────────────────
# Integrantes
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/integrantes/buscar", response_model=List[IntegranteSalida])
async def buscar_integrantes(
    q: str = "",
    sin_habitacion: bool = False,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Busca integrantes ya registrados por nombre, apellido o cédula.

    Con `sin_habitacion=true` devuelve a los que no tienen cama asignada, que es lo que
    hace falta para reubicar a alguien sin volver a teclear todos sus datos.
    """
    consulta = (
        select(PerfilMilitar)
        .join(Usuario, PerfilMilitar.usuario_id == Usuario.id)
        .options(selectinload(PerfilMilitar.usuario))
        .where(PerfilMilitar.activo == True)  # noqa: E712
        .order_by(Usuario.apellido, Usuario.nombre)
        .limit(50)
    )

    termino = q.strip()
    if termino:
        patron = f"%{termino.lower()}%"
        consulta = consulta.where(
            func.lower(Usuario.nombre).like(patron)
            | func.lower(Usuario.apellido).like(patron)
            | func.lower(Usuario.cedula).like(patron)
        )

    if sin_habitacion:
        consulta = consulta.where(PerfilMilitar.habitacion_id.is_(None))

    res = await db.execute(consulta)
    return [await dormitorio_service.construir_integrante(db, p) for p in res.scalars().all()]


@router.post("/integrantes", response_model=IntegranteSalida, status_code=status.HTTP_201_CREATED)
async def crear_integrante(
    datos: IntegranteCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Da de alta a un integrante. Si la cédula ya está en `usuarios`, se le completa el
    perfil en vez de crear una segunda ficha de la misma persona.
    """
    try:
        perfil = await dormitorio_service.crear_integrante(db, datos, creador_id=usuario.id)
    except CapacidadExcedida as e:
        raise HTTPException(status_code=400, detail=str(e))
    except EntidadDuplicada as e:
        raise HTTPException(status_code=400, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await dormitorio_service.construir_integrante(db, perfil)


@router.patch("/integrantes/{usuario_id}", response_model=IntegranteSalida)
async def editar_integrante(
    usuario_id: UUID,
    datos: IntegranteEditar,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        perfil = await dormitorio_service.editar_integrante(db, usuario_id, datos)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await dormitorio_service.construir_integrante(db, perfil)


@router.post("/habitaciones/{habitacion_id}/integrantes/{usuario_id}", response_model=IntegranteSalida)
async def asignar_a_habitacion(
    habitacion_id: UUID,
    usuario_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        perfil = await dormitorio_service.asignar_habitacion(db, habitacion_id, usuario_id)
    except CapacidadExcedida as e:
        raise HTTPException(status_code=400, detail=str(e))
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await dormitorio_service.construir_integrante(db, perfil)


@router.delete("/integrantes/{usuario_id}/habitacion", response_model=IntegranteSalida)
async def desasignar_de_habitacion(
    usuario_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    try:
        perfil = await dormitorio_service.desasignar_habitacion(db, usuario_id)
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await dormitorio_service.construir_integrante(db, perfil)


@router.post("/integrantes/{usuario_id}/qr-peatonal", response_model=QrPeatonalSalida)
async def generar_qr_peatonal(
    usuario_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Carnet QR para el personal sin vehículo.

    Sin él, quien entra a pie no deja rastro: la cámara solo ve placas. El guardia lo
    escanea con el lector de siempre y el acceso queda en la bitácora con nombre.
    """
    try:
        persona, perfil, token = await dormitorio_service.generar_qr_peatonal(
            db, usuario_id, creador_id=usuario.id
        )
    except EntidadNoEncontrada as e:
        raise HTTPException(status_code=404, detail=str(e))

    return QrPeatonalSalida(
        usuario_id=persona.id,
        nombre_completo=persona.nombre_completo,
        cedula=persona.cedula,
        grado=perfil.grado,
        token=token,
    )
