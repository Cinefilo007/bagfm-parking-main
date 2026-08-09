import { useState, useEffect } from 'react';

/**
 * Decide si un tour guiado debe abrirse solo.
 *
 * Se arranca una vez por dispositivo, no por sesión: el guardia entra y sale del
 * sistema varias veces por turno y repetirle la guía en cada entrada sería un
 * estorbo, no una ayuda.
 *
 * Vive en su propio archivo y no junto al componente porque mezclar un hook con
 * un componente en el mismo módulo rompe la recarga en caliente del desarrollo.
 */
export const useTour = (clave) => {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(`tour_${clave}`)) return undefined;

    // Se espera a que la pantalla termine de pintar: midiendo antes, los elementos
    // aún no tienen su posición definitiva y el foco cae torcido.
    const t = setTimeout(() => setAbierto(true), 900);
    return () => clearTimeout(t);
  }, [clave]);

  return {
    abierto,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
  };
};
