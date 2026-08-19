"""
Ingesta de eventos de las cámaras ANPR de las alcabalas.

La cámara ANPR de Hikvision tiene configurado un "HTTP Listening": cada vez que
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
from app.models.acceso import Acceso
from app.models.alcabala_evento import PuntoAcceso
from app.models.entidad_civil import EntidadCivil
from app.models.infraccion import Infraccion
from app.models.camara_anpr import CamaraAnpr, hashear_token
from app.models.enums import AnprDireccion, AnprEstado, CamaraRol, CamaraSentido, InfraccionEstado
from app.models.evento_anpr import EventoAnpr
from app.services import anpr_diagnostico
from app.services.placa_lookup import (
    verificar_placa, normalizar_placa, semaforo_de, SEMAFORO_ROJO,
)
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


def _resolver_sentido(
    camara: CamaraAnpr, valor_firmware: Optional[str]
) -> Tuple[AnprDireccion, str]:
    """
    ¿Este vehículo está entrando o saliendo? Devuelve (sentido, de dónde salió).

    Manda el sitio donde está atornillada la cámara. Una alcabala tiene la puerta de
    entrada separada de la de salida: ahí no hay nada que deducir, y confiar en el
    firmware sería peor, porque el campo `direction` depende de la versión y de cómo
    esté trazada la zona de detección — cosas que cambian cuando alguien entra al NVR a
    tocar una configuración.

    Solo cuando la cámara vigila un carril compartido (`mixto`) se recurre a lo que
    diga el equipo. Y si tampoco lo dice, queda `desconocida`: preferimos que se note a
    inventarnos un sentido, porque de esto depende saber quién está dentro de la base.
    """
    if camara.sentido == CamaraSentido.entrada:
        return AnprDireccion.entrada, "camara"
    if camara.sentido == CamaraSentido.salida:
        return AnprDireccion.salida, "camara"

    del_firmware = _parsear_direccion(valor_firmware)
    if del_firmware != AnprDireccion.desconocida:
        return del_firmware, "firmware"
    return AnprDireccion.desconocida, "sin_dato"


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

    **Una sola imagen sin nombre es la escena, nunca el recorte.** Antes se asignaba al
    recorte por ser la más pequeña de la lista, y con una lista de uno eso significaba
    siempre. El caso se da justo cuando la cámara no consigue leer la placa: entonces no
    hay recorte que mandar y sube solo la panorámica. El resultado era una tarjeta con la
    foto del vehículo metida en la miniatura de la placa y el hueco principal vacío,
    diciendo "sin foto" cuando la foto había llegado perfectamente.

    La regla vale también al revés: si de verdad solo llegara el recorte, mostrarlo en
    grande es peor que aceptable —se ve la placa—, mientras que perder la panorámica en
    una miniatura de 28px deja al Comandante sin lo único que identifica al vehículo.
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
        # La más grande es la escena; solo lo que sobra por debajo puede ser el recorte.
        if foto_escena is None:
            foto_escena = sin_nombre.pop()
        if foto_placa is None and sin_nombre:
            foto_placa = sin_nombre[0]

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


def _misma_placa(a: Optional[str], b: Optional[str]) -> bool:
    """
    ¿Son la misma placa, admitiendo un carácter de diferencia?

    Las dos cámaras de la alcabala leen el mismo vehículo con luz y ángulo distintos, y
    confundir un 5 con una S, un 0 con una O o un 1 con una I es lo corriente. Exigir
    igualdad exacta hacía que el mismo carro apareciera como dos tarjetas y se
    registrara dos veces.

    Se exige la MISMA longitud: una placa a la que le falta un carácter es una lectura
    incompleta, y darla por buena contra otra placa real es peor que no fusionar. Y se
    admite un solo carácter: a dos de distancia existen placas legítimamente distintas
    en la base.
    """
    if not a or not b:
        return False
    if a == b:
        return True
    if len(a) != len(b):
        return False
    return sum(1 for x, y in zip(a, b) if x != y) == 1


def _es_el_otro_extremo(rol_previo: Optional[str], rol_nuevo: Optional[str]) -> bool:
    """
    ¿Las dos lecturas vienen de las cámaras que miran extremos opuestos del vehículo?

    Solo entre ellas tiene sentido perdonar un carácter de diferencia: es el mismo paso
    visto desde delante y desde detrás. Entre dos disparos de la misma cámara, o cuando
    los roles no están configurados (`unica`), una placa distinta se toma por lo que
    parece — otro vehículo.
    """
    pareja = {CamaraRol.delantera.value, CamaraRol.trasera.value}
    return rol_previo in pareja and rol_nuevo in pareja and rol_previo != rol_nuevo


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

    async def _buscar_gemelo(
        self, db: AsyncSession, punto_id, placa: str, rol: Optional[str]
    ) -> Optional[EventoAnpr]:
        """
        La detección viva que corresponde al mismo vehículo, si la hay.

        Cubre dos cosas que parecen una sola:

          - El disparo repetido. La cámara usa LPR multi-cuadro y emite varios eventos
            por paso; sin esto un solo vehículo le llenaría la pantalla al guardia.
          - La OTRA cámara del par. En cada alcabala hay dos mirando el mismo paso, una
            a la placa delantera y otra a la trasera, así que cada vehículo llega dos
            veces (una moto, que lleva una sola placa, llega una sola vez).

        Por igualdad exacta siempre. Y además se admite **un carácter de diferencia**,
        pero SOLO entre lecturas de roles distintos: las dos cámaras ven la misma placa
        con luz y ángulo distintos y confundir un 5 con una S o un 1 con una I es lo
        corriente, así que exigirles igualdad dejaba al guardia con dos tarjetas del
        mismo carro.

        Esa tolerancia no se aplica entre lecturas del MISMO rol, ni cuando los roles no
        están configurados. El motivo es que "AV641" y "AV645" pueden ser dos vehículos
        de verdad: sin la señal de que vienen de cámaras que miran extremos opuestos del
        mismo paso, fusionarlas sería borrar el registro de uno de los dos.
        """
        ventana = datetime.now(timezone.utc) - timedelta(seconds=config.anpr_dedupe_segundos)

        # Se traen los candidatos del punto en la ventana y se comparan en Python: son
        # unos pocos —lo que quepa en 30 segundos de fila— y la distancia de edición no
        # se puede indexar de todos modos.
        candidatos = (await db.execute(
            select(EventoAnpr).where(
                EventoAnpr.punto_acceso_id == punto_id,
                EventoAnpr.timestamp_recibido >= ventana,
                EventoAnpr.estado != AnprEstado.duplicado,
            ).order_by(EventoAnpr.timestamp_recibido.desc()).limit(20)
        )).scalars().all()

        for previo in candidatos:
            if previo.placa == placa or previo.placa_alterna == placa:
                return previo

            if not _es_el_otro_extremo(previo.camara_rol, rol):
                continue
            # Un evento que ya tiene su pareja no absorbe una tercera lectura distinta:
            # a esas alturas lo que está pasando es que viene otro vehículo detrás.
            if previo.confirmada_por_rol:
                continue
            if _misma_placa(previo.placa, placa):
                return previo

        return None

    def _fusionar_lectura(
        self,
        gemelo: EventoAnpr,
        placa: str,
        confianza: Optional[int],
        rol: Optional[str],
    ) -> None:
        """
        Incorpora al evento vivo lo que aportó la segunda cámara.

        Si las dos leyeron lo mismo, la segunda lectura solo confirma. Si difieren, se
        queda como principal la de MAYOR confianza y la otra pasa a `placa_alterna`,
        para que el guardia pueda cambiarla de un toque en vez de teclear la placa
        entera con un conductor esperando.
        """
        if rol:
            gemelo.confirmada_por_rol = rol
        gemelo.confirmada_at = datetime.now(timezone.utc)

        if placa == gemelo.placa:
            # Dos cámaras coinciden: la lectura vale más de lo que dice cada una sola.
            if confianza is not None:
                gemelo.placa_confianza = max(gemelo.placa_confianza or 0, confianza)
            return

        nueva_gana = (confianza or 0) > (gemelo.placa_confianza or 0)
        if nueva_gana:
            gemelo.placa_alterna = gemelo.placa
            gemelo.placa = placa
            gemelo.placa_confianza = confianza
        else:
            gemelo.placa_alterna = placa

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
            # Se anota con las etiquetas que sí traía el XML, porque son las que separan
            # los casos que desde fuera parecen el mismo. Si la lista viene llena, la
            # cámara está enviando bien y lo que falla es el nombre del campo de la placa;
            # si viene vacía, lo que llegó no era XML siquiera.
            #
            # Aparte va el evento que NO pretendía ser una lectura. El Socket de escucha
            # ISAPI tiene un "intervalo entre latidos": con eso activado la cámara postea
            # cada pocos segundos para avisar de que sigue viva, y también manda por aquí
            # sus otros eventos armados. Ninguno trae placa, pero llamarlos error de
            # formato sería mentir — y a razón de un latido cada pocos segundos llenarían
            # la lista y taparían los fallos de verdad.
            tipo_evento = datos.get("eventType") or ""
            es_otro_evento = bool(xml) and tipo_evento.lower() not in ("", "anpr")

            anpr_diagnostico.registrar_rechazo(
                anpr_diagnostico.OTRO_EVENTO if es_otro_evento else anpr_diagnostico.SIN_PLACA,
                content_type=content_type,
                tamano=len(cuerpo),
                camara_nombre=camara.nombre,
                detalle=(
                    f"La cámara alcanza el servidor y mandó un evento de tipo "
                    f"'{tipo_evento}', que no es una lectura de placa. Si son latidos, "
                    f"ponga el intervalo en 0: no aportan nada aquí y tapan los fallos "
                    f"reales."
                    if es_otro_evento else
                    "Llegó un evento sin placa: se encontró XML pero ninguna etiqueta "
                    "licensePlate ni plateNumber."
                    if xml else
                    "Llegó un POST que no traía XML. Revise el formato de subida en la "
                    "cámara: aquí se espera el Socket de escucha ISAPI con notificación "
                    "XML, no un envío de solo imagen."
                ),
                cuerpo=cuerpo if not imagenes else (xml or cuerpo),
                etiquetas=sorted(datos.keys()),
            )
            print(f"[ANPR] {camara.nombre}: evento sin placa legible; se descarta.")
            return None

        confianza = _entero(datos.get("confidenceLevel"))
        rol = camara.rol.value if camara.rol else None
        sentido, sentido_origen = _resolver_sentido(camara, datos.get("direction"))

        # ¿Ya hay una detección viva de este mismo vehículo? Puede venir de un disparo
        # repetido de esta cámara o de la otra del par (delantera/trasera).
        gemelo = await self._buscar_gemelo(db, punto.id, placa, rol)
        duplicado = gemelo is not None

        if gemelo is not None:
            # Lo que aporta esta segunda lectura se incorpora a la detección que el
            # guardia ya tiene en pantalla, en vez de abrirle otra tarjeta.
            placa_antes = gemelo.placa
            self._fusionar_lectura(gemelo, placa, confianza, rol)

            # Si la lectura de esta cámara desbancó a la anterior por tener más
            # confianza, el veredicto guardado era el de la placa peor leída. Se
            # recalcula: dejarlo sería mostrarle al guardia el semáforo de otro carro.
            if gemelo.placa != placa_antes:
                nuevo = await verificar_placa(db, gemelo.placa)
                gemelo.coincidencia = nuevo.get("coincidencia")

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
            camara_rol=rol,
            placa=placa,
            placa_confianza=confianza,
            pais_placa=datos.get("country"),
            direccion=sentido,
            sentido_origen=sentido_origen,
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
            ficha = None
            try:
                ficha = await self.construir_ficha(db, evento, veredicto)
            except Exception as e:
                # El monitor se queda sin los datos extra, pero la tarjeta del guardia
                # tiene que llegar igual: es la que desatasca la fila.
                print(f"[ANPR] No se pudo construir la ficha de {evento.id}: {e}")
            await self._notificar(evento, punto, veredicto, ficha)
        else:
            # La segunda cámara no abre tarjeta nueva, pero sí puede haber cambiado la
            # que el guardia tiene delante: otra placa por mayor confianza, o el aviso
            # de que las dos lecturas no coinciden. Sin este aviso, la pantalla seguiría
            # mostrando la primera lectura como si nada hubiera pasado.
            await db.refresh(gemelo)
            try:
                await self._notificar_actualizacion(db, gemelo, punto)
            except Exception as e:
                print(f"[ANPR] No se pudo avisar de la fusión de {gemelo.id}: {e}")

        return evento

    # ──────────────────────────────────────────────────────────────────────────
    # Ficha para el monitor de la alcabala
    # ──────────────────────────────────────────────────────────────────────────

    async def _destinos_recientes(self, db: AsyncSession, placa: str, limite: int = 3) -> List[Dict[str, Any]]:
        """
        A dónde ha ido antes este vehículo.

        Es el dato que convierte el monitor en algo útil de verdad: un vehículo que
        siempre va al club de pádel y hoy declara otra cosa es justo el patrón que
        este sistema existe para hacer visible.
        """
        filas = (await db.execute(
            select(Acceso.timestamp, EntidadCivil.nombre, Acceso.observaciones)
            .outerjoin(EntidadCivil, Acceso.destino_entidad_id == EntidadCivil.id)
            .where(
                Acceso.vehiculo_placa == placa,
                # Los accesos sin destino no cuentan como visita: no dicen a dónde fue.
                (Acceso.destino_entidad_id.isnot(None)) | (Acceso.observaciones.isnot(None)),
            )
            .order_by(Acceso.timestamp.desc())
            .limit(limite)
        )).all()

        return [
            {
                # Sin entidad, el destino es el texto libre que escribió el guardia.
                "destino": f.nombre or (f.observaciones or "Otro"),
                "detalle": f.observaciones if f.nombre else None,
                "fecha": f.timestamp,
            }
            for f in filas
        ]

    async def _infracciones_activas(self, db: AsyncSession, vehiculo_id: Optional[str]) -> List[Dict[str, Any]]:
        """Infracciones sin resolver del vehículo. Vacía si la placa no está registrada."""
        if not vehiculo_id:
            return []

        filas = (await db.execute(
            select(Infraccion)
            .where(
                Infraccion.vehiculo_id == uuid.UUID(str(vehiculo_id)),
                Infraccion.estado == InfraccionEstado.activa,
            )
            .order_by(Infraccion.created_at.desc())
            .limit(5)
        )).scalars().all()

        return [
            {
                "tipo": i.tipo.value if i.tipo else None,
                "gravedad": i.gravedad.value if i.gravedad else None,
                "descripcion": i.descripcion,
                "bloquea_salida": i.bloquea_salida,
                "fecha": i.created_at,
            }
            for i in filas
        ]

    async def construir_ficha(
        self,
        db: AsyncSession,
        evento: EventoAnpr,
        veredicto: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Todo lo que el monitor de la alcabala muestra de una detección.

        Se recalcula el veredicto cuando no viene dado (caso de las detecciones que se
        recuperan al cargar la pantalla) en vez de leer el `coincidencia` guardado:
        para el monitor interesa la situación de ahora, no la de hace media hora.
        """
        if veredicto is None:
            veredicto = await verificar_placa(db, evento.placa)

        base = f"{config.backend_url_base}/api/v1/anpr/evento/{evento.id}/foto"

        infracciones = await self._infracciones_activas(db, veredicto.get("vehiculo_id"))

        # Una infracción que bloquea manda sobre el veredicto de la placa: un socio
        # con la membresía al día pero con una sanción activa no debe salir en verde.
        semaforo = veredicto.get("semaforo") or semaforo_de(veredicto.get("coincidencia"))
        if any(i["bloquea_salida"] for i in infracciones):
            semaforo = SEMAFORO_ROJO

        return {
            "evento_id": str(evento.id),
            "placa": evento.placa,
            "direccion": evento.direccion.value if evento.direccion else None,
            # De dónde salió ese sentido. La pantalla lo usa para saber si presentarlo
            # como un hecho (lo fija la puerta) o como una propuesta que el guardia
            # debería confirmar (carril compartido).
            "sentido_origen": evento.sentido_origen,
            "timestamp": evento.timestamp_recibido,
            "estado": evento.estado.value if evento.estado else None,
            "semaforo": semaforo,
            "vehiculo": {
                # Si la placa está registrada, mandan los datos del sistema sobre lo
                # que clasificó la cámara: "saloonCar · white" es una etiqueta
                # genérica en inglés y casi siempre la misma, mientras que el registro
                # tiene la marca, el modelo y el color reales del vehículo.
                "tipo": veredicto.get("vehiculo_modelo") or evento.tipo_vehiculo,
                "color": veredicto.get("vehiculo_color") or evento.color_vehiculo,
                "marca": veredicto.get("vehiculo_marca") or evento.marca_vehiculo,
                "foto_placa_url": f"{base}/placa" if evento.foto_placa_path else None,
                "foto_escena_url": f"{base}/escena" if evento.foto_escena_path else None,
                # `uso` decide si tiene sentido pedirle la identificación al
                # conductor: los de servicio y protocolares los maneja gente distinta
                # cada día, así que asociarles una persona sería falsear el dato.
                "uso": veredicto.get("vehiculo_uso"),
                "registrado": bool(veredicto.get("vehiculo_id")),
                "vehiculo_id": veredicto.get("vehiculo_id"),
            },
            "persona": {
                "nombre": veredicto.get("nombre_portador"),
                "coincidencia": veredicto.get("coincidencia"),
                "tipo_pase": veredicto.get("tipo_pase"),
                "tipo_pase_color": veredicto.get("tipo_pase_color"),
                "mensaje": veredicto.get("mensaje"),
                "alerta": veredicto.get("alerta"),
            },
            "destinos_recientes": await self._destinos_recientes(db, evento.placa),
            "infracciones": infracciones,
            # Qué vieron las dos cámaras del par. El guardia necesita saber cuándo la
            # placa que tiene delante es segura y cuándo conviene mirarla dos veces.
            "lectura": {
                "rol": evento.camara_rol,
                "confirmada_por": evento.confirmada_por_rol,
                # Las dos cámaras leyeron y no coincidieron: se muestra la de más
                # confianza y esta es la otra, para corregir de un toque.
                "alterna": evento.placa_alterna,
                "dudosa": bool(evento.placa_alterna),
                # Solo una cámara vio el vehículo. Puede ser una moto —lleva una sola
                # placa— o una placa tapada, o una cámara que dejó de leer.
                "una_sola_camara": evento.confirmada_por_rol is None,
                "confianza": evento.placa_confianza,
            },
        }

    async def _notificar_actualizacion(
        self, db: AsyncSession, evento: EventoAnpr, punto: PuntoAcceso
    ) -> None:
        """
        Avisa de que una detección YA en pantalla cambió al llegar la otra lectura.

        No es una detección nueva: el guardia tiene esa tarjeta delante y lo que cambia
        es la placa —si la segunda cámara leyó con más confianza— o el aviso de que las
        dos lecturas no coinciden. Va como evento propio para que la pantalla lo
        sustituya en el sitio en vez de apilar otra tarjeta.
        """
        ficha = None
        try:
            ficha = await self.construir_ficha(db, evento)
        except Exception as e:
            # El aviso viaja igual con lo mínimo: la placa corregida importa más que
            # los datos de adorno, y la pantalla se recompone al recargar.
            print(f"[ANPR] No se pudo reconstruir la ficha fusionada {evento.id}: {e}")

        await manager.broadcast(
            {
                "evento": "anpr_actualizado",
                "ficha": ficha,
                "evento_id": str(evento.id),
                "placa": evento.placa,
                "placa_alterna": evento.placa_alterna,
                "confirmada_por_rol": evento.confirmada_por_rol,
            },
            channels=[f"PUNTO_{punto.id}"],
            roles=["COMANDANTE"],
        )

    async def _notificar(
        self,
        evento: EventoAnpr,
        punto: PuntoAcceso,
        veredicto: Dict[str, Any],
        ficha: Optional[Dict[str, Any]] = None,
    ) -> None:
        try:
            await manager.broadcast(
                {
                    "evento": "anpr_deteccion",
                    # El telefono del guardia usa los campos sueltos; el monitor de la
                    # alcabala usa la ficha. Van en el mismo mensaje para que ambas
                    # pantallas se enteren a la vez y no se contradigan.
                    "ficha": ficha,
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
                    "semaforo": veredicto.get("semaforo"),
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
