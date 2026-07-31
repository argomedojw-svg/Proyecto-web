// Utilidad de verificacion manual del resultado de la conversion.
import { readFileSync } from 'node:fs';

const DIR = 'public/dsm/trastornos-del-neurodesarrollo';
const cargar = (id) => JSON.parse(readFileSync(`${DIR}/${id}.json`, 'utf8'));
const criterios = (t) =>
  t.secciones.find((s) => s.clave === 'criterios')?.contenido.find((b) => b.tipo === 'criterios');

const linea = (s) => console.log(s);
const sep = (t) => linea(`\n=== ${t} ===`);

/* 1. Codigo intercalado en mitad del criterio A */
sep('COORDINACIÓN — criterio A partido por "F82" (líneas 1057-1061)');
{
  const c = criterios(cargar('trastorno-del-desarrollo-de-la-coordinacion')).conjuntos[0];
  linea(`codigo del conjunto: ${c.codigo}`);
  linea(`A: ${c.nodos[0].texto}`);
}

/* 2. Anidamiento de 3 niveles */
sep('TDAH — anidamiento A > A.1 > A.1.a');
{
  const c = criterios(cargar('trastorno-por-deficit-de-atencion-hiperactividad')).conjuntos[0];
  const a = c.nodos[0];
  linea(`${a.ruta}: ${a.texto.slice(0, 80)}…`);
  for (const h of a.hijos.slice(0, 2)) {
    linea(`  ${h.ruta} [${h.tipo}]: ${h.texto.slice(0, 70)}…`);
    for (const n of h.hijos.slice(0, 3)) {
      linea(`    ${n.ruta} [${n.tipo}]: ${n.texto.slice(0, 60)}…`);
    }
    linea(`    (${h.hijos.length} hijos en total)`);
  }
  linea(`nodos raíz: ${c.nodos.map((n) => n.ruta).join(', ')}`);
  linea(`bloques de especificación: ${c.especificaciones.length}`);
  for (const e of c.especificaciones) {
    linea(`  "${e.encabezado}" → ${e.opciones.length} opciones`);
    for (const o of e.opciones) linea(`     ${o.codigo ?? '   '} ${o.etiqueta}`);
  }
}

/* 3. Tres conjuntos nombrados compartiendo apartado */
sep('TICS — tres conjuntos de criterios en un solo apartado');
{
  const b = criterios(cargar('trastornos-de-tics'));
  for (const c of b.conjuntos) {
    linea(`  ${c.codigo ?? '—'}  ${c.nombre}  (${c.nodos.length} criterios)  ancla=${c.id}`);
  }
  const t = cargar('trastornos-de-tics');
  linea(`codigos.dsm5tr = ${JSON.stringify(t.codigos.dsm5tr)}`);
  linea(`codigosAdicionales: ${t.codigosAdicionales.map((c) => `${c.codigo}=${c.etiqueta}`).join(' | ')}`);
}

/* 4. Criterios que venian dentro de una tabla HTML */
sep('COMUNICACIÓN SOCIAL — criterios extraídos de una tabla HTML');
{
  const c = criterios(cargar('trastorno-de-la-comunicacion-social-pragmatico')).conjuntos[0];
  linea(`codigo: ${c.codigo}`);
  for (const n of c.nodos) {
    linea(`  ${n.ruta}: ${n.texto.slice(0, 70)}…  (${n.hijos.length} subcriterios)`);
  }
}

sep('MOVIMIENTOS ESTEREOTIPADOS — tabla HTML con especificadores dentro de celdas');
{
  const c = criterios(cargar('trastorno-de-movimientos-estereotipados')).conjuntos[0];
  linea(`codigo: ${c.codigo}, criterios: ${c.nodos.map((n) => n.ruta).join(', ')}`);
  for (const e of c.especificaciones) {
    linea(`  "${e.encabezado}" → ${e.opciones.map((o) => o.etiqueta.slice(0, 40)).join(' / ')}`);
  }
}

/* 5. Subopciones agrupadas bajo un codigo */
sep('APRENDIZAJE — subaptitudes agrupadas bajo cada código');
{
  const c = criterios(cargar('trastorno-especifico-del-aprendizaje')).conjuntos[0];
  for (const e of c.especificaciones) {
    linea(`  "${e.encabezado}"`);
    for (const o of e.opciones) {
      linea(`     ${o.codigo ?? '      '} ${o.etiqueta}`);
      for (const s of o.subopciones) linea(`            · ${s}`);
    }
  }
}

/* 6. Tabla de gravedad reconstruida */
sep('DISCAPACIDAD INTELECTUAL — Tabla 1 reunida desde 3 fragmentos');
{
  const t = cargar('trastorno-del-desarrollo-intelectual-discapacidad-intelectual');
  for (const s of t.secciones) {
    for (const b of s.contenido) {
      if (b.tipo === 'tabla') {
        linea(`  en sección "${s.clave}": "${b.titulo}"`);
        linea(`  encabezados: ${b.encabezados.join(' | ')}`);
        linea(`  filas: ${b.filas.length} (${b.filas.map((f) => f[0]).join(', ')})  fragmentos: ${b.fragmentosUnidos}`);
      }
      if (b.tipo === 'imagen_ausente') linea(`  hueco de imagen en sección "${s.clave}"`);
    }
  }
  linea(`  codigosAdicionales: ${t.codigosAdicionales.map((c) => `${c.codigo}=${c.etiqueta}`).join(' | ')}`);
}

/* 7. Seccion no reconocida conservada */
sep('TDAH — sección no reconocida conservada íntegra');
{
  const t = cargar('trastorno-por-deficit-de-atencion-hiperactividad');
  const s = t.secciones.find((x) => !x.reconocida);
  linea(`  titulo="${s.titulo}" clave=${JSON.stringify(s.clave)} claveOriginal="${s.claveOriginal}"`);
  linea(`  bloques: ${s.contenido.length}, línea ${s.procedencia.lineaInicio}`);
  linea(`  primer párrafo: ${s.contenido[0].texto.slice(0, 110)}…`);
}

/* 8. Relaciones extraidas */
sep('RELACIONES extraídas del diagnóstico diferencial');
{
  for (const id of ['trastorno-del-lenguaje', 'trastorno-del-espectro-autista']) {
    const t = cargar(id);
    linea(`  ${t.nombre}: ${t.relaciones.comparadoCon.map((r) => r.nombre).join(' · ') || '—'}`);
  }
}

/* 9. Educativo vacio y orden de secciones */
sep('COMPROBACIONES GLOBALES');
{
  const idx = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8'));
  let educativoNoVacio = 0;
  let ordenRoto = 0;
  for (const e of idx.trastornos) {
    const t = cargar(e.id);
    const ed = t.educativo;
    if (
      ed.resumen !== null ||
      ed.perlas.length + ed.preguntas.length + ed.flashcards.length + ed.casos.length + ed.instrumentos.length + ed.algoritmos.length >
        0
    )
      educativoNoVacio += 1;
    const ordenes = t.secciones.map((s) => s.orden);
    if (ordenes.some((o, i) => i > 0 && o < ordenes[i - 1])) ordenRoto += 1;
  }
  linea(`  trastornos en el índice: ${idx.trastornos.length}`);
  linea(`  con contenido educativo no vacío: ${educativoNoVacio} (debe ser 0)`);
  linea(`  con orden de secciones roto: ${ordenRoto} (debe ser 0)`);
  const tics = idx.trastornos.find((t) => t.id === 'trastornos-de-tics');
  linea(`  subentradas de "Trastornos de tics": ${tics.subentradas.map((s) => `${s.codigo} ${s.nombre}`).join(' | ')}`);
  const raiz = JSON.parse(readFileSync('public/dsm/index.json', 'utf8'));
  linea(`  categorías en el índice raíz: ${raiz.categorias.length} (disponibles: ${raiz.categorias.filter((c) => c.disponible).length})`);
}
