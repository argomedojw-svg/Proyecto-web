/**
 * Seguimiento de la sección visible durante el desplazamiento (scrollspy).
 *
 * Se usa IntersectionObserver con una banda estrecha en la parte superior de la
 * ventana: la sección activa es la última cuyo encabezado ha cruzado esa banda.
 * Así el índice lateral no parpadea entre dos secciones al desplazarse.
 */

import { useEffect, useRef, useState } from 'react';

export function usarSeccionActiva(ids: string[]): string | null {
  const [activa, setActiva] = useState<string | null>(ids[0] ?? null);
  const visibles = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (ids.length === 0) return;
    visibles.current = new Set();

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const id = entrada.target.id;
          if (entrada.isIntersecting) visibles.current.add(id);
          else visibles.current.delete(id);
        }

        // La primera de las visibles en orden del documento.
        const primera = ids.find((id) => visibles.current.has(id));
        if (primera) {
          setActiva(primera);
          return;
        }

        // Ninguna visible: se conserva la última que quedó por encima.
        const desplazamiento = window.scrollY;
        let candidata: string | null = null;
        for (const id of ids) {
          const elemento = document.getElementById(id);
          if (elemento && elemento.getBoundingClientRect().top + desplazamiento <= desplazamiento + 120) {
            candidata = id;
          }
        }
        if (candidata) setActiva(candidata);
      },
      {
        // Banda de detección: desde 88 px por debajo del borde superior hasta
        // el 65 % inferior de la ventana.
        rootMargin: '-88px 0px -65% 0px',
        threshold: 0,
      },
    );

    for (const id of ids) {
      const elemento = document.getElementById(id);
      if (elemento) observador.observe(elemento);
    }

    return () => observador.disconnect();
  }, [ids]);

  return activa;
}
