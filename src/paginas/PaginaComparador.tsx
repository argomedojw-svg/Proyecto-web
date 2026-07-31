/**
 * Comparador de dos o tres trastornos.
 *
 * Columnas paralelas con las filas alineadas por atributo. Por debajo de 768 px
 * la estructura cambia a acordeón: no se reduce la tabla, se cambia de forma,
 * porque tres columnas de texto largo en 375 px no son legibles.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ExternalLink, X } from 'lucide-react';
import { cargarTrastorno, ErrorDeCarga } from '@/lib/loader';
import { usarEsEstrecho } from '@/hooks/usarMedia';
import { ORDEN_SECCION, TITULO_SECCION, type ClaveSeccion, type Trastorno } from '@/lib/schema';
import { BloquesContenido } from '@/componentes/BloquesContenido';
import { Cargando, ErrorCarga, Vacio } from '@/componentes/Estados';
import { SelectorTrastorno, type Seleccion } from '@/componentes/SelectorTrastorno';

type Ranura = 'a' | 'b' | 'c';
const RANURAS: Ranura[] = ['a', 'b', 'c'];

type EstadoColumna =
  | { estado: 'vacia' }
  | { estado: 'cargando' }
  | { estado: 'listo'; trastorno: Trastorno }
  | { estado: 'error'; error: ErrorDeCarga };

function analizar(valor: string | null): Seleccion | null {
  if (!valor) return null;
  const [categoriaId, trastornoId] = valor.split(':');
  return categoriaId && trastornoId ? { categoriaId, trastornoId } : null;
}

export function PaginaComparador() {
  const [parametros, setParametros] = useSearchParams();
  const esEstrecho = usarEsEstrecho();

  const selecciones = useMemo<Record<Ranura, Seleccion | null>>(
    () => ({
      a: analizar(parametros.get('a')),
      b: analizar(parametros.get('b')),
      c: analizar(parametros.get('c')),
    }),
    [parametros],
  );

  const [columnas, setColumnas] = useState<Record<Ranura, EstadoColumna>>({
    a: { estado: 'vacia' },
    b: { estado: 'vacia' },
    c: { estado: 'vacia' },
  });

  const [atributosAbiertos, setAtributosAbiertos] = useState<Set<string>>(new Set(['criterios']));

  /* --- Carga de cada columna --- */
  useEffect(() => {
    let vigente = true;
    for (const ranura of RANURAS) {
      const seleccion = selecciones[ranura];
      if (!seleccion) {
        setColumnas((p) => (p[ranura].estado === 'vacia' ? p : { ...p, [ranura]: { estado: 'vacia' } }));
        continue;
      }
      setColumnas((p) => ({ ...p, [ranura]: { estado: 'cargando' } }));
      cargarTrastorno(seleccion.categoriaId, seleccion.trastornoId)
        .then((trastorno) => {
          if (vigente) setColumnas((p) => ({ ...p, [ranura]: { estado: 'listo', trastorno } }));
        })
        .catch((error: unknown) => {
          if (!vigente) return;
          setColumnas((p) => ({
            ...p,
            [ranura]: {
              estado: 'error',
              error:
                error instanceof ErrorDeCarga
                  ? error
                  : new ErrorDeCarga('red', `${seleccion.trastornoId}.json`, String(error)),
            },
          }));
        });
    }
    return () => {
      vigente = false;
    };
  }, [selecciones]);

  const establecer = useCallback(
    (ranura: Ranura, seleccion: Seleccion | null) => {
      const siguiente = new URLSearchParams(parametros);
      if (seleccion) siguiente.set(ranura, `${seleccion.categoriaId}:${seleccion.trastornoId}`);
      else siguiente.delete(ranura);
      setParametros(siguiente, { replace: true });
    },
    [parametros, setParametros],
  );

  const activas = RANURAS.filter((r) => selecciones[r] !== null);
  const trastornos = activas
    .map((r) => (columnas[r].estado === 'listo' ? (columnas[r] as { trastorno: Trastorno }).trastorno : null))
    .filter((t): t is Trastorno => t !== null);

  /* --- Atributos a comparar: solo los que alguna columna tiene --- */
  const atributos = useMemo<ClaveSeccion[]>(() => {
    if (trastornos.length === 0) return [];
    return ORDEN_SECCION.filter((clave) =>
      trastornos.some((t) => t.secciones.some((s) => s.clave === clave)),
    );
  }, [trastornos]);

  const idsExcluidos = activas
    .map((r) => selecciones[r]?.trastornoId)
    .filter((id): id is string => Boolean(id));

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-manual text-[1.75rem] font-semibold tracking-tight text-texto">
        Comparador
      </h1>
      <p className="mt-1.5 max-w-lectura text-sm text-texto-suave">
        Dos o tres trastornos en paralelo, con las filas alineadas por apartado. Un apartado que el
        manual no recoge para un trastorno se marca como ausente, no se deja en blanco.
      </p>

      {/* --- Selectores --- */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RANURAS.map((ranura, i) => (
          <div key={ranura} className="relative">
            <SelectorTrastorno
              etiqueta={`Columna ${i + 1}${i === 2 ? ' (opcional)' : ''}`}
              valor={selecciones[ranura]}
              alCambiar={(seleccion) => establecer(ranura, seleccion)}
              excluir={idsExcluidos}
            />
            {selecciones[ranura] && (
              <button
                type="button"
                onClick={() => establecer(ranura, null)}
                aria-label={`Quitar la columna ${i + 1}`}
                className="absolute right-1.5 top-6 rounded p-1 text-texto-tenue hover:bg-fondo-hover hover:text-texto"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* --- Estados de columna --- */}
      <div className="mt-4 space-y-2">
        {RANURAS.map((ranura) => {
          const columna = columnas[ranura];
          if (columna.estado !== 'error') return null;
          return <ErrorCarga key={ranura} error={columna.error} />;
        })}
      </div>

      {activas.length === 0 && (
        <div className="mt-8">
          <Vacio
            titulo="Elige al menos dos trastornos"
            descripcion="Se pueden comparar dos o tres a la vez. La selección queda en la dirección, así que puedes guardarla en marcadores."
          />
        </div>
      )}

      {activas.length === 1 && (
        <div className="mt-8">
          <Vacio
            titulo="Falta una segunda columna"
            descripcion="Con un solo trastorno no hay nada que comparar; usa su ficha completa."
          />
        </div>
      )}

      {activas.some((r) => columnas[r].estado === 'cargando') && (
        <div className="mt-8">
          <Cargando lineas={8} etiqueta="Cargando trastornos…" />
        </div>
      )}

      {/* --- Comparación --- */}
      {trastornos.length >= 2 && (
        <div className="mt-8">
          {/* Cabecera de columnas: solo en modo columnas. */}
          {!esEstrecho && (
            <div
              className="sticky top-[var(--alto-cabecera)] z-barra grid gap-4 border-b-2 border-borde-fuerte bg-fondo pb-2.5 pt-3"
              style={{ gridTemplateColumns: `repeat(${trastornos.length}, minmax(0, 1fr))` }}
            >
              {trastornos.map((t) => (
                <div key={t.id} className="min-w-0">
                  <Link
                    to={`/t/${t.categoria.id}/${t.id}`}
                    className="group flex items-start gap-1.5 font-manual text-[1.0625rem] font-semibold leading-snug text-texto"
                  >
                    <span className="min-w-0">{t.nombre}</span>
                    <ExternalLink
                      className="mt-1 h-3.5 w-3.5 shrink-0 text-texto-tenue opacity-0 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </Link>
                  <p className="mt-1 text-[0.75rem] text-texto-tenue">
                    {t.codigos.dsm5tr ?? `${t.codigosAdicionales.length} códigos`} ·{' '}
                    {t.subcategoria && t.subcategoria.nombre !== t.nombre
                      ? t.subcategoria.nombre
                      : t.categoria.nombre}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className={esEstrecho ? 'space-y-2' : 'divide-y divide-borde'}>
            {atributos.map((clave) => {
              const abierto = atributosAbiertos.has(clave);
              const alternar = () =>
                setAtributosAbiertos((previo) => {
                  const siguiente = new Set(previo);
                  if (siguiente.has(clave)) siguiente.delete(clave);
                  else siguiente.add(clave);
                  return siguiente;
                });

              const celdas = trastornos.map((t) => {
                const seccion = t.secciones.find((s) => s.clave === clave);
                return { trastorno: t, seccion };
              });

              /* ---------- Acordeón (< 768 px) ---------- */
              if (esEstrecho) {
                return (
                  <section key={clave} className="overflow-hidden rounded-md border border-borde">
                    <h2>
                      <button
                        type="button"
                        onClick={alternar}
                        aria-expanded={abierto}
                        aria-controls={`panel-${clave}`}
                        className="flex w-full items-center gap-2 bg-fondo-sutil px-3 py-2.5 text-left text-sm font-semibold text-texto"
                      >
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-texto-tenue transition-transform ${
                            abierto ? 'rotate-90' : ''
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">{TITULO_SECCION[clave]}</span>
                        <span className="shrink-0 text-[0.6875rem] font-normal text-texto-tenue">
                          {celdas.filter((c) => c.seccion).length}/{celdas.length}
                        </span>
                      </button>
                    </h2>
                    {abierto && (
                      <div id={`panel-${clave}`} className="divide-y divide-borde">
                        {celdas.map(({ trastorno, seccion }) => (
                          <div key={trastorno.id} className="px-3 py-3">
                            <p className="mb-2 font-manual text-[0.9375rem] font-semibold text-texto">
                              {trastorno.nombreCorto ?? trastorno.nombre}
                            </p>
                            {seccion ? (
                              <BloquesContenido bloques={seccion.contenido} />
                            ) : (
                              <Ausente />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              }

              /* ---------- Columnas (>= 768 px) ---------- */
              return (
                <section key={clave} className="py-6" aria-labelledby={`atributo-${clave}`}>
                  <h2
                    id={`atributo-${clave}`}
                    className="mb-3 text-[0.75rem] font-semibold uppercase tracking-wide text-texto-tenue"
                  >
                    {TITULO_SECCION[clave]}
                  </h2>
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(${trastornos.length}, minmax(0, 1fr))` }}
                  >
                    {celdas.map(({ trastorno, seccion }) => (
                      <div key={trastorno.id} className="min-w-0">
                        {seccion ? (
                          <div className="[&_.oficial]:max-w-none">
                            <BloquesContenido bloques={seccion.contenido} />
                          </div>
                        ) : (
                          <Ausente />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {atributos.length === 0 && (
            <Vacio
              titulo="No hay apartados en común"
              descripcion="Ninguno de los trastornos elegidos tiene apartados reconocidos que comparar."
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Atributo ausente. Se dice explícitamente que el manual no lo recoge: en el
 * DSM la ausencia de un apartado es información, no un hueco.
 */
function Ausente() {
  return (
    <p className="rounded border border-dashed border-borde px-3 py-2.5 text-[0.8125rem] text-texto-tenue">
      El manual no recoge este apartado para este trastorno.
    </p>
  );
}
