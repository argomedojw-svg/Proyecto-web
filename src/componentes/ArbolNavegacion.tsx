/**
 * Árbol de categorías de la barra lateral.
 *
 * Carga diferida: el índice de una categoría solo se pide cuando se despliega.
 * Navegación por teclado completa según el patrón «tree view» de WAI-ARIA:
 * flechas para moverse y desplegar, Inicio/Fin para los extremos, Enter para
 * abrir. Un único tabindex=0 (foco itinerante) para no atrapar el tabulador.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, CircleAlert, Loader2 } from 'lucide-react';
import { cargarCategoria, ErrorDeCarga } from '@/lib/loader';
import type { Categoria, Indice } from '@/lib/schema';
import { CLAVES, escribir, leer } from '@/lib/almacenamiento';

type EstadoCategoria =
  | { estado: 'sin-cargar' }
  | { estado: 'cargando' }
  | { estado: 'listo'; categoria: Categoria }
  | { estado: 'error'; error: ErrorDeCarga };

type Nodo = {
  id: string;
  nivel: number;
  etiqueta: string;
  codigo: string | null;
  tipo: 'categoria' | 'subcategoria' | 'trastorno' | 'subentrada';
  desplegable: boolean;
  desplegado: boolean;
  deshabilitado: boolean;
  cargando: boolean;
  error: boolean;
  /** Ruta a la que navega, si es navegable. */
  ruta: string | null;
  padreId: string | null;
};

export function ArbolNavegacion({
  indice,
  alNavegar,
}: {
  indice: Indice;
  alNavegar?: () => void;
}) {
  const navegar = useNavigate();
  const { categoriaId: categoriaActiva, trastornoId: trastornoActivo } = useParams();

  const [datos, setDatos] = useState<Record<string, EstadoCategoria>>({});
  const [desplegados, setDesplegados] = useState<Set<string>>(
    () => new Set(leer<string[]>(CLAVES.arbolAbierto, [])),
  );
  const [focoId, setFocoId] = useState<string | null>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  /* --- Carga diferida --------------------------------------------- */
  const pedirCategoria = useCallback(
    (id: string) => {
      setDatos((previo) => {
        if (previo[id] && previo[id].estado !== 'error') return previo;
        return { ...previo, [id]: { estado: 'cargando' } };
      });
      cargarCategoria(id)
        .then((categoria) => setDatos((p) => ({ ...p, [id]: { estado: 'listo', categoria } })))
        .catch((error: unknown) =>
          setDatos((p) => ({
            ...p,
            [id]: {
              estado: 'error',
              error:
                error instanceof ErrorDeCarga
                  ? error
                  : new ErrorDeCarga('red', `${id}/index.json`, String(error)),
            },
          })),
        );
    },
    [],
  );

  /* Se despliega y carga sola la categoría de la ficha que se está viendo. */
  useEffect(() => {
    if (!categoriaActiva) return;
    setDesplegados((previo) => {
      if (previo.has(categoriaActiva)) return previo;
      const siguiente = new Set(previo);
      siguiente.add(categoriaActiva);
      return siguiente;
    });
  }, [categoriaActiva]);

  useEffect(() => {
    for (const id of desplegados) {
      const disponible = indice.categorias.find((c) => c.id === id)?.disponible;
      if (disponible && !datos[id]) pedirCategoria(id);
    }
  }, [desplegados, datos, indice.categorias, pedirCategoria]);

  useEffect(() => {
    escribir(CLAVES.arbolAbierto, [...desplegados]);
  }, [desplegados]);

  /* --- Aplanado de los nodos visibles ------------------------------ */
  const nodos = useMemo<Nodo[]>(() => {
    const salida: Nodo[] = [];

    for (const cat of [...indice.categorias].sort((a, b) => a.orden - b.orden)) {
      const estado = datos[cat.id];
      const desplegado = desplegados.has(cat.id);
      salida.push({
        id: cat.id,
        nivel: 1,
        etiqueta: cat.nombre,
        codigo: null,
        tipo: 'categoria',
        desplegable: cat.disponible,
        desplegado: desplegado && cat.disponible,
        deshabilitado: !cat.disponible,
        cargando: estado?.estado === 'cargando',
        error: estado?.estado === 'error',
        ruta: cat.disponible ? `/c/${cat.id}` : null,
        padreId: null,
      });

      if (!desplegado || !cat.disponible || estado?.estado !== 'listo') continue;
      const categoria = estado.categoria;

      for (const sub of [...categoria.subcategorias].sort((a, b) => a.orden - b.orden)) {
        const trastornos = categoria.trastornos.filter((t) => t.subcategoriaId === sub.id);
        if (trastornos.length === 0) continue;
        // El prefijo por tipo es necesario: cuando una subcategoría y su único
        // trastorno se llaman igual, sus identificadores serían el mismo.
        const subId = `sub:${cat.id}//${sub.id}`;
        const subDesplegada = !desplegados.has(`cerrada:${subId}`); // por defecto abiertas
        salida.push({
          id: subId,
          nivel: 2,
          etiqueta: sub.nombre,
          codigo: null,
          tipo: 'subcategoria',
          desplegable: true,
          desplegado: subDesplegada,
          deshabilitado: false,
          cargando: false,
          error: false,
          ruta: null,
          padreId: cat.id,
        });
        if (!subDesplegada) continue;

        for (const t of trastornos) {
          const tId = `tra:${cat.id}//${t.id}`;
          const tieneHijos = t.subentradas.length > 0;
          const tDesplegado = desplegados.has(tId) || (tieneHijos && t.id === trastornoActivo);
          salida.push({
            id: tId,
            nivel: 3,
            etiqueta: t.nombreCorto ?? t.nombre,
            codigo: t.codigo,
            tipo: 'trastorno',
            desplegable: tieneHijos,
            desplegado: tieneHijos && tDesplegado,
            deshabilitado: false,
            cargando: false,
            error: false,
            ruta: `/t/${cat.id}/${t.id}`,
            padreId: subId,
          });
          if (!tieneHijos || !tDesplegado) continue;
          for (const sub2 of t.subentradas) {
            salida.push({
              id: `${tId}//${sub2.ancla}`,
              nivel: 4,
              etiqueta: sub2.nombre,
              codigo: sub2.codigo,
              tipo: 'subentrada',
              desplegable: false,
              desplegado: false,
              deshabilitado: false,
              cargando: false,
              error: false,
              ruta: `/t/${cat.id}/${t.id}#${sub2.ancla}`,
              padreId: tId,
            });
          }
        }
      }
    }
    return salida;
  }, [indice.categorias, datos, desplegados, trastornoActivo]);

  /* --- Interacción -------------------------------------------------- */
  const alternar = useCallback((nodo: Nodo) => {
    setDesplegados((previo) => {
      const siguiente = new Set(previo);
      // Las subcategorías nacen abiertas: se guarda el cierre, no la apertura.
      const clave = nodo.tipo === 'subcategoria' ? `cerrada:${nodo.id}` : nodo.id;
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }, []);

  const activar = useCallback(
    (nodo: Nodo) => {
      if (nodo.deshabilitado) return;
      if (nodo.ruta) {
        navegar(nodo.ruta);
        alNavegar?.();
      } else if (nodo.desplegable) {
        alternar(nodo);
      }
    },
    [navegar, alternar, alNavegar],
  );

  const enfocar = useCallback((id: string) => {
    setFocoId(id);
    requestAnimationFrame(() => {
      const elemento = listaRef.current?.querySelector<HTMLElement>(`[data-nodo="${CSS.escape(id)}"]`);
      elemento?.focus();
    });
  }, []);

  const alPulsarTecla = useCallback(
    (evento: React.KeyboardEvent, indice_: number) => {
      const nodo = nodos[indice_];
      if (!nodo) return;

      switch (evento.key) {
        case 'ArrowDown': {
          evento.preventDefault();
          const siguiente = nodos[indice_ + 1];
          if (siguiente) enfocar(siguiente.id);
          break;
        }
        case 'ArrowUp': {
          evento.preventDefault();
          const anterior = nodos[indice_ - 1];
          if (anterior) enfocar(anterior.id);
          break;
        }
        case 'ArrowRight': {
          evento.preventDefault();
          if (nodo.desplegable && !nodo.desplegado) alternar(nodo);
          else {
            const siguiente = nodos[indice_ + 1];
            if (siguiente && siguiente.nivel > nodo.nivel) enfocar(siguiente.id);
          }
          break;
        }
        case 'ArrowLeft': {
          evento.preventDefault();
          if (nodo.desplegable && nodo.desplegado) alternar(nodo);
          else if (nodo.padreId) enfocar(nodo.padreId);
          break;
        }
        case 'Home': {
          evento.preventDefault();
          const primero = nodos[0];
          if (primero) enfocar(primero.id);
          break;
        }
        case 'End': {
          evento.preventDefault();
          const ultimo = nodos[nodos.length - 1];
          if (ultimo) enfocar(ultimo.id);
          break;
        }
        case 'Enter':
        case ' ': {
          evento.preventDefault();
          activar(nodo);
          break;
        }
        default:
          break;
      }
    },
    [nodos, enfocar, alternar, activar],
  );

  const idFoco = focoId && nodos.some((n) => n.id === focoId) ? focoId : (nodos[0]?.id ?? null);

  return (
    <ul
      ref={listaRef}
      role="tree"
      aria-label="Categorías del DSM-5-TR"
      className="space-y-px py-2"
    >
      {nodos.map((nodo, i) => {
        const activo =
          (nodo.tipo === 'trastorno' && nodo.id === `tra:${categoriaActiva}//${trastornoActivo}`) ||
          (nodo.tipo === 'categoria' && nodo.id === categoriaActiva && !trastornoActivo);

        return (
          <li key={nodo.id} role="none">
            <div
              role="treeitem"
              data-nodo={nodo.id}
              tabIndex={nodo.id === idFoco ? 0 : -1}
              aria-level={nodo.nivel}
              aria-expanded={nodo.desplegable ? nodo.desplegado : undefined}
              aria-selected={activo}
              aria-disabled={nodo.deshabilitado || undefined}
              aria-busy={nodo.cargando || undefined}
              onKeyDown={(e) => alPulsarTecla(e, i)}
              onClick={() => activar(nodo)}
              onFocus={() => setFocoId(nodo.id)}
              className={[
                'group flex cursor-pointer items-center gap-1.5 rounded px-2 py-[5px] text-sm',
                'transition-colors',
                nodo.deshabilitado
                  ? 'cursor-not-allowed text-texto-tenue'
                  : 'text-texto hover:bg-fondo-hover',
                activo ? 'bg-acento-suave font-medium text-texto' : '',
                nodo.tipo === 'categoria' ? 'font-medium' : '',
                nodo.tipo === 'subcategoria' ? 'text-texto-suave' : '',
                nodo.tipo === 'subentrada' ? 'text-[0.8125rem] text-texto-suave' : '',
              ].join(' ')}
              style={{ paddingLeft: `${0.35 + (nodo.nivel - 1) * 0.85}rem` }}
            >
              {/* Marcador de despliegue */}
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {nodo.cargando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-texto-tenue" aria-hidden="true" />
                ) : nodo.error ? (
                  <CircleAlert
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--peligro)' }}
                    aria-hidden="true"
                  />
                ) : nodo.desplegable ? (
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-texto-tenue transition-transform ${
                      nodo.desplegado ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      alternar(nodo);
                    }}
                  />
                ) : null}
              </span>

              <span className="min-w-0 flex-1 truncate" title={nodo.etiqueta}>
                {nodo.etiqueta}
              </span>

              {nodo.codigo && (
                <span className="shrink-0 font-mono text-[0.6875rem] text-texto-tenue">
                  {nodo.codigo}
                </span>
              )}

              {nodo.deshabilitado && (
                <span className="shrink-0 text-[0.6875rem] text-texto-tenue">pendiente</span>
              )}
            </div>

            {nodo.error && (
              <p
                className="px-3 py-1 text-xs"
                style={{ color: 'var(--peligro)', paddingLeft: `${1.9 + (nodo.nivel - 1) * 0.85}rem` }}
              >
                No se pudo cargar {nodo.etiqueta}.{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    pedirCategoria(nodo.id);
                  }}
                >
                  Reintentar
                </button>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
