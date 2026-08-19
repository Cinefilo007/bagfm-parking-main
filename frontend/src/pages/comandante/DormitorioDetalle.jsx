import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DoorClosed, Plus, Loader2, ArrowLeft, QrCode, Users,
  UserPlus, Trash2, Download, X, Car, ShieldAlert, Phone, Pencil,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
// Import con nombre y no por defecto: `react-qr-code` es CommonJS y su export por
// defecto no sobrevive al interop del bundler (error #130 de React).
import { QRCode } from 'react-qr-code';
import { toPng } from 'html-to-image';

import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Header } from '../../components/layout/Header';
import { dormitoriosService } from '../../services/dormitorios.service';
import { cn } from '../../lib/utils';

/**
 * Detalle de un dormitorio: sus habitaciones y quién ocupa cada cama.
 *
 * Dos QR distintos conviven en esta pantalla y conviene no confundirlos:
 *
 *   - El de la PUERTA identifica a la habitación. Se imprime, se pega y abre la ficha
 *     pública de sus ocupantes. Su token solo se ve al generarlo.
 *   - El PEATONAL identifica a una persona en la alcabala. Es para quien no tiene
 *     vehículo, porque la cámara solo sabe leer placas y quien entra a pie no deja
 *     rastro de otra forma.
 */

const IconoPuerta = DoorClosed;
const IconoGente = Users;
const IconoCarro = Car;
const IconoTelefono = Phone;
const IconoAlerta = ShieldAlert;

const FORM_HABITACION = { numero: '', piso: '', camas: 1, notas: '' };
const FORM_INTEGRANTE = {
  cedula: '', nombre: '', apellido: '', telefono: '', email: '',
  grado: '', unidad: '', jefe_nombre: '', jefe_telefono: '', tiene_vehiculo: false,
};

/**
 * Ficha de un ocupante.
 *
 * Muestra a la vez lo que la persona DECLARÓ sobre tener vehículo y las placas que
 * constan realmente a su nombre. Cuando no coinciden lo dice en voz alta: ese cruce es
 * la razón de ser del módulo, y esconderlo detrás de un solo indicador lo perdería.
 */
const FichaIntegrante = ({ integrante, onQrPeatonal, onDesasignar }) => {
  const declaroSinVehiculo = !integrante.tiene_vehiculo;
  const tienePlacas = integrante.vehiculos.length > 0;
  const discrepa = declaroSinVehiculo && tienePlacas;

  return (
    <div className="p-4 rounded-xl bg-bg-high/20 border border-text-main/5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {integrante.grado && (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                {integrante.grado}
              </span>
            )}
            <span className="text-sm font-black uppercase tracking-tight text-text-main truncate">
              {integrante.nombre} {integrante.apellido}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            <span className="font-mono">{integrante.cedula}</span>
            {integrante.unidad && <span className="truncate">{integrante.unidad}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onQrPeatonal(integrante)}
            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
            title="Generar carnet QR peatonal"
          >
            <QrCode size={15} />
          </button>
          <button
            onClick={() => onDesasignar(integrante)}
            className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
            title="Liberar la cama"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {(integrante.telefono || integrante.jefe_nombre) && (
        <div className="flex flex-col gap-1 text-[10px] text-text-sec">
          {integrante.telefono && (
            <span className="flex items-center gap-1.5">
              <IconoTelefono size={11} className="text-text-muted" /> {integrante.telefono}
            </span>
          )}
          {integrante.jefe_nombre && (
            <span className="text-text-muted">
              Jefe directo: <strong className="text-text-sec">{integrante.jefe_nombre}</strong>
              {integrante.jefe_telefono && ` · ${integrante.jefe_telefono}`}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-text-main/5">
        {tienePlacas ? (
          integrante.vehiculos.map((v) => (
            <span
              key={v.id}
              className="flex items-center gap-1.5 text-[9px] font-mono font-black uppercase px-2 py-1 rounded bg-bg-app text-text-sec border border-text-main/10"
            >
              <IconoCarro size={11} /> {v.placa}
            </span>
          ))
        ) : (
          <span className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-60">
            Sin vehículo registrado
          </span>
        )}

        {discrepa && (
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-warning">
            <IconoAlerta size={11} /> Declaró no tener vehículo
          </span>
        )}

        {integrante.tiene_qr_peatonal && (
          <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">
            Carnet emitido
          </span>
        )}
      </div>
    </div>
  );
};

const DormitorioDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dormitorio, setDormitorio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [modalHabitacion, setModalHabitacion] = useState(false);
  const [habitacionEditando, setHabitacionEditando] = useState(null);
  const [formHabitacion, setFormHabitacion] = useState(FORM_HABITACION);

  const [modalIntegrante, setModalIntegrante] = useState(null); // habitación destino
  const [formIntegrante, setFormIntegrante] = useState(FORM_INTEGRANTE);

  // { titulo, subtitulo, valor, archivo } — sirve para los dos tipos de QR.
  const [qrMostrado, setQrMostrado] = useState(null);
  const refQr = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDormitorio(await dormitoriosService.detalle(id));
    } catch {
      toast.error('No se pudo cargar el dormitorio');
      navigate('/comando/dormitorios');
    } finally {
      setCargando(false);
    }
  }, [id, navigate]);

  useEffect(() => { cargar(); }, [cargar]);

  // ─── Habitaciones ──────────────────────────────────────────────────────────

  const abrirNuevaHabitacion = () => {
    setHabitacionEditando(null);
    setFormHabitacion(FORM_HABITACION);
    setModalHabitacion(true);
  };

  const abrirEdicionHabitacion = (habitacion) => {
    setHabitacionEditando(habitacion);
    setFormHabitacion({
      numero: habitacion.numero,
      piso: habitacion.piso || '',
      camas: habitacion.camas,
      notas: habitacion.notas || '',
    });
    setModalHabitacion(true);
  };

  const guardarHabitacion = async (evento) => {
    evento.preventDefault();
    const camas = Number(formHabitacion.camas);

    if (!formHabitacion.numero.trim()) {
      toast.error('La habitación necesita un número');
      return;
    }
    if (!Number.isInteger(camas) || camas < 1) {
      toast.error('El número de camas tiene que ser al menos 1');
      return;
    }

    setGuardando(true);
    try {
      const datos = {
        numero: formHabitacion.numero.trim(),
        piso: formHabitacion.piso.trim() || null,
        camas,
        notas: formHabitacion.notas.trim() || null,
      };

      if (habitacionEditando) {
        await dormitoriosService.editarHabitacion(habitacionEditando.id, datos);
        toast.success('Habitación actualizada');
      } else {
        await dormitoriosService.crearHabitacion(id, datos);
        toast.success('Habitación registrada');
      }

      setModalHabitacion(false);
      await cargar();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo guardar la habitación');
    } finally {
      setGuardando(false);
    }
  };

  const desactivarHabitacion = async (habitacion) => {
    if (!window.confirm(`¿Dar de baja la habitación ${habitacion.numero}? Su QR de puerta dejará de funcionar.`)) return;

    try {
      await dormitoriosService.desactivarHabitacion(habitacion.id);
      toast.success('Habitación dada de baja');
      await cargar();
    } catch {
      toast.error('No se pudo dar de baja');
    }
  };

  // ─── QR de la puerta ───────────────────────────────────────────────────────

  const generarQrPuerta = async (habitacion) => {
    const yaTenia = habitacion.tiene_token;
    if (yaTenia && !window.confirm(
      `La habitación ${habitacion.numero} ya tiene un QR pegado. Generar otro invalida el impreso ` +
      `en el acto: habrá que imprimir el nuevo y cambiarlo físicamente. ¿Continuar?`
    )) return;

    try {
      const res = await dormitoriosService.generarQrHabitacion(habitacion.id);
      setQrMostrado({
        titulo: `Habitación ${habitacion.numero}`,
        subtitulo: 'Pegar en la puerta',
        valor: res.url_publica,
        archivo: `PUERTA_${dormitorio.nombre}_${habitacion.numero}`.replace(/\s+/g, '_'),
        nota: 'Este token no se puede volver a consultar: en la base solo queda su hash. Descárgalo ahora.',
      });
      await cargar();
    } catch {
      toast.error('No se pudo generar el QR de la puerta');
    }
  };

  const revocarQrPuerta = async (habitacion) => {
    if (!window.confirm(`¿Revocar el QR de la habitación ${habitacion.numero}? El adhesivo pegado dejará de servir.`)) return;

    try {
      await dormitoriosService.revocarQrHabitacion(habitacion.id);
      toast.success('QR revocado');
      await cargar();
    } catch {
      toast.error('No se pudo revocar');
    }
  };

  // ─── QR peatonal ───────────────────────────────────────────────────────────

  const generarQrPeatonal = async (integrante) => {
    if (integrante.tiene_qr_peatonal && !window.confirm(
      `${integrante.nombre} ${integrante.apellido} ya tiene carnet. Emitir otro anula el anterior. ¿Continuar?`
    )) return;

    try {
      const res = await dormitoriosService.generarQrPeatonal(integrante.usuario_id);
      setQrMostrado({
        titulo: res.nombre_completo,
        subtitulo: `${res.grado || 'Personal alojado'} · ${res.cedula}`,
        valor: res.token,
        archivo: `CARNET_${res.cedula}`,
        nota: 'El guardia lo escanea con el lector de siempre. Se puede reimprimir cuando haga falta.',
      });
      await cargar();
    } catch {
      toast.error('No se pudo emitir el carnet');
    }
  };

  const descargarQr = async () => {
    if (!refQr.current) return;
    try {
      const dataUrl = await toPng(refQr.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 4,
      });
      const enlace = document.createElement('a');
      enlace.download = `${qrMostrado.archivo}.png`;
      enlace.href = dataUrl;
      enlace.click();
    } catch {
      toast.error('No se pudo generar la imagen');
    }
  };

  // ─── Integrantes ───────────────────────────────────────────────────────────

  const abrirNuevoIntegrante = (habitacion) => {
    setFormIntegrante(FORM_INTEGRANTE);
    setModalIntegrante(habitacion);
  };

  const guardarIntegrante = async (evento) => {
    evento.preventDefault();
    if (!formIntegrante.cedula.trim() || !formIntegrante.nombre.trim() || !formIntegrante.apellido.trim()) {
      toast.error('Cédula, nombre y apellido son obligatorios');
      return;
    }

    setGuardando(true);
    try {
      await dormitoriosService.crearIntegrante({
        ...formIntegrante,
        cedula: formIntegrante.cedula.trim(),
        nombre: formIntegrante.nombre.trim(),
        apellido: formIntegrante.apellido.trim(),
        telefono: formIntegrante.telefono.trim() || null,
        email: formIntegrante.email.trim() || null,
        grado: formIntegrante.grado.trim() || null,
        unidad: formIntegrante.unidad.trim() || null,
        jefe_nombre: formIntegrante.jefe_nombre.trim() || null,
        jefe_telefono: formIntegrante.jefe_telefono.trim() || null,
        habitacion_id: modalIntegrante.id,
      });
      toast.success('Integrante registrado');
      setModalIntegrante(null);
      await cargar();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo registrar');
    } finally {
      setGuardando(false);
    }
  };

  const desasignarIntegrante = async (integrante) => {
    if (!window.confirm(`¿Liberar la cama de ${integrante.nombre} ${integrante.apellido}? Seguirá registrado en el sistema.`)) return;

    try {
      await dormitoriosService.desasignarHabitacion(integrante.usuario_id);
      toast.success('Cama liberada');
      await cargar();
    } catch {
      toast.error('No se pudo liberar la cama');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="min-h-screen bg-bg-app flex items-center justify-center gap-3 text-text-muted">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-xs font-black uppercase tracking-widest">Cargando dormitorio…</span>
      </div>
    );
  }

  if (!dormitorio) return null;

  return (
    <div className="min-h-screen bg-bg-app pb-24">
      <Header
        titulo={dormitorio.nombre}
        subtitle={`${dormitorio.ocupacion} de ${dormitorio.camas_totales} camas ocupadas · ${dormitorio.total_habitaciones} habitaciones`}
        actionElement={
          <Boton onClick={abrirNuevaHabitacion}>
            <Plus size={16} /> Habitación
          </Boton>
        }
      />

      <div className="container mx-auto px-4 md:px-8 flex flex-col gap-4">
        <button
          onClick={() => navigate('/comando/dormitorios')}
          className="self-start flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} /> Todos los dormitorios
        </button>

        {dormitorio.habitaciones.length === 0 ? (
          <Card className="py-16 flex flex-col items-center gap-4 text-center">
            <IconoPuerta size={40} className="text-text-muted opacity-40" />
            <p className="text-sm font-black uppercase tracking-widest text-text-main">Sin habitaciones</p>
            <Boton onClick={abrirNuevaHabitacion}><Plus size={16} /> Registrar la primera</Boton>
          </Card>
        ) : (
          dormitorio.habitaciones.map((h) => (
            <Card key={h.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <IconoPuerta size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-text-main">
                      Habitación {h.numero}
                      {h.piso && <span className="text-text-muted font-bold text-xs ml-2">Piso {h.piso}</span>}
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] font-black uppercase tracking-widest">
                      <span className={cn(h.camas_libres === 0 ? 'text-warning' : 'text-primary')}>
                        {h.ocupacion} / {h.camas} camas
                      </span>
                      {h.camas_libres > 0 && (
                        <span className="text-text-muted">{h.camas_libres} libre(s)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Boton size="sm" variant="secundario" onClick={() => abrirNuevoIntegrante(h)}>
                    <UserPlus size={13} /> Integrante
                  </Boton>
                  <Boton size="sm" variant="outline" onClick={() => generarQrPuerta(h)}>
                    <QrCode size={13} /> {h.tiene_token ? 'Rotar QR' : 'QR puerta'}
                  </Boton>
                  {h.tiene_token && (
                    <button
                      onClick={() => revocarQrPuerta(h)}
                      className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                      title="Revocar el QR de la puerta"
                    >
                      <X size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => abrirEdicionHabitacion(h)}
                    className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
                    title="Editar habitación"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => desactivarHabitacion(h)}
                    className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                    title="Dar de baja"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {h.notas && (
                <p className="text-[11px] text-text-muted italic">{h.notas}</p>
              )}

              {h.integrantes.length === 0 ? (
                <div className="py-6 flex flex-col items-center gap-2 text-text-muted">
                  <IconoGente size={22} className="opacity-30" />
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    Habitación vacía
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {h.integrantes.map((integrante) => (
                    <FichaIntegrante
                      key={integrante.usuario_id}
                      integrante={integrante}
                      onQrPeatonal={generarQrPeatonal}
                      onDesasignar={desasignarIntegrante}
                    />
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ─── Modal: habitación ─────────────────────────────────────────────── */}
      <Modal
        isOpen={modalHabitacion}
        onClose={() => setModalHabitacion(false)}
        title={habitacionEditando ? `Editar habitación ${habitacionEditando.numero}` : 'Nueva habitación'}
      >
        <form onSubmit={guardarHabitacion}>
          <Input
            label="Número"
            value={formHabitacion.numero}
            onChange={(e) => setFormHabitacion({ ...formHabitacion, numero: e.target.value })}
            placeholder="104"
            autoFocus
          />
          <Input
            label="Piso (opcional)"
            value={formHabitacion.piso}
            onChange={(e) => setFormHabitacion({ ...formHabitacion, piso: e.target.value })}
            placeholder="1"
          />
          <Input
            label="Camas"
            type="number"
            min="1"
            value={formHabitacion.camas}
            onChange={(e) => setFormHabitacion({ ...formHabitacion, camas: e.target.value })}
          />
          <Input
            label="Notas (opcional)"
            value={formHabitacion.notas}
            onChange={(e) => setFormHabitacion({ ...formHabitacion, notas: e.target.value })}
            placeholder="Baño compartido con la 105"
          />

          <div className="flex gap-3 justify-end">
            <Boton type="button" variant="ghost" onClick={() => setModalHabitacion(false)}>Cancelar</Boton>
            <Boton type="submit" isLoading={guardando}>Guardar</Boton>
          </div>
        </form>
      </Modal>

      {/* ─── Modal: integrante ─────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(modalIntegrante)}
        onClose={() => setModalIntegrante(null)}
        title={modalIntegrante ? `Integrante — habitación ${modalIntegrante.numero}` : ''}
        className="max-w-xl"
      >
        <form onSubmit={guardarIntegrante}>
          <p className="text-[10px] text-text-muted leading-relaxed mb-4">
            Si la cédula ya existe en el sistema, no se crea una segunda ficha: se completa
            la que hay, y los vehículos que esa persona ya tenga a su nombre aparecerán solos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input
              label="Cédula"
              value={formIntegrante.cedula}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, cedula: e.target.value })}
              placeholder="V12345678"
              autoFocus
            />
            <Input
              label="Grado"
              value={formIntegrante.grado}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, grado: e.target.value })}
              placeholder="Sargento Primero"
            />
            <Input
              label="Nombre"
              value={formIntegrante.nombre}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, nombre: e.target.value })}
            />
            <Input
              label="Apellido"
              value={formIntegrante.apellido}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, apellido: e.target.value })}
            />
            <Input
              label="Teléfono"
              value={formIntegrante.telefono}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, telefono: e.target.value })}
              placeholder="04141234567"
            />
            <Input
              label="Unidad"
              value={formIntegrante.unidad}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, unidad: e.target.value })}
              placeholder="Grupo Aéreo N.º 4"
            />
            <Input
              label="Jefe directo"
              value={formIntegrante.jefe_nombre}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, jefe_nombre: e.target.value })}
            />
            <Input
              label="Teléfono del jefe"
              value={formIntegrante.jefe_telefono}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, jefe_telefono: e.target.value })}
            />
            <Input
              label="Correo (opcional)"
              type="email"
              value={formIntegrante.email}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, email: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={formIntegrante.tiene_vehiculo}
              onChange={(e) => setFormIntegrante({ ...formIntegrante, tiene_vehiculo: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs font-bold text-text-sec">Declara tener vehículo</span>
          </label>

          <div className="flex gap-3 justify-end">
            <Boton type="button" variant="ghost" onClick={() => setModalIntegrante(null)}>Cancelar</Boton>
            <Boton type="submit" isLoading={guardando}>Registrar</Boton>
          </div>
        </form>
      </Modal>

      {/* ─── Modal: QR generado ────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(qrMostrado)}
        onClose={() => setQrMostrado(null)}
        title={qrMostrado?.titulo || ''}
      >
        {qrMostrado && (
          <div className="flex flex-col items-center gap-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted text-center">
              {qrMostrado.subtitulo}
            </p>

            <div ref={refQr} className="bg-white p-5 rounded-2xl">
              <QRCode
                value={String(qrMostrado.valor)}
                level="H"
                style={{ height: 'auto', maxWidth: '100%', width: '220px' }}
              />
            </div>

            <p className="text-[10px] text-text-muted text-center leading-relaxed">
              {qrMostrado.nota}
            </p>

            <div className="flex gap-3">
              <Boton variant="ghost" onClick={() => setQrMostrado(null)}>Cerrar</Boton>
              <Boton onClick={descargarQr}><Download size={15} /> Descargar</Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DormitorioDetalle;
