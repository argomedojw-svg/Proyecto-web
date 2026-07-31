/** Migas de pan. Ruta jerárquica, no historial de navegación. */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export type Miga = {
  etiqueta: string;
  ruta?: string;
};

export function Migas({ items }: { items: Miga[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[0.8125rem] text-texto-tenue">
        {items.map((item, i) => {
          const ultimo = i === items.length - 1;
          return (
            <li key={`${item.etiqueta}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-texto-tenue" aria-hidden="true" />
              )}
              {item.ruta && !ultimo ? (
                <Link
                  to={item.ruta}
                  className="truncate rounded px-0.5 hover:text-texto hover:underline"
                >
                  {item.etiqueta}
                </Link>
              ) : (
                <span
                  className={`truncate px-0.5 ${ultimo ? 'text-texto-suave' : ''}`}
                  aria-current={ultimo ? 'page' : undefined}
                >
                  {item.etiqueta}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
