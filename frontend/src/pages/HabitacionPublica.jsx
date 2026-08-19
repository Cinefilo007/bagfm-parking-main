import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, DoorClosed, Phone, MessageCircle, ShieldOff, User } from 'lucide-react';

import { dormitoriosService } from '../services/dormitorios.service';

/**
 * Ficha pública de una habitación. Se llega escaneando el QR pegado en su puerta.
 *
 * Sin sesión y sin barra de navegación, como el monitor de garita: quien toca una
 * puerta no tiene cuenta en el sistema. Se autentica el TOKEN, no la persona — 32
 * bytes aleatorios que el Comandante puede revocar desde el panel, momento en el que
 * el adhesivo pegado en la puerta deja de servir.
 *
 * Está pensada para un teléfono en un pasillo: contraste alto, botones grandes y
 * ninguna dependencia de que el tema del sistema esté en claro o en oscuro.
 */

const IconoPuerta = DoorClosed;
const IconoPersona = User;
const IconoTelefono = Phone;
const IconoWhatsapp = MessageCircle;
const IconoSinAcceso = ShieldOff;

/**
 * Deja el número como lo quiere wa.me: solo dígitos y con código de país.
 *
 * En la base los teléfonos se guardan tal cual los teclea el guardia — con guiones,
 * espacios o el cero inicial venezolano. Sin normalizar, el enlace de WhatsApp abre
 * en blanco y el botón de contacto no sirve para nada.
 */
const paraWhatsapp = (telefono) => {
  if (!telefono) return null;
  let digitos = telefono.replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.startsWith('58')) return digitos;
  if (digitos.startsWith('0')) return `58${digitos.slice(1)}`;
  return `58${digitos}`;
};

const Ocupante = ({ ocupante }) => {
  const whatsapp = paraWhatsapp(ocupante.telefono);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-emerald-400/10 text-emerald-400 shrink-0">
          <IconoPersona size={22} />
        </div>
        <div className="min-w-0">
          {ocupante.grado && (
            <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-400/15 text-emerald-400 mb-1.5">
              {ocupante.grado}
            </span>
          )}
          <h3 className="text-lg font-black uppercase tracking-tight text-white leading-tight">
            {ocupante.nombre} {ocupante.apellido}
          </h3>
          {ocupante.unidad && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mt-1">
              {ocupante.unidad}
            </p>
          )}
        </div>
      </div>

      {ocupante.jefe_nombre && (
        <div className="text-[11px] text-white/60 border-t border-white/10 pt-3">
          <span className="font-black uppercase tracking-widest text-white/40 block mb-0.5">Jefe directo</span>
          {ocupante.jefe_nombre}
          {ocupante.jefe_telefono && (
            <a href={`tel:${ocupante.jefe_telefono}`} className="text-emerald-400 ml-2 font-mono">
              {ocupante.jefe_telefono}
            </a>
          )}
        </div>
      )}

      {ocupante.telefono ? (
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${ocupante.telefono}`}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
          >
            <IconoTelefono size={16} /> Llamar
          </a>
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/10 text-white text-xs font-black uppercase tracking-widest border border-white/15 active:scale-95 transition-transform"
            >
              <IconoWhatsapp size={16} /> WhatsApp
            </a>
          ) : (
            <span className="flex items-center justify-center py-3.5 rounded-xl bg-white/5 text-white/30 text-xs font-black uppercase tracking-widest">
              Sin WhatsApp
            </span>
          )}
        </div>
      ) : (
        <span className="text-[11px] font-black uppercase tracking-widest text-white/30 text-center py-2">
          Sin teléfono registrado
        </span>
      )}
    </div>
  );
};

const HabitacionPublica = () => {
  const { token } = useParams();

  const [ficha, setFicha] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Una ficha de personal no tiene por qué acabar en un buscador. No cambia lo que
    // ve quien escanea, pero evita que la URL circule sola una vez que existe.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    let vigente = true;

    (async () => {
      try {
        const datos = await dormitoriosService.fichaPublica(token);
        if (vigente) setFicha(datos);
      } catch {
        if (vigente) setError(true);
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => { vigente = false; };
  }, [token]);

  // Fondo oscuro fijo y no los tokens del tema: esta página se ve fuera de la app, sin
  // el conmutador de tema al alcance, y muchas veces en un pasillo con poca luz.
  const marco = 'min-h-screen bg-slate-950 text-white flex flex-col items-center px-4 py-10';

  if (cargando) {
    return (
      <div className={`${marco} justify-center gap-3`}>
        <Loader2 className="animate-spin text-emerald-400" size={26} />
        <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Consultando…</span>
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className={`${marco} justify-center gap-4 text-center`}>
        <IconoSinAcceso size={40} className="text-white/20" />
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-white">Ficha no disponible</p>
          <p className="text-[11px] text-white/40 mt-2 max-w-xs">
            Este código ya no es válido o la habitación fue dada de baja. Consulta con el
            comando de la base.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={marco}>
      <div className="w-full max-w-md flex flex-col gap-6">
        <header className="flex flex-col items-center text-center gap-3">
          <div className="p-4 rounded-3xl bg-emerald-400/10 text-emerald-400">
            <IconoPuerta size={26} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
              {ficha.dormitorio}
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white leading-none mt-1">
              Habitación {ficha.habitacion}
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mt-2">
              {ficha.ocupacion} de {ficha.camas} camas
              {ficha.piso && ` · Piso ${ficha.piso}`}
            </p>
          </div>
        </header>

        {ficha.ocupantes.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 py-12 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
              Habitación sin ocupantes asignados
            </p>
          </div>
        ) : (
          ficha.ocupantes.map((ocupante, indice) => (
            <Ocupante key={`${ocupante.nombre}-${ocupante.apellido}-${indice}`} ocupante={ocupante} />
          ))
        )}

        <footer className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/20 pt-4">
          BAGFM · Base Aérea La Carlota
        </footer>
      </div>
    </div>
  );
};

export default HabitacionPublica;
