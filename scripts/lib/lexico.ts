/**
 * Analisis lexico del markdown fuente.
 *
 * Convierte el archivo en una lista de piezas (encabezado, parrafo, tabla,
 * imagen, codigo CIE suelto) conservando SIEMPRE el numero de linea original.
 * No se usa una libreria de markdown a proposito: la fuente es un OCR con
 * jerarquia rota, tablas HTML y frases partidas por saltos de pagina, y
 * necesitamos numeros de linea exactos para el informe.
 */

import { Informe } from './informe.js';
import { decidirUnion, esCodigoSuelto, limpiar, unir } from './texto.js';

export type Pieza =
  | { tipo: 'encabezado'; nivel: number; texto: string; linea: number }
  | { tipo: 'parrafo'; texto: string; linea: number; lineaFin: number }
  | { tipo: 'codigo'; codigo: string; linea: number }
  | { tipo: 'imagen'; src: string; linea: number }
  | {
      tipo: 'tabla';
      titulo: string | null;
      continuacion: boolean;
      encabezados: string[];
      filas: string[][];
      /** Celdas con su contenido partido por saltos de linea internos. */
      filasCrudas: string[][][];
      linea: number;
      fragmentos: number;
    };

const RE_ENCABEZADO = /^(#{1,6})\s+(.*)$/;
const RE_TABLA_TITULO = /^TABLA\s+\d+\s+(.*)$/i;

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Extrae filas y celdas de una tabla HTML en una sola cadena. */
function parsearTablaHtml(html: string): string[][][] {
  const filas: string[][][] = [];
  const reFila = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let mFila: RegExpExecArray | null;
  while ((mFila = reFila.exec(html)) !== null) {
    const contenidoFila = mFila[1] ?? '';
    const celdas: string[][] = [];
    const reCelda = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let mCelda: RegExpExecArray | null;
    while ((mCelda = reCelda.exec(contenidoFila)) !== null) {
      const bruto = decodificarEntidades(mCelda[1] ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');
      // Los saltos de linea internos de la celda son significativos: separan
      // criterios y bloques "Especificar si:" dentro de una misma celda.
      const lineas = bruto
        .split('\n')
        .map((l) => limpiar(l))
        .filter((l) => l.length > 0);
      celdas.push(lineas);
    }
    if (celdas.length > 0) filas.push(celdas);
  }
  return filas;
}

/** Aplana una fila de celdas multilinea a texto plano por celda. */
function aplanar(fila: string[][]): string[] {
  return fila.map((celda) => celda.join(' '));
}

export function analizar(contenido: string, informe: Informe): Pieza[] {
  const lineas = contenido.split(/\r?\n/);
  const piezas: Pieza[] = [];

  // Acumulador de parrafo en curso.
  let buffer: string[] = [];
  let bufferInicio = 0;

  const cerrarParrafo = (lineaFin: number) => {
    if (buffer.length === 0) return;
    const texto = limpiar(buffer.join(' '));
    if (texto.length > 0) {
      piezas.push({ tipo: 'parrafo', texto, linea: bufferInicio, lineaFin });
    }
    buffer = [];
  };

  for (let i = 0; i < lineas.length; i++) {
    const numero = i + 1;
    const cruda = lineas[i] ?? '';
    const linea = cruda.trim();

    if (linea.length === 0) {
      cerrarParrafo(numero - 1);
      continue;
    }

    // Tablas HTML: pueden abarcar varias lineas porque las celdas llevan saltos.
    if (/^<table/i.test(linea)) {
      cerrarParrafo(numero - 1);
      let html = cruda;
      let j = i;
      while (!/<\/table>/i.test(html) && j + 1 < lineas.length) {
        j += 1;
        html += `\n${lineas[j] ?? ''}`;
      }
      const filasCrudas = parsearTablaHtml(html);
      const cabecera = filasCrudas[0] ? aplanar(filasCrudas[0]) : [];
      const cuerpo = filasCrudas.slice(1).map(aplanar);
      piezas.push({
        tipo: 'tabla',
        titulo: null,
        continuacion: false,
        encabezados: cabecera,
        filas: cuerpo,
        filasCrudas,
        linea: numero,
        fragmentos: 1,
      });
      i = j;
      continue;
    }

    // Imagen remota: el <img> apunta a un servicio OCR externo. No sirve sin
    // conexion y no podemos reconstruir lo que mostraba. Se deja constancia.
    const mImg = linea.match(/<img[^>]*src=['"]([^'"]+)['"]/i);
    if (mImg) {
      cerrarParrafo(numero - 1);
      piezas.push({ tipo: 'imagen', src: mImg[1] ?? '', linea: numero });
      continue;
    }

    // Envoltorios de maquetacion: se descartan, su contenido no.
    if (/^<\/?div/i.test(linea)) {
      cerrarParrafo(numero - 1);
      continue;
    }

    if (/^</.test(linea)) {
      cerrarParrafo(numero - 1);
      informe.registrar('html_desconocido', 'aviso', 'Etiqueta HTML no contemplada', {
        textoLiteral: linea.slice(0, 160),
        linea: numero,
        ambito: null,
      });
      continue;
    }

    const mEnc = linea.match(RE_ENCABEZADO);
    if (mEnc) {
      cerrarParrafo(numero - 1);
      piezas.push({
        tipo: 'encabezado',
        nivel: (mEnc[1] ?? '#').length,
        texto: limpiar(mEnc[2] ?? ''),
        linea: numero,
      });
      continue;
    }

    // Codigo CIE en linea suelta: el maquetado del manual lo pone al margen y
    // el OCR lo deja aislado, a veces partiendo un parrafo por la mitad.
    if (esCodigoSuelto(linea)) {
      const partiaParrafo = buffer.length > 0;
      cerrarParrafo(numero - 1);
      piezas.push({ tipo: 'codigo', codigo: linea, linea: numero });
      if (partiaParrafo) {
        informe.registrar(
          'codigo_intercalado',
          'info',
          `Código ${linea} intercalado dentro de un párrafo`,
          { textoLiteral: linea, linea: numero, ambito: null },
        );
      }
      continue;
    }

    if (buffer.length === 0) bufferInicio = numero;
    buffer.push(linea);
  }
  cerrarParrafo(lineas.length);

  return posprocesar(piezas, informe);
}

/**
 * Segunda pasada: titula tablas, une fragmentos "(cont.)" y repara los
 * parrafos partidos por saltos de pagina.
 */
function posprocesar(piezas: Pieza[], informe: Informe): Pieza[] {
  // --- Titulos de tabla: "TABLA 2 Niveles de gravedad..." antes de la tabla ---
  const conTitulo: Pieza[] = [];
  for (const pieza of piezas) {
    if (pieza.tipo === 'tabla') {
      const previa = conTitulo[conTitulo.length - 1];
      if (previa && previa.tipo === 'parrafo') {
        const m = previa.texto.match(RE_TABLA_TITULO);
        if (m) {
          conTitulo.pop();
          const bruto = m[1] ?? '';
          pieza.continuacion = /\(cont\.?\)\s*$/i.test(bruto);
          pieza.titulo = limpiar(bruto.replace(/\s*\(cont\.?\)\s*$/i, ''));
        }
      }
    }
    conTitulo.push(pieza);
  }

  // --- Union de tablas fragmentadas por salto de pagina ---
  const unidas: Pieza[] = [];
  for (const pieza of conTitulo) {
    if (pieza.tipo === 'tabla') {
      // Se salta una imagen intermedia: el OCR intercala la captura de la pagina.
      let k = unidas.length - 1;
      while (k >= 0 && unidas[k]?.tipo === 'imagen') k -= 1;
      const anterior = k >= 0 ? unidas[k] : undefined;
      if (
        anterior &&
        anterior.tipo === 'tabla' &&
        anterior.encabezados.length > 0 &&
        anterior.encabezados.join('|') === pieza.encabezados.join('|')
      ) {
        anterior.filas.push(...pieza.filas);
        anterior.filasCrudas.push(...pieza.filasCrudas.slice(1));
        anterior.fragmentos += 1;
        informe.registrar(
          'tabla_fragmentada',
          'info',
          `Tabla "${anterior.titulo ?? 'sin título'}" reconstruida: fragmento ${anterior.fragmentos}`,
          { linea: pieza.linea, ambito: null },
        );
        continue;
      }
    }
    unidas.push(pieza);
  }

  // --- Reparacion de parrafos partidos ---
  const reparadas: Pieza[] = [];
  for (const pieza of unidas) {
    const anterior = reparadas[reparadas.length - 1];
    if (pieza.tipo === 'parrafo' && anterior && anterior.tipo === 'parrafo') {
      const decision = decidirUnion(anterior.texto, pieza.texto);
      if (decision) {
        informe.registrar(
          decision,
          'info',
          `Párrafo reunido (líneas ${anterior.linea}–${pieza.linea})`,
          {
            textoLiteral: `…${anterior.texto.slice(-45)} ⟨+⟩ ${pieza.texto.slice(0, 45)}…`,
            linea: pieza.linea,
            ambito: null,
          },
        );
        anterior.texto = unir(anterior.texto, pieza.texto, decision);
        anterior.lineaFin = pieza.lineaFin;
        continue;
      }
    }
    reparadas.push(pieza);
  }

  return reparadas;
}

/**
 * Une un parrafo partido por un codigo intercalado, como en el trastorno del
 * desarrollo de la coordinacion, donde "F82" cae en mitad del criterio A.
 * Se ejecuta despues de extraer los codigos, por eso va aparte del posproceso.
 */
export function repararTrasCodigos(piezas: Pieza[], informe: Informe): Pieza[] {
  const salida: Pieza[] = [];
  for (const pieza of piezas) {
    const anterior = salida[salida.length - 1];
    if (pieza.tipo === 'parrafo' && anterior && anterior.tipo === 'parrafo') {
      const decision = decidirUnion(anterior.texto, pieza.texto);
      if (decision) {
        informe.registrar(
          decision,
          'info',
          `Párrafo reunido tras extraer un código (líneas ${anterior.linea}–${pieza.linea})`,
          {
            textoLiteral: `…${anterior.texto.slice(-45)} ⟨+⟩ ${pieza.texto.slice(0, 45)}…`,
            linea: pieza.linea,
          },
        );
        anterior.texto = unir(anterior.texto, pieza.texto, decision);
        anterior.lineaFin = pieza.lineaFin;
        continue;
      }
    }
    salida.push(pieza);
  }
  return salida;
}
