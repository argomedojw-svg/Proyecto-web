/**
 * Buscador. Atajo «/» para llegar, Esc para vaciar o salir, flechas para
 * recorrer los resultados y Enter para abrir.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { cargarIndiceBusqueda } from '@/lib/loader';
import { usarRecurso } from '@/hooks/usarRecurso';
import {
  agruparPorTipo,
  buscar,
  crearBuscador,
  ETIQUETA_COINCIDENCIA,
  fragmentar,
  type Resultado,
} from '@/lib/busqueda';
import { Cargando, ErrorCarga, SinResultados, Vacio } from '@/componentes/Estados';

function Resaltado({
  texto,
  rangos,
}: {
  texto: string;
  rangos: readonly (readonly [number, number])[];
}) {
  return (
    <>
      {fragmentar(texto, rangos).map((parte, i) =>
        parte.resaltado ? (
          <mark
            key={i}
            className="rounded-[2px] px-0.5"
            style={{
              backgroundColor: 'var(--realce-busqueda)',
              color: 'var(--realce-busqueda-texto)',
            }}
          >
            {parte.texto}
          </mark>
        ) : (
          <span key={i}>{parte.texto}</span>
        ),
      )}
    </>
  );
}

export function PaginaBusqueda() {
  const [consulta, setConsulta] = useState('');
  const [seleccion, setSeleccion] = useState(0);
  const consultaDiferida = useDeferredValue(consulta);
  const entradaRef = useRef<HTMLInputElement>(null);
  const navegar = useNavigate();

  const indice = usarRecurso(cargarIndiceBusqueda, []);

  const buscador = useMemo(
    () => (indice.estado === 'listo' ? crearBuscador(indice.datos) : null),
    [indice.estado, indice.datos],
  );

  const resultados = useMemo<Resultado[]>(
    () => (buscador ? buscar(buscador, consultaDiferida) : []),
    [buscador, consultaDiferida],
  );

  const grupos = useMemo(() => agruparPorTipo(resultados), [resultados]);
  const planos = useMemo(() => grupos.flatMap(([, lista]) => lista), [grupos]);

  useEffect(() => {
    entradaRef.current?.focus();
  }, []);

  useEffect(() => {
    setSeleccion(0);
  }, [consultaDiferida]);

  const alPulsar = (evento: React.KeyboardEvent) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setSeleccion((n) => Math.min(n + 1, planos.length - 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setSeleccion((n) => Math.max(n - 1, 0));
    } else if (evento.key === 'Enter') {
      const elegido = planos[seleccion];
      if (elegido) {
        evento.preventDefault();
        navegar(`/t/${elegido.entrada.categoriaId}/${elegido.entrada.id}`);
      }
    } else if (evento.key === 'Escape') {
      if (consulta) {
        evento.preventDefault();
        setConsulta('');
      } else {
        navegar(-1);
      }
    }
  };

  let indiceGlobal = -1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="sr-only">Buscar en el DSM-5-TR</h1>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-tenue"
          aria-hidden="true"
        />
        <input
          ref={entradaRef}
          type="search"
          role="combobox"
          aria-expanded={resultados.length > 0}
          aria-controls="resultados-busqueda"
          aria-autocomplete="list"
          aria-label="Buscar trastorno, código o sinónimo"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={alPulsar}
          placeholder="Trastorno, código CIE, sinónimo…"
          className="w-full rounded-md border border-borde bg-fondo-elevado py-3 pl-10 pr-10 text-[0.9375rem] text-texto placeholder:text-texto-tenue focus:border-acento"
          autoComplete="off"
          spellCheck={false}
        />
        {consulta && (
          <button
            type="button"
            onClick={() => {
              setConsulta('');
              entradaRef.current?.focus();
            }}
            aria-label="Vaciar la búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-texto-tenue hover:bg-fondo-hover hover:text-texto"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="mt-2 text-[0.75rem] text-texto-tenue">
        <kbd className="rounded border border-borde px-1">↑</kbd>{' '}
        <kbd className="rounded border border-borde px-1">↓</kbd> moverse ·{' '}
        <kbd className="rounded border border-borde px-1">Enter</kbd> abrir ·{' '}
        <kbd className="rounded border border-borde px-1">Esc</kbd> vaciar
      </p>

      <div className="mt-6" id="resultados-busqueda">
        {indice.estado === 'cargando' && <Cargando lineas={5} etiqueta="Cargando el índice…" />}

        {indice.estado === 'error' && (
          <ErrorCarga error={indice.error} reintentar={indice.reintentar} />
        )}

        {indice.estado === 'listo' && indice.datos.entradas.length === 0 && (
          <Vacio
            titulo="El índice de búsqueda está vacío"
            descripcion="Ejecuta «npm run build:search» para generarlo a partir de public/dsm/."
          />
        )}

        {indice.estado === 'listo' &&
          indice.datos.entradas.length > 0 &&
          consulta.trim().length === 0 && (
            <Vacio
              titulo="Escribe para buscar"
              descripcion={`${indice.datos.entradas.length} trastornos indexados por nombre, sinónimo, abreviatura y código.`}
            />
          )}

        {indice.estado === 'listo' && consulta.trim().length > 0 && resultados.length === 0 && (
          <SinResultados consulta={consulta} />
        )}

        {grupos.map(([tipo, lista]) => (
          <section key={tipo} className="mb-6" aria-labelledby={`grupo-${tipo}`}>
            <h2
              id={`grupo-${tipo}`}
              className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-texto-tenue"
            >
              {ETIQUETA_COINCIDENCIA[tipo]}
              <span className="ml-1.5 font-normal">({lista.length})</span>
            </h2>
            <ul className="divide-y divide-borde overflow-hidden rounded-md border border-borde">
              {lista.map((resultado) => {
                indiceGlobal += 1;
                const activo = indiceGlobal === seleccion;
                return (
                  <li key={`${tipo}-${resultado.entrada.id}`}>
                    <Link
                      to={`/t/${resultado.entrada.categoriaId}/${resultado.entrada.id}`}
                      aria-selected={activo}
                      className={`block px-4 py-2.5 transition ${
                        activo ? 'bg-acento-suave' : 'hover:bg-fondo-hover'
                      }`}
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 text-[0.9375rem] text-texto">
                          {tipo === 'nombre' ? (
                            <Resaltado texto={resultado.entrada.nombre} rangos={resultado.rangos} />
                          ) : (
                            resultado.entrada.nombre
                          )}
                        </span>
                        {resultado.entrada.codigos[0] && (
                          <span className="codigo-cie shrink-0">{resultado.entrada.codigos[0]}</span>
                        )}
                      </div>

                      {tipo !== 'nombre' && (
                        <p className="mt-0.5 text-[0.8125rem] text-texto-suave">
                          <Resaltado texto={resultado.textoCoincidente} rangos={resultado.rangos} />
                        </p>
                      )}

                      <p className="mt-0.5 text-[0.75rem] text-texto-tenue">
                        {/* Cuando la subcategoría se llama igual que el trastorno,
                            repetirla no dice nada: se muestra la categoría. */}
                        {resultado.entrada.subcategoriaNombre &&
                        resultado.entrada.subcategoriaNombre !== resultado.entrada.nombre
                          ? resultado.entrada.subcategoriaNombre
                          : resultado.entrada.categoriaNombre}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
