/**
 * Búsqueda con Fuse.js sobre el índice pre-construido.
 *
 * Los resultados se agrupan por TIPO DE COINCIDENCIA (código, nombre, sinónimo,
 * palabra clave) porque no es lo mismo acertar el nombre exacto que rozar una
 * palabra suelta, y ordenarlos todos en una sola lista por puntuación mezcla
 * cosas que el ojo distingue mejor separadas.
 */

import Fuse, { type FuseResultMatch, type IFuseOptions } from 'fuse.js';
import type { IndiceBusqueda } from './schema';

export type EntradaBusqueda = IndiceBusqueda['entradas'][number];

export type TipoCoincidencia = 'codigo' | 'nombre' | 'sinonimo' | 'palabra_clave';

export const ETIQUETA_COINCIDENCIA: Record<TipoCoincidencia, string> = {
  codigo: 'Por código',
  nombre: 'Por nombre',
  sinonimo: 'Por sinónimo o abreviatura',
  palabra_clave: 'Por palabra clave',
};

export type Resultado = {
  entrada: EntradaBusqueda;
  tipo: TipoCoincidencia;
  puntuacion: number;
  /** Texto en el que se acertó, para poder mostrar el fragmento resaltado. */
  textoCoincidente: string;
  /** Rangos [inicio, fin] dentro de `textoCoincidente`. */
  rangos: readonly (readonly [number, number])[];
};

const OPCIONES: IFuseOptions<EntradaBusqueda> = {
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
  keys: [
    { name: 'nombre', weight: 1 },
    { name: 'abreviaturas', weight: 0.95 },
    { name: 'sinonimos', weight: 0.8 },
    { name: 'codigos', weight: 0.7 },
    { name: 'palabrasClave', weight: 0.3 },
  ],
};

function tipoDeClave(clave: string | undefined): TipoCoincidencia {
  switch (clave) {
    case 'codigos':
      return 'codigo';
    case 'nombre':
      return 'nombre';
    case 'sinonimos':
    case 'abreviaturas':
      return 'sinonimo';
    default:
      return 'palabra_clave';
  }
}

const PRIORIDAD: Record<TipoCoincidencia, number> = {
  codigo: 0,
  nombre: 1,
  sinonimo: 2,
  palabra_clave: 3,
};

export function crearBuscador(indice: IndiceBusqueda): Fuse<EntradaBusqueda> {
  return new Fuse(indice.entradas, OPCIONES);
}

/** Plegado sin tildes: «TDAH», «tdah» y «autismo» deben comportarse igual. */
function plegar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function buscar(
  buscador: Fuse<EntradaBusqueda>,
  consulta: string,
  limite = 30,
): Resultado[] {
  const limpia = consulta.trim();
  if (limpia.length === 0) return [];

  const plegada = plegar(limpia);
  const resultados: Resultado[] = [];
  const vistos = new Set<string>();

  /* 1 · Coincidencias exactas primero. Fuse es difuso y en un buscador de
        consulta rápida el acierto literal tiene que ganar siempre. */
  for (const entrada of buscador.getIndex().docs as EntradaBusqueda[]) {
    const nombre = plegar(entrada.nombre);
    const codigoExacto = entrada.codigos.find((c) => plegar(c) === plegada);
    const abreviaturaExacta = entrada.abreviaturas.find((a) => plegar(a) === plegada);

    if (codigoExacto) {
      resultados.push({
        entrada,
        tipo: 'codigo',
        puntuacion: 0,
        textoCoincidente: codigoExacto,
        rangos: [[0, codigoExacto.length - 1]],
      });
      vistos.add(entrada.id);
    } else if (abreviaturaExacta) {
      resultados.push({
        entrada,
        tipo: 'sinonimo',
        puntuacion: 0,
        textoCoincidente: abreviaturaExacta,
        rangos: [[0, abreviaturaExacta.length - 1]],
      });
      vistos.add(entrada.id);
    } else if (nombre.startsWith(plegada)) {
      resultados.push({
        entrada,
        tipo: 'nombre',
        puntuacion: 0.001,
        textoCoincidente: entrada.nombre,
        rangos: [[0, plegada.length - 1]],
      });
      vistos.add(entrada.id);
    }
  }

  /* 2 · Búsqueda difusa para el resto. */
  for (const bruto of buscador.search(limpia, { limit: limite * 2 })) {
    if (vistos.has(bruto.item.id)) continue;
    const coincidencia: FuseResultMatch | undefined = bruto.matches?.[0];
    resultados.push({
      entrada: bruto.item,
      tipo: tipoDeClave(coincidencia?.key),
      puntuacion: bruto.score ?? 1,
      textoCoincidente: coincidencia?.value ?? bruto.item.nombre,
      rangos: coincidencia?.indices ?? [],
    });
    vistos.add(bruto.item.id);
  }

  resultados.sort((a, b) => {
    const p = PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo];
    return p !== 0 ? p : a.puntuacion - b.puntuacion;
  });

  return resultados.slice(0, limite);
}

export function agruparPorTipo(resultados: Resultado[]): [TipoCoincidencia, Resultado[]][] {
  const grupos = new Map<TipoCoincidencia, Resultado[]>();
  for (const resultado of resultados) {
    const lista = grupos.get(resultado.tipo) ?? [];
    lista.push(resultado);
    grupos.set(resultado.tipo, lista);
  }
  return [...grupos.entries()].sort((a, b) => PRIORIDAD[a[0]] - PRIORIDAD[b[0]]);
}

/** Trocea un texto en fragmentos marcados/no marcados para resaltarlo. */
export function fragmentar(
  texto: string,
  rangos: readonly (readonly [number, number])[],
): { texto: string; resaltado: boolean }[] {
  if (rangos.length === 0) return [{ texto, resaltado: false }];

  const ordenados = [...rangos].sort((a, b) => a[0] - b[0]);
  const partes: { texto: string; resaltado: boolean }[] = [];
  let cursor = 0;

  for (const [inicio, fin] of ordenados) {
    if (inicio > cursor) partes.push({ texto: texto.slice(cursor, inicio), resaltado: false });
    partes.push({ texto: texto.slice(inicio, fin + 1), resaltado: true });
    cursor = fin + 1;
  }
  if (cursor < texto.length) partes.push({ texto: texto.slice(cursor), resaltado: false });

  return partes.filter((p) => p.texto.length > 0);
}
