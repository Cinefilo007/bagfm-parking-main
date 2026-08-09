import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight, X, GraduationCap } from 'lucide-react';

import { Boton } from './Boton';

/**
 * Tour guiado paso a paso.
 *
 * Existe porque en la alcabala el personal rota: cada relevo puede traer a alguien
 * que nunca ha visto el sistema, y no hay quien le explique en el momento. Que la
 * pantalla se explique sola es más fiable que un instructivo que nadie lee.
 *
 * Se muestra una sola vez por dispositivo y queda siempre disponible desde el botón
 * de ayuda, para el que llega nuevo o para el que lo olvidó.
 *
 * Los pasos apuntan a atributos `data-tour` y no a clases CSS: una clase cambia al
 * retocar el diseño y el tour se rompería en silencio, sin que nadie lo note hasta
 * que un guardia se queda mirando un recuadro vacío.
 */

const MARGEN = 8;

export const TourGuiado = ({ pasos, clave, abierto, onCerrar }) => {
  const [indice, setIndice] = useState(0);
  const [recuadro, setRecuadro] = useState(null);

  // Solo los pasos cuyo elemento existe ahora mismo. Un paso que apunta a algo que
  // todavía no está en pantalla se salta en vez de dejar el foco en la nada.
  const visibles = pasos.filter((p) => !p.selector || document.querySelector(p.selector));
  const paso = visibles[indice];

  const medir = useCallback(() => {
    if (!paso?.selector) return setRecuadro(null);
    const el = document.querySelector(paso.selector);
    if (!el) return setRecuadro(null);

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const r = el.getBoundingClientRect();
    return setRecuadro({
      top: r.top - MARGEN,
      left: r.left - MARGEN,
      width: r.width + MARGEN * 2,
      height: r.height + MARGEN * 2,
    });
  }, [paso]);

  useLayoutEffect(() => {
    if (!abierto) return undefined;
    // Medir el elemento y guardar su recuadro es justo el caso de uso de un layout
    // effect: hay que leer el DOM ya dispuesto y pintar el foco encima antes de que
    // el usuario llegue a ver nada. La regla no distingue eso de un setState
    // gratuito, pero sin medir no hay dónde poner el foco.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto, medir]);

  const cerrar = useCallback(() => {
    if (clave) localStorage.setItem(`tour_${clave}`, 'visto');
    setIndice(0);
    onCerrar();
  }, [clave, onCerrar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsar = (e) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, visibles.length - 1));
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto, cerrar, visibles.length]);

  if (!abierto || !paso) return null;

  const ultimo = indice === visibles.length - 1;

  // El globo se coloca debajo del elemento, o encima si abajo no cabe.
  const alturaGlobo = 200;
  const cabeDebajo = recuadro
    ? recuadro.top + recuadro.height + alturaGlobo < window.innerHeight
    : true;

  const estiloGlobo = recuadro
    ? {
        position: 'fixed',
        top: cabeDebajo ? recuadro.top + recuadro.height + 12 : undefined,
        bottom: cabeDebajo ? undefined : window.innerHeight - recuadro.top + 12,
        left: Math.max(12, Math.min(recuadro.left, window.innerWidth - 372)),
        width: 360,
        zIndex: 10001,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 360,
        zIndex: 10001,
      };

  return (
    <>
      {/* El recuadro recorta la penumbra con una sombra enorme: así solo queda
          iluminado el elemento del que se está hablando. */}
      {recuadro ? (
        <div
          style={{
            position: 'fixed',
            top: recuadro.top,
            left: recuadro.left,
            width: recuadro.width,
            height: recuadro.height,
            borderRadius: 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
            border: '3px solid var(--color-primary, #10b981)',
            zIndex: 10000,
            pointerEvents: 'none',
            transition: 'all 0.25s ease',
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[10000] bg-black/75" />
      )}

      <div style={estiloGlobo} className="rounded-2xl bg-bg-card p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-wide text-text-main">
              {paso.titulo}
            </h3>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="shrink-0 text-text-sec hover:text-text-main"
            title="Cerrar la guía"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-text-sec">{paso.texto}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-sec">
            {indice + 1} de {visibles.length}
          </span>

          <div className="flex gap-2">
            {indice > 0 && (
              <Boton size="sm" variant="ghost" onClick={() => setIndice((i) => i - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Atrás
              </Boton>
            )}
            <Boton size="sm" onClick={() => (ultimo ? cerrar() : setIndice((i) => i + 1))}>
              {ultimo ? 'Entendido' : <>Siguiente <ChevronRight className="h-3.5 w-3.5" /></>}
            </Boton>
          </div>
        </div>
      </div>
    </>
  );
};
