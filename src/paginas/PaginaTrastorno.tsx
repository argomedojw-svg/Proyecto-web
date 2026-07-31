/**
 * Ficha de un trastorno.
 *
 * Lectura larga: cabecera con nombre y códigos, índice lateral que sigue la
 * sección activa, secciones desplegables con estado recordado, navegación
 * anterior/siguiente, botón de ir arriba y hoja de estilos de impresión.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUp, Printer, Star, TriangleAlert } from 'lucide-react';
import { cargarCategoria, cargarTrastorno } from '@/lib/loader';
import { usarRecurso } from '@/hooks/usarRecurso';
import { usarSeccionActiva } from '@/hooks/usarSeccionActiva';
import { Cargando, ErrorCarga, NoEncontrado, Vacio } from '@/componentes/Estados';
import { BloquesContenido } from '@/componentes/BloquesContenido';
import { SeccionDesplegable } from '@/componentes/SeccionDesplegable';
import { Migas } from '@/componentes/Migas';
import { alternarFavorito, leerFavoritos, registrarReciente } from '@/lib/almacenamiento';
import type { Categoria, Trastorno } from '@/lib/schema';

const idSeccion = (indice: number, clave: string | null) =>
  `seccion-${indice}-${clave ?? 'sin-clave'}`;

export function PaginaTrastorno() {
  const { categoriaId, trastornoId } = useParams();
  const navegar = useNavigate();

  const trastorno = usarRecurso(
    () => cargarTrastorno(categoriaId ?? '', trastornoId ?? ''),
    [categoriaId, trastornoId],
  );
  const categoria = usarRecurso(() => cargarCategoria(categoriaId ?? ''), [categoriaId]);

  if (!categoriaId || !trastornoId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <NoEncontrado que="el trastorno" detalle="La dirección está incompleta." />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      {trastorno.estado === 'cargando' && (
        <div className="mx-auto max-w-4xl">
          <Cargando lineas={12} etiqueta="Cargando el trastorno…" />
        </div>
      )}

      {trastorno.estado === 'error' && (
        <div className="mx-auto max-w-4xl">
          <ErrorCarga error={trastorno.error} reintentar={trastorno.reintentar} />
          <p className="mt-4">
            <Link to={`/c/${categoriaId}`} className="enlace text-sm">
              Volver a la categoría
            </Link>
          </p>
        </div>
      )}

      {trastorno.estado === 'listo' && (
        <FichaTrastorno
          trastorno={trastorno.datos}
          categoria={categoria.estado === 'listo' ? categoria.datos : null}
          alNavegar={navegar}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FichaTrastorno({
  trastorno,
  categoria,
  alNavegar,
}: {
  trastorno: Trastorno;
  categoria: Categoria | null;
  alNavegar: ReturnType<typeof useNavigate>;
}) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [mostrarArriba, setMostrarArriba] = useState(false);
  const contenidoRef = useRef<HTMLDivElement>(null);

  const idsSeccion = useMemo(
    () => trastorno.secciones.map((s, i) => idSeccion(i, s.clave)),
    [trastorno.secciones],
  );
  const seccionActiva = usarSeccionActiva(idsSeccion);

  useEffect(() => {
    setFavoritos(leerFavoritos());
    registrarReciente({
      categoriaId: trastorno.categoria.id,
      trastornoId: trastorno.id,
      nombre: trastorno.nombreCorto ?? trastorno.nombre,
    });
  }, [trastorno.id, trastorno.categoria.id, trastorno.nombre, trastorno.nombreCorto]);

  useEffect(() => {
    const alDesplazar = () => setMostrarArriba(window.scrollY > 600);
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);

  /* --- Anterior / siguiente dentro de la categoría --- */
  const { anterior, siguiente } = useMemo(() => {
    if (!categoria) return { anterior: null, siguiente: null };
    const lista = [...categoria.trastornos].sort((a, b) => a.orden - b.orden);
    const i = lista.findIndex((t) => t.id === trastorno.id);
    return {
      anterior: i > 0 ? (lista[i - 1] ?? null) : null,
      siguiente: i >= 0 && i < lista.length - 1 ? (lista[i + 1] ?? null) : null,
    };
  }, [categoria, trastorno.id]);

  /* --- Atajos: flechas izquierda/derecha para cambiar de trastorno --- */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;
      if (
        destino instanceof HTMLInputElement ||
        destino instanceof HTMLTextAreaElement ||
        destino?.isContentEditable ||
        destino?.closest('[role="tree"]')
      ) {
        return;
      }
      if (evento.altKey && evento.key === 'ArrowLeft' && anterior) {
        evento.preventDefault();
        alNavegar(`/t/${trastorno.categoria.id}/${anterior.id}`);
      }
      if (evento.altKey && evento.key === 'ArrowRight' && siguiente) {
        evento.preventDefault();
        alNavegar(`/t/${trastorno.categoria.id}/${siguiente.id}`);
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [anterior, siguiente, alNavegar, trastorno.categoria.id]);

  const esFavorito = favoritos.includes(trastorno.id);
  const avisosGraves = trastorno.advertencias.filter((a) => a.severidad !== 'info');

  return (
    <article className="mx-auto flex max-w-[75rem] gap-10">
      {/* ------------------ Columna principal ------------------ */}
      <div className="min-w-0 flex-1">
        <Migas
          items={[
            { etiqueta: 'Inicio', ruta: '/' },
            { etiqueta: trastorno.categoria.nombre, ruta: `/c/${trastorno.categoria.id}` },
            // Se omite la subcategoría cuando se llama igual que el trastorno
            // (autismo, TDAH, aprendizaje específico): repetirla no informa.
            ...(trastorno.subcategoria && trastorno.subcategoria.nombre !== trastorno.nombre
              ? [{ etiqueta: trastorno.subcategoria.nombre }]
              : []),
            { etiqueta: trastorno.nombreCorto ?? trastorno.nombre },
          ]}
        />

        {/* ------------------ Cabecera ------------------ */}
        <header className="mt-3 border-b border-borde pb-5">
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 font-manual text-[1.75rem] font-semibold leading-tight tracking-tight text-texto sm:text-[2.125rem]">
              {trastorno.nombre}
            </h1>
            <div className="flex shrink-0 gap-1 print:hidden">
              <button
                type="button"
                onClick={() => setFavoritos(alternarFavorito(trastorno.id))}
                aria-pressed={esFavorito}
                aria-label={esFavorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                className="rounded p-2 text-texto-suave transition hover:bg-fondo-hover"
              >
                <Star
                  className="h-4 w-4"
                  aria-hidden="true"
                  fill={esFavorito ? 'currentColor' : 'none'}
                  style={esFavorito ? { color: 'var(--acento)' } : undefined}
                />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                aria-label="Imprimir esta ficha"
                className="rounded p-2 text-texto-suave transition hover:bg-fondo-hover"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Códigos */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {trastorno.codigos.dsm5tr ? (
              <span className="flex items-baseline gap-1.5">
                <span className="text-[0.75rem] uppercase tracking-wide text-texto-tenue">CIE-10</span>
                <span className="codigo-cie">{trastorno.codigos.dsm5tr}</span>
              </span>
            ) : (
              <span className="flex items-baseline gap-1.5">
                <span className="text-[0.75rem] uppercase tracking-wide text-texto-tenue">CIE-10</span>
                <span className="text-texto-tenue">
                  por especificador
                </span>
              </span>
            )}

            <span className="flex items-baseline gap-1.5">
              <span className="text-[0.75rem] uppercase tracking-wide text-texto-tenue">CIE-11</span>
              <span className="font-mono text-[0.8125rem] text-texto-tenue">[PENDIENTE]</span>
            </span>
          </div>

          {trastorno.codigosAdicionales.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem]">
              {trastorno.codigosAdicionales.map((c, i) => (
                <li key={i} className="flex items-baseline gap-1.5">
                  <span className="codigo-cie">{c.codigo}</span>
                  <span className="text-texto-suave">{c.etiqueta}</span>
                </li>
              ))}
            </ul>
          )}

          {(trastorno.sinonimos.length > 0 || trastorno.abreviaturas.length > 0) && (
            <p className="mt-3 max-w-lectura text-[0.8125rem] text-texto-suave">
              <span className="text-texto-tenue">También: </span>
              {[...trastorno.abreviaturas, ...trastorno.sinonimos].join(' · ')}
            </p>
          )}
        </header>

        {/* Advertencias de conversión: se muestran, no se esconden. */}
        {avisosGraves.length > 0 && (
          <details className="mt-5 rounded-md border border-borde print:hidden">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[0.8125rem] text-texto-suave">
              <TriangleAlert
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--sin-validar)' }}
                aria-hidden="true"
              />
              {avisosGraves.length} incidencia(s) de conversión en esta ficha
            </summary>
            <ul className="space-y-1.5 border-t border-borde px-3 py-2.5 text-[0.8125rem] text-texto-suave">
              {avisosGraves.map((a, i) => (
                <li key={i}>
                  <span className="font-mono text-[0.75rem] text-texto-tenue">{a.codigo}</span>{' '}
                  {a.mensaje}
                  {a.linea && <span className="text-texto-tenue"> (línea {a.linea})</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* ------------------ Índice en móvil ------------------ */}
        <nav aria-label="Secciones de la ficha" className="mt-6 xl:hidden print:hidden">
          <ul className="flex flex-wrap gap-1.5">
            {trastorno.secciones.map((s, i) => (
              <li key={idSeccion(i, s.clave)}>
                <a
                  href={`#${idSeccion(i, s.clave)}`}
                  className="inline-block rounded border border-borde px-2 py-1 text-[0.8125rem] text-texto-suave transition hover:bg-fondo-hover"
                >
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* ------------------ Secciones ------------------ */}
        <div ref={contenidoRef} className="mt-4">
          {trastorno.secciones.length === 0 ? (
            <Vacio
              titulo="Esta ficha no tiene secciones"
              descripcion="El archivo de origen no contenía contenido para este trastorno, o la conversión no lo reconoció. Revisa el informe de conversión."
            />
          ) : (
            trastorno.secciones.map((seccion, i) => (
              <SeccionDesplegable
                key={idSeccion(i, seccion.clave)}
                id={idSeccion(i, seccion.clave)}
                claveMemoria={`${trastorno.id}:${seccion.clave ?? seccion.claveOriginal}`}
                titulo={seccion.titulo}
                reconocida={seccion.reconocida}
              >
                {seccion.contenido.length === 0 ? (
                  <Vacio titulo="Sección sin contenido" />
                ) : (
                  <BloquesContenido bloques={seccion.contenido} />
                )}
              </SeccionDesplegable>
            ))
          )}
        </div>

        {/* ------------------ Relaciones ------------------ */}
        {trastorno.relaciones.comparadoCon.length > 0 && (
          <section className="mt-8 border-t border-borde pt-5 print:hidden" aria-labelledby="titulo-relaciones">
            <h2
              id="titulo-relaciones"
              className="mb-2.5 text-[0.8125rem] font-semibold uppercase tracking-wide text-texto-tenue"
            >
              Se contrasta habitualmente con
            </h2>
            <ul className="flex flex-wrap gap-2">
              {trastorno.relaciones.comparadoCon.map((rel, i) => (
                <li key={i}>
                  {rel.idTrastorno ? (
                    <Link
                      to={`/t/${trastorno.categoria.id}/${rel.idTrastorno}`}
                      className="inline-block rounded border border-borde px-2.5 py-1 text-[0.8125rem] text-texto transition hover:bg-fondo-hover"
                    >
                      {rel.nombre}
                    </Link>
                  ) : (
                    <span className="inline-block rounded border border-dashed border-borde px-2.5 py-1 text-[0.8125rem] text-texto-tenue">
                      {rel.nombre}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3">
              <Link
                to={`/comparar?a=${trastorno.categoria.id}:${trastorno.id}`}
                className="enlace text-[0.8125rem]"
              >
                Abrir en el comparador
              </Link>
            </p>
          </section>
        )}

        {/* ------------------ Anterior / siguiente ------------------ */}
        <nav
          aria-label="Trastorno anterior y siguiente"
          className="mt-8 flex gap-3 border-t border-borde pt-5 print:hidden"
        >
          {anterior ? (
            <Link
              to={`/t/${trastorno.categoria.id}/${anterior.id}`}
              className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-borde px-3.5 py-3 transition hover:bg-fondo-hover"
              rel="prev"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-texto-tenue" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[0.6875rem] uppercase tracking-wide text-texto-tenue">
                  Anterior
                </span>
                <span className="block truncate text-sm text-texto">{anterior.nombre}</span>
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          {siguiente ? (
            <Link
              to={`/t/${trastorno.categoria.id}/${siguiente.id}`}
              className="group flex min-w-0 flex-1 items-center justify-end gap-2.5 rounded-md border border-borde px-3.5 py-3 text-right transition hover:bg-fondo-hover"
              rel="next"
            >
              <span className="min-w-0">
                <span className="block text-[0.6875rem] uppercase tracking-wide text-texto-tenue">
                  Siguiente
                </span>
                <span className="block truncate text-sm text-texto">{siguiente.nombre}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-texto-tenue" aria-hidden="true" />
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </nav>

        <p className="mt-6 text-[0.75rem] text-texto-tenue print:mt-3">
          Origen: {trastorno.procedencia.archivoFuente}, líneas{' '}
          {trastorno.procedencia.lineaInicio}–{trastorno.procedencia.lineaFin}.
        </p>
      </div>

      {/* ------------------ Índice lateral (escritorio) ------------------ */}
      <nav
        aria-label="Índice de la ficha"
        className="sticky top-[calc(var(--alto-cabecera)+1.5rem)] hidden h-fit max-h-[calc(100vh-var(--alto-cabecera)-3rem)] w-56 shrink-0 overflow-y-auto xl:block print:hidden"
      >
        <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-texto-tenue">
          En esta ficha
        </p>
        <ul className="space-y-px border-l border-borde">
          {trastorno.secciones.map((seccion, i) => {
            const id = idSeccion(i, seccion.clave);
            const activa = seccionActiva === id;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={activa ? 'true' : undefined}
                  className={`-ml-px block border-l-2 py-1 pl-3 text-[0.8125rem] leading-snug transition ${
                    activa
                      ? 'border-acento font-medium text-texto'
                      : 'border-transparent text-texto-tenue hover:border-borde-fuerte hover:text-texto-suave'
                  }`}
                >
                  {seccion.titulo}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ------------------ Ir arriba ------------------ */}
      {mostrarArriba && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-5 z-barra rounded-full border border-borde bg-fondo-elevado p-2.5 text-texto-suave shadow-[var(--sombra-panel)] transition hover:bg-fondo-hover hover:text-texto print:hidden"
          aria-label="Ir arriba"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
