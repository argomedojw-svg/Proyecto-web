/**
 * Manifiesto del capitulo "Trastornos del neurodesarrollo".
 *
 * Todo lo que hay aqui esta tomado del archivo fuente del usuario. Los sinonimos
 * llevan la linea exacta donde aparecen para que el informe permita auditarlos
 * uno a uno. Ningun termino se ha anadido por conocimiento externo.
 */

import type { CapituloDeclarado } from './tipos.js';

export const neurodesarrollo: CapituloDeclarado = {
  id: 'trastornos-del-neurodesarrollo',
  nombre: 'Trastornos del neurodesarrollo',
  orden: 1,
  archivoFuente: '01-Transtornos del neurodesarrollo- corregido.md',
  subcategorias: [
    {
      nombre: 'Trastornos del desarrollo intelectual',
      trastornos: [
        {
          nombre: 'Trastorno del desarrollo intelectual (discapacidad intelectual)',
          nombreCorto: 'Trastorno del desarrollo intelectual',
          // El titulo aparece como parrafo suelto en la linea 35, sin encabezado.
          tituloHuerfano: true,
          sinonimos: [{ termino: 'Discapacidad intelectual', lineaFuente: 35 }],
        },
        {
          nombre: 'Retraso global del desarrollo',
          tipoEntrada: 'variante',
        },
        {
          nombre: 'Trastorno del desarrollo intelectual (discapacidad intelectual) no especificado',
          nombreCorto: 'Trastorno del desarrollo intelectual no especificado',
          tipoEntrada: 'no_especificado',
        },
      ],
    },
    {
      nombre: 'Trastornos de la comunicación',
      trastornos: [
        { nombre: 'Trastorno del lenguaje' },
        { nombre: 'Trastorno del sonido del habla' },
        {
          nombre: 'Trastorno de la fluidez de inicio en la infancia (tartamudeo)',
          nombreCorto: 'Trastorno de la fluidez de inicio en la infancia',
          sinonimos: [{ termino: 'Tartamudeo', lineaFuente: 311 }],
        },
        {
          nombre: 'Trastorno de la comunicación social (pragmático)',
          nombreCorto: 'Trastorno de la comunicación social',
        },
        {
          nombre: 'Trastorno de la comunicación no especificado',
          tipoEntrada: 'no_especificado',
        },
      ],
    },
    {
      nombre: 'Trastorno del espectro autista',
      trastornos: [
        {
          nombre: 'Trastorno del espectro autista',
          sinonimos: [
            { termino: 'Trastorno de Asperger', lineaFuente: 523 },
            { termino: 'Autismo infantil', lineaFuente: 523 },
            { termino: 'Autismo de Kanner', lineaFuente: 523 },
            { termino: 'Trastorno generalizado del desarrollo', lineaFuente: 523 },
            { termino: 'Trastorno autista', lineaFuente: 465 },
          ],
          // "TEA" no aparece en el archivo fuente; no se anade.
        },
      ],
    },
    {
      nombre: 'Trastorno por déficit de atención/hiperactividad',
      variantes: ['Trastorno por déficit de atención/ hiperactividad'],
      trastornos: [
        {
          nombre: 'Trastorno por déficit de atención/hiperactividad',
          variantes: ['Trastorno por déficit de atención/ hiperactividad'],
          tituloHuerfano: true,
          abreviaturas: [{ termino: 'TDAH', lineaFuente: 23 }],
        },
        {
          nombre: 'Otro trastorno por déficit de atención/hiperactividad especificado',
          variantes: ['Otro trastorno por déficit de atención/ hiperactividad especificado'],
          nombreCorto: 'Otro TDAH especificado',
          tipoEntrada: 'otro_especificado',
        },
        {
          nombre: 'Trastorno por déficit de atención/hiperactividad no especificado',
          variantes: ['Trastorno por déficit de atención/ hiperactividad no especificado'],
          nombreCorto: 'TDAH no especificado',
          tipoEntrada: 'no_especificado',
        },
      ],
    },
    {
      nombre: 'Trastorno específico del aprendizaje',
      trastornos: [
        {
          nombre: 'Trastorno específico del aprendizaje',
          sinonimos: [
            { termino: 'Dislexia', lineaFuente: 907 },
            { termino: 'Discalculia', lineaFuente: 927 },
          ],
        },
      ],
    },
    {
      nombre: 'Trastornos motores',
      trastornos: [
        { nombre: 'Trastorno del desarrollo de la coordinación' },
        { nombre: 'Trastorno de movimientos estereotipados' },
        {
          // El manual da un unico apartado de criterios con tres trastornos
          // nombrados dentro y despues secciones comunes a los tres.
          // Se convierte en UNA ficha con tres conjuntos de criterios; el arbol
          // los expone como subentradas enlazadas por ancla.
          nombre: 'Trastornos de tics',
          sinonimos: [
            { termino: 'Trastorno de la Tourette', lineaFuente: 1218 },
            { termino: 'Trastorno de tics motores o vocales persistente (crónico)', lineaFuente: 1230 },
            { termino: 'Trastorno de tics provisional', lineaFuente: 1250 },
            { termino: 'Tourette', lineaFuente: 1218 },
          ],
        },
        {
          nombre: 'Otro trastorno de tics especificado',
          tipoEntrada: 'otro_especificado',
        },
        {
          nombre: 'Trastorno de tics no especificado',
          tipoEntrada: 'no_especificado',
        },
      ],
    },
    {
      nombre: 'Otros trastornos del neurodesarrollo',
      trastornos: [
        {
          nombre: 'Otro trastorno del neurodesarrollo especificado',
          tipoEntrada: 'otro_especificado',
        },
        {
          nombre: 'Trastorno del neurodesarrollo no especificado',
          tipoEntrada: 'no_especificado',
        },
      ],
    },
  ],
};

/**
 * Encabezados que en la fuente introducen un conjunto de criterios nombrado
 * DENTRO del apartado de criterios de otra ficha (no son fichas propias).
 */
export const CONJUNTOS_NOMBRADOS: Record<string, string[]> = {
  'trastornos-de-tics': [
    'Trastorno de la Tourette',
    'Trastorno de tics motores o vocales persistente (crónico)',
    'Trastorno de tics provisional',
  ],
};
