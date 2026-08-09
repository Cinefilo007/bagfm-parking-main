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
| 2 bullets **"ANPR Camera"** de Hikvision | Las que leen placas, una por alcabala. **NO son la DS-TCG406-E** del PDF: son bullets DeepinView. Modelo exacto **pendiente de confirmar**. |
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

**El QR se conserva** como respaldo: la cámara no cubre peatones, motos sin placa
delantera ni eventos con preinscripción, falla ~1.5% de lecturas, y si se cae la red es
lo único que queda.

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
elección del guardia, KPI de conductores identificados por turno.

**Pendiente:**
0. **Meta de identificaciones por guardia**: el KPI ya cuenta; falta que el Comandante
   pueda fijar un mínimo por turno y verlo comparado entre garitas.
1. **Modelo exacto de la cámara** — bloquea decidir cómo se controlará el brazo.
2. **Fase 2**: WireGuard + control del brazo. El cliente ISAPI está escrito tras el flag
   `hikvision_control_activo`.
3. **Analítica del Comandante**: `GET /anpr/analitica` y su vista. Es la finalidad del
   sistema (recurrencia por placa, horas pico, placas recurrentes sin registro).
4. Terminar la unificación de las tres tablas de vehículos.
5. Limpiar los artefactos de Railway.
6. **Fase 3**: restringir accesos de verdad, solo cuando haya meses de datos.
