/**
 * Comprobacion de fidelidad: todo el texto oficial que sale en los JSON tiene
 * que estar literalmente en el markdown de origen.
 *
 * Metodo: se normaliza (espacios colapsados, sin acentos) tanto la fuente como
 * cada fragmento extraido, y se comprueba que el fragmento aparezca como
 * subcadena. Los fragmentos reunidos por salto de pagina no apareceran enteros;
 * en ese caso se comprueban sus dos mitades por separado.
 *
 * Recorre TODOS los capitulos declarados en el registro: cada uno se compara
 * contra su propio archivo fuente, nunca contra el de otro.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { DIR_FUENTE, DIR_SALIDA } from './config.js';
import { CAPITULOS } from './capitulos/registro.js';

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();

/** Recoge todos los fragmentos de texto oficial de un JSON de trastorno. */
function fragmentos(t) {
  const out = [];
  const nodo = (n) => {
    out.push(n.texto);
    n.hijos.forEach(nodo);
  };
  for (const s of t.secciones) {
    for (const b of s.contenido) {
      switch (b.tipo) {
        case 'parrafo':
        case 'subtitulo':
          out.push(b.texto);
          break;
        case 'nota':
          out.push(b.texto);
          break;
        case 'tabla':
          out.push(...b.encabezados, ...b.filas.flat());
          break;
        case 'criterios':
          for (const c of b.conjuntos) {
            out.push(...c.preambulo);
            c.nodos.forEach(nodo);
            for (const e of c.especificaciones) {
              out.push(e.encabezado, ...e.notas);
              for (const o of e.opciones) {
                out.push(o.etiqueta);
                if (o.descripcion) out.push(o.descripcion);
                out.push(...o.subopciones);
              }
            }
          }
          break;
        default:
          break;
      }
    }
  }
  return out.filter((x) => typeof x === 'string' && x.trim().length > 0);
}

let total = 0;
let literal = 0;
let porMitades = 0;
const fallos = [];

for (const capitulo of CAPITULOS) {
  const dir = join(DIR_SALIDA, capitulo.id);
  if (!existsSync(dir)) continue;

  const bruto = readFileSync(join(DIR_FUENTE, capitulo.archivoFuente), 'utf8');
  const fuente = norm(bruto);
  // Version sin guiones de corte, para los fragmentos reunidos con guion.
  const fuenteSinGuion = fuente.replace(/- /g, '');
  // Version sin los codigos CIE que el maquetado deja al margen partiendo una
  // frase por la mitad (el "F82" dentro del criterio A de la coordinacion).
  const fuenteSinCodigos = norm(bruto.replace(/^\s*F\d{2}(?:\.\d{1,2})?\s*$/gm, ''));

  for (const archivo of readdirSync(dir)) {
    if (!archivo.endsWith('.json') || archivo === 'index.json') continue;
    const t = JSON.parse(readFileSync(join(dir, archivo), 'utf8'));
    for (const trozo of fragmentos(t)) {
      total += 1;
      const f = norm(trozo);
      if (f.length < 3) {
        literal += 1;
        continue;
      }
      if (fuente.includes(f) || fuenteSinGuion.includes(f.replace(/- /g, ''))) {
        literal += 1;
        continue;
      }
      if (fuenteSinCodigos.includes(f)) {
        porMitades += 1;
        continue;
      }
      // Fragmento reunido: se prueban varios puntos de corte y se comprueba que
      // ambas mitades existan literalmente en la fuente.
      let reunido = false;
      for (const fraccion of [0.25, 0.35, 0.5, 0.65, 0.75]) {
        const corte = f.lastIndexOf(' ', Math.floor(f.length * fraccion));
        if (corte < 20) continue;
        const izq = f.slice(0, corte).trim();
        const der = f.slice(corte).trim();
        if (der.length > 20 && fuente.includes(izq) && fuente.includes(der)) {
          reunido = true;
          break;
        }
      }
      if (reunido) {
        porMitades += 1;
        continue;
      }
      fallos.push({ capitulo: capitulo.id, archivo, texto: trozo.slice(0, 160) });
    }
  }
}

console.log('\n=== FIDELIDAD DEL TEXTO OFICIAL ===');
console.log(`Capítulos comprobados .......... ${CAPITULOS.length}`);
console.log(`Fragmentos comprobados ......... ${total}`);
console.log(`Literales en la fuente ......... ${literal}`);
console.log(`Reunidos (mitades verificadas) . ${porMitades}`);
console.log(`Sin correspondencia ............ ${fallos.length}`);
for (const f of fallos.slice(0, 15)) {
  console.log(`  ✗ ${f.capitulo}/${f.archivo}\n     ${f.texto}`);
}
if (fallos.length > 15) console.log(`  … y ${fallos.length - 15} más`);
process.exitCode = fallos.length === 0 ? 0 : 1;
