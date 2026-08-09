import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
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

/** Dos recuadros iguales no justifican volver a pintar. Ver el bucle de abajo. */
const mismoRecuadro = (a, b) =>
  a === b || (
    !!a && !!b &&
    Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
  );

export const TourGuiado = ({ pasos, clave, abierto, onCerrar }) => {
  const [indice, setIndice] = useState(0);
  const [recuadro, setRecuadro] = useState(null);
  // La altura real del globo, no una estimada: el texto de cada paso es de largo
  // distinto y colocarlo suponiendo 200 px lo dejaba fuera de la pantalla justo en
  // los pasos largos, que son los que más falta hace leer.
  const [altoGlobo, setAltoGlobo] = useState(0);
  const globoRef = useRef(null);

  // Solo los pasos cuyo elemento existe ahora mismo. Un paso que apunta a algo que
  // todavía no está en pantalla se salta en vez de dejar el foco en la nada.
  const visibles = pasos.filter((p) => !p.selector || document.querySelector(p.selector));
  const paso = visibles[indice];
  const selector = paso?.selector;

  // Medir es SOLO leer dónde está el elemento. Antes esta misma función también
  // hacía scrollIntoView, y como estaba suscrita al evento 'scroll' se realimentaba:
  // desplazar disparaba medir, medir volvía a desplazar y el navegador se quedaba
  // dando vueltas repintando. Solo pasaba cuando la página tenía scroll de verdad
  // —un vehículo en pantalla con su botonera de destinos abierta—, y desde fuera se
  // veía como si la pantalla se hubiera congelado.
  const medir = useCallback(() => {
    if (!selector) return setRecuadro(null);
    const el = document.querySelector(selector);
    if (!el) return setRecuadro(null);

    const r = el.getBoundingClientRect();
    const nuevo = {
      top: r.top - MARGEN,
      left: r.left - MARGEN,
      width: r.width + MARGEN * 2,
      height: r.height + MARGEN * 2,
    };
    // Sin esta comparación, cada evento de scroll deja un estado nuevo aunque el
    // elemento no se haya movido, y con el scroll suave son decenas por segundo.
    return setRecuadro((previo) => (mismoRecuadro(previo, nuevo) ? previo : nuevo));
  }, [selector]);

  // Traer el elemento a la vista es cosa del cambio de paso, no de cada medición.
  useEffect(() => {
    if (!abierto || !selector) return;
    document.querySelector(selector)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [abierto, selector]);

  useLayoutEffect(() => {
    if (!abierto) return undefined;

    // Un solo repintado por fotograma: mientras el scroll suave está en marcha
    // llegan muchos más eventos que fotogramas, y medir en todos no cambia nada.
    let pendiente = 0;
    const alMover = () => {
      if (pendiente) return;
      pendiente = window.requestAnimationFrame(() => {
        pendiente = 0;
        medir();
      });
    };

    // Medir el elemento y guardar su recuadro es justo el caso de uso de un layout
    // effect: hay que leer el DOM ya dispuesto y pintar el foco encima antes de que
    // el usuario llegue a ver nada. La regla no distingue eso de un setState
    // gratuito, pero sin medir no hay dónde poner el foco.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    medir();
    window.addEventListener('resize', alMover);
    window.addEventListener('scroll', alMover, true);
    return () => {
      if (pendiente) window.cancelAnimationFrame(pendiente);
      window.removeEventListener('resize', alMover);
      window.removeEventListener('scroll', alMover, true);
    };
  }, [abierto, medir]);

  // Se mide después de pintar, con el texto de este paso ya dentro. Depende del paso
  // (cada texto tiene su largo) y del recuadro, que es lo que cambia al redimensionar.
  // Guardar solo cuando la altura cambia de verdad corta cualquier cadena de
  // actualizaciones: medir no puede cambiar lo medido.
  useLayoutEffect(() => {
    if (!abierto) return;
    const alto = globoRef.current?.offsetHeight || 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAltoGlobo((previo) => (Math.abs(previo - alto) < 2 ? previo : alto));
  }, [abierto, indice, recuadro]);

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

  // El globo se coloca debajo del elemento, o encima si abajo no cabe. Y si no cabe
  // en ningún lado, se pega al borde inferior de la ventana ENCIMA del elemento.
  //
  // Ese último caso no es raro: la tarjeta de un vehículo con su botonera de destinos
  // abierta ocupa casi toda la pantalla del teléfono. Antes se calculaba `bottom`
  // contra el borde superior del elemento y el globo terminaba fuera de la pantalla
  // (medido: top −187 en una ventana de 600). El guardia veía la penumbra, el recuadro
  // y ni un solo control — ni el botón de siguiente ni la equis para salir. Desde
  // fuera parecía que la pantalla se había congelado, y si el tour se había abierto
  // solo, no había forma de quitárselo de encima.
  const alto = altoGlobo || 200;
  const margen = 12;
  const limiteInferior = Math.max(margen, window.innerHeight - alto - margen);

  let arriba = margen;
  if (recuadro) {
    if (recuadro.top + recuadro.height + alto + margen <= window.innerHeight) {
      arriba = recuadro.top + recuadro.height + margen;          // debajo
    } else if (recuadro.top - alto - margen >= margen) {
      arriba = recuadro.top - alto - margen;                     // encima
    } else {
      arriba = limiteInferior;                                   // pegado al fondo
    }
    arriba = Math.min(Math.max(margen, arriba), limiteInferior);
  }

  const estiloGlobo = recuadro
    ? {
        position: 'fixed',
        top: arriba,
        left: Math.max(12, Math.min(recuadro.left, window.innerWidth - 372)),
        width: Math.min(360, window.innerWidth - 24),
        zIndex: 10001,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: Math.min(360, window.innerWidth - 24),
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
        // Sin elemento que resaltar, este fondo sí captura los toques. Se cierra al
        // pulsarlo: nadie debe poder quedarse atrapado detrás de una guía.
        <div
          className="fixed inset-0 z-[10000] bg-black/75"
          onClick={cerrar}
          role="presentation"
        />
      )}

      <div ref={globoRef} style={estiloGlobo} className="rounded-2xl bg-bg-card p-4 shadow-2xl">
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
