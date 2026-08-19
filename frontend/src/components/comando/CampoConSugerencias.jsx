import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Check } from 'lucide-react';

import { cn } from '../../lib/utils';

/**
 * Campo de texto que sugiere mientras se escribe, sin dejar de aceptar texto libre.
 *
 * Los cuatro campos del alta de integrante que buscan contra la base —cédula, unidad,
 * jefe directo y placa— comparten el mismo problema: si son campos libres se duplican
 * los datos (tres grafías del mismo apellido, la misma cédula con y sin la "V"), pero
 * si son listas cerradas no se puede dar de alta a quien todavía no está. Este
 * componente resuelve las dos cosas a la vez: propone lo que ya existe y deja escribir
 * lo que no.
 *
 * La búsqueda se retrasa 300 ms desde la última tecla. Sin eso, teclear una cédula de
 * ocho dígitos dispara ocho consultas y las respuestas llegan desordenadas: la de
 * "1234" puede aterrizar después de la de "12345678" y pisar la lista buena.
 */

const IconoCargando = Loader2;
const IconoElegido = Check;

const CampoConSugerencias = ({
  etiqueta,
  valor,
  onChange,
  onElegir,
  buscar,
  render,
  claveDe,
  placeholder,
  minimoCaracteres = 2,
  autoFocus = false,
  // Cuando la lista es corta y fija (las unidades), se muestra entera al enfocar en
  // vez de esperar a que el usuario adivine qué escribir.
  sugerenciasIniciales = null,
  ayuda = null,
  elegido = false,
}) => {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const contenedor = useRef(null);
  // Cada búsqueda lleva número: solo la última que se lanzó puede pintar resultados.
  const peticion = useRef(0);

  const cerrarSiEsFuera = useCallback((evento) => {
    if (contenedor.current && !contenedor.current.contains(evento.target)) {
      setAbierto(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', cerrarSiEsFuera);
    return () => document.removeEventListener('mousedown', cerrarSiEsFuera);
  }, [cerrarSiEsFuera]);

  useEffect(() => {
    const termino = (valor || '').trim();

    if (termino.length < minimoCaracteres) {
      setSugerencias(sugerenciasIniciales || []);
      setCargando(false);
      return undefined;
    }

    const mia = ++peticion.current;
    setCargando(true);

    const temporizador = setTimeout(async () => {
      try {
        const resultados = await buscar(termino);
        if (peticion.current === mia) setSugerencias(resultados || []);
      } catch {
        if (peticion.current === mia) setSugerencias([]);
      } finally {
        if (peticion.current === mia) setCargando(false);
      }
    }, 300);

    return () => clearTimeout(temporizador);
  }, [valor, buscar, minimoCaracteres, sugerenciasIniciales]);

  const hayQueMostrar = abierto && (cargando || sugerencias.length > 0);

  return (
    <div className="w-full mb-4 relative" ref={contenedor}>
      {etiqueta && (
        <label className="block tracking-[0.05em] text-text-sec text-xs font-medium mb-1.5">
          {etiqueta}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          className={cn('input-field', elegido && 'pr-9')}
          value={valor || ''}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => { onChange(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
        />
        {elegido && (
          <IconoElegido
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none"
          />
        )}
      </div>

      {ayuda && (
        <p className="mt-1 text-[10px] text-text-muted leading-snug">{ayuda}</p>
      )}

      {hayQueMostrar && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-text-main/10 bg-bg-modal shadow-2xl">
          {cargando ? (
            <div className="flex items-center gap-2 px-4 py-3 text-text-muted">
              <IconoCargando size={14} className="animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Buscando…</span>
            </div>
          ) : (
            sugerencias.map((sugerencia) => (
              <button
                key={claveDe(sugerencia)}
                type="button"
                onClick={() => { onElegir(sugerencia); setAbierto(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-primary/10 transition-colors border-b border-text-main/5 last:border-0"
              >
                {render(sugerencia)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CampoConSugerencias;
