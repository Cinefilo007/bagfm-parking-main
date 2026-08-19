import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BedDouble, Plus, Loader2, MapPin, Users, DoorClosed,
  ChevronRight, Trash2, Pencil, X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Card } from '../../components/ui/Card';
import { Boton } from '../../components/ui/Boton';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Header } from '../../components/layout/Header';
import { dormitoriosService } from '../../services/dormitorios.service';
import { cn } from '../../lib/utils';

/**
 * Dormitorios de la base — Comandante.
 *
 * Es la puerta de entrada al censo de alojamiento. Cada dormitorio se georreferencia
 * desde el mapa táctico del dashboard, no desde aquí: allí se ve el terreno y aquí no,
 * y poner unas coordenadas a ciegas es la forma más rápida de que el pin acabe en
 * mitad de la pista.
 */

// El proyecto no tiene eslint-plugin-react: un identificador usado solo dentro de JSX
// no cuenta como uso. Por eso los iconos se sacan a const en vez de desestructurarlos.
const IconoCama = BedDouble;
const IconoPuerta = DoorClosed;
const IconoGente = Users;
const IconoMapa = MapPin;

const FORM_VACIO = { nombre: '', codigo: '', descripcion: '' };

/** Barra de ocupación. El color solo cambia cuando la lectura cambia con él. */
const BarraOcupacion = ({ ocupacion, total }) => {
  const pct = total > 0 ? Math.min(100, Math.round((ocupacion / total) * 100)) : 0;
  const lleno = total > 0 && ocupacion >= total;

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Ocupación</span>
        <span className={cn('text-xs font-black font-mono', lleno ? 'text-warning' : 'text-primary')}>
          {ocupacion} / {total}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-bg-high/40 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', lleno ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const Dormitorios = () => {
  const navigate = useNavigate();

  const [dormitorios, setDormitorios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDormitorios(await dormitoriosService.listar());
    } catch {
      toast.error('No se pudo cargar la lista de dormitorios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirEdicion = (dormitorio, evento) => {
    evento.stopPropagation();
    setEditando(dormitorio);
    setForm({
      nombre: dormitorio.nombre || '',
      codigo: dormitorio.codigo || '',
      descripcion: dormitorio.descripcion || '',
    });
    setModalAbierto(true);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El dormitorio necesita un nombre');
      return;
    }

    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || null,
        descripcion: form.descripcion.trim() || null,
      };

      if (editando) {
        await dormitoriosService.editar(editando.id, datos);
        toast.success('Dormitorio actualizado');
      } else {
        await dormitoriosService.crear(datos);
        toast.success('Dormitorio registrado. Ubícalo en el mapa del dashboard.');
      }

      setModalAbierto(false);
      await cargar();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (dormitorio, evento) => {
    evento.stopPropagation();
    if (!window.confirm(`¿Dar de baja el dormitorio ${dormitorio.nombre}? Sus habitaciones dejarán de estar disponibles.`)) return;

    try {
      await dormitoriosService.desactivar(dormitorio.id);
      toast.success('Dormitorio dado de baja');
      await cargar();
    } catch {
      toast.error('No se pudo dar de baja');
    }
  };

  return (
    <div className="min-h-screen bg-bg-app pb-24">
      <Header
        titulo="Dormitorios"
        subtitle="Alojamiento del personal // Censo de la base"
        actionElement={
          <Boton onClick={abrirNuevo}>
            <Plus size={16} /> Nuevo dormitorio
          </Boton>
        }
      />

      <div className="container mx-auto px-4 md:px-8">
        {cargando ? (
          <div className="flex items-center justify-center py-24 gap-3 text-text-muted">
            <Loader2 className="animate-spin" size={20} />
            <span className="text-xs font-black uppercase tracking-widest">Cargando alojamiento…</span>
          </div>
        ) : dormitorios.length === 0 ? (
          <Card className="py-16 flex flex-col items-center gap-4 text-center">
            <IconoCama size={40} className="text-text-muted opacity-40" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-text-main">Sin dormitorios registrados</p>
              <p className="text-[11px] text-text-muted mt-2 max-w-md">
                Registra el primero y después ubícalo en el mapa del dashboard para que aparezca
                junto a las alcabalas y las zonas.
              </p>
            </div>
            <Boton onClick={abrirNuevo}><Plus size={16} /> Nuevo dormitorio</Boton>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {dormitorios.map((d) => (
              <Card
                key={d.id}
                hoverable
                onClick={() => navigate(`/comando/dormitorios/${d.id}`)}
                className="flex flex-col gap-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shrink-0">
                      <IconoCama size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black uppercase tracking-tight text-text-main truncate group-hover:text-primary transition-colors">
                        {d.nombre}
                      </h3>
                      {d.codigo && (
                        <span className="text-[9px] font-mono font-black uppercase tracking-widest text-text-muted">
                          {d.codigo}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-text-muted opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all shrink-0" />
                </div>

                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <IconoPuerta size={13} /> {d.total_habitaciones} hab.
                  </span>
                  <span className="flex items-center gap-1.5">
                    <IconoGente size={13} /> {d.camas_totales} camas
                  </span>
                </div>

                <BarraOcupacion ocupacion={d.ocupacion} total={d.camas_totales} />

                <div className="flex items-center justify-between pt-3 border-t border-text-main/5">
                  {d.latitud && d.longitud ? (
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary/70">
                      <IconoMapa size={12} /> En el mapa
                    </span>
                  ) : (
                    // Sin coordenadas no sale en el mapa táctico, y el mapa es la vía por la
                    // que se entra a este módulo desde el dashboard.
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-danger/80">
                      <IconoMapa size={12} /> Sin ubicar
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => abrirEdicion(d, e)}
                      className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => desactivar(d, e)}
                      className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                      title="Dar de baja"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={editando ? 'Editar dormitorio' : 'Nuevo dormitorio'}
      >
        <form onSubmit={guardar}>
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Dormitorio Oficiales Norte"
            autoFocus
          />
          <Input
            label="Código (opcional)"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            placeholder="DOR-01"
          />
          <Input
            label="Descripción (opcional)"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Edificio de dos plantas junto al comedor"
          />

          <p className="text-[10px] text-text-muted leading-relaxed mb-5">
            La ubicación en el mapa se asigna desde el dashboard, con el botón de
            georreferenciación: hace falta ver el terreno para clavar el pin.
          </p>

          <div className="flex gap-3 justify-end">
            <Boton type="button" variant="ghost" onClick={() => setModalAbierto(false)}>
              <X size={15} /> Cancelar
            </Boton>
            <Boton type="submit" isLoading={guardando}>
              {editando ? 'Guardar cambios' : 'Registrar'}
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dormitorios;
