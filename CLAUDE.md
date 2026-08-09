# BAGFM — Control de acceso Base Aérea La Carlota

## Qué es esto

Control de acceso vehicular de una base aérea que **no es solo militar**: dentro operan
entidades civiles (club de pádel, club de fútbol, pizzería, parque) cuyos visitantes no
se pueden filtrar ni negar, y muchas dependen de cargos altos. Por eso no existía un
protocolo de acceso viable.

El sistema nació alrededor del **QR** (socios y pases masivos, cargables por Excel). En
agosto de 2026 se instalaron **cámaras ANPR** en las dos alcabalas y el eje pasó a ser la
lectura automática de placas.

**El objetivo de la Fase 1 NO es restringir el acceso.** Es alimentar la base de datos y
detectar patrones sin frenar la fila. Todo vehículo que entra queda registrado con lo que
la cámara ve sola; el guardia solo agrega el destino con un toque.

## Despliegue

- Backend y frontend en **VPS propio con Coolify** (ya no Railway, aunque quedan
  artefactos: `railway.json`, `docs/RAILWAY_STABILITY.md`, CORS por defecto en
  `backend/app/core/config.py`).
- API: `https://api.bagfm.app` · Frontend: `https://bagfm.app`
- `backend/entrypoint.sh` corre `alembic upgrade head` en cada arranque: **desplegar
  aplica las migraciones**. Si una migración falla, el contenedor no arranca y Coolify
  mantiene el anterior.
- La base **no es accesible desde fuera** del VPS. Para probar SQL hay un Postgres local
  en Docker (`backend-postgres-1`, usuario y base `cinefilos`).

## Hardware real (verificado contra datasheets y fotos)

| Equipo | Rol |
|---|---|
| 5 bullets **"ANPR Camera"** de Hikvision | Las que leen placas. **NO son la DS-TCG406-E** del PDF: son bullets DeepinView. Modelo exacto **pendiente de confirmar**. Reparto: ver abajo. |

**Cómo están repartidas las cámaras** (decide todo el flujo de entradas y salidas):

| Alcabala | Puerta | Cámaras |
|---|---|---|
| La de puertas separadas | Entrada | 2: placa delantera + placa trasera |
| La de puertas separadas | Salida | 1, apuntando al **frente** — ver el aviso de abajo |
| La de puerta única | Carril compartido | 2: delantera + trasera, para ambos sentidos |

> **Pendiente en la garita:** la cámara de la puerta de salida mira al frente del
> vehículo, y en Venezuela las motos llevan una sola placa y va **atrás**. Tal como
> está, ninguna moto queda registrada al salir. Se arregla girándola o pasándola al
> otro lado para que vea el vehículo alejándose: leería motos y carros por igual,
> porque los carros llevan las dos placas. Es un cambio de montaje, no una compra.
> Mientras tanto, el hueco lo tapa el cierre deducido (más abajo).
| `iDS-2CD7A86G2/V-XZHSY` | Variante `/V` = protección perimetral. **No lee placas ni hace reconocimiento facial.** |
| `DS-7608NXI-K2/8P` | NVR AcuSense. Aquí vive el reconocimiento facial (descartado en Fase 1). |

**Consecuencia abierta:** las funciones de barrera de la serie TCG (relés dedicados,
Wiegand, apertura offline por lista blanca) **no se pueden dar por hechas**. La Fase 2
probablemente necesite una tarjeta de relé cableada a la salida de alarma, o control
desde la plataforma por túnel WireGuard. Confirmar antes de comprar los brazos.

## Arquitectura del flujo ANPR

```
Cámara ─(HTTP Listening, multipart XML+JPEG)─> POST /api/v1/anpr/ingesta/{token}
   └─ token identifica la cámara Y su alcabala
      └─ anpr_service: parsea, deduplica, guarda fotos, verifica placa
         └─ WebSocket ──> teléfono del guardia (Puerta) + TV (Monitor)
```

Solo la dirección **cámara → servidor** funciona hoy. La inversa (pulsar relé, sincronizar
lista blanca) necesita WireGuard en el VPS + un router saliente en cada alcabala.

### Piezas clave del backend

| Archivo | Qué hace |
|---|---|
| `services/placa_lookup.py` | **Fuente única de verdad** sobre qué significa una placa. La usan ANPR, el flujo Gemini del parquero y la búsqueda manual. Devuelve `coincidencia` y `semaforo`. |
| `services/anpr_service.py` | Parseo tolerante del evento Hikvision, dedupe, `construir_ficha()` (lo que ven ambas pantallas). |
| `api/v1/anpr.py` | Ingesta sin sesión + operación del guardia + admin de cámaras y pantallas + emparejamiento. |
| `api/v1/vehiculos.py` | Saneamiento de fichas duplicadas (`/duplicados`, `/fusionar-en/`). |
| `services/ia_service.py` | Lectura de documentos con Gemini (cédula, circulación, odómetro, surtidor). Llama al SDK **en un hilo aparte** y reintenta con espera creciente. |

### Decisiones que conviene no revertir sin leer el porqué

- **Los enums nuevos son VARCHAR+CHECK**, no ENUM nativo de Postgres. El repo tiene
  `fix_enum.py` y `check_enum.py` como evidencia de que un `ALTER TYPE` ya costó caro.
- **`placa_lookup` compara también en forma normalizada** (sin guiones ni espacios).
  La migración `b8c9veh0d1e2` normalizó los datos, pero **dejó sin tocar las placas que
  colisionaban** con la restricción UNIQUE de `vehiculos.placa`. Esas son fichas
  duplicadas reales, resolubles desde Parque Automotor → Duplicados.
- **El semáforo se calcula en el backend**, para que el teléfono del guardia y el
  monitor no puedan contradecirse. Verde pasa · amarillo el guardia decide · rojo no.
- **Los tokens de dispositivo (cámaras y pantallas) se guardan hasheados** con SHA-256,
  no bcrypt: son 32 bytes aleatorios y la autenticación necesita buscar por hash.
- **`/anpr/pendientes` devuelve la ficha recalculada**, no el veredicto guardado al
  detectar: un vehículo dado de alta después de pasar debe dejar de salir como
  desconocido.
- **Cada alcabala tiene DOS cámaras sobre el mismo paso** (`camaras_anpr.rol`:
  `delantera` / `trasera` / `unica`, migración `b1c2rol3d4e5`). Un vehículo llega dos
  veces y una **moto una sola**, porque lleva una sola placa. El dedupe fusiona las dos
  lecturas en una tarjeta: la de mayor confianza manda y la otra queda en
  `placa_alterna`, a un toque del guardia. Se admite **un carácter de diferencia, pero
  solo entre roles opuestos**: las dos cámaras ven la misma placa con luz y ángulo
  distintos, mientras que dentro del mismo rol "AV641" y "AV645" son dos vehículos
  reales y fusionarlos borraría el registro de uno. Que no llegue la segunda lectura se
  guarda (`confirmada_por_rol` en nulo) y la tarjeta lo dice: o es una moto, o una
  cámara dejó de leer.
- **El sentido lo fija la puerta, no el firmware** (`camaras_anpr.sentido`: `entrada` /
  `salida` / `mixto`, migración `c2d3sal4e5f6`). El campo `direction` que manda la
  cámara depende de la versión y de cómo esté trazada la zona de detección; el lado de
  la garita donde está atornillado el equipo, no. Solo en el carril compartido se
  recurre al firmware, y si tampoco lo dice queda `desconocida` — se prefiere que se
  note antes que inventar un sentido, porque de esto depende saber quién está dentro.
  `eventos_anpr.sentido_origen` guarda de dónde salió (`camara` / `firmware` /
  `sin_dato` / `guardia`), y la tarjeta marca con `?` lo que es una suposición.
- **Una salida no lleva destino.** Exigírselo obligaba al guardia a inventarse uno para
  poder cerrar la tarjeta, y ese dato inventado ensuciaba justo el análisis que el
  destino existe para alimentar. Tampoco se ofrece identificar al conductor al salir.
- **Las salidas deducidas (`origen_registro = deducido`, migración `d3e4ded5f6a7`)
  tapan un hueco FÍSICO, no de software.** La cámara de la puerta de salida apunta al
  frente del vehículo y las motos llevan la placa atrás: una moto que sale por ahí no
  la ve nadie. Cuando esa placa reaparece entrando sin haber salido, la salida existió
  y se registra — pero **la hora no es real** y por eso se marca aparte. Lo correcto es
  reorientar esa cámara para que lea la placa trasera; esto es el paliativo mientras
  tanto. Ojo: `origen_registro` se creó como VARCHAR(6) y `deducido` no cabía; la
  migración amplía la columna a 12.
- **Los enums VARCHAR necesitan `create_constraint=True` explícito.** En SQLAlchemy 2.0
  vale `False` por defecto, así que sin él la columna queda como un VARCHAR suelto que
  acepta cualquier cosa — comprobado: admitía el rol `lateral`.
- **`resolver_evento` consulta `verificar_placa` antes de registrar el acceso** y guarda
  `usuario_id`/`vehiculo_id`. Sin eso el acceso quedaba con la placa suelta y la bitácora
  mostraba a todo el mundo como no identificado, incluso a quien se acababa de
  identificar con la cédula.
- **En la bitácora ya no se dice "Socio Desconocido"** sino `CONDUCTOR NO IDENTIFICADO`:
  "socio" era el vocabulario de cuando el sistema servía solo a los clubes. Cuando el
  acceso no tiene persona atada pero la placa sí tiene titular hoy, el historial lo
  resuelve por placa — identificar a alguien arregla también su pasado.
- **La identificación del conductor se sella en la detección**
  (`eventos_anpr.conductor_identificado_at/_por` + `conductor_usuario_id`, migración
  `a7d8ide9f0a1`). El vehículo no recuerda cuándo ni gracias a quién dejó de ser anónimo,
  y sin eso no se puede medir el turno de un guardia.
- **La IA de documentos corre en un hilo aparte y con reintentos.** El SDK de Gemini es
  bloqueante: llamarlo dentro de un `async def` congelaba el bucle de eventos, y en
  ráfaga (varias fotos seguidas) se sumaban los 429 de cuota. El motivo del fallo viaja
  al frontend en `error` (`cuota`, `servicio`, `clave`, `lectura`) para que la pantalla
  pueda decir la verdad en vez de "no se pudo leer".

## Roles y pantallas

| Rol | Pantalla | Ruta |
|---|---|---|
| ALCABALA | Panel del turno | `/alcabala/dashboard` |
| ALCABALA | **Puerta** (flujo principal) | `/alcabala/puerta` |
| ALCABALA | Escáner QR (respaldo) | `/alcabala/scanner` |
| ALCABALA | Confirmar pantalla | `/alcabala/emparejar/:codigo` |
| — | **Monitor del TV** (kiosco, sin sesión) | `/monitor` |
| COMANDANTE | Cámaras ANPR y pantallas | `/comando/camaras` |
| COMANDANTE | Duplicados de vehículos | Parque Automotor → Duplicados |

El **monitor** se autentica con token de pantalla (no caduca, revocable al instante) y se
empareja escaneando un QR con el teléfono del guardia, estilo Netflix (RFC 8628).

## Las tres tablas de vehículos

Historia: primero `vehiculos` (registro madre, el del módulo de combustible), luego
`codigos_qr` (pases temporales, con datos de vehículo embebidos), luego `vehiculos_pase`
(varios vehículos por QR). Las tres guardaban la placa por separado.

**Ya hecho:** placas normalizadas, y `codigos_qr.vehiculo_id` / `vehiculos_pase.vehiculo_id`
rellenados contra el registro madre.

**Pendiente:** que al crear un pase se busque o se cree la fila en `vehiculos`, para que
toda placa termine en el registro madre. Y retirar las columnas duplicadas
(`vehiculo_placa`, `vehiculo_marca`…) cuando todo consulte por `vehiculo_id`.

**El QR se conserva** como respaldo: la cámara no cubre peatones ni eventos con
preinscripción, falla ~1.5% de lecturas, y si se cae la red es lo único que queda.

Las **motos** sí quedaron cubiertas al instalarse la segunda cámara de cada alcabala:
en Venezuela llevan una sola placa y va **atrás**, así que las lee la cámara trasera y
el sistema lo registra como lectura de una sola cámara en vez de tomarlo por una avería.

## Configuración

```bash
ANPR_DEDUPE_SEGUNDOS=30        # la cámara dispara varias veces por vehículo
ANPR_RETENCION_FOTOS_DIAS=90
ANPR_IP_ALLOWLIST=             # IP PÚBLICA de la alcabala, no la LAN de la cámara.
                               # Vacía si el ISP da IP dinámica.
HIKVISION_CONTROL_ACTIVO=false # Fase 2
```

`ANPR_INGEST_TOKEN` quedó **obsoleta**: cada cámara tiene su token en la base.

## Cómo probar sin ir a la alcabala

```bash
python backend/scripts/simular_camara_anpr.py --url https://api.bagfm.app --token <TOKEN_DEL_PANEL> --placa AC255LB
```

Construye el mismo multipart que manda Hikvision. Con `--repetir 5` se comprueba la
deduplicación. El token sale del panel de Cámaras ANPR al crear la cámara o rotarla.

**El par de cámaras** se prueba lanzándolo dos veces seguidas, una por token, dentro de
los 30 segundos de la ventana de dedupe:

```bash
# la trasera lee bien, la delantera confunde la L con un 1: debe salir UNA sola tarjeta
python backend/scripts/simular_camara_anpr.py --token <TOKEN_TRASERA>   --placa AC255LB
python backend/scripts/simular_camara_anpr.py --token <TOKEN_DELANTERA> --placa AC2551B
```

Una **moto** es simplemente una sola de las dos llamadas: la tarjeta debe salir igual y
avisar de que la leyó una sola cámara.

**Lección aprendida:** varias veces se dio por verificado un camino que no se había
ejercitado (CORS bloqueaba la petición, el bundle era viejo, la medición estaba anclada
al script y no al evento). Para el frontend, montar un backend falso en el scratchpad y
medir en el navegador con `mcp__Claude_Browser__` ha sido lo único fiable.

## Convenciones del proyecto

- **Todo en español**: código, comentarios, mensajes y commits.
- Los comentarios explican **por qué**, no qué. Si algo parece raro, hay un motivo escrito.
- `frontend`: no hay `eslint-plugin-react`, así que **usar un identificador solo dentro de
  JSX no cuenta como uso**. Sacar los iconos a `const` en vez de desestructurarlos en el
  parámetro.
- `Dashboard.jsx` de alcabala tiene **3 errores de lint preexistentes**; no son regresión.
- El tour guiado ancla en atributos `data-tour`, no en clases CSS. Su globo se coloca
  midiendo su altura real y **siempre dentro de la ventana**: cuando el elemento
  resaltado es más alto que la pantalla —la tarjeta de un vehículo con la botonera
  abierta— el cálculo anterior lo dejaba fuera (medido: `top −187` en una ventana de
  600) y el guardia se quedaba con la penumbra y ningún control, como si la pantalla
  se hubiera congelado.
- En modo claro, `bg-low` es el fondo de los campos de formulario. Un panel que también
  use `bg-low` deja los campos invisibles: los contenedores de formulario van sobre
  `bg-card`.

## Estado y pendientes

**Funcionando:** ingesta ANPR, pantalla de Puerta, monitor de TV con emparejamiento por
QR, semáforo, modo claro, admin de cámaras y pantallas, saneamiento de duplicados, tour
guiado, identificación opcional del conductor (cámara con guías dentro del navegador,
recorte al marco antes de subir), destinos en botonera o en lista con búsqueda a
elección del guardia, KPI de conductores identificados por turno, par de cámaras
delantera/trasera con fusión de las dos lecturas.

**Pendiente:**
0. **Meta de identificaciones por guardia**: el KPI ya cuenta; falta que el Comandante
   pueda fijar un mínimo por turno y verlo comparado entre garitas.
0.b **Salidas, fase B**: en el carril compartido, deducir el sentido por el último
   movimiento de la placa (si consta dentro → sale). Hoy ahí el sentido sale del
   firmware, y si no lo manda queda `desconocida` y el guardia lo confirma a mano.
   Antes de escribirlo conviene mirar qué proporción de eventos llega con sentido:
   `SELECT direccion, sentido_origen, count(*) FROM eventos_anpr GROUP BY 1,2;`
1. **Modelo exacto de la cámara** — bloquea decidir cómo se controlará el brazo.
2. **Fase 2**: WireGuard + control del brazo. El cliente ISAPI está escrito tras el flag
   `hikvision_control_activo`.
3. **Analítica del Comandante**: `GET /anpr/analitica` y su vista. Es la finalidad del
   sistema (recurrencia por placa, horas pico, placas recurrentes sin registro).
4. Terminar la unificación de las tres tablas de vehículos.
5. Limpiar los artefactos de Railway.
6. **Fase 3**: restringir accesos de verdad, solo cuando haya meses de datos.
