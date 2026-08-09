import React from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Botón flotante que abre la guía de la pantalla.
 *
 * Va arriba a la IZQUIERDA, en espejo del conmutador de tema que flota a la derecha:
 * son las dos cosas que no pertenecen al trabajo de la garita —una explica la pantalla,
 * la otra cambia cómo se ve— y ninguna debe robarle sitio a lo que sí importa, que es
 * la tarjeta del vehículo que está esperando.
 *
 * Solo en móvil. En escritorio la barra lateral ocupa ese borde, así que ahí la ayuda
 * sigue siendo el botón con texto de la cabecera, que tiene sitio de sobra.
 *
 * El símbolo es la interrogación y no el birrete del tour: un guardia de relevo que
 * nunca ha visto el sistema busca ayuda, no una clase.
 */
export const BotonAyuda = ({ onClick, titulo = 'Cómo funciona esta pantalla' }) => (
  <button
    type="button"
    onClick={onClick}
    title={titulo}
    aria-label={titulo}
    className="fixed top-6 left-6 z-[100] flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-bg-modal/80 text-primary shadow-tactica backdrop-blur-md transition-all hover:scale-105 active:scale-95 lg:hidden"
  >
    <HelpCircle size={20} />
  </button>
);
