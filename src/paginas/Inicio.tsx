/** Portada: las 18 categorías de la Sección II, recientes y favoritos. */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import { cargarIndice } from '@/lib/loader';
import { usarRecurso } from '@/hooks/usarRecurso';
import { Cargando, ErrorCarga, Vacio } from '@/componentes/Estados';
import { leerRecientes, type EntradaReciente } from '@/lib/almacenamiento';

export function Inicio() {
  const indice = usarRecurso(cargarIndice, []);
  const [recientes, setRecientes] = useState<EntradaReciente[]>([]);

  useEffect(() => {
    setRecientes(leerRecientes());
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="font-manual text-[1.75rem] font-semibold tracking-tight text-texto sm:text-[2rem]">
          Biblioteca DSM-5-TR
        </h1>
        <p className="mt-2 max-w-lectura text-texto-suave">
          Consulta y estudio de la Sección II. Todo el contenido oficial procede de tus archivos;
          nada se genera automáticamente.
        </p>
      </header>

      {recientes.length > 0 && (
        <section className="mb-9" aria-labelledby="titulo-recientes">
          <h2
            id="titulo-recientes"
            className="mb-3 flex items-center gap-1.5 text-[0.8125rem] font-semibold uppercase tracking-wide text-texto-tenue"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Recientes
          </h2>
          <ul className="flex flex-wrap gap-2">
            {recientes.map((r) => (
              <li key={r.trastornoId}>
                <Link
                  to={`/t/${r.categoriaId}/${r.trastornoId}`}
                  className="inline-block rounded border border-borde bg-fondo-elevado px-3 py-1.5 text-sm text-texto transition hover:border-borde-fuerte hover:bg-fondo-hover"
                >
                  {r.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-categorias">
        <h2
          id="titulo-categorias"
          className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wide text-texto-tenue"
        >
          Categorías diagnósticas
        </h2>

        {indice.estado === 'cargando' && <Cargando lineas={8} etiqueta="Cargando categorías…" />}

        {indice.estado === 'error' && (
          <ErrorCarga error={indice.error} reintentar={indice.reintentar} />
        )}

        {indice.estado === 'listo' &&
          (indice.datos.categorias.length === 0 ? (
            <Vacio
              titulo="No hay ninguna categoría en el índice"
              descripcion="Ejecuta «npm run convert» para generar public/dsm/."
            />
          ) : (
            <ol className="divide-y divide-borde overflow-hidden rounded-md border border-borde">
              {[...indice.datos.categorias]
                .sort((a, b) => a.orden - b.orden)
                .map((categoria) => {
                  const contenido = (
                    <>
                      <span className="w-6 shrink-0 text-right font-mono text-[0.8125rem] text-texto-tenue tabular-nums">
                        {categoria.orden}
                      </span>
                      <span className="min-w-0 flex-1">{categoria.nombre}</span>
                      {categoria.disponible ? (
                        <span className="shrink-0 text-[0.8125rem] text-texto-tenue">
                          {categoria.totalTrastornos} trastornos
                        </span>
                      ) : (
                        <span className="shrink-0 rounded border border-borde px-1.5 py-0.5 text-[0.6875rem] text-texto-tenue">
                          pendiente
                        </span>
                      )}
                    </>
                  );

                  return (
                    <li key={categoria.id}>
                      {categoria.disponible ? (
                        <Link
                          to={`/c/${categoria.id}`}
                          className="flex items-center gap-3 px-4 py-3 text-[0.9375rem] text-texto transition hover:bg-fondo-hover"
                        >
                          {contenido}
                        </Link>
                      ) : (
                        <div
                          className="flex items-center gap-3 px-4 py-3 text-[0.9375rem] text-texto-tenue"
                          aria-disabled="true"
                        >
                          {contenido}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ol>
          ))}
      </section>

      <section className="mt-9" aria-labelledby="titulo-leyenda">
        <h2
          id="titulo-leyenda"
          className="mb-3 flex items-center gap-1.5 text-[0.8125rem] font-semibold uppercase tracking-wide text-texto-tenue"
        >
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          Cómo se distingue el contenido
        </h2>
        <div className="space-y-3">
          <div className="oficial rounded border border-borde px-4 py-3">
            <p className="!mt-0">
              <strong className="font-propia text-sm uppercase tracking-wide">Oficial.</strong> Texto
              del manual, en serif. Es la voz por defecto y nunca lleva adorno.
            </p>
          </div>
          <div className="propio">
            <p>
              <strong className="text-sm uppercase tracking-wide">Tuyo, validado.</strong> Sans,
              filete continuo, sangría y fondo liso.
            </p>
          </div>
          <div className="propio-sin-validar">
            <p>
              <strong className="text-sm uppercase tracking-wide">Tuyo, sin validar.</strong> Sans,
              filete discontinuo, sangría y trama diagonal. Se distingue también en gris y en papel.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
