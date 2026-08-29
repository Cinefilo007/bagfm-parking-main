import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera, Plus, KeyRound, RotateCcw, Trash2, Copy, Check,
  Loader2, ShieldAlert, Pencil, X, Wifi, WifiOff, Power,
  ChevronDown, ChevronRight, BookOpen, TriangleAlert, Monitor as MonitorIcon,
  Activity, RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Header } from '../../components/layout/Header';
import { anprService } from '../../services/anpr.service';
import api from '../../services/api';
import { cn } from '../../lib/utils';

/**
 * Administración de cámaras ANPR — Comandante.
 *
 * Cada cámara tiene su propio token de ingesta. El token se muestra UNA sola vez, al
 * generarlo o rotarlo: en la base solo queda su hash. Eso obliga a copiarlo en el
 * momento, pero significa que un volcado de la base no le sirve a nadie para inyectar
 * detecciones falsas.
 */

/** Una cámara "viva" es la que mandó algo hace poco: la comunicación es de una sola
 *  dirección, así que no hay forma de preguntarle si está encendida. */
const MINUTOS_PARA_CONSIDERARLA_VIVA = 30;

const estaViva = (ultimoEventoAt) => {
  if (!ultimoEventoAt) return false;
  const minutos = (Date.now() - new Date(ultimoEventoAt).getTime()) / 60000;
  return minutos < MINUTOS_PARA_CONSIDERARLA_VIVA;
};

const formatearFecha = (valor) =>
  valor ? new Date(valor).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/**
 * Origen del backend, sacado de la configuración real del cliente.
 *
 * Se deriva en vez de escribirlo fijo para que la guía siga siendo correcta si el
 * servidor cambia de dominio: una instrucción con un host obsoleto es peor que no
 * tener instrucción, porque se sigue al pie de la letra y falla en la garita.
 */
const origenApi = () => {
  try {
    return new URL(api.defaults.baseURL).origin;
  } catch {
    return window.location.origin;
  }
};

/**
 * Parte la URL de ingesta en los campos que pide el formulario de la cámara.
 *
 * El "HTTP Listening" de Hikvision no tiene un campo para la URL completa: pide el
 * host, el puerto, el protocolo y la ruta por separado. Mostrar solo la URL entera
 * obligaría a quien está en la garita a partirla a mano, que es justo donde se cuela
 * el error que después nadie encuentra.
 */
const desglosarUrl = (url) => {
  try {
    const u = new URL(url);
    return {
      protocolo: u.protocol === 'https:' ? 'HTTPS' : 'HTTP',
      host: u.hostname,
      puerto: u.port || (u.protocol === 'https:' ? '443' : '80'),
      ruta: `${u.pathname}${u.search}`,
      completa: url,
    };
  } catch {
    return { protocolo: '—', host: '—', puerto: '—', ruta: url, completa: url };
  }
};

/** Campo con su botón de copiar. */
const CampoCopiable = ({ etiqueta, valor, ancho = '' }) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar. Selecciónelo a mano.');
    }
  };

  return (
    <div className={ancho}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-sec">
        {etiqueta}
      </p>
      <button
        type="button"
        onClick={copiar}
        title="Copiar"
        className="group flex w-full items-center gap-2 rounded-lg bg-bg-low p-2.5 text-left transition-colors hover:bg-bg-high"
      >
        <span className="min-w-0 flex-1 break-all font-mono text-xs text-text-main">
          {valor}
        </span>
        {copiado
          ? <Check className="h-3.5 w-3.5 shrink-0 text-success" />
          : <Copy className="h-3.5 w-3.5 shrink-0 text-text-sec opacity-0 transition-opacity group-hover:opacity-100" />}
      </button>
    </div>
  );
};

/** Muestra el token recién generado. Es la única oportunidad de copiarlo. */
const ModalToken = ({ resultado, onCerrar }) => {
  const d = desglosarUrl(resultado.url_ingesta);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <Card elevation={4} className="my-auto w-full max-w-2xl">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-main">
              Token de {resultado.camara.nombre}
            </h2>
            <p className="mt-1 text-xs text-text-sec">
              Cópielo ahora. <strong>No se vuelve a mostrar</strong>: el sistema solo
              guarda su huella. Si lo pierde, tendrá que rotarlo y volver a configurar
              la cámara.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-primary/20 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">
            Pegue esto en Configuración → Red → Configuración avanzada → HTTP Listening
          </p>

          <div className="grid gap-2 sm:grid-cols-3">
            <CampoCopiable etiqueta="Dirección IP / Nombre de host" valor={d.host} ancho="sm:col-span-2" />
            <CampoCopiable etiqueta="Puerto" valor={d.puerto} />
          </div>

          <div className="mt-2">
            <CampoCopiable etiqueta="URL (ruta)" valor={d.ruta} />
          </div>

          <p className="mt-2 text-[11px] text-text-sec">
            Protocolo: <strong className="text-text-main">{d.protocolo}</strong>.
            {' '}El formulario de la cámara pide estos datos por separado, no la URL completa.
          </p>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-text-sec">
            Ver token suelto y URL completa
          </summary>
          <div className="mt-2 space-y-2">
            {/* El token a secas hace falta para el simulador, que lo recibe como
                argumento. Sin este campo hay que recortarlo de la ruta a mano. */}
            <CampoCopiable etiqueta="Token (para el simulador)" valor={resultado.token} />
            <CampoCopiable etiqueta="URL completa" valor={d.completa} />
          </div>
        </details>

        <div className="mt-4 flex justify-end">
          <Boton onClick={onCerrar}>Ya la copié</Boton>
        </div>
      </Card>
    </div>
  );
};

/** Token recién generado de una pantalla. También es la única vez que se muestra. */
const ModalPantalla = ({ resultado, onCerrar }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
    <Card elevation={4} className="my-auto w-full max-w-2xl">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-main">
            Pantalla {resultado.pantalla.nombre}
          </h2>
          <p className="mt-1 text-xs text-text-sec">
            Ponga esta dirección como <strong>página de inicio del televisor</strong>. Al
            abrirla, la pantalla guarda su credencial y vuelve a funcionar sola después
            de cada corte de luz, sin que nadie tenga que iniciar sesión.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <CampoCopiable etiqueta="Dirección para el televisor" valor={resultado.url_monitor} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-text-sec">
        Esta dirección solo permite <strong>leer</strong> el monitor de su alcabala. No
        puede registrar accesos, ni ver el histórico, ni la otra garita. Si el televisor
        se pierde o se cambia, rote el token y esta dirección deja de servir en el acto.
      </p>

      <div className="mt-4 flex justify-end">
        <Boton onClick={onCerrar}>Ya la copié</Boton>
      </div>
    </Card>
  </div>
);

const Paso = ({ numero, titulo, children }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
      {numero}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold text-text-main">{titulo}</p>
      <div className="mt-0.5 space-y-1 text-xs leading-relaxed text-text-sec">{children}</div>
    </div>
  </div>
);

const Ruta = ({ children }) => (
  <code className="rounded bg-bg-low px-1 py-0.5 text-[11px] text-text-main">{children}</code>
);

/**
 * Guía de configuración, a la mano de quien está por ir a la garita.
 *
 * Vive aquí y no en un documento aparte porque se consulta justo en el momento de
 * generar el token, y un manual que hay que ir a buscar es un manual que no se lee.
 */
const GuiaConfiguracion = () => {
  const [abierta, setAbierta] = useState(false);

  return (
    <Card elevation={2} className="border-bg-high/10">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {abierta ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wide text-text-main">
          Cómo configurar una cámara para que envíe al servidor
        </span>
      </button>

      {abierta && (
        <div className="mt-4 space-y-4">
          <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="text-xs leading-relaxed text-text-sec">
              <p className="font-bold text-text-main">Antes que nada: compruebe si la cámara hace HTTPS.</p>
              <p className="mt-1">
                En el formulario del <strong>Socket de escucha ISAPI</strong>, mire si el campo
                de protocolo le deja elegir HTTPS. El servidor responde a HTTP con una
                redirección a HTTPS, y las cámaras <strong>no siguen redirecciones</strong>:
                enviarían el evento y se perdería sin más aviso.
              </p>
              <p className="mt-1">
                Si la cámara solo hace HTTP, <strong>no la apunte a internet en texto
                plano</strong>: por ahí viajarían el token y fotos de placas de civiles.
                En ese caso hay que montar el túnel VPN antes de seguir.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-bg-low p-3 text-xs leading-relaxed text-text-sec">
            <p className="font-bold text-text-main">Las cámaras de la base son DS-TCG406-E.</p>
            <p className="mt-1">
              No son cámaras de vigilancia con ANPR añadido: son <strong>cámaras de captura
              de tráfico</strong> y se presentan como <Ruta>IP CAPTURE CAMERA</Ruta>. La
              lectura de placas ya viene activa de fábrica, así que el trabajo no es
              encenderla sino <strong>decirle a dónde mandar lo que lee</strong>.
            </p>
            <p className="mt-1">
              Los nombres de menú de abajo están tomados de una cámara real de la base
              (firmware <Ruta>V5.3.2</Ruta>, IP <Ruta>192.168.100.171</Ruta>). Aquí
              <strong> no existe “HTTP Listening”</strong>: en esta serie eso se llama
              <strong> Socket de escucha ISAPI</strong> y vive bajo Conexión de datos.
            </p>
          </div>

          <div className="space-y-3">
            <Paso numero="1" titulo="Red — Configuración → Red → Parámetros de red → Interfaz de red">
              <p>
                Las cámaras vienen con <strong>DHCP marcado</strong>. Conviene quitarlo y
                fijarles la IP: si el router les cambia la dirección, nadie vuelve a entrar
                a su web sin salir a buscarlas con el SADP. Al envío no le afecta —la cámara
                es la que sale— pero a mantenerlas sí.
              </p>
              <p>
                Y ponga el <strong>DNS</strong>. Es obligatorio: el destino se escribe por
                nombre, no por IP, o el certificado no valida.
              </p>
            </Paso>

            <Paso numero="2" titulo="Hora — Configuración → Sistema → Configuración de hora">
              <p>
                Active <strong>NTP</strong>. No es un paso de adorno: en la cámara que se
                revisó, el certificado se emitió con fecha de <strong>1970</strong>, señal de
                que el reloj arrancó a cero y nadie lo sincronizó. Con esa hora, un
                certificado de internet se ve como “aún no válido” y el envío por HTTPS falla
                sin decir por qué. Además de ahí sale la hora de cada detección.
              </p>
            </Paso>

            <Paso numero="3" titulo="La lectura — Configuración → Captura → Modo de aplicación">
              <p>
                En estas cámaras el ANPR no está bajo Evento: tiene su propia sección.
                Normalmente ya viene bien de fábrica —conviene mirar, no tocar.
              </p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>Modo de trabajo: <strong>Sistema de reconocimiento de matrículas</strong></li>
                <li>Tipo de disparador: <strong>Detección de vídeo</strong> (no bucle inductivo: no hay bucle enterrado)</li>
                <li>Tipos de captura: <strong>Prioridad de matrículas</strong></li>
                <li>Carriles totales: <strong>1</strong>, y dibuje el carril sobre la imagen</li>
              </ul>
            </Paso>

            <Paso numero="4" titulo="El destino — Configuración → Red → Conexión de datos → Socket de escucha ISAPI">
              <p>
                <strong>Esta es la pestaña.</strong> Es el equivalente al “HTTP Listening” de
                las cámaras de vigilancia: la cámara hace POST del
                <Ruta>EventNotificationAlert</Ruta> en XML con las fotos adjuntas, que es
                exactamente lo que este sistema espera.
              </p>
              <p>
                Ahí van los datos que le entrega esta pantalla al crear la cámara o rotar su
                token: host, puerto, protocolo y ruta, <strong>en campos separados</strong>.
              </p>
              <p>
                Cada cámara lleva <strong>su propia ruta</strong>, porque el token identifica
                también a qué alcabala pertenece. Por eso una detección solo le llega al
                guardia de esa alcabala.
              </p>
              <p>
                Las vecinas de esa misma fila <strong>no sirven</strong>:
                <Ruta>Escucha SDK</Ruta> usa el protocolo propietario de Hikvision,
                <Ruta>ISUP</Ruta> y <Ruta>OTAP</Ruta> son para plataformas de terceros, y
                <Ruta>FTP</Ruta> sube fotos sueltas sin el dato de la placa.
              </p>
            </Paso>

            <Paso numero="5" titulo="Que la lectura dispare el envío — pestaña Cargar Arm">
              <p>
                De nada sirve el destino si la cámara no tiene marcado que suba lo que lee.
                En <strong>Cargar Arm</strong> (carga por armado), compruebe que el envío de
                los resultados de matrícula esté activado y apuntando al canal ISAPI.
              </p>
              <p>
                Es el olvido más común, y desde fuera se ve igual que una cámara apagada: lee
                la placa perfectamente y no la manda a ningún sitio.
              </p>
            </Paso>

            <Paso numero="6" titulo="Fotos — Configuración → Captura → Parámetros de captura">
              <p>
                Que lleguen las dos imágenes: el recorte de la placa y la escena completa. Si
                el evento supera los 12 MB el servidor lo rechaza, así que no suba la
                resolución más de lo necesario.
              </p>
            </Paso>

            <Paso numero="7" titulo="Comprobar">
              <p>
                Pase un vehículo y vea si la cámara aparece como <strong>Transmitiendo</strong>
                en la lista de abajo. Si no aparece, abra el <strong>Diagnóstico</strong> que
                está justo debajo de esta guía: ahí se ve si el envío llegó y por qué se
                descartó. Para probar sin ir a la garita, desde el servidor:
              </p>
              <div className="mt-1">
                <CampoCopiable
                  etiqueta="Simulador (usa el token que le dio esta pantalla)"
                  valor={`python scripts/simular_camara_anpr.py --url ${origenApi()} --token=<TOKEN> --placa PRUEBA1`}
                />
              </div>
              <p className="mt-1">
                El <Ruta>=</Ruta> del <Ruta>--token=</Ruta> no es un adorno: hay tokens que
                empiezan por guion y sin él el script los toma por una opción suya.
              </p>
            </Paso>
          </div>

          <div className="rounded-lg bg-bg-low p-3 text-xs leading-relaxed text-text-sec">
            <p className="font-bold text-text-main">Si no llega nada</p>
            <ul className="ml-4 mt-1 list-disc space-y-0.5">
              <li>Mire primero el <strong>Diagnóstico</strong>: distingue “no llegó” de “llegó y se descartó”.</li>
              <li>¿Quedó activado el envío en <strong>Cargar Arm</strong> (paso 5)?</li>
              <li>¿Configuró el <strong>Socket de escucha ISAPI</strong> y no la Escucha SDK?</li>
              <li>¿La cámara está <strong>activa</strong> y con token en esta pantalla?</li>
              <li>¿La ruta lleva el token completo? Un carácter de menos da 404.</li>
              <li>
                Si llenó <Ruta>ANPR_IP_ALLOWLIST</Ruta> en el servidor, ahí va la
                <strong> IP pública de la alcabala</strong>, no la IP LAN de la cámara. Y si
                el proveedor da IP dinámica, al cambiar bloquea la ingesta: déjela vacía si
                no tiene IP fija.
              </li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
};

/**
 * Qué significa cada motivo de rechazo y qué hacer con él.
 *
 * El texto va aquí y no en el backend porque es lo que se lee estando en la garita: un
 * motivo en clave (`token_invalido`) obliga a saberse el sistema por dentro, y quien
 * está montando la cámara normalmente no es quien lo escribió.
 */
const MOTIVOS = {
  token_invalido: {
    titulo: 'Token que no existe',
    color: 'text-danger',
    que_hacer: 'La ruta de la cámara no coincide con ninguna cámara activa. Rote el token y vuelva a cargarlo.',
  },
  ip_rechazada: {
    titulo: 'IP bloqueada',
    color: 'text-warning',
    que_hacer: 'La cámara transmite bien: la frena ANPR_IP_ALLOWLIST en el servidor.',
  },
  cuerpo_enorme: {
    titulo: 'Evento demasiado grande',
    color: 'text-warning',
    que_hacer: 'Baje la resolución de las fotos de captura en la cámara.',
  },
  sin_alcabala: {
    titulo: 'Cámara sin alcabala',
    color: 'text-danger',
    que_hacer: 'Vuelva a asignarle su punto de acceso desde esta misma pantalla.',
  },
  sin_placa: {
    titulo: 'Llegó, pero sin placa',
    color: 'text-warning',
    que_hacer: 'La cámara alcanza el servidor. Lo que falla es el formato: revise el modo de subida.',
  },
  otro_evento: {
    // Buena noticia disfrazada de error: el camino entero funciona. Va en verde para que
    // no se busque una avería donde no la hay.
    titulo: 'Llegó un evento que no es una lectura',
    color: 'text-success',
    que_hacer: 'La cámara alcanza el servidor y el token es correcto. Si son latidos, ponga el intervalo en 0.',
  },
};

/**
 * Las ingestas que no prosperaron.
 *
 * Existe porque "la cámara no aparece" tenía cuatro causas que desde el panel se veían
 * exactamente igual, y separarlas obligaba a entrar al VPS a leer los logs del
 * contenedor — justo lo que no se puede hacer de pie en la garita.
 */
const DiagnosticoIngesta = () => {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await anprService.getDiagnosticoIngesta());
    } catch {
      toast.error('No se pudo leer el diagnóstico');
    } finally {
      setCargando(false);
    }
  }, []);

  // Se consulta al desplegar y no al montar la pantalla: mientras esté cerrado no hay
  // nada que mirar, y la lista de cámaras ya carga sola al entrar.
  useEffect(() => { if (abierto) cargar(); }, [abierto, cargar]);

  const limpiar = async () => {
    try {
      await anprService.limpiarDiagnosticoIngesta();
      toast.success('Lista vacía. Haga pasar un vehículo y vuelva a consultar.');
      cargar();
    } catch {
      toast.error('No se pudo limpiar');
    }
  };

  const intentos = datos?.intentos || [];

  return (
    <Card elevation={2} className="border-bg-high/10">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {abierto ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
        <Activity className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wide text-text-main">
          Diagnóstico: envíos que no se registraron
        </span>
      </button>

      {abierto && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Boton size="sm" variant="secundario" onClick={cargar} disabled={cargando}>
              {cargando
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Actualizar
            </Boton>
            <Boton size="sm" variant="secundario" onClick={limpiar} disabled={cargando}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpiar antes de probar
            </Boton>
          </div>

          {intentos.length === 0 ? (
            <div className="rounded-lg bg-bg-low p-3 text-xs leading-relaxed text-text-sec">
              <p className="font-bold text-text-main">No hay envíos rechazados.</p>
              <p className="mt-1">
                Si además la cámara aparece como <strong>sin transmitir</strong>, entonces
                al servidor no le está llegando nada y el problema está antes: la cámara no
                envía, o no llega a salir de la alcabala. Empiece por comprobar que la
                vinculación quedó marcada y que el equipo tiene salida a internet.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {intentos.map((i, idx) => {
                const m = MOTIVOS[i.motivo] || { titulo: i.motivo, color: 'text-text-main', que_hacer: '' };
                return (
                  <li key={`${i.momento}-${idx}`} className="rounded-lg bg-bg-low p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className={cn('text-xs font-bold', m.color)}>{m.titulo}</span>
                      <span className="font-mono text-[10px] text-text-sec">
                        {formatearFecha(i.momento)}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-text-sec">
                      {m.que_hacer}
                    </p>

                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-sec">
                      {i.camara_nombre && <span>Cámara: <strong className="text-text-main">{i.camara_nombre}</strong></span>}
                      {i.pista_token && <span>Token ••••{i.pista_token}</span>}
                      {i.ip && <span>Desde {i.ip}</span>}
                      {i.content_type && <span className="font-mono">{i.content_type}</span>}
                      {i.tamano != null && <span>{i.tamano} bytes</span>}
                    </div>

                    {/* Las etiquetas del XML son lo que resuelve el caso difícil: si están
                        pero no hay licensePlate, la cámara envía bien y solo cambia el
                        nombre del campo. */}
                    {i.etiquetas?.length > 0 && (
                      <p className="mt-1.5 break-all font-mono text-[10px] text-text-sec">
                        Etiquetas recibidas: {i.etiquetas.join(', ')}
                      </p>
                    )}

                    {i.extracto && (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-text-sec">
                          Ver lo que llegó
                        </summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-bg-card p-2 font-mono text-[10px] text-text-main">
                          {i.extracto}
                        </pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {datos?.volatil && (
            <p className="text-[10px] leading-relaxed text-text-sec">
              Esta lista vive en la memoria del servidor: se borra al desplegar y guarda
              los últimos {datos.maximo}. No es un registro de auditoría, es una
              herramienta para dejar la cámara transmitiendo.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

const FormularioCamara = ({ camara, puntos, onGuardar, onCancelar, guardando }) => {
  const [form, setForm] = useState({
    nombre: camara?.nombre || '',
    punto_acceso_id: camara?.punto_acceso_id || puntos[0]?.id || '',
    rol: camara?.rol || 'unica',
    sentido: camara?.sentido || 'mixto',
    modelo: camara?.modelo || '',
    serial: camara?.serial || '',
    ip_lan: camara?.ip_lan || '',
    notas: camara?.notas || '',
  });

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const enviar = (e) => {
    e.preventDefault();
    if (form.nombre.trim().length < 3) {
      toast.error('El nombre debe tener al menos 3 caracteres');
      return;
    }
    if (!form.punto_acceso_id) {
      toast.error('Seleccione la alcabala');
      return;
    }
    onGuardar({
      ...form,
      modelo: form.modelo || null,
      serial: form.serial || null,
      ip_lan: form.ip_lan || null,
      notas: form.notas || null,
    });
  };

  return (
    <Card elevation={2} className="border-primary/30">
      <form onSubmit={enviar} className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-text-sec">
          {camara ? `Editar ${camara.nombre}` : 'Nueva cámara'}
        </h3>

        <Input
          label="Nombre"
          value={form.nombre}
          onChange={cambiar('nombre')}
          placeholder="Ej: ANPR Alcabala Principal — Entrada"
        />

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium tracking-[0.05em] text-text-sec">
            Alcabala
          </label>
          <select
            value={form.punto_acceso_id}
            onChange={cambiar('punto_acceso_id')}
            className="input-field"
          >
            {puntos.length === 0 && <option value="">No hay alcabalas registradas</option>}
            {puntos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (inactiva)'}</option>
            ))}
          </select>
        </div>

        {/* En cada alcabala hay dos camaras sobre el mismo paso. Decir cual mira
            que extremo es lo que permite cruzar sus dos lecturas y, sobre todo,
            distinguir una moto —que lleva una sola placa— de una camara averiada. */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium tracking-[0.05em] text-text-sec">
            Qué placa lee
          </label>
          <select value={form.rol} onChange={cambiar('rol')} className="input-field">
            <option value="delantera">Placa delantera</option>
            <option value="trasera">Placa trasera</option>
            <option value="unica">Única cámara del punto</option>
          </select>
          <p className="mt-1 text-[11px] text-text-sec">
            Si la alcabala tiene las dos, marque una de cada tipo: así el sistema sabe
            que las dos lecturas son del mismo vehículo y avisa cuando falta una.
          </p>
        </div>

        {/* El sentido lo fija la puerta donde esta la camara, no lo que diga su
            firmware: el campo `direction` cambia con la version y con como este
            trazada la zona de deteccion, y el sitio donde esta atornillada no. */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium tracking-[0.05em] text-text-sec">
            Qué registra
          </label>
          <select value={form.sentido} onChange={cambiar('sentido')} className="input-field">
            <option value="entrada">Solo entradas — puerta de entrada</option>
            <option value="salida">Solo salidas — puerta de salida</option>
            <option value="mixto">Entradas y salidas — carril compartido</option>
          </select>
          <p className="mt-1 text-[11px] text-text-sec">
            En una puerta de un solo sentido el registro queda garantizado. En un carril
            compartido el sistema propone el sentido y el guardia lo confirma.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Modelo" value={form.modelo} onChange={cambiar('modelo')} placeholder="DS-TCG406-E" />
          <Input label="Serial" value={form.serial} onChange={cambiar('serial')} />
          <Input label="IP en la LAN" value={form.ip_lan} onChange={cambiar('ip_lan')} placeholder="192.168.1.64" />
        </div>

        <Input label="Notas" value={form.notas} onChange={cambiar('notas')} placeholder="Ubicación, orientación, quién la instaló…" />

        <div className="flex justify-end gap-2 pt-1">
          <Boton type="button" variant="ghost" onClick={onCancelar}>Cancelar</Boton>
          <Boton type="submit" isLoading={guardando}>
            {camara ? 'Guardar cambios' : 'Crear y generar token'}
          </Boton>
        </div>
      </form>
    </Card>
  );
};

const FilaCamara = ({ camara, onEditar, onRotar, onRevocar, onEliminar, onActivar, ocupada }) => {
  const viva = estaViva(camara.ultimo_evento_at);

  return (
    <Card elevation={2} className={cn('border-bg-high/10', !camara.activa && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="truncate text-sm font-bold text-text-main">{camara.nombre}</h3>
            {/* Qué extremo mira. Se ve en la lista para poder comprobar de un vistazo
                que cada alcabala tiene una delantera y una trasera, y no dos iguales. */}
            {camara.rol && camara.rol !== 'unica' && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                {camara.rol === 'delantera' ? 'Delantera' : 'Trasera'}
              </span>
            )}
            {camara.sentido && camara.sentido !== 'mixto' && (
              <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-400">
                {camara.sentido === 'entrada' ? 'Entradas' : 'Salidas'}
              </span>
            )}
            {!camara.activa && (
              <span className="rounded bg-text-sec/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-text-sec">
                Desactivada
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-text-sec">
            {camara.punto_nombre}
            {camara.modelo && ` · ${camara.modelo}`}
            {camara.ip_lan && ` · ${camara.ip_lan}`}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-sec">
            <span className="inline-flex items-center gap-1">
              {viva
                ? <><Wifi className="h-3 w-3 text-success" /> Transmitiendo</>
                : <><WifiOff className="h-3 w-3 text-text-sec/60" /> Sin eventos recientes</>}
            </span>
            <span>Último: {formatearFecha(camara.ultimo_evento_at)}</span>
            <span>{camara.total_eventos} eventos</span>
            <span className="inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              {camara.tiene_token
                ? <>Token ••••{camara.token_pista} · {formatearFecha(camara.token_generado_at)}</>
                : <span className="text-warning">Sin token — no puede enviar</span>}
            </span>
          </div>

          {camara.notas && (
            <p className="mt-1.5 text-[11px] italic text-text-sec/80">{camara.notas}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Boton size="sm" variant="ghost" onClick={() => onEditar(camara)} disabled={ocupada}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Boton>
          <Boton size="sm" variant="secundario" onClick={() => onRotar(camara)} disabled={ocupada}>
            <RotateCcw className="h-3.5 w-3.5" /> {camara.tiene_token ? 'Rotar token' : 'Generar token'}
          </Boton>
          {camara.tiene_token && (
            <Boton size="sm" variant="ghost" onClick={() => onRevocar(camara)} disabled={ocupada}>
              <X className="h-3.5 w-3.5" /> Revocar
            </Boton>
          )}
          <Boton size="sm" variant="ghost" onClick={() => onActivar(camara)} disabled={ocupada}>
            <Power className="h-3.5 w-3.5" /> {camara.activa ? 'Desactivar' : 'Activar'}
          </Boton>
          <Boton size="sm" variant="destructivo" onClick={() => onEliminar(camara)} disabled={ocupada}>
            <Trash2 className="h-3.5 w-3.5" />
          </Boton>
        </div>
      </div>
    </Card>
  );
};

/** Inventario de televisores de garita y sus credenciales de solo lectura. */
const SeccionPantallas = ({ puntos, onTokenNuevo }) => {
  const [pantallas, setPantallas] = useState([]);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ nombre: '', punto_acceso_id: '' });
  const [ocupada, setOcupada] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPantallas(await anprService.getPantallas());
    } catch {
      toast.error('No se pudieron cargar las pantallas');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const conOcupada = async (accion) => {
    setOcupada(true);
    try {
      await accion();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'La operación falló');
    } finally {
      setOcupada(false);
    }
  };

  const crear = () => {
    if (form.nombre.trim().length < 3) return toast.error('Nombre demasiado corto');
    const punto = form.punto_acceso_id || puntos[0]?.id;
    if (!punto) return toast.error('No hay alcabalas registradas');

    return conOcupada(async () => {
      const resultado = await anprService.crearPantalla({
        nombre: form.nombre.trim(),
        punto_acceso_id: punto,
      });
      onTokenNuevo(resultado);
      setForm({ nombre: '', punto_acceso_id: '' });
      setCreando(false);
      await cargar();
    });
  };

  const rotar = (p) => {
    if (!window.confirm(`Rotar el token de "${p.nombre}".

El televisor dejará de mostrar datos hasta que le carguen la dirección nueva.

¿Continuar?`)) return;
    conOcupada(async () => {
      onTokenNuevo(await anprService.rotarTokenPantalla(p.id));
      await cargar();
    });
  };

  const eliminar = (p) => {
    if (!window.confirm(`Eliminar la pantalla "${p.nombre}".

Su dirección deja de funcionar de inmediato.

¿Continuar?`)) return;
    conOcupada(async () => {
      await anprService.eliminarPantalla(p.id);
      await cargar();
      toast.success('Pantalla eliminada');
    });
  };

  return (
    <Card elevation={2} className="border-bg-high/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorIcon className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-text-main">
            Pantallas de garita
          </span>
          <span className="text-[11px] text-text-sec">· solo lectura</span>
        </div>
        {!creando && (
          <Boton size="sm" variant="secundario" onClick={() => setCreando(true)} disabled={puntos.length === 0}>
            <Plus className="h-3.5 w-3.5" /> Nueva pantalla
          </Boton>
        )}
      </div>

      {creando && (
        <div className="mt-4 space-y-3 rounded-xl border border-primary/30 p-3">
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: TV Alcabala Principal"
          />
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium tracking-[0.05em] text-text-sec">
              Alcabala
            </label>
            <select
              className="input-field"
              value={form.punto_acceso_id || puntos[0]?.id || ''}
              onChange={(e) => setForm((f) => ({ ...f, punto_acceso_id: e.target.value }))}
            >
              {puntos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Boton variant="ghost" onClick={() => setCreando(false)}>Cancelar</Boton>
            <Boton onClick={crear} isLoading={ocupada}>Crear y generar dirección</Boton>
          </div>
        </div>
      )}

      {pantallas.length === 0 ? (
        <p className="mt-3 text-xs text-text-sec">
          Sin pantallas registradas. Cree una para obtener la dirección que se deja como
          página de inicio del televisor.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {pantallas.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-low p-3',
                !p.activa && 'opacity-60'
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text-main">{p.nombre}</p>
                <p className="text-[11px] text-text-sec">
                  {p.punto_nombre}
                  {' · '}
                  {p.tiene_token
                    ? <>Token ••••{p.token_pista}</>
                    : <span className="text-warning">Sin token</span>}
                  {' · '}
                  Última señal: {formatearFecha(p.ultimo_acceso_at)}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Boton size="sm" variant="secundario" onClick={() => rotar(p)} disabled={ocupada}>
                  <RotateCcw className="h-3.5 w-3.5" /> Rotar
                </Boton>
                <Boton size="sm" variant="destructivo" onClick={() => eliminar(p)} disabled={ocupada}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Boton>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

/**
 * Cada cuánto se borran las fotos de las detecciones.
 *
 * Se muestra siempre, aunque nadie vaya a tocarlo: durante mucho tiempo la retención
 * existió como ajuste pero nunca se aplicó, y las fotos llenaron 13 GB sin que nada
 * lo dijera. Un número a la vista es lo que evita que eso vuelva a pasar en silencio.
 *
 * Lo que vence es la FOTO, no la detección: la placa, la hora y el sentido quedan para
 * siempre en la bitácora de la alcabala.
 */
const RetencionFotos = () => {
  const [dias, setDias] = useState(null);
  const [conFoto, setConFoto] = useState(0);
  const [borrador, setBorrador] = useState('');
  const [editando, setEditando] = useState(false);
  const [ocupada, setOcupada] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const datos = await anprService.getRetencionFotos();
      setDias(datos.dias);
      setConFoto(datos.detecciones_con_foto);
    } catch {
      // Silencioso a propósito: es un panel informativo dentro de la pantalla de
      // cámaras. Un toast de error aquí taparía el trabajo real del Comandante.
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    const valor = Number(borrador);
    if (!Number.isInteger(valor) || valor < 1 || valor > 365) {
      toast.error('Indique un número entero de días, entre 1 y 365.');
      return;
    }
    setOcupada(true);
    try {
      const datos = await anprService.setRetencionFotos(valor);
      setDias(datos.dias);
      setConFoto(datos.detecciones_con_foto);
      setEditando(false);
      toast.success(`Las fotos se borrarán a los ${datos.dias} días`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo guardar la retención');
    } finally {
      setOcupada(false);
    }
  };

  const purgarAhora = async () => {
    if (!window.confirm(
      `Se borrarán ahora mismo las fotos de las detecciones con más de ${dias} días.\n\n` +
      'Las detecciones (placa, hora, sentido) NO se borran: solo la imagen.\n\n¿Continuar?'
    )) return;

    setOcupada(true);
    try {
      const resultado = await anprService.purgarFotos();
      await cargar();
      toast.success(`Se liberaron las fotos de ${resultado.detecciones_purgadas} detecciones`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'La purga falló');
    } finally {
      setOcupada(false);
    }
  };

  if (dias === null) return null;

  return (
    <Card elevation={2} className="border-bg-high/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-text-sec" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-pri">Retención de fotos</h3>
            {!editando ? (
              <p className="mt-0.5 text-xs leading-relaxed text-text-sec">
                Las fotos de las detecciones se eliminan automáticamente a los{' '}
                <strong className="text-text-pri">{dias} {dias === 1 ? 'día' : 'días'}</strong>.
                {' '}Hoy hay <strong className="text-text-pri">{conFoto.toLocaleString('es-VE')}</strong>
                {' '}detecciones con foto guardada.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  className="w-24"
                  autoFocus
                />
                <span className="text-xs text-text-sec">días</span>
                <Boton size="sm" onClick={guardar} disabled={ocupada}>
                  {ocupada ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Guardar
                </Boton>
                <Boton size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={ocupada}>
                  <X className="h-4 w-4" /> Cancelar
                </Boton>
              </div>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-sec/80">
              Solo se borra la imagen. La placa, la hora y el sentido de cada detección
              quedan en el histórico de forma permanente.
            </p>
          </div>
        </div>

        {!editando && (
          <div className="flex gap-2">
            <Boton
              size="sm"
              variant="ghost"
              onClick={() => { setBorrador(String(dias)); setEditando(true); }}
              disabled={ocupada}
            >
              <Pencil className="h-4 w-4" /> Cambiar
            </Boton>
            <Boton size="sm" variant="ghost" onClick={purgarAhora} disabled={ocupada}>
              {ocupada ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Purgar ahora
            </Boton>
          </div>
        )}
      </div>
    </Card>
  );
};

const CamarasAnpr = () => {
  const [camaras, setCamaras] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [tokenNuevo, setTokenNuevo] = useState(null);
  const [tokenPantalla, setTokenPantalla] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [cams, pts] = await Promise.all([
        anprService.getCamaras(),
        anprService.getPuntosAcceso(),
      ]);
      setCamaras(cams);
      setPuntos(pts);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudieron cargar las cámaras');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const conOcupada = async (accion) => {
    setOcupada(true);
    try {
      await accion();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'La operación falló');
    } finally {
      setOcupada(false);
    }
  };

  const crear = (datos) => conOcupada(async () => {
    const resultado = await anprService.crearCamara(datos);
    setTokenNuevo(resultado);
    setCreando(false);
    await cargar();
    toast.success('Cámara creada');
  });

  const guardarEdicion = (datos) => conOcupada(async () => {
    await anprService.editarCamara(editando.id, datos);
    setEditando(null);
    await cargar();
    toast.success('Cambios guardados');
  });

  const rotar = (camara) => {
    const aviso = camara.tiene_token
      ? `Rotar el token de "${camara.nombre}" invalida el actual de inmediato. La cámara dejará de registrar hasta que le carguen la URL nueva.\n\n¿Continuar?`
      : `Generar un token para "${camara.nombre}"?`;
    if (!window.confirm(aviso)) return;

    conOcupada(async () => {
      const resultado = await anprService.rotarToken(camara.id);
      setTokenNuevo(resultado);
      await cargar();
    });
  };

  const revocar = (camara) => {
    if (!window.confirm(`Revocar el token de "${camara.nombre}". La cámara dejará de registrar de inmediato.\n\n¿Continuar?`)) return;
    conOcupada(async () => {
      await anprService.revocarToken(camara.id);
      await cargar();
      toast.success('Token revocado');
    });
  };

  const alternarActiva = (camara) => conOcupada(async () => {
    await anprService.editarCamara(camara.id, { activa: !camara.activa });
    await cargar();
  });

  const eliminar = (camara) => {
    if (!window.confirm(`Eliminar "${camara.nombre}" del inventario.\n\nSus detecciones ya registradas NO se borran.\n\n¿Continuar?`)) return;
    conOcupada(async () => {
      await anprService.eliminarCamara(camara.id);
      await cargar();
      toast.success('Cámara eliminada');
    });
  };

  return (
    <div className="min-h-screen bg-bg-app">
      <Header
        titulo="Cámaras ANPR"
        subtitle="Inventario y tokens de ingesta"
        actionElement={
          !creando && !editando && (
            <Boton size="sm" onClick={() => setCreando(true)} disabled={puntos.length === 0}>
              <Plus className="h-4 w-4" /> Nueva cámara
            </Boton>
          )
        }
      />

      <main className="mt-[-1rem] space-y-4 px-4 pb-24 lg:px-8">
      <GuiaConfiguracion />
      <RetencionFotos />
      <DiagnosticoIngesta />

      {puntos.length === 0 && !cargando && (
        <Card elevation={2} className="border-warning/30">
          <p className="text-xs text-text-sec">
            No hay alcabalas registradas. Cree primero los puntos de acceso en
            <strong> Mando → Alcabalas</strong>: cada cámara tiene que pertenecer a uno.
          </p>
        </Card>
      )}

      {creando && (
        <FormularioCamara
          puntos={puntos}
          onGuardar={crear}
          onCancelar={() => setCreando(false)}
          guardando={ocupada}
        />
      )}

      {editando && (
        <FormularioCamara
          camara={editando}
          puntos={puntos}
          onGuardar={guardarEdicion}
          onCancelar={() => setEditando(null)}
          guardando={ocupada}
        />
      )}

      {cargando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : camaras.length === 0 ? (
        <Card elevation={2} className="border-bg-high/10 py-16 text-center">
          <Camera className="mx-auto h-10 w-10 text-text-sec/30" />
          <p className="mt-3 text-sm font-bold uppercase tracking-wide text-text-sec">
            Sin cámaras registradas
          </p>
          <p className="mt-1 text-xs text-text-sec/70">
            Registre una cámara para obtener la URL que se carga en su HTTP Listening.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {camaras.map((camara) => (
            <FilaCamara
              key={camara.id}
              camara={camara}
              ocupada={ocupada}
              onEditar={setEditando}
              onRotar={rotar}
              onRevocar={revocar}
              onActivar={alternarActiva}
              onEliminar={eliminar}
            />
          ))}
        </div>
      )}

        <SeccionPantallas puntos={puntos} onTokenNuevo={setTokenPantalla} />
      </main>

      {tokenNuevo && (
        <ModalToken resultado={tokenNuevo} onCerrar={() => setTokenNuevo(null)} />
      )}

      {tokenPantalla && (
        <ModalPantalla resultado={tokenPantalla} onCerrar={() => setTokenPantalla(null)} />
      )}
    </div>
  );
};

export default CamarasAnpr;
