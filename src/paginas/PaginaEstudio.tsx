/**
 * Modo estudio: flashcards, banco de preguntas y visor de algoritmos.
 *
 * Todo elemento con `validado: false` se muestra con el tratamiento de trama
 * diagonal y su indicador. Al marcarlo como validado, el indicador desaparece y
 * el bloque pasa al tratamiento de fondo liso.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, RotateCcw, Shuffle, X } from 'lucide-react';
import { cargarIndiceBusqueda, cargarTrastorno } from '@/lib/loader';
import { usarRecurso } from '@/hooks/usarRecurso';
import { Cargando, ErrorCarga, Vacio } from '@/componentes/Estados';
import { EnvolturaPropia, IndicadorValidado } from '@/componentes/Envoltura';
import { SelectorTrastorno, type Seleccion } from '@/componentes/SelectorTrastorno';
import { CLAVES, escribir, leer } from '@/lib/almacenamiento';
import { leerMarcas, marcarValidado, validadoEfectivo } from '@/lib/validacion-local';
import { TITULO_SECCION, type Algoritmo, type Flashcard, type Pregunta } from '@/lib/schema';

type Pestana = 'flashcards' | 'preguntas' | 'algoritmos';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'flashcards', etiqueta: 'Flashcards' },
  { id: 'preguntas', etiqueta: 'Preguntas' },
  { id: 'algoritmos', etiqueta: 'Algoritmos' },
];

export function PaginaEstudio() {
  const [parametros, setParametros] = useSearchParams();
  const [pestana, setPestana] = useState<Pestana>('flashcards');
  const [marcas, setMarcas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMarcas(leerMarcas());
  }, []);

  const alternarValidado = useCallback((id: string, actual: boolean) => {
    setMarcas(marcarValidado(id, !actual));
  }, []);

  const seleccionUrl = parametros.get('t');
  const [categoriaId, trastornoId] = (seleccionUrl ?? '').split(':');
  const seleccion: Seleccion | null =
    categoriaId && trastornoId ? { categoriaId, trastornoId } : null;

  const trastorno = usarRecurso(
    () =>
      seleccion
        ? cargarTrastorno(seleccion.categoriaId, seleccion.trastornoId)
        : Promise.resolve(null),
    [seleccionUrl],
  );

  const establecer = useCallback(
    (nueva: Seleccion | null) => {
      const siguiente = new URLSearchParams(parametros);
      if (nueva) siguiente.set('t', `${nueva.categoriaId}:${nueva.trastornoId}`);
      else siguiente.delete('t');
      setParametros(siguiente, { replace: true });
    },
    [parametros, setParametros],
  );

  const educativo = trastorno.estado === 'listo' ? (trastorno.datos?.educativo ?? null) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-manual text-[1.75rem] font-semibold tracking-tight text-texto">Estudio</h1>
      <p className="mt-1.5 max-w-lectura text-sm text-texto-suave">
        Material propio. Nada de lo que aparece aquí es contenido oficial del DSM-5-TR: lo escribes
        tú o lo genera el andamiaje a partir de tus archivos, y hasta que lo revisas se muestra con
        trama diagonal.
      </p>

      <div className="mt-6 max-w-sm">
        <SelectorTrastorno etiqueta="Trastorno" valor={seleccion} alCambiar={establecer} />
      </div>

      {!seleccion && (
        <div className="mt-8">
          <Vacio
            titulo="Elige un trastorno para estudiar"
            descripcion="Las flashcards y las preguntas están asociadas a la ficha de cada trastorno."
          />
        </div>
      )}

      {seleccion && trastorno.estado === 'cargando' && (
        <div className="mt-8">
          <Cargando lineas={6} etiqueta="Cargando material de estudio…" />
        </div>
      )}

      {seleccion && trastorno.estado === 'error' && (
        <div className="mt-8">
          <ErrorCarga error={trastorno.error} reintentar={trastorno.reintentar} />
        </div>
      )}

      {educativo && trastorno.datos && (
        <>
          <div className="mt-7 flex items-center justify-between gap-3 border-b border-borde">
            <div role="tablist" aria-label="Tipo de material" className="flex gap-1">
              {PESTANAS.map((p) => {
                const activa = pestana === p.id;
                const total =
                  p.id === 'flashcards'
                    ? educativo.flashcards.length
                    : p.id === 'preguntas'
                      ? educativo.preguntas.length
                      : educativo.algoritmos.length;
                return (
                  <button
                    key={p.id}
                    role="tab"
                    id={`pestana-${p.id}`}
                    aria-selected={activa}
                    aria-controls={`panel-${p.id}`}
                    tabIndex={activa ? 0 : -1}
                    onClick={() => setPestana(p.id)}
                    onKeyDown={(e) => {
                      const i = PESTANAS.findIndex((x) => x.id === pestana);
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        setPestana(PESTANAS[(i + 1) % PESTANAS.length]!.id);
                      }
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setPestana(PESTANAS[(i - 1 + PESTANAS.length) % PESTANAS.length]!.id);
                      }
                    }}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                      activa
                        ? 'border-acento font-medium text-texto'
                        : 'border-transparent text-texto-suave hover:text-texto'
                    }`}
                  >
                    {p.etiqueta}
                    <span className="ml-1.5 text-[0.75rem] text-texto-tenue">{total}</span>
                  </button>
                );
              })}
            </div>

            <Link
              to={`/t/${trastorno.datos.categoria.id}/${trastorno.datos.id}`}
              className="enlace shrink-0 pb-2 text-[0.8125rem]"
            >
              Ver la ficha
            </Link>
          </div>

          <div className="mt-6">
            {pestana === 'flashcards' && (
              <div role="tabpanel" id="panel-flashcards" aria-labelledby="pestana-flashcards">
                <Flashcards
                  tarjetas={educativo.flashcards}
                  trastornoId={trastorno.datos.id}
                  marcas={marcas}
                  alAlternar={alternarValidado}
                />
              </div>
            )}
            {pestana === 'preguntas' && (
              <div role="tabpanel" id="panel-preguntas" aria-labelledby="pestana-preguntas">
                <BancoPreguntas
                  preguntas={educativo.preguntas}
                  categoriaId={trastorno.datos.categoria.id}
                  trastornoId={trastorno.datos.id}
                  marcas={marcas}
                  alAlternar={alternarValidado}
                />
              </div>
            )}
            {pestana === 'algoritmos' && (
              <div role="tabpanel" id="panel-algoritmos" aria-labelledby="pestana-algoritmos">
                <VisorAlgoritmos
                  algoritmos={educativo.algoritmos}
                  marcas={marcas}
                  alAlternar={alternarValidado}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flashcards                                                          */
/* ------------------------------------------------------------------ */

type ProgresoTarjetas = Record<string, { aciertos: number; fallos: number; ultimaEn: number }>;

function Flashcards({
  tarjetas,
  trastornoId,
  marcas,
  alAlternar,
}: {
  tarjetas: Flashcard[];
  trastornoId: string;
  marcas: Record<string, boolean>;
  alAlternar: (id: string, actual: boolean) => void;
}) {
  const [orden, setOrden] = useState<number[]>([]);
  const [posicion, setPosicion] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const [progreso, setProgreso] = useState<ProgresoTarjetas>({});

  useEffect(() => {
    setOrden(tarjetas.map((_, i) => i));
    setPosicion(0);
    setVolteada(false);
    setProgreso(leer<ProgresoTarjetas>(CLAVES.progresoFlashcards, {}));
  }, [tarjetas, trastornoId]);

  const tarjeta = tarjetas[orden[posicion] ?? 0];

  const registrar = useCallback(
    (acierto: boolean) => {
      if (!tarjeta) return;
      const actual = leer<ProgresoTarjetas>(CLAVES.progresoFlashcards, {});
      const previo = actual[tarjeta.id] ?? { aciertos: 0, fallos: 0, ultimaEn: 0 };
      actual[tarjeta.id] = {
        aciertos: previo.aciertos + (acierto ? 1 : 0),
        fallos: previo.fallos + (acierto ? 0 : 1),
        ultimaEn: Date.now(),
      };
      escribir(CLAVES.progresoFlashcards, actual);
      setProgreso({ ...actual });
      setVolteada(false);
      setPosicion((p) => Math.min(p + 1, tarjetas.length - 1));
    },
    [tarjeta, tarjetas.length],
  );

  /* Flechas para moverse, espacio para voltear. */
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;
      if (destino instanceof HTMLInputElement || destino instanceof HTMLSelectElement) return;
      if (evento.key === 'ArrowRight') {
        evento.preventDefault();
        setVolteada(false);
        setPosicion((p) => Math.min(p + 1, tarjetas.length - 1));
      }
      if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        setVolteada(false);
        setPosicion((p) => Math.max(p - 1, 0));
      }
      if (evento.key === ' ' && destino?.tagName !== 'BUTTON') {
        evento.preventDefault();
        setVolteada((v) => !v);
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [tarjetas.length]);

  if (tarjetas.length === 0) {
    return (
      <Vacio
        titulo="No hay flashcards para este trastorno"
        descripcion="Añádelas en el campo educativo.flashcards del JSON, o ejecuta «npm run andamiaje» para generar tarjetas a partir de los criterios de tu propio archivo."
      />
    );
  }
  if (!tarjeta) return <Vacio titulo="Sin tarjeta activa" />;

  const validado = validadoEfectivo(tarjeta.id, tarjeta.validado, marcas);
  const estadisticas = progreso[tarjeta.id];
  const estudiadas = Object.keys(progreso).filter((id) =>
    tarjetas.some((t) => t.id === id),
  ).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[0.8125rem] text-texto-tenue">
        <span>
          Tarjeta {posicion + 1} de {tarjetas.length}
        </span>
        <span>{estudiadas} vistas</span>
      </div>

      <div
        className="h-1 overflow-hidden rounded-full bg-fondo-sutil"
        role="progressbar"
        aria-valuenow={posicion + 1}
        aria-valuemin={1}
        aria-valuemax={tarjetas.length}
        aria-label="Progreso de la sesión"
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${((posicion + 1) / tarjetas.length) * 100}%`,
            backgroundColor: 'var(--acento)',
          }}
        />
      </div>

      <div className="mt-4">
        <EnvolturaPropia
          validado={validado}
          etiqueta={tarjeta.fuente.origen === 'andamiaje' ? 'andamiaje' : 'tuya'}
          alAlternar={() => alAlternar(tarjeta.id, validado)}
        >
          <p className="text-[0.6875rem] uppercase tracking-wide text-texto-tenue">Anverso</p>
          <p className="mt-1 text-base font-medium text-texto">{tarjeta.anverso}</p>

          {volteada ? (
            <div className="mt-4 border-t border-borde pt-3">
              <p className="text-[0.6875rem] uppercase tracking-wide text-texto-tenue">Reverso</p>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-texto">{tarjeta.reverso}</p>
              {tarjeta.fuente.seccionOrigen && (
                <p className="mt-3 text-[0.75rem] text-texto-tenue">
                  Procede de: {TITULO_SECCION[tarjeta.fuente.seccionOrigen]}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setVolteada(true)}
              className="mt-4 rounded border border-borde-fuerte bg-fondo-elevado px-3 py-1.5 text-sm font-medium text-texto transition hover:bg-fondo-hover"
            >
              Mostrar el reverso{' '}
              <kbd className="ml-1 rounded border border-borde px-1 font-mono text-[0.6875rem]">
                espacio
              </kbd>
            </button>
          )}
        </EnvolturaPropia>
      </div>

      {volteada && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => registrar(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-borde px-3 py-2.5 text-sm font-medium text-texto transition hover:bg-fondo-hover"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            No la sabía
          </button>
          <button
            type="button"
            onClick={() => registrar(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-sm font-medium transition"
            style={{ borderColor: 'var(--acento)', color: 'var(--acento)' }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            La sabía
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setVolteada(false);
              setPosicion((p) => Math.max(p - 1, 0));
            }}
            disabled={posicion === 0}
            aria-label="Tarjeta anterior"
            className="rounded border border-borde p-2 text-texto-suave transition hover:bg-fondo-hover disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setVolteada(false);
              setPosicion((p) => Math.min(p + 1, tarjetas.length - 1));
            }}
            disabled={posicion === tarjetas.length - 1}
            aria-label="Tarjeta siguiente"
            className="rounded border border-borde p-2 text-texto-suave transition hover:bg-fondo-hover disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-[0.75rem] text-texto-tenue">
          {estadisticas && (
            <span>
              {estadisticas.aciertos} aciertos · {estadisticas.fallos} fallos
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setOrden((o) => [...o].sort(() => Math.random() - 0.5));
              setPosicion(0);
              setVolteada(false);
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-fondo-hover hover:text-texto"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
            Barajar
          </button>
          <button
            type="button"
            onClick={() => {
              escribir(CLAVES.progresoFlashcards, {});
              setProgreso({});
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-fondo-hover hover:text-texto"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Banco de preguntas                                                  */
/* ------------------------------------------------------------------ */

function BancoPreguntas({
  preguntas,
  categoriaId,
  trastornoId,
  marcas,
  alAlternar,
}: {
  preguntas: Pregunta[];
  categoriaId: string;
  trastornoId: string;
  marcas: Record<string, boolean>;
  alAlternar: (id: string, actual: boolean) => void;
}) {
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});

  if (preguntas.length === 0) {
    return (
      <Vacio
        titulo="No hay preguntas para este trastorno"
        descripcion="Añádelas en educativo.preguntas del JSON. El andamiaje solo genera preguntas de código, porque cualquier otra exigiría redactar contenido clínico."
      />
    );
  }

  return (
    <ol className="space-y-5">
      {preguntas.map((pregunta, i) => {
        const validado = validadoEfectivo(pregunta.id, pregunta.validado, marcas);
        const elegida = respuestas[pregunta.id];
        const respondida = elegida !== undefined;

        return (
          <li key={pregunta.id}>
            <EnvolturaPropia
              validado={validado}
              etiqueta={`pregunta ${i + 1} · ${pregunta.fuente.origen === 'andamiaje' ? 'andamiaje' : 'tuya'}`}
              alAlternar={() => alAlternar(pregunta.id, validado)}
            >
              <fieldset>
                <legend className="text-[0.9375rem] font-medium text-texto">
                  {pregunta.enunciado}
                </legend>

                <div className="mt-3 space-y-1.5">
                  {pregunta.opciones.map((opcion) => {
                    const esCorrecta = opcion.id === pregunta.respuestaCorrecta;
                    const esElegida = opcion.id === elegida;
                    let estilo = 'border-borde';
                    if (respondida && esCorrecta) estilo = 'border-[var(--acento)]';
                    else if (respondida && esElegida) estilo = 'border-[var(--peligro)]';

                    return (
                      <label
                        key={opcion.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded border ${estilo} bg-fondo-elevado px-3 py-2 text-sm transition hover:bg-fondo-hover`}
                      >
                        <input
                          type="radio"
                          name={pregunta.id}
                          value={opcion.id}
                          checked={esElegida}
                          onChange={() =>
                            setRespuestas((r) => ({ ...r, [pregunta.id]: opcion.id }))
                          }
                          className="accent-[var(--acento)]"
                        />
                        <span className="flex-1 text-texto">{opcion.texto}</span>
                        {respondida && esCorrecta && (
                          <Check
                            className="h-4 w-4 shrink-0"
                            style={{ color: 'var(--acento)' }}
                            aria-label="Respuesta correcta"
                          />
                        )}
                        {respondida && esElegida && !esCorrecta && (
                          <X
                            className="h-4 w-4 shrink-0"
                            style={{ color: 'var(--peligro)' }}
                            aria-label="Respuesta incorrecta"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>

                {pregunta.respuestaCorrecta === null && (
                  <p className="mt-2 text-[0.75rem] text-texto-tenue">
                    Esta pregunta todavía no tiene marcada la respuesta correcta.
                  </p>
                )}
              </fieldset>

              {respondida && (
                <div className="mt-3 border-t border-borde pt-2.5">
                  <p className="text-[0.6875rem] uppercase tracking-wide text-texto-tenue">
                    Explicación
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-texto">{pregunta.explicacion}</p>
                  {pregunta.seccionReferencia && (
                    <p className="mt-2 text-[0.8125rem]">
                      <Link
                        to={`/t/${categoriaId}/${trastornoId}`}
                        className="enlace"
                      >
                        Ir a «{TITULO_SECCION[pregunta.seccionReferencia]}» en la ficha
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </EnvolturaPropia>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Visor de algoritmos                                                 */
/* ------------------------------------------------------------------ */

function VisorAlgoritmos({
  algoritmos,
  marcas,
  alAlternar,
}: {
  algoritmos: Algoritmo[];
  marcas: Record<string, boolean>;
  alAlternar: (id: string, actual: boolean) => void;
}) {
  const [recorrido, setRecorrido] = useState<Record<string, string[]>>({});

  if (algoritmos.length === 0) {
    return (
      <Vacio
        titulo="No hay ningún algoritmo diagnóstico"
        descripcion="El conversor y el andamiaje no generan algoritmos a propósito: un árbol de decisión escrito por una máquina parecería validado sin estarlo. Escríbelos tú en educativo.algoritmos; el visor los mostrará aquí."
      />
    );
  }

  return (
    <div className="space-y-6">
      {algoritmos.map((algoritmo) => {
        const validado = validadoEfectivo(algoritmo.id, algoritmo.validado, marcas);
        const camino = recorrido[algoritmo.id] ?? (algoritmo.nodoInicial ? [algoritmo.nodoInicial] : []);
        const porId = new Map(algoritmo.nodos.map((n) => [n.id, n]));

        return (
          <EnvolturaPropia
            key={algoritmo.id}
            validado={validado}
            etiqueta="algoritmo"
            alAlternar={() => alAlternar(algoritmo.id, validado)}
          >
            <h2 className="text-base font-semibold text-texto">{algoritmo.titulo}</h2>

            <ol className="mt-3 space-y-3">
              {camino.map((idNodo, paso) => {
                const nodo = porId.get(idNodo);
                if (!nodo) {
                  return (
                    <li key={`${idNodo}-${paso}`} className="text-sm" style={{ color: 'var(--peligro)' }}>
                      El algoritmo apunta al nodo «{idNodo}», que no existe.
                    </li>
                  );
                }
                const esUltimo = paso === camino.length - 1;
                return (
                  <li key={`${idNodo}-${paso}`} className="border-l-2 border-borde pl-3">
                    <p className="text-[0.6875rem] uppercase tracking-wide text-texto-tenue">
                      {nodo.tipo === 'resultado' ? 'Resultado' : nodo.tipo === 'nota' ? 'Nota' : `Paso ${paso + 1}`}
                    </p>
                    <p className="mt-0.5 text-sm text-texto">{nodo.texto}</p>

                    {nodo.seccionReferencia && (
                      <p className="mt-1 text-[0.75rem] text-texto-tenue">
                        Apoyo: {TITULO_SECCION[nodo.seccionReferencia]}
                      </p>
                    )}

                    {esUltimo && nodo.ramas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {nodo.ramas.map((rama, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() =>
                              setRecorrido((r) => ({
                                ...r,
                                [algoritmo.id]: [...camino, rama.destino],
                              }))
                            }
                            className="rounded border border-borde bg-fondo-elevado px-2.5 py-1 text-[0.8125rem] text-texto transition hover:bg-fondo-hover"
                          >
                            {rama.etiqueta}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {camino.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setRecorrido((r) => ({
                    ...r,
                    [algoritmo.id]: algoritmo.nodoInicial ? [algoritmo.nodoInicial] : [],
                  }))
                }
                className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] text-texto-suave hover:text-texto"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Empezar de nuevo
              </button>
            )}
          </EnvolturaPropia>
        );
      })}
    </div>
  );
}
