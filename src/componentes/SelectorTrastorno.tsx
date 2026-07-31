/** Selector de trastorno para el comparador y el modo estudio. */

import { useEffect, useMemo, useState } from 'react';
import { cargarIndiceBusqueda } from '@/lib/loader';
import { usarRecurso } from '@/hooks/usarRecurso';

export type Seleccion = { categoriaId: string; trastornoId: string };

export function SelectorTrastorno({
  valor,
  alCambiar,
  etiqueta,
  excluir = [],
}: {
  valor: Seleccion | null;
  alCambiar: (seleccion: Seleccion | null) => void;
  etiqueta: string;
  excluir?: string[];
}) {
  const indice = usarRecurso(cargarIndiceBusqueda, []);
  const [id, setId] = useState(valor?.trastornoId ?? '');

  useEffect(() => {
    setId(valor?.trastornoId ?? '');
  }, [valor?.trastornoId]);

  const opciones = useMemo(() => {
    if (indice.estado !== 'listo') return [];
    return [...indice.datos.entradas]
      .filter((e) => !excluir.includes(e.id) || e.id === id)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice.estado, indice.datos, excluir.join('|'), id]);

  return (
    <label className="block">
      <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-wide text-texto-tenue">
        {etiqueta}
      </span>
      <select
        value={id}
        disabled={indice.estado !== 'listo'}
        onChange={(e) => {
          const nuevo = e.target.value;
          setId(nuevo);
          const entrada = opciones.find((o) => o.id === nuevo);
          alCambiar(
            entrada ? { categoriaId: entrada.categoriaId, trastornoId: entrada.id } : null,
          );
        }}
        className="w-full rounded border border-borde bg-fondo-elevado px-2.5 py-2 text-sm text-texto disabled:opacity-60"
      >
        <option value="">
          {indice.estado === 'cargando' ? 'Cargando…' : '— Sin seleccionar —'}
        </option>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.nombre}
            {opcion.codigos[0] ? ` · ${opcion.codigos[0]}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
