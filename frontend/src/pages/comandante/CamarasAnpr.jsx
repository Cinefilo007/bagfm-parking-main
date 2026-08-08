import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera, Plus, KeyRound, RotateCcw, Trash2, Copy, Check,
  Loader2, ShieldAlert, Pencil, X, Wifi, WifiOff, Power,
  ChevronDown, ChevronRight, BookOpen, TriangleAlert,
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
            Ver URL completa
          </summary>
          <div className="mt-2">
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
    <Card elevation={1}>
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
                En el formulario de HTTP Listening, mire si el campo de protocolo le deja
                elegir HTTPS. El servidor responde a HTTP con una redirección a HTTPS, y
                las cámaras <strong>no siguen redirecciones</strong>: enviarían el evento
                y se perdería sin más aviso.
              </p>
              <p className="mt-1">
                Si la cámara solo hace HTTP, <strong>no la apunte a internet en texto
                plano</strong>: por ahí viajarían el token y fotos de placas de civiles.
                En ese caso hay que montar el túnel VPN antes de seguir.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Paso numero="1" titulo="Red — Configuración → Red → Configuración básica">
              <p>
                IP fija, puerta de enlace y <strong>DNS</strong>. El DNS es obligatorio: si
                pone la IP del servidor en vez del nombre, el certificado no valida y la
                conexión se cae.
              </p>
            </Paso>

            <Paso numero="2" titulo="Hora — Configuración → Sistema → Configuración de hora">
              <p>
                Active <strong>NTP</strong>. Con el reloj desfasado el certificado se ve
                como “aún no válido” y el envío falla en silencio. Además de ahí sale la
                hora que se guarda con cada detección.
              </p>
            </Paso>

            <Paso numero="3" titulo="Activar el ANPR — Configuración → Evento → Tráfico rodado">
              <p>También aparece como <em>Road Traffic</em> o <em>Evento inteligente</em>.</p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>Tipo de detección: <strong>Detección de vehículos / ANPR</strong></li>
                <li>Región: <strong>Venezuela</strong> — sin esto no lee bien la placa venezolana</li>
                <li>Dibuje el carril y la línea de disparo sobre la imagen</li>
                <li>Modo de disparo: <strong>por vídeo</strong></li>
                <li>Marque los atributos de <strong>tipo y color</strong> de vehículo</li>
              </ul>
            </Paso>

            <Paso numero="4" titulo="Vinculación — misma pantalla, pestaña Vinculación / Linkage">
              <p>
                Marque <strong>“Notificar al centro de vigilancia”</strong> y, si aparece,
                <strong> “Cargar a HTTP Listening”</strong>. Sin esto la cámara detecta
                pero no envía nada, y es el olvido más común.
              </p>
            </Paso>

            <Paso numero="5" titulo="Captura — parámetros de captura de la misma pantalla">
              <p>
                Elija <strong>“imagen de escena + imagen de primer plano”</strong> para que
                lleguen las dos fotos: el recorte de la placa y el vehículo completo.
              </p>
            </Paso>

            <Paso numero="6" titulo="El destino — Configuración → Red → Configuración avanzada → HTTP Listening">
              <p>
                Aquí van los datos que le entrega esta pantalla al crear la cámara o rotar
                su token: host, puerto, protocolo y ruta, <strong>en campos separados</strong>.
              </p>
              <p>
                Cada cámara lleva <strong>su propia ruta</strong>, porque el token identifica
                también a qué alcabala pertenece. Por eso una detección solo le llega al
                guardia de esa alcabala.
              </p>
            </Paso>

            <Paso numero="7" titulo="Comprobar">
              <p>
                Pase un vehículo y vea si la cámara aparece como <strong>Transmitiendo</strong>
                en la lista de abajo. Para probar sin ir a la garita, desde el servidor:
              </p>
              <div className="mt-1">
                <CampoCopiable
                  etiqueta="Simulador (usa el token que le dio esta pantalla)"
                  valor={`python scripts/simular_camara_anpr.py --url ${origenApi()} --token <TOKEN> --placa PRUEBA1`}
                />
              </div>
            </Paso>
          </div>

          <div className="rounded-lg bg-bg-low p-3 text-xs leading-relaxed text-text-sec">
            <p className="font-bold text-text-main">Si no llega nada</p>
            <ul className="ml-4 mt-1 list-disc space-y-0.5">
              <li>¿Quedó marcada la vinculación del paso 4?</li>
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

const FormularioCamara = ({ camara, puntos, onGuardar, onCancelar, guardando }) => {
  const [form, setForm] = useState({
    nombre: camara?.nombre || '',
    punto_acceso_id: camara?.punto_acceso_id || puntos[0]?.id || '',
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
    <Card elevation={3} className="border border-primary/30">
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

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-text-sec">
            Alcabala
          </label>
          <select
            value={form.punto_acceso_id}
            onChange={cambiar('punto_acceso_id')}
            className="min-h-[44px] w-full rounded-xl border border-bg-high bg-bg-low px-3 text-sm text-text-main dark:border-white/10"
          >
            {puntos.length === 0 && <option value="">No hay alcabalas registradas</option>}
            {puntos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (inactiva)'}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Modelo" value={form.modelo} onChange={cambiar('modelo')} placeholder="iDS-2CD7A46G0/P" />
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
    <Card elevation={2} className={cn(!camara.activa && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="truncate text-sm font-bold text-text-main">{camara.nombre}</h3>
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

const CamarasAnpr = () => {
  const [camaras, setCamaras] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [tokenNuevo, setTokenNuevo] = useState(null);

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
    <div className="space-y-4 pb-24">
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

      <GuiaConfiguracion />

      {puntos.length === 0 && !cargando && (
        <Card elevation={1} className="border border-warning/30">
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
        <Card elevation={1} className="py-16 text-center">
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

      {tokenNuevo && (
        <ModalToken resultado={tokenNuevo} onCerrar={() => setTokenNuevo(null)} />
      )}
    </div>
  );
};

export default CamarasAnpr;
