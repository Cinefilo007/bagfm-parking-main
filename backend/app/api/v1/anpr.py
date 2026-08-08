"""
Control de acceso por lectura de placas (ANPR) en las alcabalas.

Dos públicos muy distintos comparten este router:

  - La CÁMARA, que postea eventos a `/ingesta/{token}` sin sesión ni JWT. Se autentica
    con su token en la ruta, porque una cámara Hikvision no puede mandar cabeceras
    propias. Ese token también dice de qué alcabala viene el evento.
  - El GUARDIA, que resuelve las detecciones, y el COMANDANTE, que administra las
    cámaras y consulta el histórico. Ambos con su sesión normal.
"""
import ipaddress
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import obtener_config
from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.models.alcabala_evento import PuntoAcceso
from app.models.camara_anpr import CamaraAnpr, generar_token, hashear_token
from app.models.destino_alcabala import DestinoAlcabala
from app.models.enums import AccesoTipo, AnprEstado, OrigenRegistro, RolTipo
from app.models.evento_anpr import EventoAnpr
from app.models.usuario import Usuario
from app.schemas.acceso import AccesoRegistrar
from app.schemas.anpr import (
    CamaraConToken,
    CamaraCrear,
    CamaraEditar,
    CamaraSalida,
    DestinoSalida,
    EventoAnprSalida,
    PaginatedEventosAnpr,
    ResolverEvento,
)
from app.services.acceso_service import acceso_service
from app.services.anpr_service import anpr_service
from app.services.placa_lookup import normalizar_placa
from app.services.storage_local import leer_imagen

router = APIRouter()
config = obtener_config()

DEPENDENCY_ALCABALA = Depends(require_rol([
    RolTipo.ALCABALA, RolTipo.ADMIN_BASE, RolTipo.COMANDANTE, RolTipo.SUPERVISOR,
]))

# Límite del cuerpo que se acepta de una cámara. Un evento con dos fotos ronda los
# 500 KB; 12 MB deja margen de sobra y a la vez evita que un POST malicioso al
# endpoint sin sesión agote la memoria del proceso.
MAX_CUERPO_BYTES = 12 * 1024 * 1024


def _ip_origen(request: Request) -> Optional[str]:
    """
    IP real de quien hace la petición.

    El backend corre detrás del proxy del VPS, así que `request.client.host` es la IP
    del proxy y sería la misma para todo el mundo: comparar contra ella dejaría la
    allowlist sin efecto. Se usa la primera entrada de X-Forwarded-For, que es la que
    el proxy escribe con la IP del cliente.

    Esto vale porque el proxy REEMPLAZA la cabecera en cada petición entrante. Si algún
    día el backend quedara expuesto directo a internet, un atacante podría falsificar
    X-Forwarded-For y saltarse el filtro — por eso la allowlist es una segunda barrera
    y no la principal: el secreto de la ruta es lo que de verdad protege el endpoint.
    """
    reenviada = request.headers.get("x-forwarded-for", "")
    if reenviada:
        return reenviada.split(",")[0].strip()
    return request.client.host if request.client else None


def _ip_autorizada(request: Request) -> bool:
    permitidas = config.anpr_ips_permitidas
    if not permitidas:
        # Sin lista configurada no se filtra. En producción eso es una omisión seria,
        # así que se deja constancia en el log en vez de fallar en silencio.
        if config.en_produccion:
            print("[ANPR] AVISO: ingesta sin ANPR_IP_ALLOWLIST configurada.")
        return True

    origen = _ip_origen(request)
    if not origen:
        return False

    for entrada in permitidas:
        try:
            if "/" in entrada:
                if ipaddress.ip_address(origen) in ipaddress.ip_network(entrada, strict=False):
                    return True
            elif origen == entrada:
                return True
        except ValueError:
            continue

    print(f"[ANPR] Origen rechazado: {origen} no está en ANPR_IP_ALLOWLIST")
    return False


# ──────────────────────────────────────────────────────────────────────────────
# Ingesta desde la cámara (sin sesión)
# ──────────────────────────────────────────────────────────────────────────────

# Va bajo /ingesta y no bajo /evento a propósito: `/evento/{token}` tiene la misma
# forma que `/evento/{evento_id}`, y como esta ruta se declara antes, FastAPI le
# entregaría a la cámara las peticiones del guardia. Además deja separada de un
# vistazo la superficie sin sesión de la que sí la exige.
@router.post("/ingesta/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def recibir_evento_anpr(
    token: str,
    request: Request,
    db: AsyncSession = Depends(obtener_db),
):
    """
    Recibe una detección de placa de una cámara.

    El token identifica a la cámara y, con ella, a su alcabala: por eso la URL no
    lleva el punto de acceso aparte. Cada cámara tiene el suyo, administrable desde
    el panel de cámaras, y revocarlo deja fuera a esa cámara sola.

    Responde 204 aunque el evento no traiga una placa legible: devolver un error haría
    que la cámara reintentara en bucle algo que nunca va a mejorar.
    """
    camara = await anpr_service.autenticar_camara(db, token)
    if not camara:
        # Mismo 404 para token inválido y para cámara desactivada: no se le confirma a
        # quien prueba tokens que uno de ellos existió alguna vez.
        raise HTTPException(status_code=404, detail="No encontrado")

    if not _ip_autorizada(request):
        raise HTTPException(status_code=403, detail="Origen no autorizado")

    largo = request.headers.get("content-length")
    if largo and largo.isdigit() and int(largo) > MAX_CUERPO_BYTES:
        raise HTTPException(status_code=413, detail="Evento demasiado grande")

    cuerpo = await request.body()
    if len(cuerpo) > MAX_CUERPO_BYTES:
        raise HTTPException(status_code=413, detail="Evento demasiado grande")

    punto_db = await db.get(PuntoAcceso, camara.punto_acceso_id)
    if not punto_db:
        raise HTTPException(status_code=409, detail="La cámara no tiene alcabala asignada")

    await anpr_service.registrar_evento(
        db, camara, punto_db, request.headers.get("content-type", ""), cuerpo
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────────────────────────────────────
# Administración de cámaras (Comandante)
# ──────────────────────────────────────────────────────────────────────────────

DEPENDENCY_ADMIN = Depends(require_rol([RolTipo.COMANDANTE, RolTipo.ADMIN_BASE]))


def _url_ingesta(token: str) -> str:
    """La URL completa que se pega en el campo del HTTP Listening de la cámara."""
    return f"{config.backend_url_base}/api/v1/anpr/ingesta/{token}"


async def _recargar(db: AsyncSession, camara_id: UUID) -> CamaraAnpr:
    """
    Relee la cámara con su punto de acceso ya cargado.

    Hace falta porque `CamaraSalida` expone `punto_nombre`, que sale de la relación.
    Leer esa relación después de un commit dispararía una carga perezosa, y en una
    sesión async eso no falla en desarrollo pero revienta con MissingGreenlet bajo
    carga. Con un SELECT explícito el dato ya viene resuelto.
    """
    return (await db.execute(
        select(CamaraAnpr)
        .options(selectinload(CamaraAnpr.punto_acceso))
        .where(CamaraAnpr.id == camara_id)
    )).scalars().one()


@router.get("/camaras", response_model=List[CamaraSalida])
async def listar_camaras(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    camaras = (await db.execute(
        select(CamaraAnpr)
        .options(selectinload(CamaraAnpr.punto_acceso))
        .order_by(CamaraAnpr.nombre)
    )).scalars().all()
    return camaras


@router.post("/camaras", response_model=CamaraConToken, status_code=status.HTTP_201_CREATED)
async def crear_camara(
    datos: CamaraCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Registra una cámara y le genera su token de ingesta.

    El token se devuelve aquí y **no vuelve a mostrarse nunca**: en la base solo queda
    su hash. Si se pierde, se rota.
    """
    if not await db.get(PuntoAcceso, datos.punto_acceso_id):
        raise HTTPException(status_code=400, detail="Punto de acceso inexistente")

    token = generar_token()
    camara = CamaraAnpr(
        **datos.model_dump(),
        token_hash=hashear_token(token),
        token_pista=token[-4:],
        token_generado_at=func.now(),
        token_generado_por=usuario.id,
        creado_por=usuario.id,
    )
    db.add(camara)
    await db.commit()
    camara = await _recargar(db, camara.id)

    return CamaraConToken(
        camara=CamaraSalida.model_validate(camara),
        token=token,
        url_ingesta=_url_ingesta(token),
    )


@router.patch("/camaras/{camara_id}", response_model=CamaraSalida)
async def editar_camara(
    camara_id: UUID,
    datos: CamaraEditar,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    camara = await db.get(CamaraAnpr, camara_id)
    if not camara:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")

    cambios = datos.model_dump(exclude_unset=True)
    if "punto_acceso_id" in cambios and cambios["punto_acceso_id"]:
        if not await db.get(PuntoAcceso, cambios["punto_acceso_id"]):
            raise HTTPException(status_code=400, detail="Punto de acceso inexistente")

    for campo, valor in cambios.items():
        setattr(camara, campo, valor)

    await db.commit()
    return await _recargar(db, camara.id)


@router.post("/camaras/{camara_id}/rotar-token", response_model=CamaraConToken)
async def rotar_token(
    camara_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Genera un token nuevo e invalida el anterior de inmediato.

    La cámara deja de poder enviar hasta que se le cargue la URL nueva. Es el
    comportamiento correcto ante una sospecha de filtración, pero conviene hacerlo
    con alguien delante del equipo.
    """
    camara = await db.get(CamaraAnpr, camara_id)
    if not camara:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")

    token = generar_token()
    camara.token_hash = hashear_token(token)
    camara.token_pista = token[-4:]
    camara.token_generado_at = func.now()
    camara.token_generado_por = usuario.id
    await db.commit()
    camara = await _recargar(db, camara.id)

    return CamaraConToken(
        camara=CamaraSalida.model_validate(camara),
        token=token,
        url_ingesta=_url_ingesta(token),
    )


@router.delete("/camaras/{camara_id}/token", response_model=CamaraSalida)
async def revocar_token(
    camara_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """Deja a la cámara sin token: deja de poder enviar, pero se conserva su historial."""
    camara = await db.get(CamaraAnpr, camara_id)
    if not camara:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")

    camara.token_hash = None
    camara.token_pista = None
    camara.token_generado_at = None
    camara.token_generado_por = None
    await db.commit()
    return await _recargar(db, camara.id)


@router.delete("/camaras/{camara_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_camara(
    camara_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Borra la cámara del inventario.

    Sus detecciones NO se borran: quedan con `camara_id` en nulo. El historial de
    quién entró a la base no puede depender de que el equipo siga inventariado.
    """
    camara = await db.get(CamaraAnpr, camara_id)
    if not camara:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")

    await db.delete(camara)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/puntos-acceso")
async def listar_puntos_acceso(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """Alcabalas disponibles, para el selector del formulario de cámara."""
    puntos = (await db.execute(
        select(PuntoAcceso.id, PuntoAcceso.nombre, PuntoAcceso.activo)
        .order_by(PuntoAcceso.nombre)
    )).all()
    return [{"id": p.id, "nombre": p.nombre, "activo": p.activo} for p in puntos]


# ──────────────────────────────────────────────────────────────────────────────
# Operación del guardia
# ──────────────────────────────────────────────────────────────────────────────

def _a_salida(evento: EventoAnpr) -> EventoAnprSalida:
    salida = EventoAnprSalida.model_validate(evento)
    base = f"{config.backend_url_base}/api/v1/anpr/evento/{evento.id}/foto"
    if evento.foto_placa_path:
        salida.foto_placa_url = f"{base}/placa"
    if evento.foto_escena_path:
        salida.foto_escena_url = f"{base}/escena"
    return salida


@router.get("/destinos", response_model=List[DestinoSalida])
async def listar_destinos(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """Catálogo de destinos que el guardia ve como botones."""
    destinos = (await db.execute(
        select(DestinoAlcabala)
        .where(DestinoAlcabala.activo == True)
        .order_by(DestinoAlcabala.orden, DestinoAlcabala.nombre)
    )).scalars().all()
    return destinos


@router.get("/pendientes", response_model=List[EventoAnprSalida])
async def listar_pendientes(
    limite: int = 20,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """
    Detecciones sin resolver del punto de acceso del guardia.

    El camino normal es el WebSocket; esto es el respaldo para cuando el guardia
    recarga la pantalla o se le cayó la conexión un momento.
    """
    punto_id = (await db.execute(
        select(PuntoAcceso.id).where(PuntoAcceso.usuario_id == usuario.id)
    )).scalars().first()

    consulta = (
        select(EventoAnpr)
        .where(EventoAnpr.estado == AnprEstado.pendiente)
        .order_by(EventoAnpr.timestamp_recibido.desc())
        .limit(min(limite, 100))
    )
    # Un supervisor o el comandante no están asignados a una alcabala: ven todas.
    if punto_id:
        consulta = consulta.where(EventoAnpr.punto_acceso_id == punto_id)

    eventos = (await db.execute(consulta)).scalars().all()
    return [_a_salida(e) for e in eventos]


@router.get("/monitor")
async def monitor_alcabala(
    limite: int = 4,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """
    Últimas detecciones con su ficha completa, para el TV de la alcabala.

    La pantalla se alimenta del WebSocket en vivo; esto es lo que pinta al encenderla
    o tras un corte, para que el monitor nunca aparezca en blanco delante de la fila.
    """
    punto_id = (await db.execute(
        select(PuntoAcceso.id).where(PuntoAcceso.usuario_id == usuario.id)
    )).scalars().first()

    consulta = (
        select(EventoAnpr)
        .where(EventoAnpr.estado != AnprEstado.duplicado)
        .order_by(EventoAnpr.timestamp_recibido.desc())
        .limit(min(limite, 10))
    )
    if punto_id:
        consulta = consulta.where(EventoAnpr.punto_acceso_id == punto_id)

    eventos = (await db.execute(consulta)).scalars().all()
    return [await anpr_service.construir_ficha(db, e) for e in eventos]


@router.get("/evento/{evento_id}/foto/{cual}")
async def obtener_foto(
    evento_id: UUID,
    cual: str,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """
    Entrega una foto de la detección.

    Las fotos viven en el volumen privado y nunca se sirven como estáticos: son
    imágenes de civiles y de sus vehículos, y solo deben salir con sesión válida.
    """
    if cual not in ("placa", "escena"):
        raise HTTPException(status_code=400, detail="Foto inválida")

    evento = await db.get(EventoAnpr, evento_id)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    ruta = evento.foto_placa_path if cual == "placa" else evento.foto_escena_path
    contenido = leer_imagen(ruta)
    if not contenido:
        raise HTTPException(status_code=404, detail="Foto no disponible")

    return Response(
        content=contenido,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.post("/evento/{evento_id}/resolver", response_model=EventoAnprSalida)
async def resolver_evento(
    evento_id: UUID,
    datos: ResolverEvento,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """
    El guardia marca el destino y con eso queda registrado el acceso.

    En Fase 1 esto NO decide si el vehículo pasa —el brazo abre siempre— sino que
    convierte una detección de la cámara en un registro formal con destino declarado.
    """
    evento = await db.get(EventoAnpr, evento_id)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if evento.estado == AnprEstado.resuelto:
        raise HTTPException(status_code=409, detail="El evento ya fue resuelto")

    destino = await db.get(DestinoAlcabala, datos.destino_id)
    if not destino or not destino.activo:
        raise HTTPException(status_code=400, detail="Destino inválido")

    if destino.requiere_texto_libre and not (datos.observaciones or "").strip():
        raise HTTPException(status_code=400, detail=f"'{destino.nombre}' requiere indicar el destino")

    if datos.placa_corregida:
        evento.placa = normalizar_placa(datos.placa_corregida)

    punto = await db.get(PuntoAcceso, evento.punto_acceso_id)

    acceso = await acceso_service.registrar_acceso(
        db,
        AccesoRegistrar(
            tipo=AccesoTipo.salida if evento.direccion.value == "salida" else AccesoTipo.entrada,
            punto_acceso=punto.nombre if punto else "Alcabala",
            es_manual=False,
            origen_registro=OrigenRegistro.anpr,
            destino_id=destino.id,
            observaciones=datos.observaciones,
            vehiculo_placa=evento.placa,
            vehiculo_marca=evento.marca_vehiculo,
            vehiculo_modelo=evento.tipo_vehiculo,
            vehiculo_color=evento.color_vehiculo,
        ),
        usuario.id,
    )

    evento.estado = AnprEstado.resuelto
    evento.acceso_id = acceso.id
    evento.resuelto_por = usuario.id
    evento.resuelto_at = func.now()
    await db.commit()
    await db.refresh(evento)

    return _a_salida(evento)


@router.post("/evento/{evento_id}/descartar", response_model=EventoAnprSalida)
async def descartar_evento(
    evento_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """
    Marca la detección como no aplicable: peatón, falso positivo, o un vehículo que se
    devolvió sin entrar. El evento NO se borra — un descarte también es un dato.
    """
    evento = await db.get(EventoAnpr, evento_id)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if evento.estado == AnprEstado.resuelto:
        raise HTTPException(status_code=409, detail="El evento ya generó un acceso")

    evento.estado = AnprEstado.descartado
    evento.resuelto_por = usuario.id
    evento.resuelto_at = func.now()
    await db.commit()
    await db.refresh(evento)
    return _a_salida(evento)


# ──────────────────────────────────────────────────────────────────────────────
# Consulta histórica
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/eventos", response_model=PaginatedEventosAnpr)
async def historial_eventos(
    page: int = 1,
    size: int = 20,
    placa: Optional[str] = None,
    estado: Optional[AnprEstado] = None,
    punto_acceso_id: Optional[UUID] = None,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = Depends(require_rol([
        RolTipo.COMANDANTE, RolTipo.ADMIN_BASE, RolTipo.SUPERVISOR,
    ])),
):
    """Histórico de detecciones. Es la materia prima del análisis de patrones."""
    page = max(1, page)
    size = min(max(1, size), 100)

    filtros = []
    if placa:
        filtros.append(EventoAnpr.placa.ilike(f"%{normalizar_placa(placa)}%"))
    if estado:
        filtros.append(EventoAnpr.estado == estado)
    if punto_acceso_id:
        filtros.append(EventoAnpr.punto_acceso_id == punto_acceso_id)

    total = (await db.execute(
        select(func.count()).select_from(EventoAnpr).where(*filtros)
    )).scalar_one()

    eventos = (await db.execute(
        select(EventoAnpr)
        .where(*filtros)
        .order_by(EventoAnpr.timestamp_recibido.desc())
        .offset((page - 1) * size)
        .limit(size)
    )).scalars().all()

    return PaginatedEventosAnpr(
        items=[_a_salida(e) for e in eventos],
        total=total,
        page=page,
        size=size,
    )
