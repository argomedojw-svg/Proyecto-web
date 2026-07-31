/**
 * Sección desplegable con estado recordado en localStorage.
 *
 * Se usa <details>/<summary> nativos: los lectores de pantalla anuncian el
 * estado desplegado/plegado sin ARIA adicional y funciona con teclado por
 * defecto. El estado se guarda por trastorno y clave de sección.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { CLAVES, escribir, leer } from '@/lib/almacenamiento';

type EstadoSecciones = Record<string, boolean>;

function leerEstado(): EstadoSecciones {
  return leer<EstadoSecciones>(CLAVES.secciones, {});
}

export function SeccionDesplegable({
  id,
  claveMemoria,
  titulo,
  reconocida,
  children,
}: {
  id: string;
  claveMemoria: string;
  titulo: string;
  /** false = el título no está en el mapa de normalización; se avisa discretamente. */
  reconocida: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState<boolean>(() => leerEstado()[claveMemoria] ?? true);
  const detallesRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const estado = leerEstado();
    estado[claveMemoria] = abierta;
    escribir(CLAVES.secciones, estado);
  }, [abierta, claveMemoria]);

  /* Si se llega por un enlace con ancla, la sección se abre sola. */
  useEffect(() => {
    const abrirSiEsElDestino = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;
      if (hash === id || detallesRef.current?.querySelector(`#${CSS.escape(hash)}`)) {
        setAbierta(true);
      }
    };
    abrirSiEsElDestino();
    window.addEventListener('hashchange', abrirSiEsElDestino);
    return () => window.removeEventListener('hashchange', abrirSiEsElDestino);
  }, [id]);

  const copiarEnlace = useCallback(
    (evento: React.MouseEvent) => {
      evento.preventDefault();
      evento.stopPropagation();
      const url = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash.split('#')[0] ?? ''}`;
      void navigator.clipboard?.writeText(`${url}#${id}`).catch(() => {
        /* Sin portapapeles disponible: no es crítico. */
      });
    },
    [id],
  );

  return (
    <details
      ref={detallesRef}
      id={id}
      open={abierta}
      onToggle={(e) => setAbierta((e.currentTarget as HTMLDetailsElement).open)}
      className="scroll-mt-20 border-b border-borde py-1 last:border-b-0 print:border-b-0"
    >
      <summary className="group -mx-2 flex cursor-pointer list-none items-center gap-2 rounded px-2 py-2.5 transition hover:bg-fondo-hover print:hover:bg-transparent [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-4 w-4 shrink-0 text-texto-tenue transition-transform group-open:rotate-90 print:hidden"
          aria-hidden="true"
        />
        <h2 className="min-w-0 flex-1 font-manual text-[1.1875rem] font-semibold tracking-tight text-texto">
          {titulo}
        </h2>

        {!reconocida && (
          <span
            className="shrink-0 rounded border border-borde px-1.5 py-0.5 text-[0.6875rem] font-normal text-texto-tenue print:hidden"
            title="El título de esta sección no está en el mapa de normalización. El contenido se conserva íntegro."
          >
            sin normalizar
          </span>
        )}

        <button
          type="button"
          onClick={copiarEnlace}
          aria-label={`Copiar enlace a «${titulo}»`}
          title="Copiar enlace a esta sección"
          className="shrink-0 rounded p-1 text-texto-tenue opacity-0 transition hover:bg-fondo-sutil hover:text-texto focus-visible:opacity-100 group-hover:opacity-100 print:hidden"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </summary>

      <div className="pb-6 pl-6 pt-1 print:pl-0">{children}</div>
    </details>
  );
}
