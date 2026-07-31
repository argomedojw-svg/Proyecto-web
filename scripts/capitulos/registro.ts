/**
 * Registro de las 18 categorias de la Seccion II del DSM-5-TR.
 *
 * Los nombres son los rotulos de los capitulos, no contenido clinico. Las
 * categorias sin manifiesto aparecen en el indice raiz con `disponible: false`
 * para que el arbol de navegacion las muestre en gris desde el primer dia y la
 * arquitectura no cambie al ir anadiendolas.
 */

import type { CapituloDeclarado, EntradaRegistro } from './tipos.js';
import { neurodesarrollo } from './neurodesarrollo.js';

export const REGISTRO_CATEGORIAS: EntradaRegistro[] = [
  { id: 'trastornos-del-neurodesarrollo', nombre: 'Trastornos del neurodesarrollo', orden: 1 },
  {
    id: 'espectro-de-la-esquizofrenia-y-otros-trastornos-psicoticos',
    nombre: 'Espectro de la esquizofrenia y otros trastornos psicóticos',
    orden: 2,
  },
  { id: 'trastorno-bipolar-y-trastornos-relacionados', nombre: 'Trastorno bipolar y trastornos relacionados', orden: 3 },
  { id: 'trastornos-depresivos', nombre: 'Trastornos depresivos', orden: 4 },
  { id: 'trastornos-de-ansiedad', nombre: 'Trastornos de ansiedad', orden: 5 },
  {
    id: 'trastorno-obsesivo-compulsivo-y-trastornos-relacionados',
    nombre: 'Trastorno obsesivo-compulsivo y trastornos relacionados',
    orden: 6,
  },
  {
    id: 'trastornos-relacionados-con-traumas-y-factores-de-estres',
    nombre: 'Trastornos relacionados con traumas y factores de estrés',
    orden: 7,
  },
  { id: 'trastornos-disociativos', nombre: 'Trastornos disociativos', orden: 8 },
  {
    id: 'trastorno-de-sintomas-somaticos-y-trastornos-relacionados',
    nombre: 'Trastorno de síntomas somáticos y trastornos relacionados',
    orden: 9,
  },
  { id: 'trastornos-alimentarios-y-de-la-ingestion-de-alimentos', nombre: 'Trastornos alimentarios y de la ingestión de alimentos', orden: 10 },
  { id: 'trastornos-de-la-excrecion', nombre: 'Trastornos de la excreción', orden: 11 },
  { id: 'trastornos-del-sueno-vigilia', nombre: 'Trastornos del sueño-vigilia', orden: 12 },
  { id: 'disfunciones-sexuales', nombre: 'Disfunciones sexuales', orden: 13 },
  { id: 'disforia-de-genero', nombre: 'Disforia de género', orden: 14 },
  {
    id: 'trastornos-disruptivos-del-control-de-los-impulsos-y-de-la-conducta',
    nombre: 'Trastornos disruptivos, del control de los impulsos y de la conducta',
    orden: 15,
  },
  {
    id: 'trastornos-relacionados-con-sustancias-y-trastornos-adictivos',
    nombre: 'Trastornos relacionados con sustancias y trastornos adictivos',
    orden: 16,
  },
  { id: 'trastornos-neurocognitivos', nombre: 'Trastornos neurocognitivos', orden: 17 },
  { id: 'trastornos-de-la-personalidad', nombre: 'Trastornos de la personalidad', orden: 18 },
];

/** Capitulos que tienen manifiesto y por tanto pueden convertirse. */
export const CAPITULOS: CapituloDeclarado[] = [neurodesarrollo];
