import React, { useMemo, useState } from 'react';
import { Search, LayoutGrid, List, CornerDownLeft } from 'lucide-react';

import { cn } from '../../lib/utils';
import { MODO_BOTONERA, MODO_LISTA } from './modoDestinos';

/**
 * Cómo el guardia marca a dónde va el vehículo.
 *
 * Hay dos formas y ninguna es mejor: en una garita con seis destinos, la botonera se
 * resuelve de un toque sin mirar; con treinta entidades dadas de alta, esa misma
 * botonera es una pared de botones donde hay que buscar con el dedo, y escribir tres
 * letras es más rápido. Como el sistema va a crecer y cada guardia tiene su maña, la
 * elección es suya y se recuerda en su teléfono.
 *
 * "Otro" siempre está disponible en los dos modos: si el sitio no está en la lista, el
 * registro no se puede quedar sin destino — un acceso que no dice a dónde fue el
 * vehículo no sirve para nada de lo que este sistema existe para hacer.
 */

/** Sin tildes y en minúsculas: nadie escribe "Pádel" con tilde a las seis de la mañana. */
const plano = (texto) =>
  (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const OPCIONES_MODO = [
  { valor: MODO_BOTONERA, icono: LayoutGrid, rotulo: 'Botones' },
  { valor: MODO_LISTA, icono: List, rotulo: 'Buscar' },
];

/** El conmutador. Va en la cabecera de Puerta, no dentro de cada tarjeta. */
export const ConmutadorModoDestinos = ({ modo, onCambiar }) => (
  <span data-tour="modo-destinos" className="flex items-center gap-1">
    <span className="text-text-sec">Destinos:</span>
    {OPCIONES_MODO.map((opcion) => {
      // El icono se saca a una constante en vez de desestructurarlo en el parámetro:
      // sin eslint-plugin-react, usarlo solo dentro del JSX no cuenta como uso.
      const Icono = opcion.icono;
      return (
        <button
          key={opcion.valor}
          type="button"
          onClick={() => onCambiar(opcion.valor)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 transition-colors',
            modo === opcion.valor
              ? 'bg-primary/15 text-primary'
              : 'text-text-sec hover:bg-bg-high'
          )}
        >
          <Icono className="h-3.5 w-3.5" /> {opcion.rotulo}
        </button>
      );
    })}
  </span>
);

const ESTILO_BOTON =
  'min-h-[56px] rounded-xl border border-primary/20 bg-bg-low px-3 text-xs font-bold ' +
  'uppercase tracking-wide text-text-main transition-colors hover:bg-primary/10 active:bg-primary/20';

export const SelectorDestino = ({ destinos, modo, onElegir }) => {
  const [texto, setTexto] = useState('');

  const filtrados = useMemo(() => {
    const busqueda = plano(texto.trim());
    if (!busqueda) return destinos;
    return destinos.filter((d) => plano(d.nombre).includes(busqueda));
  }, [destinos, texto]);

  if (modo === MODO_BOTONERA) {
    return (
      <div data-tour="destinos" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {destinos.map((destino) => (
          <button key={destino.id} type="button" onClick={() => onElegir(destino)} className={ESTILO_BOTON}>
            {destino.nombre}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onElegir(null)}
          className={cn(ESTILO_BOTON, 'border-text-sec/20 text-text-sec')}
        >
          Otro
        </button>
      </div>
    );
  }

  return (
    <div data-tour="destinos" className="mt-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-sec" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter registra la primera coincidencia: escribir "pad" + Enter cierra el
            // vehículo sin levantar la vista del teclado.
            if (e.key === 'Enter' && filtrados.length > 0) onElegir(filtrados[0]);
            if (e.key === 'Escape') setTexto('');
          }}
          placeholder="Escriba el destino…"
          className="input-field h-12 pl-10 text-sm font-bold uppercase"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {filtrados.map((destino, i) => (
          <button
            key={destino.id}
            type="button"
            onClick={() => onElegir(destino)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border border-primary/15 bg-bg-low',
              'px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-text-main',
              'transition-colors hover:bg-primary/10 active:bg-primary/20'
            )}
          >
            {destino.nombre}
            {/* La pista de Enter solo tiene sentido en la primera, que es la que se
                registraría, y solo cuando se está filtrando. */}
            {i === 0 && texto.trim() && (
              <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
          </button>
        ))}

        {filtrados.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-text-sec">
            Ningún destino coincide. Use «Otro» y escríbalo.
          </p>
        )}

        <button
          type="button"
          onClick={() => onElegir(null)}
          className="w-full rounded-lg border border-text-sec/20 bg-bg-low px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-text-sec transition-colors hover:bg-primary/10"
        >
          Otro — escribir el destino
        </button>
      </div>
    </div>
  );
};
