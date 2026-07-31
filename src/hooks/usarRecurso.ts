/**
 * Hook de carga asíncrona con estados explícitos.
 *
 * Regla transversal del proyecto: todo componente que carga datos maneja cuatro
 * estados —cargando, vacío, sin resultados y error de carga—. Este hook cubre
 * «cargando» y «error»; «vacío» y «sin resultados» los decide quien consume,
 * porque dependen del contenido.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorDeCarga, vaciarCache } from '@/lib/loader';

export type Recurso<T> =
  | { estado: 'cargando'; datos: null; error: null }
  | { estado: 'listo'; datos: T; error: null }
  | { estado: 'error'; datos: null; error: ErrorDeCarga };

export type ResultadoRecurso<T> = Recurso<T> & {
  reintentar: () => void;
};

export function usarRecurso<T>(
  cargar: () => Promise<T>,
  dependencias: readonly unknown[],
): ResultadoRecurso<T> {
  const [recurso, setRecurso] = useState<Recurso<T>>({
    estado: 'cargando',
    datos: null,
    error: null,
  });
  const [intento, setIntento] = useState(0);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  useEffect(() => {
    let vigente = true;
    setRecurso({ estado: 'cargando', datos: null, error: null });

    cargarRef
      .current()
      .then((datos) => {
        if (vigente) setRecurso({ estado: 'listo', datos, error: null });
      })
      .catch((error: unknown) => {
        if (!vigente) return;
        const normalizado =
          error instanceof ErrorDeCarga
            ? error
            : new ErrorDeCarga(
                'red',
                '(desconocido)',
                error instanceof Error ? error.message : String(error),
              );
        setRecurso({ estado: 'error', datos: null, error: normalizado });
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, intento]);

  const reintentar = useCallback(() => {
    // Se vacía la caché para que reintentar vuelva a leer el archivo del disco:
    // lo normal es que el usuario acabe de corregir el JSON.
    vaciarCache();
    setIntento((n) => n + 1);
  }, []);

  return { ...recurso, reintentar } as ResultadoRecurso<T>;
}
