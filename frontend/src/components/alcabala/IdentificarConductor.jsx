import React, { useState } from 'react';
import { IdCard, Camera, Check, X, ScanLine } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Boton } from '../ui/Boton';
import { CapturaCedula } from './CapturaCedula';
import { anprService } from '../../services/anpr.service';

/**
 * Captura opcional de la identidad del conductor.
 *
 * Sirve para que el registro se vaya llenando solo: el guardia fotografía la cédula,
 * la IA saca los datos y la placa deja de ser anónima. La próxima vez que ese carro
 * pase, la alcabala ya sabrá de quién es.
 *
 * Es OPCIONAL a propósito. En hora pico no se puede parar la fila por esto, y forzarlo
 * convertiría una mejora progresiva en un cuello de botella.
 *
 * Los campos quedan editables después de la lectura: la IA se equivoca con cédulas
 * gastadas o mal iluminadas, y es más rápido corregir una letra que repetir la foto.
 *
 * SOBRE EL TAMAÑO Y EL CONTRASTE
 * Todo el bloque tiene que caber en la pantalla de un teléfono a la vez: si el guardia
 * tiene que desplazarse para llegar a "Guardar", con un conductor esperando delante,
 * no lo va a usar. Por eso los campos van apretados y sin la separación por defecto
 * del formulario. Y el panel va sobre `bg-card` y no sobre `bg-low`, que es el mismo
 * color que usan los campos: en modo claro el formulario entero se veía como un
 * bloque gris uniforme donde no se distinguía dónde escribir.
 */

/** Campo compacto: la etiqueta pesa poco y el hueco entre campos es mínimo. */
const Campo = ({ etiqueta, valor, onChange, autoFocus = false }) => (
  <label className="block">
    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-text-sec">
      {etiqueta}
    </span>
    <input
      className="input-field h-10 min-h-0 font-bold uppercase"
      value={valor}
      onChange={onChange}
      autoFocus={autoFocus}
      autoComplete="off"
      spellCheck={false}
    />
  </label>
);

// Lo que se le dice al guardia según por qué falló la IA. El motivo lo manda el
// backend: sin él, una cuota agotada se veía igual que una foto movida y el guardia
// repetía la foto diez veces sin que nada pudiera funcionar.
const MOTIVOS = {
  cuota: 'La IA agotó su cuota por ahora. Escriba los datos a mano.',
  servicio: 'El servicio de IA no responde. Escriba los datos a mano.',
  clave: 'La IA no está configurada. Avise al comando y escriba a mano.',
  lectura: 'No se entendió el documento. Corrija o escriba a mano.',
  imagen: 'La foto no se pudo procesar. Repítala o escriba a mano.',
};

export const IdentificarConductor = ({ eventoId, onListo, onCancelar }) => {
  const [capturando, setCapturando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellido: '', cedula: '' });

  const cambiar = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.value.toUpperCase() }));

  const alTomarFoto = async (base64) => {
    setCapturando(false);
    setLeyendo(true);
    try {
      const respuesta = await anprService.leerCedula(base64);
      const datos = respuesta?.data || {};

      setForm({
        nombre: (datos.nombre || datos.nombres || '').toUpperCase(),
        apellido: (datos.apellido || datos.apellidos || '').toUpperCase(),
        cedula: (datos.cedula || '').toString().toUpperCase(),
      });

      if (respuesta?.error) {
        toast(MOTIVOS[respuesta.error] || MOTIVOS.lectura, { icon: '✍️', duration: 5000 });
      } else if (!datos.cedula) {
        toast('No se leyó la cédula. Complete los datos a mano.', { icon: '✍️' });
      } else {
        toast.success('Cédula leída. Revise antes de guardar.');
      }
    } catch {
      toast.error('No se pudo consultar la IA. Escriba los datos a mano.');
    } finally {
      setLeyendo(false);
    }
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.cedula.trim()) {
      toast.error('Faltan datos del conductor');
      return;
    }

    setGuardando(true);
    try {
      const r = await anprService.identificarConductor(eventoId, form);
      toast.success(
        r.vehiculo_creado
          ? `${form.nombre} ${form.apellido} registrado con su vehículo`
          : `Vehículo asociado a ${form.nombre} ${form.apellido}`
      );
      // La ficha recalculada vuelve del backend: el vehículo que hace un segundo era
      // desconocido ya tiene titular, y la tarjeta lo tiene que reflejar sin recargar.
      onListo(r.ficha || null);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo guardar');
      setGuardando(false);
    }
  };

  return (
    <>
      {capturando && (
        <CapturaCedula onFoto={alTomarFoto} onCerrar={() => setCapturando(false)} />
      )}

      <div className="mt-3 space-y-2.5 rounded-xl border-2 border-primary/40 bg-bg-card p-3 shadow-tactica">
        <div className="flex items-center gap-2">
          <IdCard className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-[11px] font-black uppercase tracking-widest text-text-main">
            Identificación del conductor
          </p>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-text-sec">
            Opcional
          </span>
        </div>

        <Boton
          className="h-11 w-full"
          isLoading={leyendo}
          onClick={() => setCapturando(true)}
        >
          {leyendo ? 'Leyendo el documento…' : <><Camera className="h-4 w-4" /> Fotografiar cédula</>}
        </Boton>

        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Nombre" valor={form.nombre} onChange={cambiar('nombre')} />
          <Campo etiqueta="Apellido" valor={form.apellido} onChange={cambiar('apellido')} />
        </div>
        <Campo etiqueta="Cédula" valor={form.cedula} onChange={cambiar('cedula')} />

        <p className="flex items-center gap-1.5 text-[10px] leading-tight text-text-sec">
          <ScanLine className="h-3 w-3 shrink-0 opacity-60" />
          Puede corregir a mano lo que la lectura haya sacado mal.
        </p>

        <div className="flex items-stretch gap-2">
          <Boton variant="ghost" className="h-11 px-2 text-[11px]" onClick={onCancelar} disabled={guardando}>
            <X className="h-4 w-4" /> Cancelar
          </Boton>
          {/* Relleno y letra reducidos a mano: con el tamaño por defecto, el rótulo se
              parte en dos líneas y el botón se sale del panel en una pantalla de 390. */}
          <Boton
            className="h-11 flex-1 whitespace-nowrap px-3 text-[11px]"
            onClick={guardar}
            isLoading={guardando}
          >
            <Check className="h-4 w-4" /> Guardar conductor
          </Boton>
        </div>
      </div>
    </>
  );
};
