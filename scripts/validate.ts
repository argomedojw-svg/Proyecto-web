/**
 * Validacion de todos los JSON de public/dsm/ contra el esquema Zod.
 *
 * Objetivo: cuando edites un JSON a mano y te equivoques, saber EXACTAMENTE
 * que fichero y que ruta del campo esta mal, en vez de una pantalla en blanco.
 *
 *   npm run validate
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ZodError, type ZodTypeAny } from 'zod';

import {
  categoriaSchema,
  indiceBusquedaSchema,
  indiceSchema,
  trastornoSchema,
} from '../src/lib/schema.js';
import { DIR_SALIDA as DIR_DSM, RAIZ } from './config.js';

const COLOR = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  rojo: '[31m',
  amarillo: '[33m',
  verde: '[32m',
};

type Resultado = {
  archivo: string;
  ok: boolean;
  esquema: string;
  errores: { ruta: string; mensaje: string; recibido: string | null }[];
};

/** Elige el esquema por el campo `esquema` del propio JSON. */
function elegirEsquema(dato: unknown): { nombre: string; schema: ZodTypeAny } | null {
  if (typeof dato !== 'object' || dato === null) return null;
  const marca = (dato as { esquema?: unknown }).esquema;
  switch (marca) {
    case 'dsm5tr-trastorno/1':
      return { nombre: 'trastorno', schema: trastornoSchema };
    case 'dsm5tr-categoria/1':
      return { nombre: 'categoría', schema: categoriaSchema };
    case 'dsm5tr-indice/1':
      return { nombre: 'índice', schema: indiceSchema };
    case 'dsm5tr-busqueda/1':
      return { nombre: 'índice de búsqueda', schema: indiceBusquedaSchema };
    default:
      return null;
  }
}

async function listarJson(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true });
  const salida: string[] = [];
  for (const entrada of entradas) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await listarJson(ruta)));
    else if (entrada.name.endsWith('.json')) salida.push(ruta);
  }
  return salida.sort();
}

function formatearRuta(ruta: (string | number)[]): string {
  if (ruta.length === 0) return '(raíz)';
  return ruta
    .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? p : `.${p}`))
    .join('');
}

async function validarArchivo(ruta: string): Promise<Resultado> {
  const relativa = relative(RAIZ, ruta).replace(/\\/g, '/');
  // Se descarta la marca de orden de bytes (BOM): en Windows es fácil guardar
  // un JSON como «UTF-8 con BOM» y JSON.parse falla sin explicar por qué.
  const bruto = (await readFile(ruta, 'utf8')).replace(/^﻿/, '');

  let dato: unknown;
  try {
    dato = JSON.parse(bruto);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return {
      archivo: relativa,
      ok: false,
      esquema: '—',
      errores: [{ ruta: '(archivo)', mensaje: `JSON mal formado: ${mensaje}`, recibido: null }],
    };
  }

  const elegido = elegirEsquema(dato);
  if (!elegido) {
    return {
      archivo: relativa,
      ok: false,
      esquema: '—',
      errores: [
        {
          ruta: 'esquema',
          mensaje:
            'Falta el campo "esquema" o su valor no se reconoce. Valores válidos: dsm5tr-trastorno/1, dsm5tr-categoria/1, dsm5tr-indice/1, dsm5tr-busqueda/1',
          recibido: JSON.stringify((dato as { esquema?: unknown })?.esquema ?? null),
        },
      ],
    };
  }

  const resultado = elegido.schema.safeParse(dato);
  if (resultado.success) {
    return { archivo: relativa, ok: true, esquema: elegido.nombre, errores: [] };
  }

  const error = resultado.error as ZodError;
  return {
    archivo: relativa,
    ok: false,
    esquema: elegido.nombre,
    errores: error.issues.map((issue) => ({
      ruta: formatearRuta(issue.path),
      mensaje: issue.message,
      recibido:
        'received' in issue && issue.received !== undefined ? String(issue.received) : null,
    })),
  };
}

async function main(): Promise<void> {
  if (!existsSync(DIR_DSM)) {
    console.error(
      `${COLOR.rojo}No existe public/dsm/. Ejecuta primero:${COLOR.reset}\n  npm run convert\n`,
    );
    process.exit(1);
  }

  const archivos = await listarJson(DIR_DSM);
  if (archivos.length === 0) {
    console.error(`${COLOR.rojo}No hay ningún JSON en public/dsm/.${COLOR.reset}`);
    process.exit(1);
  }

  const resultados = await Promise.all(archivos.map(validarArchivo));
  const fallidos = resultados.filter((r) => !r.ok);

  console.log(`\n${COLOR.bold}Validación de public/dsm/${COLOR.reset}`);
  console.log(`${COLOR.dim}${archivos.length} archivos${COLOR.reset}\n`);

  if (fallidos.length === 0) {
    for (const r of resultados) {
      console.log(`  ${COLOR.verde}✓${COLOR.reset} ${r.archivo} ${COLOR.dim}(${r.esquema})${COLOR.reset}`);
    }
    console.log(`\n${COLOR.verde}${COLOR.bold}Todo correcto: ${resultados.length}/${resultados.length}.${COLOR.reset}\n`);
    return;
  }

  for (const r of fallidos) {
    console.log(`${COLOR.rojo}${COLOR.bold}✗ ${r.archivo}${COLOR.reset} ${COLOR.dim}(${r.esquema})${COLOR.reset}`);
    for (const e of r.errores) {
      console.log(`    ${COLOR.amarillo}${e.ruta}${COLOR.reset}`);
      console.log(`      ${e.mensaje}${e.recibido ? `${COLOR.dim} · recibido: ${e.recibido}${COLOR.reset}` : ''}`);
    }
    console.log('');
  }

  console.log(
    `${COLOR.rojo}${COLOR.bold}${fallidos.length} de ${resultados.length} archivos no validan.${COLOR.reset}\n`,
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
