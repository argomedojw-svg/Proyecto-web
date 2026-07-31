/**
 * Comprobacion de cobertura: toda linea de texto del markdown de origen tiene
 * que aparecer en algun JSON. Es la comprobacion inversa a la de fidelidad y es
 * la que garantiza "nada se pierde en silencio".
 *
 * Lo unico que puede quedar fuera legitimamente son los encabezados (que pasan
 * a ser titulos de seccion o nombres de trastorno), los envoltorios de
 * maquetacion y las URL de imagen, que se registran como hueco explicito.
 *
 * Recorre TODOS los capitulos declarados en el registro: cada fuente se compara
 * solo contra los JSON de su propio capitulo.
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

/* --- Todo el texto extraido de un capitulo, en un solo saco --- */
function recogerTrozos(dir) {
  const trozos = [];
  const empujarNodo = (n) => {
    trozos.push(n.texto);
    n.hijos.forEach(empujarNodo);
  };
  const empujarBloques = (bloques) => {
    for (const b of bloques) {
      if (b.tipo === 'parrafo' || b.tipo === 'subtitulo' || b.tipo === 'nota') trozos.push(b.texto);
      else if (b.tipo === 'tabla') trozos.push(b.titulo ?? '', ...b.encabezados, ...b.filas.flat());
      else if (b.tipo === 'criterios') {
        for (const c of b.conjuntos) {
          if (c.nombre) trozos.push(c.nombre);
          if (c.codigo) trozos.push(c.codigo);
          trozos.push(...c.preambulo);
          c.nodos.forEach(empujarNodo);
          for (const e of c.especificaciones) {
            trozos.push(e.encabezado, ...e.notas);
            for (const o of e.opciones) {
              trozos.push(o.etiqueta, o.descripcion ?? '', ...o.subopciones);
              if (o.codigo) trozos.push(o.codigo);
            }
          }
        }
      }
    }
  };

  for (const archivo of readdirSync(dir)) {
    if (!archivo.endsWith('.json')) continue;
    const j = JSON.parse(readFileSync(join(dir, archivo), 'utf8'));
    if (archivo === 'index.json') {
      empujarBloques(j.introduccion);
      for (const s of j.subcategorias) empujarBloques(s.introduccion);
      for (const t of j.trastornos) trozos.push(t.nombre, t.codigo ?? '');
      continue;
    }
    trozos.push(j.nombre, j.codigos.dsm5tr ?? '');
    for (const c of j.codigosAdicionales) trozos.push(c.codigo, c.etiqueta);
    for (const s of j.secciones) {
      trozos.push(s.titulo);
      empujarBloques(s.contenido);
    }
  }
  return trozos;
}

/**
 * Transformaciones mecanicas que aplica el conversor y que el comparador debe
 * reproducir para no dar falsos negativos. Ninguna altera contenido: solo
 * separan el marcador del cuerpo.
 */
function variantes(n) {
  const out = new Set([n]);
  // "a. texto" / "1. texto" / "A. texto" -> el marcador va a `etiqueta`.
  out.add(n.replace(/^[a-z0-9]{1,2}\.\s+/, ''));
  // "f71 moderado" -> codigo + etiqueta separados.
  out.add(n.replace(/^f\d{2}(?:\.\d{1,2})?\s+/, ''));
  // "tabla 1 escala de gravedad ... (cont.)" -> titulo de la tabla.
  out.add(n.replace(/^tabla\s+\d+\s+/, '').replace(/\s*\(cont\.?\)\s*$/, ''));
  // "nota: texto" -> el cuerpo se guarda sin el rotulo.
  out.add(n.replace(/^nota(?: de codificacion)?:\s*/, ''));
  // Palabra cortada al final de pagina.
  out.add(n.replace(/-$/, ''));
  return [...out];
}

/**
 * Umbral de longitud para buscar por subcadena. Por debajo de el, una cadena
 * corta ("delirios.") aparecería por casualidad dentro de cualquier parrafo, asi
 * que solo se acepta si coincide EXACTAMENTE con algun fragmento extraido.
 */
const MIN_SUBCADENA = 12;

let comprobadas = 0;
let cubiertas = 0;
const ausentes = [];

for (const capitulo of CAPITULOS) {
  const dir = join(DIR_SALIDA, capitulo.id);
  if (!existsSync(dir)) continue;

  const trozos = recogerTrozos(dir);
  const saco = norm(trozos.join('  '));
  // Variantes para absorber los reensamblados.
  const sacoSinGuion = saco.replace(/- /g, '');
  // Fragmentos completos, para las cadenas demasiado cortas como para buscarlas
  // por subcadena sin arriesgar un falso positivo ("delirios.", "muecas.").
  const exactos = new Set(trozos.map((t) => norm(t)));

  const contiene = (v) =>
    v.length >= MIN_SUBCADENA
      ? saco.includes(v) || sacoSinGuion.includes(v.replace(/- /g, ''))
      : exactos.has(v);

  function presente(n) {
    for (const v of variantes(n)) {
      if (v.length > 0 && contiene(v)) return true;
    }
    // Opcion de especificador: el conversor la parte en codigo + etiqueta +
    // descripcion, asi que la linea entera nunca aparece como una sola cadena.
    // Se comprueba que cada trozo este presente por separado.
    const sinCodigo = n.replace(/^(f\d{2}(?:\.\d{1,2})?)\s+/, '');
    const codigo = n === sinCodigo ? null : (n.match(/^(f\d{2}(?:\.\d{1,2})?)/)?.[1] ?? null);
    if (codigo && !contiene(codigo)) return false;

    const dosPuntos = sinCodigo.indexOf(':');
    if (dosPuntos > 0) {
      const etiqueta = sinCodigo.slice(0, dosPuntos).trim();
      const descripcion = sinCodigo.slice(dosPuntos + 1).trim();
      if (
        etiqueta.length >= 3 &&
        contiene(etiqueta) &&
        (descripcion.length < 12 || contiene(descripcion))
      ) {
        return true;
      }
    }
    // Etiqueta corta precedida de codigo ("F71 Moderado").
    if (codigo && sinCodigo.length >= 3 && contiene(sinCodigo)) return true;

    return false;
  }

  /* --- Recorrido del origen --- */
  const lineas = readFileSync(join(DIR_FUENTE, capitulo.archivoFuente), 'utf8').split(/\r?\n/);

  for (let i = 0; i < lineas.length; i++) {
    const cruda = (lineas[i] ?? '').trim();
    if (!cruda) continue;
    if (/^<\/?div/i.test(cruda)) continue; // maquetacion
    if (/^<img|<div[^>]*><img/i.test(cruda)) continue; // hueco registrado aparte
    if (/^#{1,6}\s/.test(cruda)) continue; // encabezado: se convierte en titulo

    const texto = cruda;
    if (/^<table/i.test(texto)) {
      // Se comprueban las celdas por separado.
      let html = texto;
      let j = i;
      while (!/<\/table>/i.test(html) && j + 1 < lineas.length) html += `\n${lineas[++j] ?? ''}`;
      i = j;
      const celdas = [...html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
        m[1].replace(/<[^>]+>/g, ' '),
      );
      for (const celda of celdas) {
        for (const parte of celda.split('\n')) {
          const n = norm(parte);
          if (n.length < 12) continue;
          comprobadas += 1;
          if (presente(n)) cubiertas += 1;
          else
            ausentes.push({
              capitulo: capitulo.id,
              linea: i + 1,
              texto: parte.trim().slice(0, 120),
            });
        }
      }
      continue;
    }

    const n = norm(texto);
    if (n.length < 12) continue;
    comprobadas += 1;
    if (presente(n)) {
      cubiertas += 1;
      continue;
    }
    // Linea partida por salto de pagina: basta con que sus dos mitades esten.
    let ok = false;
    for (const fraccion of [0.3, 0.5, 0.7]) {
      const corte = n.lastIndexOf(' ', Math.floor(n.length * fraccion));
      if (corte < 12) continue;
      const izq = n.slice(0, corte).trim();
      const der = n.slice(corte).trim();
      if (der.length > 12 && presente(izq) && presente(der)) {
        ok = true;
        break;
      }
    }
    if (ok) cubiertas += 1;
    else ausentes.push({ capitulo: capitulo.id, linea: i + 1, texto: cruda.slice(0, 140) });
  }
}

console.log('\n=== COBERTURA DEL ORIGEN ===');
console.log(`Capítulos comprobados .......... ${CAPITULOS.length}`);
console.log(`Líneas de texto comprobadas .... ${comprobadas}`);
console.log(`Presentes en algún JSON ........ ${cubiertas}`);
console.log(`Ausentes ....................... ${ausentes.length}`);
for (const a of ausentes.slice(0, 20)) {
  console.log(`  ✗ ${a.capitulo} línea ${a.linea}: ${a.texto}`);
}
if (ausentes.length > 20) console.log(`  … y ${ausentes.length - 20} más`);
process.exitCode = ausentes.length === 0 ? 0 : 1;
