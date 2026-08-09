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
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import obtener_config
from app.core.database import obtener_db
from app.core.dependencias import obtener_usuario_actual, require_rol
from app.core.notify_manager import manager
from app.models.alcabala_evento import PuntoAcceso
from app.models.camara_anpr import CamaraAnpr, generar_token, hashear_token
from app.core.tokens import generar_codigo_corto
from app.models.emparejamiento_pantalla import EmparejamientoPantalla
from app.models.entidad_civil import EntidadCivil
from app.models.enums import AccesoTipo, AnprEstado, OrigenRegistro, RolTipo
from app.models.evento_anpr import EventoAnpr
from app.models.pantalla_monitor import PantallaMonitor
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
    EmparejamientoConfirmar,
    EmparejamientoEstado,
    EmparejamientoInfo,
    EmparejamientoIniciado,
    PantallaConToken,
    PantallaCrear,
    PantallaEditar,
    PantallaSalida,
    ResolverEvento,
)
from app.services.acceso_service import acceso_service
from app.services.anpr_service import anpr_service
from app.services.placa_lookup import normalizar_placa, verificar_placa
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
    """
    Destinos que el guardia ve como botones: las entidades registradas en el sistema.

    Se leen de `entidades_civiles` y no de un catálogo aparte para que dar de alta una
    entidad la haga aparecer sola en la alcabala, sin un segundo mantenimiento que
    alguien olvidaría.
    """
    entidades = (await db.execute(
        select(EntidadCivil)
        .where(EntidadCivil.activo == True)
        .order_by(EntidadCivil.nombre)
    )).scalars().all()

    return [
        DestinoSalida(id=e.id, nombre=e.nombre, slug=e.codigo_slug)
        for e in entidades
    ]


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


# ──────────────────────────────────────────────────────────────────────────────
# Pantallas de garita: solo lectura, autenticadas por token de dispositivo
# ──────────────────────────────────────────────────────────────────────────────

async def _autenticar_pantalla(db: AsyncSession, token: Optional[str]) -> PantallaMonitor:
    """
    Resuelve la pantalla a partir de su token y deja constancia de que sigue viva.

    Se consulta la base en cada petición, en vez de emitir un JWT de larga duración,
    porque una credencial que vive para siempre en un televisor de una garita tiene
    que poder retirarse en el acto. Un JWT no se puede retirar.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Falta el token de la pantalla")

    pantalla = (await db.execute(
        select(PantallaMonitor)
        .options(selectinload(PantallaMonitor.punto_acceso))
        .where(PantallaMonitor.token_hash == hashear_token(token))
    )).scalars().first()

    if not pantalla or not pantalla.activa:
        raise HTTPException(status_code=401, detail="Pantalla no autorizada")

    pantalla.ultimo_acceso_at = func.now()
    await db.commit()
    return pantalla


def _token_de_pantalla(request: Request, token: Optional[str]) -> Optional[str]:
    """
    El token llega por cabecera cuando se puede, y por query cuando no.

    Las imágenes y el WebSocket no permiten poner cabeceras propias, así que ahí no
    queda otra que la query. Se acepta en ambos sitios para no tener dos rutas.
    """
    return request.headers.get("x-pantalla-token") or token


@router.get("/pantalla/monitor")
async def monitor_pantalla(
    request: Request,
    token: Optional[str] = None,
    limite: int = 4,
    db: AsyncSession = Depends(obtener_db),
):
    """Últimas detecciones de la alcabala de esta pantalla. Solo lectura."""
    pantalla = await _autenticar_pantalla(db, _token_de_pantalla(request, token))

    eventos = (await db.execute(
        select(EventoAnpr)
        .where(
            EventoAnpr.punto_acceso_id == pantalla.punto_acceso_id,
            EventoAnpr.estado != AnprEstado.duplicado,
        )
        .order_by(EventoAnpr.timestamp_recibido.desc())
        .limit(min(limite, 10))
    )).scalars().all()

    return {
        "punto_acceso_id": str(pantalla.punto_acceso_id),
        "punto_nombre": pantalla.punto_nombre,
        "detecciones": [await anpr_service.construir_ficha(db, e) for e in eventos],
    }


@router.get("/pantalla/foto/{evento_id}/{cual}")
async def foto_pantalla(
    evento_id: UUID,
    cual: str,
    request: Request,
    token: Optional[str] = None,
    db: AsyncSession = Depends(obtener_db),
):
    """
    Foto de una detección, para la pantalla.

    Solo entrega fotos de SU alcabala: sin esa comprobación, el token de una garita
    serviría para ver las fotos de la otra con solo cambiar el id en la URL.
    """
    if cual not in ("placa", "escena"):
        raise HTTPException(status_code=400, detail="Foto inválida")

    pantalla = await _autenticar_pantalla(db, _token_de_pantalla(request, token))

    evento = await db.get(EventoAnpr, evento_id)
    if not evento or evento.punto_acceso_id != pantalla.punto_acceso_id:
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    contenido = leer_imagen(evento.foto_placa_path if cual == "placa" else evento.foto_escena_path)
    if not contenido:
        raise HTTPException(status_code=404, detail="Foto no disponible")

    return Response(
        content=contenido,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


# ──────────────────────────────────────────────────────────────────────────────
# Emparejamiento: el televisor muestra un código, el guardia lo confirma
# ──────────────────────────────────────────────────────────────────────────────

MINUTOS_EMPAREJAMIENTO = 5


async def _purgar_emparejamientos(db: AsyncSession) -> None:
    """Borra los caducados. Se hace al vuelo para no montar un cron por tan poco."""
    await db.execute(
        delete(EmparejamientoPantalla).where(
            EmparejamientoPantalla.expira_at < datetime.now(timezone.utc)
        )
    )


@router.post("/pantalla/emparejar", response_model=EmparejamientoIniciado)
async def iniciar_emparejamiento(db: AsyncSession = Depends(obtener_db)):
    """
    El televisor pide un código para que lo autoricen. Sin sesión: todavía no tiene.

    Devuelve además un secreto que solo conoce este aparato. El código puede verlo
    cualquiera que mire la pantalla —para eso está— pero sin el secreto no sirve para
    reclamar la credencial.
    """
    await _purgar_emparejamientos(db)

    secreto = generar_token()
    # Reintento por si el código sorteado ya estuviera vivo. Con 29^6 combinaciones
    # la colisión es rarísima, pero el índice es único y reventaría el alta.
    for _ in range(5):
        codigo = generar_codigo_corto()
        existe = (await db.execute(
            select(EmparejamientoPantalla.id).where(EmparejamientoPantalla.codigo == codigo)
        )).scalars().first()
        if not existe:
            break
    else:
        raise HTTPException(status_code=503, detail="No se pudo generar un código, reintente")

    emparejamiento = EmparejamientoPantalla(
        codigo=codigo,
        secreto_hash=hashear_token(secreto),
        expira_at=datetime.now(timezone.utc) + timedelta(minutes=MINUTOS_EMPAREJAMIENTO),
    )
    db.add(emparejamiento)
    await db.commit()
    await db.refresh(emparejamiento)

    return EmparejamientoIniciado(
        codigo=codigo,
        secreto=secreto,
        url_confirmacion=f"{config.frontend_url.rstrip('/')}/alcabala/emparejar/{codigo}",
        expira_at=emparejamiento.expira_at,
    )


@router.get("/pantalla/emparejar/estado", response_model=EmparejamientoEstado)
async def estado_emparejamiento(
    secreto: str,
    db: AsyncSession = Depends(obtener_db),
):
    """
    El televisor pregunta si ya lo autorizaron.

    Cuando la respuesta es que sí, se le genera aquí su credencial y se borra el
    emparejamiento: el token existe en claro solo el tiempo de esta respuesta y de él
    únicamente queda el hash.
    """
    emparejamiento = (await db.execute(
        select(EmparejamientoPantalla).where(
            EmparejamientoPantalla.secreto_hash == hashear_token(secreto)
        )
    )).scalars().first()

    if not emparejamiento:
        return EmparejamientoEstado(estado="expirado")

    if emparejamiento.expira_at < datetime.now(timezone.utc):
        await db.delete(emparejamiento)
        await db.commit()
        return EmparejamientoEstado(estado="expirado")

    if not emparejamiento.pantalla_id:
        return EmparejamientoEstado(estado="pendiente")

    pantalla = (await db.execute(
        select(PantallaMonitor)
        .options(selectinload(PantallaMonitor.punto_acceso))
        .where(PantallaMonitor.id == emparejamiento.pantalla_id)
    )).scalars().first()

    if not pantalla:
        await db.delete(emparejamiento)
        await db.commit()
        return EmparejamientoEstado(estado="expirado")

    token = generar_token()
    pantalla.token_hash = hashear_token(token)
    pantalla.token_pista = token[-4:]
    pantalla.token_generado_at = func.now()

    await db.delete(emparejamiento)
    await db.commit()

    return EmparejamientoEstado(
        estado="confirmado",
        token=token,
        punto_nombre=pantalla.punto_nombre,
    )


@router.get("/emparejar/{codigo}", response_model=EmparejamientoInfo)
async def consultar_emparejamiento(
    codigo: str,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """Lo que el guardia ve antes de confirmar: qué código es y a qué alcabala iría."""
    emparejamiento = (await db.execute(
        select(EmparejamientoPantalla).where(
            EmparejamientoPantalla.codigo == codigo.strip().upper().replace("-", "")
        )
    )).scalars().first()

    if not emparejamiento or emparejamiento.expira_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Código no válido o vencido")
    if emparejamiento.pantalla_id:
        raise HTTPException(status_code=409, detail="Ese código ya fue confirmado")

    punto = await _punto_del_guardia(db, usuario)
    return EmparejamientoInfo(
        codigo=emparejamiento.codigo,
        punto_nombre=punto.nombre if punto else None,
        expira_at=emparejamiento.expira_at,
    )


async def _punto_del_guardia(db: AsyncSession, usuario: Usuario) -> Optional[PuntoAcceso]:
    """La alcabala a la que está asignada la cuenta del guardia."""
    return (await db.execute(
        select(PuntoAcceso).where(PuntoAcceso.usuario_id == usuario.id)
    )).scalars().first()


@router.post("/emparejar/{codigo}/confirmar", response_model=PantallaSalida)
async def confirmar_emparejamiento(
    codigo: str,
    datos: EmparejamientoConfirmar,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """
    El guardia autoriza el televisor desde su teléfono.

    La pantalla hereda la alcabala de la cuenta que confirma, que es lo que hace este
    flujo tan corto: el guardia no elige nada, porque su cuenta ya dice en qué garita
    está. Un comandante, que no está asignado a ninguna, tiene que crear la pantalla
    desde el panel.
    """
    emparejamiento = (await db.execute(
        select(EmparejamientoPantalla).where(
            EmparejamientoPantalla.codigo == codigo.strip().upper().replace("-", "")
        )
    )).scalars().first()

    if not emparejamiento or emparejamiento.expira_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Código no válido o vencido")
    if emparejamiento.pantalla_id:
        raise HTTPException(status_code=409, detail="Ese código ya fue confirmado")

    punto = await _punto_del_guardia(db, usuario)
    if not punto:
        raise HTTPException(
            status_code=400,
            detail="Su cuenta no está asignada a una alcabala. Registre la pantalla desde el panel de Cámaras ANPR.",
        )

    pantalla = PantallaMonitor(
        nombre=(datos.nombre or f"TV {punto.nombre}").strip()[:150],
        punto_acceso_id=punto.id,
        creado_por=usuario.id,
        notas=f"Emparejada desde el teléfono por {usuario.nombre} {usuario.apellido}".strip(),
    )
    db.add(pantalla)
    await db.flush()

    emparejamiento.pantalla_id = pantalla.id
    emparejamiento.confirmado_por = usuario.id
    emparejamiento.confirmado_at = func.now()
    await db.commit()

    return await _recargar_pantalla(db, pantalla.id)


@router.get("/pantallas", response_model=List[PantallaSalida])
async def listar_pantallas(
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    pantallas = (await db.execute(
        select(PantallaMonitor)
        .options(selectinload(PantallaMonitor.punto_acceso))
        .order_by(PantallaMonitor.nombre)
    )).scalars().all()
    return pantallas


async def _recargar_pantalla(db: AsyncSession, pantalla_id: UUID) -> PantallaMonitor:
    return (await db.execute(
        select(PantallaMonitor)
        .options(selectinload(PantallaMonitor.punto_acceso))
        .where(PantallaMonitor.id == pantalla_id)
    )).scalars().one()


def _url_monitor(token: str) -> str:
    """
    URL que se deja como página de inicio del televisor.

    Lleva el token dentro para que la pantalla arranque sola al encenderse: en una
    garita no hay quien teclee credenciales cada vez que se va la luz.
    """
    return f"{config.frontend_url.rstrip('/')}/monitor?t={token}"


@router.post("/pantallas", response_model=PantallaConToken, status_code=status.HTTP_201_CREATED)
async def crear_pantalla(
    datos: PantallaCrear,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    if not await db.get(PuntoAcceso, datos.punto_acceso_id):
        raise HTTPException(status_code=400, detail="Punto de acceso inexistente")

    token = generar_token()
    pantalla = PantallaMonitor(
        **datos.model_dump(),
        token_hash=hashear_token(token),
        token_pista=token[-4:],
        token_generado_at=func.now(),
        creado_por=usuario.id,
    )
    db.add(pantalla)
    await db.commit()
    pantalla = await _recargar_pantalla(db, pantalla.id)

    return PantallaConToken(
        pantalla=PantallaSalida.model_validate(pantalla),
        token=token,
        url_monitor=_url_monitor(token),
    )


@router.patch("/pantallas/{pantalla_id}", response_model=PantallaSalida)
async def editar_pantalla(
    pantalla_id: UUID,
    datos: PantallaEditar,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    pantalla = await db.get(PantallaMonitor, pantalla_id)
    if not pantalla:
        raise HTTPException(status_code=404, detail="Pantalla no encontrada")

    cambios = datos.model_dump(exclude_unset=True)
    if cambios.get("punto_acceso_id") and not await db.get(PuntoAcceso, cambios["punto_acceso_id"]):
        raise HTTPException(status_code=400, detail="Punto de acceso inexistente")

    for campo, valor in cambios.items():
        setattr(pantalla, campo, valor)

    await db.commit()
    return await _recargar_pantalla(db, pantalla.id)


@router.post("/pantallas/{pantalla_id}/rotar-token", response_model=PantallaConToken)
async def rotar_token_pantalla(
    pantalla_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """Token nuevo. El televisor deja de mostrar datos hasta que se le cargue la URL nueva."""
    pantalla = await db.get(PantallaMonitor, pantalla_id)
    if not pantalla:
        raise HTTPException(status_code=404, detail="Pantalla no encontrada")

    token = generar_token()
    pantalla.token_hash = hashear_token(token)
    pantalla.token_pista = token[-4:]
    pantalla.token_generado_at = func.now()
    await db.commit()
    pantalla = await _recargar_pantalla(db, pantalla.id)

    return PantallaConToken(
        pantalla=PantallaSalida.model_validate(pantalla),
        token=token,
        url_monitor=_url_monitor(token),
    )


@router.delete("/pantallas/{pantalla_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_pantalla(
    pantalla_id: UUID,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    pantalla = await db.get(PantallaMonitor, pantalla_id)
    if not pantalla:
        raise HTTPException(status_code=404, detail="Pantalla no encontrada")

    await db.delete(pantalla)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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

    # Sin entidad el destino es "Otro", y entonces el texto libre es obligatorio: un
    # registro que no dice a dónde fue el vehículo no sirve para detectar patrones.
    destino = None
    if datos.destino_entidad_id:
        destino = await db.get(EntidadCivil, datos.destino_entidad_id)
        if not destino or not destino.activo:
            raise HTTPException(status_code=400, detail="Destino inválido")
    elif not (datos.observaciones or "").strip():
        raise HTTPException(status_code=400, detail="Indique el destino")

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
            destino_entidad_id=destino.id if destino else None,
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

    # Se avisa al monitor de la garita para que muestre la confirmación. Sin esto no
    # hay forma de saber desde la pantalla si el toque del guardia llegó a registrarse
    # o se perdió, que es justo la duda que deja el sistema cuando algo va mal.
    try:
        await manager.broadcast(
            {
                "evento": "anpr_resuelto",
                "evento_id": str(evento.id),
                "placa": evento.placa,
                "destino": destino.nombre if destino else (datos.observaciones or "Otro"),
                "registrado_por": f"{usuario.nombre} {usuario.apellido}".strip(),
            },
            channels=[f"PUNTO_{evento.punto_acceso_id}"],
        )
    except Exception as e:
        print(f"[ANPR] No se pudo avisar de la resolución {evento.id}: {e}")

    return _a_salida(evento)


@router.post("/pantalla/tema")
async def cambiar_tema_pantalla(
    tema: str,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ALCABALA,
):
    """
    Cambia el tema del monitor de la garita desde el teléfono del guardia.

    Existe porque el televisor puede estar colgado sin mando ni ratón a mano, y a
    pleno sol el fondo oscuro no se lee. Desde el teléfono siempre se puede.
    """
    if tema not in ("claro", "oscuro"):
        raise HTTPException(status_code=400, detail="Tema inválido")

    punto_id = (await db.execute(
        select(PuntoAcceso.id).where(PuntoAcceso.usuario_id == usuario.id)
    )).scalars().first()
    if not punto_id:
        raise HTTPException(status_code=400, detail="Su cuenta no está asignada a una alcabala")

    await manager.broadcast(
        {"evento": "pantalla_tema", "tema": tema},
        channels=[f"PUNTO_{punto_id}"],
    )
    return {"tema": tema}


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

    # El monitor de la garita tiene que enterarse: la ficha se queda en pantalla
    # hasta que el acceso se resuelve o se descarta, y esto es lo segundo.
    try:
        await manager.broadcast(
            {
                "evento": "anpr_descartado",
                "evento_id": str(evento.id),
                "placa": evento.placa,
            },
            channels=[f"PUNTO_{evento.punto_acceso_id}"],
        )
    except Exception as e:
        print(f"[ANPR] No se pudo avisar del descarte {evento.id}: {e}")

    return _a_salida(evento)


# ──────────────────────────────────────────────────────────────────────────────
# Consulta histórica
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/diagnostico-placa")
async def diagnostico_placa(
    placa: str,
    db: AsyncSession = Depends(obtener_db),
    usuario: Usuario = DEPENDENCY_ADMIN,
):
    """
    Dice en qué tablas aparece una placa y con qué datos.

    Existe porque la información de vehículos vive repartida en tres sitios
    (`vehiculos`, `codigos_qr`, `vehiculos_pase`) y, cuando la alcabala dice que un
    vehículo no está registrado, sin esto no hay forma de saber si el dato falta, si
    está en otra tabla, o si difiere por un guion en la placa.
    """
    from app.models.vehiculo import Vehiculo
    from app.models.vehiculo_pase import VehiculoPase
    from app.models.codigo_qr import CodigoQR
    from app.services.placa_lookup import _placa_sin_separadores

    buscada = normalizar_placa(placa)

    vehiculos = (await db.execute(
        select(Vehiculo).where(_placa_sin_separadores(Vehiculo.placa) == buscada)
    )).scalars().all()

    qrs = (await db.execute(
        select(CodigoQR).where(_placa_sin_separadores(CodigoQR.vehiculo_placa) == buscada)
    )).scalars().all()

    pases = (await db.execute(
        select(VehiculoPase).where(_placa_sin_separadores(VehiculoPase.placa) == buscada)
    )).scalars().all()

    return {
        "placa_buscada": buscada,
        # El mismo veredicto que verá la alcabala, para poder contrastarlo con lo que
        # hay en cada tabla sin tener que reproducir la detección.
        "veredicto": await verificar_placa(db, buscada),
        "vehiculos": [
            {
                "id": str(v.id),
                # Tal cual está guardada: si trae guion o espacio, aquí se ve.
                "placa_guardada": v.placa,
                "activo": v.activo,
                "socio_id": str(v.socio_id) if v.socio_id else None,
                "entidad_id": str(v.entidad_id) if v.entidad_id else None,
                "marca": v.marca,
                "modelo": v.modelo,
            }
            for v in vehiculos
        ],
        "codigos_qr": [
            {
                "id": str(q.id),
                "placa_guardada": q.vehiculo_placa,
                "activo": q.activo,
                "tipo": q.tipo.value if q.tipo else None,
                "nombre_portador": q.nombre_portador,
                "expira": q.fecha_expiracion.isoformat() if q.fecha_expiracion else None,
            }
            for q in qrs
        ],
        "vehiculos_pase": [
            {
                "id": str(vp.id),
                "placa_guardada": vp.placa,
                "ingresado": vp.ingresado,
                "qr_id": str(vp.qr_id) if vp.qr_id else None,
            }
            for vp in pases
        ],
    }


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
