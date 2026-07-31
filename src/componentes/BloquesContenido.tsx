/**
 * Render de los bloques de contenido oficial del manual.
 *
 * Todo lo de aquí lleva la clase `.oficial`: serif, medida de lectura limitada
 * e interlineado generoso. Es el tratamiento 1 de los tres.
 */

import { ImageOff } from 'lucide-react';
import type { BloqueContenido, ConjuntoCriterios, NodoCriterio } from '@/lib/schema';

/* ------------------------------------------------------------------ */
/* Criterios diagnósticos                                              */
/* ------------------------------------------------------------------ */

function NodoCriterioVista({ nodo, nivel }: { nodo: NodoCriterio; nivel: number }) {
  if (nodo.tipo === 'nota' || nodo.tipo === 'nota_codificacion') {
    return (
      <div className="my-2.5 border-l-2 border-borde-fuerte pl-3">
        <p className="text-[0.9375rem] leading-relaxed text-texto-suave">
          <span className="font-semibold text-texto">
            {nodo.tipo === 'nota' ? 'Nota:' : 'Nota de codificación:'}
          </span>{' '}
          {nodo.texto}
        </p>
      </div>
    );
  }

  if (nodo.tipo === 'texto') {
    return <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{nodo.texto}</p>;
  }

  return (
    <li id={`criterio-${nodo.ruta.replace(/\./g, '-')}`} className="scroll-mt-24">
      <div className="flex gap-2">
        <span
          className="shrink-0 select-none font-semibold tabular-nums"
          style={{ minWidth: nivel === 1 ? '1.4em' : '1.6em' }}
          aria-hidden="true"
        >
          {nodo.etiqueta}
          {nivel === 1 ? '.' : '.'}
        </span>
        <div className="min-w-0 flex-1">
          <span className="sr-only">Criterio {nodo.ruta}. </span>
          {nodo.texto}
          {nodo.hijos.length > 0 && (
            <ol className="mt-2 space-y-2">
              {nodo.hijos.map((hijo, i) => (
                <NodoCriterioVista key={`${hijo.ruta}-${i}`} nodo={hijo} nivel={nivel + 1} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </li>
  );
}

function ConjuntoVista({ conjunto }: { conjunto: ConjuntoCriterios }) {
  return (
    <div id={conjunto.id} className="scroll-mt-24">
      {conjunto.nombre && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-borde pb-2">
          <h3 className="font-propia text-[1.0625rem] font-semibold text-texto">{conjunto.nombre}</h3>
          {conjunto.codigo && <span className="codigo-cie">{conjunto.codigo}</span>}
        </div>
      )}

      {conjunto.preambulo.map((texto, i) => (
        <p key={i} className="mb-3">
          {texto}
        </p>
      ))}

      {conjunto.nodos.length > 0 && (
        <ol className="space-y-3">
          {conjunto.nodos.map((nodo, i) => (
            <NodoCriterioVista key={`${nodo.ruta}-${i}`} nodo={nodo} nivel={1} />
          ))}
        </ol>
      )}

      {conjunto.especificaciones.map((bloque, i) => (
        <div key={i} className="mt-5">
          <p className="font-propia text-sm font-semibold uppercase tracking-wide text-texto-suave">
            {bloque.encabezado}
          </p>
          <ul className="mt-2 space-y-1.5">
            {bloque.opciones.map((opcion, j) => (
              <li key={j}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {opcion.codigo && <span className="codigo-cie">{opcion.codigo}</span>}
                  <span className="font-semibold">{opcion.etiqueta}</span>
                </div>
                {opcion.descripcion && (
                  <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-texto-suave">
                    {opcion.descripcion}
                  </p>
                )}
                {opcion.subopciones.length > 0 && (
                  <ul className="ml-4 mt-1 list-disc space-y-0.5 text-[0.9375rem] text-texto-suave marker:text-texto-tenue">
                    {opcion.subopciones.map((sub, k) => (
                      <li key={k}>{sub}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {bloque.notas.map((nota, j) => (
            <p key={j} className="mt-2 border-l-2 border-borde-fuerte pl-3 text-[0.9375rem] text-texto-suave">
              {nota}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabla                                                               */
/* ------------------------------------------------------------------ */

function TablaVista({
  titulo,
  encabezados,
  filas,
}: {
  titulo: string | null;
  encabezados: string[];
  filas: string[][];
}) {
  return (
    <figure className="my-6 max-w-none">
      {titulo && (
        <figcaption className="mb-2 font-propia text-sm font-semibold text-texto">{titulo}</figcaption>
      )}
      {/* El desbordamiento se queda dentro de la tabla: la página nunca hace scroll horizontal. */}
      <div className="overflow-x-auto rounded-md border border-borde">
        <table className="w-full min-w-[42rem] border-collapse text-left">
          <thead>
            <tr className="bg-fondo-sutil">
              {encabezados.map((celda, i) => (
                <th
                  key={i}
                  scope="col"
                  className="border-b border-borde px-3 py-2 align-top font-propia text-[0.8125rem] font-semibold text-texto"
                >
                  {celda}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i} className="align-top even:bg-fondo-sutil/40">
                {fila.map((celda, j) => (
                  <td
                    key={j}
                    className="border-b border-borde px-3 py-2.5 text-[0.875rem] leading-relaxed last:border-b-0"
                  >
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Despachador                                                         */
/* ------------------------------------------------------------------ */

export function BloquesContenido({ bloques }: { bloques: BloqueContenido[] }) {
  return (
    <div className="oficial">
      {bloques.map((bloque, i) => {
        switch (bloque.tipo) {
          case 'parrafo':
            return (
              <p key={i} className="mt-0 [&:not(:first-child)]:mt-[0.9em]">
                {bloque.texto}
              </p>
            );

          case 'subtitulo':
            return (
              <h3
                key={i}
                className="mb-2 mt-6 font-propia text-[0.9375rem] font-semibold uppercase tracking-wide text-texto-suave"
              >
                {bloque.texto}
              </h3>
            );

          case 'nota':
            return (
              <p key={i} className="my-3 border-l-2 border-borde-fuerte pl-3 text-texto-suave">
                <span className="font-semibold text-texto">
                  {bloque.variante === 'nota' ? 'Nota:' : 'Nota de codificación:'}
                </span>{' '}
                {bloque.texto}
              </p>
            );

          case 'lista':
            return bloque.ordenada ? (
              <ol key={i} className="my-3 ml-5 list-decimal space-y-1.5">
                {bloque.items.map((item, j) => (
                  <li key={j}>{item.texto}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="my-3 ml-5 list-disc space-y-1.5 marker:text-texto-tenue">
                {bloque.items.map((item, j) => (
                  <li key={j}>{item.texto}</li>
                ))}
              </ul>
            );

          case 'tabla':
            return (
              <TablaVista
                key={i}
                titulo={bloque.titulo}
                encabezados={bloque.encabezados}
                filas={bloque.filas}
              />
            );

          case 'criterios':
            return (
              <div key={i} className="space-y-8">
                {bloque.conjuntos.map((conjunto) => (
                  <ConjuntoVista key={conjunto.id} conjunto={conjunto} />
                ))}
              </div>
            );

          case 'especificacion':
            return (
              <div key={i} className="mt-4">
                <p className="font-propia text-sm font-semibold uppercase tracking-wide text-texto-suave">
                  {bloque.bloque.encabezado}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {bloque.bloque.opciones.map((opcion, j) => (
                    <li key={j}>
                      {opcion.codigo && <span className="codigo-cie mr-2">{opcion.codigo}</span>}
                      <span className="font-semibold">{opcion.etiqueta}</span>
                      {opcion.descripcion && (
                        <span className="text-texto-suave"> {opcion.descripcion}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );

          case 'imagen_ausente':
            /* Hueco explícito: en el origen había una figura con URL remota,
               inservible sin conexión. Se deja constancia en vez de fingir
               que ahí no había nada. */
            return (
              <p
                key={i}
                className="my-4 flex max-w-lectura items-start gap-2 rounded border border-dashed border-borde px-3 py-2 font-propia text-[0.8125rem] text-texto-tenue"
              >
                <ImageOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Aquí había una figura en el documento de origen que no se pudo conservar (su
                  dirección era remota y la aplicación funciona sin conexión).{' '}
                  <span className="font-mono">[PENDIENTE]</span>
                </span>
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
