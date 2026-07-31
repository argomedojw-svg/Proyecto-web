/**
 * Estructura general: cabecera fija, barra lateral con el árbol y área de
 * lectura. Por debajo de 1024 px la barra lateral pasa a ser un cajón.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Columns2, GraduationCap, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { cargarIndice } from '@/lib/loader';
import { usarRecurso } from '@/hooks/usarRecurso';
import { usarTema } from '@/contextos/TemaContexto';
import { ArbolNavegacion } from './ArbolNavegacion';
import { Cargando, ErrorCarga } from './Estados';

export function Disposicion() {
  const { tema, alternar } = usarTema();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [cajonAbierto, setCajonAbierto] = useState(false);
  const indice = usarRecurso(cargarIndice, []);
  const botonMenuRef = useRef<HTMLButtonElement>(null);

  /* Atajos globales: «/» abre la búsqueda, Esc cierra lo que esté abierto. */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;
      const escribiendo =
        destino instanceof HTMLInputElement ||
        destino instanceof HTMLTextAreaElement ||
        destino?.isContentEditable === true;

      if (evento.key === '/' && !escribiendo && !evento.metaKey && !evento.ctrlKey) {
        evento.preventDefault();
        navegar('/buscar');
      }
      if (evento.key === 'Escape') {
        setCajonAbierto(false);
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [navegar]);

  /* El cajón se cierra al cambiar de página. */
  useEffect(() => {
    setCajonAbierto(false);
  }, [ubicacion.pathname]);

  const barraLateral = (
    <>
      {indice.estado === 'cargando' && (
        <div className="px-3 py-3">
          <Cargando lineas={8} etiqueta="Cargando el índice de categorías…" />
        </div>
      )}
      {indice.estado === 'error' && (
        <div className="px-3 py-3">
          <ErrorCarga error={indice.error} reintentar={indice.reintentar} />
        </div>
      )}
      {indice.estado === 'listo' && (
        <ArbolNavegacion indice={indice.datos} alNavegar={() => setCajonAbierto(false)} />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-fondo">
      <a href="#contenido" className="salto-contenido">
        Saltar al contenido
      </a>

      {/* ---------------- Cabecera ---------------- */}
      <header className="sticky top-0 z-cabecera border-b border-borde bg-fondo/95 backdrop-blur print:hidden">
        <div className="flex h-[var(--alto-cabecera)] items-center gap-2 px-3 sm:px-4">
          <button
            ref={botonMenuRef}
            type="button"
            onClick={() => setCajonAbierto((v) => !v)}
            aria-expanded={cajonAbierto}
            aria-controls="barra-lateral"
            aria-label={cajonAbierto ? 'Cerrar el índice' : 'Abrir el índice'}
            className="rounded p-1.5 text-texto-suave transition hover:bg-fondo-hover hover:text-texto lg:hidden"
          >
            {cajonAbierto ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded px-1 py-1 text-[0.9375rem] font-semibold tracking-tight text-texto"
          >
            <BookOpen className="h-[1.05rem] w-[1.05rem] text-acento" aria-hidden="true" />
            <span className="hidden sm:inline">DSM-5-TR</span>
          </Link>

          <div className="flex-1" />

          <Link
            to="/buscar"
            className="flex items-center gap-2 rounded border border-borde bg-fondo-elevado px-2.5 py-1.5 text-sm text-texto-tenue transition hover:border-borde-fuerte hover:text-texto-suave"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded border border-borde bg-fondo-sutil px-1.5 py-0.5 font-mono text-[0.6875rem] text-texto-tenue sm:inline">
              /
            </kbd>
          </Link>

          <Link
            to="/comparar"
            className="rounded p-1.5 text-texto-suave transition hover:bg-fondo-hover hover:text-texto"
            title="Comparador"
            aria-label="Comparador de trastornos"
          >
            <Columns2 className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
          </Link>

          <Link
            to="/estudio"
            className="rounded p-1.5 text-texto-suave transition hover:bg-fondo-hover hover:text-texto"
            title="Estudio"
            aria-label="Modo estudio"
          >
            <GraduationCap className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={alternar}
            className="rounded p-1.5 text-texto-suave transition hover:bg-fondo-hover hover:text-texto"
            aria-label={tema === 'claro' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
            title={tema === 'claro' ? 'Tema oscuro' : 'Tema claro'}
          >
            {tema === 'claro' ? (
              <Moon className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
            ) : (
              <Sun className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* ---------------- Barra lateral (escritorio) ---------------- */}
        <nav
          id="barra-lateral"
          aria-label="Índice del manual"
          className="sticky top-[var(--alto-cabecera)] hidden h-[calc(100vh-var(--alto-cabecera))] w-barra-lateral shrink-0 overflow-y-auto border-r border-borde px-1.5 lg:block print:hidden"
        >
          {barraLateral}
        </nav>

        {/* ---------------- Cajón (móvil y tableta) ---------------- */}
        {cajonAbierto && (
          <div className="fixed inset-0 z-superposicion lg:hidden print:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setCajonAbierto(false)}
              aria-hidden="true"
            />
            <nav
              aria-label="Índice del manual"
              className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] overflow-y-auto border-r border-borde bg-fondo px-1.5 pb-6 shadow-lg"
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-borde bg-fondo px-2 py-2">
                <span className="text-sm font-medium text-texto">Índice</span>
                <button
                  type="button"
                  onClick={() => setCajonAbierto(false)}
                  aria-label="Cerrar el índice"
                  className="rounded p-1 text-texto-suave hover:bg-fondo-hover"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {barraLateral}
            </nav>
          </div>
        )}

        {/* ---------------- Contenido ---------------- */}
        <main id="contenido" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
