import React from 'react';

/**
 * `sitioAyuda` reserva el hueco del botón flotante de ayuda, que en móvil se pone
 * arriba a la izquierda y si no taparía el título. Es opcional porque solo lo
 * necesitan las pantallas que llevan ese botón.
 *
 * El hueco va a los dos lados: dejándolo solo a la izquierda, el contenido se centra
 * respecto a lo que sobra y la cabecera entera se ve corrida hacia la derecha.
 */
export const Header = ({ titulo, subtitle, actionElement, sitioAyuda = false }) => {
  return (
    <header className="bg-bg-app border-b border-bg-high/10 py-8 px-4 md:px-8 mb-6">
      <div className={`container mx-auto flex items-center justify-between ${sitioAyuda ? 'px-12 lg:px-0' : ''}`}>
        <div>
          {subtitle && (
            <p className="text-primary font-mono text-[10px] font-bold uppercase tracking-[0.2em] mb-1 opacity-80">
              {subtitle}
            </p>
          )}
          <h1 className="font-display font-black text-2xl lg:text-4xl tracking-tight text-text-main leading-none uppercase">
            {titulo}
          </h1>
        </div>
        {actionElement && (
          <div className="flex-shrink-0 ml-4">
            {actionElement}
          </div>
        )}
      </div>
    </header>
  );
};
