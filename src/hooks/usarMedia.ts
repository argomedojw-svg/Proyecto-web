/** Consulta de medios reactiva. Se usa para cambiar de estructura, no solo de estilo. */

import { useEffect, useState } from 'react';

export function usarMedia(consulta: string): boolean {
  const [coincide, setCoincide] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(consulta).matches,
  );

  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const revisar = () => setCoincide(lista.matches);
    revisar();
    lista.addEventListener('change', revisar);
    // Red de seguridad: algunos entornos redimensionan la ventana sin emitir
    // «change» en la MediaQueryList, y entonces la estructura se quedaría en el
    // modo anterior.
    window.addEventListener('resize', revisar);
    return () => {
      lista.removeEventListener('change', revisar);
      window.removeEventListener('resize', revisar);
    };
  }, [consulta]);

  return coincide;
}

/** true por debajo de 768 px: el comparador pasa de columnas a acordeón. */
export function usarEsEstrecho(): boolean {
  return usarMedia('(max-width: 767px)');
}
