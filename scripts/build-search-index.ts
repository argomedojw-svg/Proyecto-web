/**
 * Genera public/dsm/search-index.json.
 *
 * SIN texto completo, a propósito: solo identificación (nombre, sinónimos,
 * abreviaturas, códigos y palabras clave de los títulos de sección). Indexar la
 * Sección II entera en tiempo de ejecución congelaría el arranque; y un índice
 * con el cuerpo de los artículos pesaría megabytes.
 *
 * Las palabras clave salen de los TÍTULOS y de los nombres de especificador,
 * nunca del cuerpo clínico: no se resume ni se reinterpreta contenido.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  ESQUEMA_BUSQUEDA,
  VERSION_ESQUEMA,
  categoriaSchema,
  indiceBusquedaSchema,
  indiceSchema,
  trastornoSchema,
  type Trastorno,
} from '../src/lib/schema.js';
import { DIR_SALIDA } from './config.js';

const COLOR = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  verde: '[32m',
  rojo: '[31m',
};

/** Palabras clave: títulos de sección, nombres de conjunto y especificadores. */
function palabrasClave(trastorno: Trastorno): string[] {
  const claves = new Set<string>();

  for (const seccion of trastorno.secciones) {
    if (seccion.titulo) claves.add(seccion.titulo);

    for (const bloque of seccion.contenido) {
      if (bloque.tipo !== 'criterios') continue;
      for (const conjunto of bloque.conjuntos) {
        if (conjunto.nombre) claves.add(conjunto.nombre);
        for (const especificacion of conjunto.especificaciones) {
          for (const opcion of especificacion.opciones) {
            if (opcion.etiqueta.length <= 60) claves.add(opcion.etiqueta);
          }
        }
      }
    }
  }

  for (const relacion of trastorno.relaciones.comparadoCon) claves.add(relacion.nombre);

  return [...claves];
}

async function main(): Promise<void> {
  if (!existsSync(DIR_SALIDA)) {
    console.error(`${COLOR.rojo}No existe public/dsm/. Ejecuta antes: npm run convert${COLOR.reset}`);
    process.exit(1);
  }

  const indiceRaiz = indiceSchema.parse(
    JSON.parse(await readFile(join(DIR_SALIDA, 'index.json'), 'utf8')),
  );

  const entradas: unknown[] = [];

  for (const categoria of indiceRaiz.categorias) {
    if (!categoria.disponible) continue;
    const dir = join(DIR_SALIDA, categoria.id);
    if (!existsSync(dir)) continue;

    const indiceCategoria = categoriaSchema.parse(
      JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')),
    );
    const subPorId = new Map(indiceCategoria.subcategorias.map((s) => [s.id, s.nombre]));

    for (const archivo of (await readdir(dir)).sort()) {
      if (!archivo.endsWith('.json') || archivo === 'index.json') continue;

      const trastorno = trastornoSchema.parse(
        JSON.parse(await readFile(join(dir, archivo), 'utf8')),
      );

      const codigos = [
        trastorno.codigos.dsm5tr,
        trastorno.codigos.cie10,
        trastorno.codigos.cie11,
        ...trastorno.codigosAdicionales.map((c) => c.codigo),
      ].filter((c): c is string => Boolean(c));

      entradas.push({
        id: trastorno.id,
        nombre: trastorno.nombre,
        // Las subentradas (Tourette y compañía) entran como sinónimos para que
        // buscarlas por su nombre lleve a la ficha que las contiene.
        sinonimos: [
          ...trastorno.sinonimos,
          ...(trastorno.nombreCorto ? [trastorno.nombreCorto] : []),
        ],
        abreviaturas: trastorno.abreviaturas,
        codigos: [...new Set(codigos)],
        palabrasClave: palabrasClave(trastorno),
        categoriaId: trastorno.categoria.id,
        categoriaNombre: trastorno.categoria.nombre,
        subcategoriaNombre: trastorno.subcategoria
          ? (subPorId.get(trastorno.subcategoria.id) ?? trastorno.subcategoria.nombre)
          : null,
        archivo: `${categoria.id}/${trastorno.id}.json`,
      });
    }
  }

  const indiceBusqueda = indiceBusquedaSchema.parse({
    esquema: ESQUEMA_BUSQUEDA,
    version: VERSION_ESQUEMA,
    generadoEn: new Date().toISOString(),
    entradas,
  });

  await mkdir(DIR_SALIDA, { recursive: true });
  const ruta = join(DIR_SALIDA, 'search-index.json');
  const json = `${JSON.stringify(indiceBusqueda, null, 2)}\n`;
  await writeFile(ruta, json, 'utf8');

  const kb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);
  console.log(`\n${COLOR.bold}Índice de búsqueda${COLOR.reset}`);
  console.log(`  entradas ....... ${indiceBusqueda.entradas.length}`);
  console.log(`  códigos ........ ${indiceBusqueda.entradas.reduce((n, e) => n + e.codigos.length, 0)}`);
  console.log(`  sinónimos ...... ${indiceBusqueda.entradas.reduce((n, e) => n + e.sinonimos.length, 0)}`);
  console.log(`  palabras clave . ${indiceBusqueda.entradas.reduce((n, e) => n + e.palabrasClave.length, 0)}`);
  console.log(`  tamaño ......... ${kb} kB ${COLOR.dim}(sin texto completo)${COLOR.reset}`);
  console.log(`\n${COLOR.verde}Escrito en public/dsm/search-index.json${COLOR.reset}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
