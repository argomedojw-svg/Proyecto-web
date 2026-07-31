/** Página de una categoría: introducción del capítulo y sus trastornos por subcategoría. */

import { Link, useParams } from 'react-router-dom';
import { cargarCategoria } from '@/lib/loader';
import { usarRecurso } from '@/hooks/usarRecurso';
import { Cargando, ErrorCarga, NoEncontrado, Vacio } from '@/componentes/Estados';
import { BloquesContenido } from '@/componentes/BloquesContenido';
import { Migas } from '@/componentes/Migas';

export function PaginaCategoria() {
  const { categoriaId } = useParams();
  const categoria = usarRecurso(
    () => cargarCategoria(categoriaId ?? ''),
    [categoriaId],
  );

  if (!categoriaId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <NoEncontrado que="la categoría" detalle="La dirección no incluye ningún identificador." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {categoria.estado === 'cargando' && <Cargando lineas={10} etiqueta="Cargando la categoría…" />}

      {categoria.estado === 'error' && (
        <ErrorCarga error={categoria.error} reintentar={categoria.reintentar} />
      )}

      {categoria.estado === 'listo' && (
        <>
          <Migas items={[{ etiqueta: 'Inicio', ruta: '/' }, { etiqueta: categoria.datos.nombre }]} />

          <h1 className="mt-3 font-manual text-[1.75rem] font-semibold tracking-tight text-texto">
            {categoria.datos.nombre}
          </h1>

          {categoria.datos.introduccion.length > 0 && (
            <section className="mt-6" aria-label="Introducción del capítulo">
              <BloquesContenido bloques={categoria.datos.introduccion} />
            </section>
          )}

          <section className="mt-10" aria-labelledby="titulo-trastornos">
            <h2 id="titulo-trastornos" className="sr-only">
              Trastornos de la categoría
            </h2>

            {categoria.datos.trastornos.length === 0 ? (
              <Vacio
                titulo="Esta categoría no tiene trastornos convertidos"
                descripcion="Añade su manifiesto en scripts/capitulos/ y ejecuta «npm run convert»."
              />
            ) : (
              <div className="space-y-8">
                {[...categoria.datos.subcategorias]
                  .sort((a, b) => a.orden - b.orden)
                  .map((sub) => {
                    const trastornos = categoria.datos.trastornos
                      .filter((t) => t.subcategoriaId === sub.id)
                      .sort((a, b) => a.orden - b.orden);
                    if (trastornos.length === 0) return null;

                    return (
                      <section key={sub.id} aria-labelledby={`sub-${sub.id}`}>
                        <h3
                          id={`sub-${sub.id}`}
                          className="mb-3 border-b border-borde pb-1.5 font-manual text-[1.25rem] font-semibold text-texto"
                        >
                          {sub.nombre}
                        </h3>

                        {sub.introduccion.length > 0 && (
                          <div className="mb-4">
                            <BloquesContenido bloques={sub.introduccion} />
                          </div>
                        )}

                        <ul className="divide-y divide-borde overflow-hidden rounded-md border border-borde">
                          {trastornos.map((t) => (
                            <li key={t.id}>
                              <Link
                                to={`/t/${categoria.datos.id}/${t.id}`}
                                className="flex items-baseline gap-3 px-4 py-2.5 transition hover:bg-fondo-hover"
                              >
                                <span className="w-16 shrink-0 font-mono text-[0.75rem] text-texto-tenue">
                                  {t.codigo ?? '—'}
                                </span>
                                <span className="min-w-0 flex-1 text-[0.9375rem] text-texto">
                                  {t.nombre}
                                  {t.subentradas.length > 0 && (
                                    <span className="ml-2 text-[0.8125rem] text-texto-tenue">
                                      ({t.subentradas.length} trastornos)
                                    </span>
                                  )}
                                </span>
                                <span className="shrink-0 text-[0.75rem] text-texto-tenue">
                                  {t.totalSecciones} secc.
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
