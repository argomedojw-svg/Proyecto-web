/**
 * Mapa de normalizacion de titulos de seccion -> clave canonica.
 *
 * Tres estrategias, en orden, ninguna adivinatoria:
 *   1. Coincidencia exacta sobre el titulo plegado.
 *   2. Alias declarado (variantes que aparecen literalmente en la fuente).
 *   3. Patron de prefijo declarado (para titulos que arrastran el nombre del
 *      trastorno: "Consecuencias funcionales del trastorno de la fluidez...").
 *
 * Si ninguna resuelve, la seccion NO se descarta ni se adivina: se conserva con
 * `clave: null` y se reporta con su texto literal. Se descarta expresamente el
 * emparejamiento difuso (Levenshtein y similares): un mapeo silenciosamente
 * equivocado es peor que un hueco explicito.
 */

import type { ClaveSeccion } from '../../src/lib/schema.js';
import { plegar } from './texto.js';

/** Titulo canonico plegado -> clave. */
const CANONICOS: Record<string, ClaveSeccion> = {
  'criterios diagnosticos': 'criterios',
  especificadores: 'especificadores',
  'procedimientos de registro': 'procedimientos_registro',
  'caracteristicas diagnosticas': 'caracteristicas_diagnosticas',
  'caracteristicas asociadas': 'caracteristicas_asociadas',
  prevalencia: 'prevalencia',
  'desarrollo y curso': 'desarrollo_curso',
  'factores de riesgo y pronostico': 'factores_riesgo_pronostico',
  'aspectos diagnosticos relacionados con la cultura': 'cultura',
  'aspectos diagnosticos relacionados con el sexo y el genero': 'sexo_genero',
  'marcadores diagnosticos': 'marcadores_diagnosticos',
  'asociacion con pensamientos o conductas suicidas': 'suicidio',
  'consecuencias funcionales': 'consecuencias_funcionales',
  'diagnostico diferencial': 'diagnostico_diferencial',
  comorbilidad: 'comorbilidad',
  'relacion con otras clasificaciones': 'relacion_otras_clasificaciones',
};

/**
 * Variantes observadas o previsibles. Se declaran una a una a proposito:
 * anadir un alias es una decision humana, no un calculo del conversor.
 */
const ALIAS: Record<string, ClaveSeccion> = {
  'criterios diagnosticos y caracteristicas': 'criterios',
  'caracteristicas asociadas que apoyan el diagnostico': 'caracteristicas_asociadas',
  'caracteristicas que apoyan el diagnostico': 'caracteristicas_asociadas',
  'aspectos diagnosticos relacionados con el genero': 'sexo_genero',
  'aspectos diagnosticos relacionados con el sexo': 'sexo_genero',
  'cuestiones diagnosticas relativas a la cultura': 'cultura',
  'cuestiones diagnosticas relativas al genero': 'sexo_genero',
  'riesgo de suicidio': 'suicidio',
  'consecuencias funcionales del trastorno': 'consecuencias_funcionales',
  'relacion con la cie-11': 'relacion_otras_clasificaciones',
  'relacion con otros sistemas de clasificacion': 'relacion_otras_clasificaciones',
  'especificadores de gravedad': 'especificadores',
  'subtipos y especificadores': 'especificadores',
  'procedimiento de registro': 'procedimientos_registro',
  'nota de codificacion': 'procedimientos_registro',
};

/**
 * Patrones de prefijo. El DSM alarga algunos titulos con el nombre del
 * trastorno; el prefijo es estable aunque la cola no lo sea.
 */
const PREFIJOS: ReadonlyArray<readonly [RegExp, ClaveSeccion]> = [
  [/^consecuencias funcionales\b/, 'consecuencias_funcionales'],
  [/^aspectos diagnosticos relacionados con la cultura\b/, 'cultura'],
  [/^aspectos diagnosticos relacionados con (el sexo|el genero)\b/, 'sexo_genero'],
  [/^asociacion con (pensamientos|conductas|el suicidio)\b/, 'suicidio'],
  [/^factores de riesgo y pronostico\b/, 'factores_riesgo_pronostico'],
  [/^relacion con otras clasificaciones\b/, 'relacion_otras_clasificaciones'],
  [/^marcadores diagnosticos\b/, 'marcadores_diagnosticos'],
  [/^criterios diagnosticos\b/, 'criterios'],
  [/^diagnostico diferencial\b/, 'diagnostico_diferencial'],
  [/^procedimientos? de registro\b/, 'procedimientos_registro'],
  [/^desarrollo y curso\b/, 'desarrollo_curso'],
];

export type ResolucionSeccion = {
  clave: ClaveSeccion | null;
  claveOriginal: string;
  /** Como se resolvio. Se usa en el informe. */
  via: 'canonico' | 'alias' | 'prefijo' | 'desconocida';
};

export function resolverSeccion(titulo: string): ResolucionSeccion {
  const plegado = plegar(titulo).replace(/[:.]+$/, '').trim();

  const canonico = CANONICOS[plegado];
  if (canonico) return { clave: canonico, claveOriginal: plegado, via: 'canonico' };

  const alias = ALIAS[plegado];
  if (alias) return { clave: alias, claveOriginal: plegado, via: 'alias' };

  for (const [patron, clave] of PREFIJOS) {
    if (patron.test(plegado)) return { clave, claveOriginal: plegado, via: 'prefijo' };
  }

  return { clave: null, claveOriginal: plegado, via: 'desconocida' };
}

/**
 * Encabezados que parecen seccion pero pertenecen al bloque de criterios.
 * Se absorben en la seccion de criterios en curso en lugar de promoverse.
 */
export function esEncabezadoDeEspecificacion(titulo: string): boolean {
  const p = plegar(titulo).replace(/[:.]+$/, '').trim();
  return (
    /^especificar\b/.test(p) ||
    /^especificar si$/.test(p) ||
    /^nota de codificacion$/.test(p) ||
    /^f\d{2}(\.\d{1,2})?\s+con\b/.test(p)
  );
}
