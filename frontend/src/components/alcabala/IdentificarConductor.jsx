import React, { useState, useRef } from 'react';
import { IdCard, Camera, Loader2, Check, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Boton } from '../ui/Boton';
import { Input } from '../ui/Input';
import { anprService } from '../../services/anpr.service';

/**
 * Captura opcional de la identidad del conductor.
 *
 * Sirve para que el registro se vaya llenando solo: el guardia fotografía la cédula,
 * la IA saca los datos y la placa deja de ser anónima. La próxima vez que ese carro
 * pase, la alcabala ya sabrá de quién es.
 *
 * Es OPCIONAL a propósito. En hora pica no se puede parar la fila por esto, y forzarlo
 * convertiría una mejora progresiva en un cuello de botella.
 *
 * Los campos quedan editables después de la lectura: la IA se equivoca con cédulas
 * gastadas o mal iluminadas, y es más rápido corregir una letra que repetir la foto.
 */
export const IdentificarConductor = ({ eventoId, onListo, onCancelar }) => {
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellido: '', cedula: '' });
  const entradaFoto = useRef(null);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const alTomarFoto = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setLeyendo(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result).split(',')[1]);
        lector.onerror = reject;
        lector.readAsDataURL(archivo);
      });

      const { data } = await anprService.leerCedula(base64);
      setForm({
        nombre: (data?.nombre || data?.nombres || '').toUpperCase(),
        apellido: (data?.apellido || data?.apellidos || '').toUpperCase(),
        cedula: (data?.cedula || '').toString().toUpperCase(),
      });

      if (!data?.cedula) {
        toast('No se leyó la cédula. Complete los datos a mano.', { icon: '✍️' });
      }
    } catch {
      toast.error('No se pudo leer el documento. Escriba los datos a mano.');
    } finally {
      setLeyendo(false);
      // Se limpia para que volver a elegir la misma foto dispare el evento otra vez.
      if (entradaFoto.current) entradaFoto.current.value = '';
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
      onListo();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo guardar');
      setGuardando(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-bg-low p-3">
      <div className="flex items-center gap-2">
        <IdCard className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold uppercase tracking-wide text-text-main">
          Identificación del conductor
        </p>
      </div>

      <input
        ref={entradaFoto}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={alTomarFoto}
        className="hidden"
      />

      <Boton
        variant="secundario"
        className="w-full"
        isLoading={leyendo}
        onClick={() => entradaFoto.current?.click()}
      >
        {leyendo ? 'Leyendo el documento…' : <><Camera className="h-4 w-4" /> Fotografiar cédula</>}
      </Boton>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input label="Nombre" value={form.nombre} onChange={cambiar('nombre')} />
        <Input label="Apellido" value={form.apellido} onChange={cambiar('apellido')} />
        <Input label="Cédula" value={form.cedula} onChange={cambiar('cedula')} />
      </div>

      <p className="text-[11px] text-text-sec">
        Puede corregir a mano lo que la lectura haya sacado mal.
      </p>

      <div className="flex justify-end gap-2">
        <Boton variant="ghost" size="sm" onClick={onCancelar} disabled={guardando}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Boton>
        <Boton size="sm" onClick={guardar} isLoading={guardando}>
          <Check className="h-3.5 w-3.5" /> Guardar conductor
        </Boton>
      </div>
    </div>
  );
};
