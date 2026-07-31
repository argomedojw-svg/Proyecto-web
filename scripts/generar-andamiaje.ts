/**
 * Generador de andamiaje educativo.
 *
 * LÍMITE ESTRICTO: no se redacta ni una palabra de contenido clínico. Todo lo
 * que produce este script es una REORDENACIÓN mecánica de texto que ya está en
 * los JSON: el anverso de una tarjeta es una etiqueta ("Criterio A de X") y el
 * reverso es el texto literal del criterio.
 *
 * Lo que este script NO hace, a propósito:
 *   - No escribe resúmenes ni perlas clínicas (exigirían redactar).
 *   - No inventa casos clínicos.
 *   - No construye algoritmos diagnósticos (parecerían validados sin serlo).
 *
 * Todo nace con `origen: 'andamiaje'` y `validado: false`, y solo se tocan los
 * elementos cuyo id empieza por `and:`. Lo que escriba la persona usuaria a mano
 * nunca se sobrescribe.
 *
 *   npm run andamiaje
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  indiceSchema,
  trastornoSchema,
  type Flashcard,
  type NodoCriterio,
  type Pregunta,
  type Trastorno,
} from '../src/lib/schema.js';
import { DIR_SALIDA } from './config.js';

const PREFIJO = 'and:';

const COLOR = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  verde: '[32m',
  amarillo: '[33m',
};

function fuenteAndamiaje(seccion: 'criterios' | null) {
  return {
    origen: 'andamiaje' as const,
    referencia: 'Reordenación mecánica del texto del propio archivo. No revisado.',
    seccionOrigen: seccion,
  };
}

/** Criterios de primer nivel del conjunto principal. */
function criteriosPrincipales(trastorno: Trastorno): {
  conjunto: string | null;
  nodo: NodoCriterio;
}[] {
  const salida: { conjunto: string | null; nodo: NodoCriterio }[] = [];
  for (const seccion of trastorno.secciones) {
    if (seccion.clave !== 'criterios') continue;
    for (const bloque of seccion.contenido) {
      if (bloque.tipo !== 'criterios') continue;
      for (const conjunto of bloque.conjuntos) {
        for (const nodo of conjunto.nodos) {
          if (nodo.tipo === 'criterio') salida.push({ conjunto: conjunto.nombre, nodo });
        }
      }
    }
  }
  return salida;
}

/** Texto completo de un criterio, con sus hijos, tal cual está en el JSON. */
function textoCompleto(nodo: NodoCriterio): string {
  const partes = [nodo.texto];
  for (const hijo of nodo.hijos) {
    const marca = hijo.etiqueta ? `${hijo.etiqueta}. ` : '';
    partes.push(`${marca}${textoCompleto(hijo)}`);
  }
  return partes.join('\n');
}

function generarFlashcards(trastorno: Trastorno): Flashcard[] {
  const tarjetas: Flashcard[] = [];

  for (const { conjunto, nodo } of criteriosPrincipales(trastorno)) {
    const sujeto = conjunto ?? trastorno.nombreCorto ?? trastorno.nombre;
    tarjetas.push({
      id: `${PREFIJO}${trastorno.id}:criterio:${nodo.ruta}${conjunto ? `:${conjunto}` : ''}`,
      validado: false,
      fuente: fuenteAndamiaje('criterios'),
      notas: null,
      creadoEn: null,
      anverso: `${sujeto} — Criterio ${nodo.ruta}`,
      reverso: textoCompleto(nodo),
      etiquetas: ['criterios'],
    });
  }

  // Código CIE: dato objetivo tomado del propio archivo.
  if (trastorno.codigos.dsm5tr) {
    tarjetas.push({
      id: `${PREFIJO}${trastorno.id}:codigo`,
      validado: false,
      fuente: fuenteAndamiaje(null),
      notas: null,
      creadoEn: null,
      anverso: `Código CIE-10 de: ${trastorno.nombre}`,
      reverso: trastorno.codigos.dsm5tr,
      etiquetas: ['códigos'],
    });
  }

  for (const adicional of trastorno.codigosAdicionales) {
    tarjetas.push({
      id: `${PREFIJO}${trastorno.id}:codigo:${adicional.codigo}`,
      validado: false,
      fuente: fuenteAndamiaje(null),
      notas: null,
      creadoEn: null,
      anverso: `${trastorno.nombre} — código de «${adicional.etiqueta}»`,
      reverso: adicional.codigo,
      etiquetas: ['códigos', 'especificadores'],
    });
  }

  return tarjetas;
}

/**
 * Preguntas de código. Los distractores son códigos REALES de otros trastornos
 * del mismo archivo: no hay ninguna afirmación clínica que inventar.
 */
function generarPreguntas(trastorno: Trastorno, otrosCodigos: string[]): Pregunta[] {
  const correcto = trastorno.codigos.dsm5tr;
  if (!correcto) return [];

  const distractores = otrosCodigos.filter((c) => c !== correcto).slice(0, 3);
  if (distractores.length < 2) return [];

  const opciones = [correcto, ...distractores]
    .map((codigo, i) => ({ id: `o${i}`, texto: codigo, codigo }))
    // Orden estable por código: sin aleatoriedad, para que regenerar no cambie el archivo.
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const idCorrecta = opciones.find((o) => o.codigo === correcto)?.id ?? null;

  return [
    {
      id: `${PREFIJO}${trastorno.id}:pregunta:codigo`,
      validado: false,
      fuente: fuenteAndamiaje(null),
      notas: null,
      creadoEn: null,
      enunciado: `¿Qué código CIE-10 corresponde a «${trastorno.nombre}»?`,
      opciones: opciones.map(({ id, texto }) => ({ id, texto })),
      respuestaCorrecta: idCorrecta,
      explicacion: `Según tu archivo de origen (${trastorno.procedencia.archivoFuente}, líneas ${trastorno.procedencia.lineaInicio}–${trastorno.procedencia.lineaFin}), el código es ${correcto}.`,
      seccionReferencia: 'criterios',
    },
  ];
}

async function main(): Promise<void> {
  if (!existsSync(DIR_SALIDA)) {
    console.error('No existe public/dsm/. Ejecuta antes: npm run convert');
    process.exit(1);
  }

  const indice = indiceSchema.parse(
    JSON.parse(await readFile(join(DIR_SALIDA, 'index.json'), 'utf8')),
  );

  let totalTarjetas = 0;
  let totalPreguntas = 0;
  let conservados = 0;
  let ficheros = 0;

  for (const categoria of indice.categorias) {
    if (!categoria.disponible) continue;
    const dir = join(DIR_SALIDA, categoria.id);
    if (!existsSync(dir)) continue;

    const nombres = (await readdir(dir)).filter((n) => n.endsWith('.json') && n !== 'index.json');
    const trastornos: Trastorno[] = [];
    for (const nombre of nombres.sort()) {
      trastornos.push(
        trastornoSchema.parse(JSON.parse(await readFile(join(dir, nombre), 'utf8'))),
      );
    }

    const codigosDelCapitulo = trastornos
      .map((t) => t.codigos.dsm5tr)
      .filter((c): c is string => Boolean(c));

    for (const trastorno of trastornos) {
      const tarjetasPropias = trastorno.educativo.flashcards.filter(
        (f) => !f.id.startsWith(PREFIJO),
      );
      const preguntasPropias = trastorno.educativo.preguntas.filter(
        (p) => !p.id.startsWith(PREFIJO),
      );
      conservados += tarjetasPropias.length + preguntasPropias.length;

      const tarjetas = generarFlashcards(trastorno);
      const preguntas = generarPreguntas(trastorno, codigosDelCapitulo);

      const actualizado: Trastorno = {
        ...trastorno,
        educativo: {
          ...trastorno.educativo,
          flashcards: [...tarjetasPropias, ...tarjetas],
          preguntas: [...preguntasPropias, ...preguntas],
        },
      };

      const validado = trastornoSchema.parse(actualizado);
      await writeFile(
        join(dir, `${trastorno.id}.json`),
        `${JSON.stringify(validado, null, 2)}\n`,
        'utf8',
      );

      totalTarjetas += tarjetas.length;
      totalPreguntas += preguntas.length;
      ficheros += 1;
    }
  }

  console.log(`\n${COLOR.bold}Andamiaje educativo${COLOR.reset}`);
  console.log(`  fichas actualizadas ..... ${ficheros}`);
  console.log(`  flashcards generadas .... ${totalTarjetas}`);
  console.log(`  preguntas generadas ..... ${totalPreguntas}`);
  console.log(`  elementos tuyos intactos  ${conservados}`);
  console.log(
    `\n  ${COLOR.amarillo}Todo nace con validado: false${COLOR.reset}${COLOR.dim} y se muestra con trama diagonal.${COLOR.reset}`,
  );
  console.log(
    `  ${COLOR.dim}No se han generado resúmenes, perlas, casos ni algoritmos: exigirían redactar contenido clínico.${COLOR.reset}`,
  );
  console.log(`\n${COLOR.verde}Hecho.${COLOR.reset}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
