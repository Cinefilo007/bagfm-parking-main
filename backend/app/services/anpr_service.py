"""
Ingesta de eventos de las cámaras ANPR de las alcabalas.

La cámara (Hikvision DS-TCG406-E) tiene configurado un "HTTP Listening": cada vez que
reconoce una placa hace un POST a nuestro endpoint con el evento y las fotos. Nosotros
no le preguntamos nada a ella; el flujo entero es de entrada.

El formato que manda no es uno solo. Según firmware y según si hay fotos, llega como
`multipart/form-data`, como `multipart/mixed` o como XML pelado, y los nombres de las
partes cambian. Por eso el parseo de aquí es deliberadamente tolerante: busca los datos
que necesita donde estén, en vez de exigir una estructura exacta que el próximo
firmware rompería.
"""
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import obtener_config
from app.core.notify_manager import manager
from app.models.alcabala_evento import PuntoAcceso
from app.models.camara_anpr import CamaraAnpr, hashear_token
from app.models.enums import AnprDireccion, AnprEstado
from app.models.evento_anpr import EventoAnpr
from app.services.placa_lookup import verificar_placa, normalizar_placa
from app.services.storage_local import almacenamiento_privado, PREFIJO_ARCHIVO

config = obtener_config()


# ──────────────────────────────────────────────────────────────────────────────
# Parseo del cuerpo que manda la cámara
# ──────────────────────────────────────────────────────────────────────────────

def _partes_multipart(cuerpo: bytes, boundary: str) -> List[Tuple[Dict[str, str], bytes]]:
    """
    Parte un cuerpo multipart en (cabeceras, contenido).

    Se hace a mano en vez de usar el parser de Starlette porque las cámaras omiten con
    frecuencia el atributo `name` del Content-Disposition, y sin él `request.form()`
    descarta la parte en silencio — justo la que trae la foto de la placa.
    """
    sep = b"--" + boundary.encode("latin-1")
    partes = []
    for bloque in cuerpo.split(sep):
        # Quitar el salto que cierra la línea del boundary. Se quita UNO solo: el
        # siguiente, si lo hay, es la línea en blanco que separa cabeceras de cuerpo,
        # y es justo la que indica que la parte no trae cabeceras.
        if bloque.startswith(b"\r\n"):
            bloque = bloque[2:]
        elif bloque.startswith(b"\n"):
            bloque = bloque[1:]

        # Preámbulo vacío y marcador final ('--').
        if not bloque or bloque[:2] == b"--":
            continue

        if bloque.startswith(b"\r\n") or bloque.startswith(b"\n"):
            # Parte sin cabeceras: hay firmwares que omiten hasta el Content-Type.
            crudo_cabeceras = b""
            contenido = bloque[2:] if bloque.startswith(b"\r\n") else bloque[1:]
        else:
            corte = bloque.find(b"\r\n\r\n")
            salto = 4
            if corte < 0:
                corte = bloque.find(b"\n\n")
                salto = 2
            if corte < 0:
                continue
            crudo_cabeceras, contenido = bloque[:corte], bloque[corte + salto:]

        cabeceras = {}
        for linea in crudo_cabeceras.decode("latin-1", "replace").splitlines():
            if ":" in linea:
                k, v = linea.split(":", 1)
                cabeceras[k.strip().lower()] = v.strip()
        partes.append((cabeceras, contenido.rstrip(b"\r\n")))
    return partes


def _es_xml(cabeceras: Dict[str, str], contenido: bytes) -> bool:
    tipo = cabeceras.get("content-type", "").lower()
    if "xml" in tipo:
        return True
    return contenido.lstrip()[:1] == b"<"


def _es_imagen(cabeceras: Dict[str, str], contenido: bytes) -> bool:
    tipo = cabeceras.get("content-type", "").lower()
    if tipo.startswith("image/"):
        return True
    # JPEG empieza siempre con FF D8 FF; sirve cuando la cámara no declara el tipo.
    return contenido[:3] == b"\xff\xd8\xff"


def separar_cuerpo(content_type: str, cuerpo: bytes) -> Tuple[Optional[bytes], List[Tuple[str, bytes]]]:
    """
    Devuelve (xml, [(nombre, bytes_imagen), ...]).

    `nombre` es lo que la cámara haya puesto en el Content-Disposition; se usa solo
    para distinguir la foto de la placa de la foto de escena, y si no viene se decide
    por tamaño (ver `_clasificar_fotos`).
    """
    tipo = (content_type or "").lower()

    m = re.search(r'boundary="?([^";]+)"?', content_type or "")
    if "multipart" in tipo and m:
        xml = None
        imagenes = []
        for cabeceras, contenido in _partes_multipart(cuerpo, m.group(1)):
            if not contenido:
                continue
            if xml is None and _es_xml(cabeceras, contenido):
                xml = contenido
            elif _es_imagen(cabeceras, contenido):
                disp = cabeceras.get("content-disposition", "")
                nm = re.search(r'name="?([^";]+)"?', disp)
                imagenes.append((nm.group(1) if nm else "", contenido))
        return xml, imagenes

    # Sin fotos: algunos firmwares postean el XML directo.
    if cuerpo.lstrip()[:1] == b"<":
        return cuerpo, []

    return None, []


def _sin_namespace(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _aplanar(elemento) -> Dict[str, str]:
    """Aplana un subárbol a {etiqueta_sin_namespace: primer_texto_no_vacío}."""
    plano: Dict[str, str] = {}
    for hijo in elemento.iter():
        clave = _sin_namespace(hijo.tag)
        texto = (hijo.text or "").strip()
        if texto and clave not in plano:
            plano[clave] = texto
    return plano


def _aplanar_xml(xml: bytes) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Devuelve (evento_completo, bloque_vehicleInfo), ambos aplanados.

    Se separan porque Hikvision repite nombres de etiqueta en distintos niveles con
    significados distintos: `vehicleType` cuelga tanto de `ANPR` (donde vale un
    genérico "vehicle") como de `vehicleInfo` (donde trae la clase real, "saloonCar").
    Aplanar todo junto se quedaría con el primero, que es el inútil. Y `color` dentro
    de `vehicleInfo` es el color del vehículo, mientras que `plateColor` en el nivel
    de arriba es el de la matrícula: confundirlos llenaría la base de colores falsos.
    """
    try:
        raiz = ElementTree.fromstring(xml)
    except ElementTree.ParseError:
        return {}, {}

    vehiculo: Dict[str, str] = {}
    for elemento in raiz.iter():
        if _sin_namespace(elemento.tag) == "vehicleInfo":
            vehiculo = _aplanar(elemento)
            break

    return _aplanar(raiz), vehiculo


def _texto_descriptivo(valor: Optional[str]) -> Optional[str]:
    """
    Descarta los valores que son códigos numéricos en vez de descripciones.

    La marca llega en `vehicleLogoRecog` como un índice de la tabla de fabricantes de
    Hikvision ("12"), no como texto. Guardar ese número en `marca_vehiculo` sería
    guardar basura: parece un dato y no lo es. Se deja vacío a propósito — el XML
    completo queda en `payload_raw`, así que cuando se levante la tabla de códigos
    contra una cámara real se puede rellenar hacia atrás sin haber perdido nada.
    """
    if not valor:
        return None
    valor = valor.strip()
    return None if not valor or valor.isdigit() else valor


_DIRECCIONES = {
    "forward": AnprDireccion.entrada,
    "in": AnprDireccion.entrada,
    "entrance": AnprDireccion.entrada,
    "reverse": AnprDireccion.salida,
    "out": AnprDireccion.salida,
    "exit": AnprDireccion.salida,
}


def _parsear_direccion(valor: Optional[str]) -> AnprDireccion:
    return _DIRECCIONES.get((valor or "").strip().lower(), AnprDireccion.desconocida)


def _parsear_fecha(valor: Optional[str]) -> Optional[datetime]:
    """Lee el dateTime ISO-8601 de la cámara. Devuelve None si no es interpretable."""
    if not valor:
        return None
    texto = valor.strip().replace("Z", "+00:00")
    try:
        fecha = datetime.fromisoformat(texto)
    except ValueError:
        return None
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def _entero(valor: Optional[str]) -> Optional[int]:
    try:
        return int(str(valor).strip())
    except (TypeError, ValueError):
        return None


def _clasificar_fotos(imagenes: List[Tuple[str, bytes]]) -> Tuple[Optional[bytes], Optional[bytes]]:
    """
    Separa el recorte de la placa de la foto de escena.

    Si la cámara nombra las partes, se respeta el nombre. Si no —que es lo habitual—
    se usa el tamaño: el recorte de la matrícula siempre pesa bastante menos que la
    foto completa del vehículo.
    """
    if not imagenes:
        return None, None

    foto_placa = foto_escena = None
    sin_nombre = []
    for nombre, contenido in imagenes:
        n = nombre.lower()
        if "licenseplate" in n or "plate" in n:
            foto_placa = foto_placa or contenido
        elif "detection" in n or "scene" in n or "vehicle" in n or "background" in n:
            foto_escena = foto_escena or contenido
        else:
            sin_nombre.append(contenido)

    if sin_nombre:
        sin_nombre.sort(key=len)
        if foto_placa is None:
            foto_placa = sin_nombre.pop(0)
        if foto_escena is None and sin_nombre:
            foto_escena = sin_nombre[-1]

    return foto_placa, foto_escena


def _guardar_foto(contenido: Optional[bytes], subcarpeta: str) -> Optional[str]:
    """Guarda en el volumen privado y devuelve la referencia 'file:<ruta>'."""
    if not contenido:
        return None
    ahora = datetime.now(timezone.utc)
    ruta = f"anpr/{subcarpeta}/{ahora:%Y/%m/%d}/{uuid.uuid4()}.jpg"
    try:
        almacenamiento_privado.guardar(contenido, ruta)
    except (OSError, ValueError) as e:
        print(f"[ANPR] No se pudo guardar la foto {ruta}: {e}")
        return None
    return f"{PREFIJO_ARCHIVO}{ruta}"


# ──────────────────────────────────────────────────────────────────────────────
# Servicio
# ──────────────────────────────────────────────────────────────────────────────

class AnprService:

    async def autenticar_camara(self, db: AsyncSession, token: str) -> Optional[CamaraAnpr]:
        """
        Identifica la cámara a partir del token que trae la URL.

        El token no solo autentica: también dice de qué alcabala viene el evento, así
        que la URL de la cámara no necesita llevar el punto de acceso aparte. Una cosa
        menos que teclear mal en la garita.

        La búsqueda es por hash, nunca por el token en claro, porque en la base solo
        está el hash. Ver app/models/camara_anpr.py.
        """
        if not token:
            return None

        camara = (await db.execute(
            select(CamaraAnpr)
            .where(CamaraAnpr.token_hash == hashear_token(token))
        )).scalars().first()

        if not camara or not camara.activa:
            return None
        return camara

    async def _es_duplicado(self, db: AsyncSession, punto_id, placa: str) -> bool:
        """
        ¿Es un disparo repetido del mismo vehículo?

        La cámara usa LPR multi-cuadro y emite varios eventos por paso. Sin esto, un
        solo vehículo le llenaría la pantalla al guardia con cuatro tarjetas iguales.
        """
        ventana = datetime.now(timezone.utc) - timedelta(seconds=config.anpr_dedupe_segundos)
        previo = (await db.execute(
            select(EventoAnpr.id).where(
                EventoAnpr.punto_acceso_id == punto_id,
                EventoAnpr.placa == placa,
                EventoAnpr.timestamp_recibido >= ventana,
                EventoAnpr.estado != AnprEstado.duplicado,
            ).limit(1)
        )).scalars().first()
        return previo is not None

    async def registrar_evento(
        self,
        db: AsyncSession,
        camara: CamaraAnpr,
        punto: PuntoAcceso,
        content_type: str,
        cuerpo: bytes,
    ) -> Optional[EventoAnpr]:
        """
        Procesa un POST de la cámara de punta a punta y devuelve el evento creado.

        Devuelve None cuando el cuerpo no traía una placa legible: eso no es un error
        del que haya que avisar a la cámara —seguiría reintentando— sino un evento que
        simplemente no aporta nada.
        """
        xml, imagenes = separar_cuerpo(content_type, cuerpo)
        datos, vehiculo = _aplanar_xml(xml) if xml else ({}, {})

        placa = normalizar_placa(datos.get("licensePlate") or datos.get("plateNumber"))
        if not placa:
            print("[ANPR] Evento sin placa legible; se descarta.")
            return None

        duplicado = await self._es_duplicado(db, punto.id, placa)

        # En un duplicado no se guardan las fotos: son del mismo vehículo que ya se
        # fotografió hace segundos y multiplicarían el disco sin aportar nada.
        if duplicado:
            foto_placa_path = foto_escena_path = None
            veredicto: Dict[str, Any] = {}
        else:
            bytes_placa, bytes_escena = _clasificar_fotos(imagenes)
            foto_placa_path = _guardar_foto(bytes_placa, "placa")
            foto_escena_path = _guardar_foto(bytes_escena, "escena")
            veredicto = await verificar_placa(db, placa)

        evento = EventoAnpr(
            punto_acceso_id=punto.id,
            camara_id=camara.id,
            camara_serial=datos.get("serialNumber") or datos.get("macAddress"),
            canal=_entero(datos.get("channelID")),
            placa=placa,
            placa_confianza=_entero(datos.get("confidenceLevel")),
            pais_placa=datos.get("country"),
            direccion=_parsear_direccion(datos.get("direction")),
            # Se prefiere siempre el bloque vehicleInfo: es el que trae la clase real
            # del vehículo y su color, no los genéricos del nivel de arriba.
            tipo_vehiculo=vehiculo.get("vehicleType") or datos.get("vehicleType"),
            color_vehiculo=_texto_descriptivo(vehiculo.get("color") or datos.get("vehicleColor")),
            marca_vehiculo=_texto_descriptivo(
                vehiculo.get("vehicleBrand")
                or vehiculo.get("vehicleLogoRecog")
                or datos.get("vehicleBrand")
            ),
            foto_placa_path=foto_placa_path,
            foto_escena_path=foto_escena_path,
            timestamp_camara=_parsear_fecha(datos.get("dateTime")),
            coincidencia=veredicto.get("coincidencia"),
            estado=AnprEstado.duplicado if duplicado else AnprEstado.pendiente,
            payload_raw=xml.decode("utf-8", "replace") if xml else None,
        )
        db.add(evento)

        # Señal de vida de la cámara. Como la comunicación es de una sola dirección y
        # el servidor nunca le pregunta nada, esto es lo único que permite que el panel
        # distinga una cámara viva de una desconectada. Se cuentan también los
        # duplicados: para "¿está transmitiendo?" un duplicado vale igual.
        camara.ultimo_evento_at = datetime.now(timezone.utc)
        camara.total_eventos = (camara.total_eventos or 0) + 1

        await db.commit()
        await db.refresh(evento)

        if not duplicado:
            # Igual que en acceso_service, la notificación va después del commit: si
            # el WebSocket falla, la detección ya está guardada y no se pierde.
            await self._notificar(evento, punto, veredicto)

        return evento

    async def _notificar(self, evento: EventoAnpr, punto: PuntoAcceso, veredicto: Dict[str, Any]) -> None:
        try:
            await manager.broadcast(
                {
                    "evento": "anpr_deteccion",
                    "evento_id": str(evento.id),
                    "punto_acceso_id": str(punto.id),
                    "punto_nombre": punto.nombre,
                    "placa": evento.placa,
                    "direccion": evento.direccion.value,
                    "tipo_vehiculo": evento.tipo_vehiculo,
                    "color_vehiculo": evento.color_vehiculo,
                    "marca_vehiculo": evento.marca_vehiculo,
                    "timestamp": evento.timestamp_recibido,
                    "coincidencia": veredicto.get("coincidencia"),
                    "mensaje": veredicto.get("mensaje"),
                    "alerta": veredicto.get("alerta"),
                    "tipo_pase": veredicto.get("tipo_pase"),
                    "tipo_pase_color": veredicto.get("tipo_pase_color"),
                    "nombre_portador": veredicto.get("nombre_portador"),
                },
                channels=[f"PUNTO_{punto.id}"],
                roles=["COMANDANTE"],
            )
        except Exception as e:
            print(f"[ANPR] Fallo al notificar la detección {evento.id}: {e}")


anpr_service = AnprService()
