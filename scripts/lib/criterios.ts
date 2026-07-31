/**
 * Construccion del arbol de criterios diagnosticos.
 *
 * Entrada: lineas de texto ya reparadas (sin cortes de pagina) pertenecientes
 * al apartado "Criterios diagnosticos".
 * Salida: uno o mas ConjuntoCriterios con arbol recursivo, preambulo y bloques
 * de especificacion.
 *
 * El parser NO reescribe el texto clinico: solo separa el marcador del cuerpo.
 */

import type {
  BloqueEspecificacion,
  ConjuntoCriterios,
  NodoCriterio,
  OpcionEspecificador,
} from '../../src/lib/schema.js';
import type { Informe } from './informe.js';
import { plegar, slug } from './texto.js';

/** "A. texto" — criterio de primer nivel. */
const RE_NIVEL_1 = /^([A-Z])\.\s+(.+)$/;
/** "1. texto" — segundo nivel. */
const RE_NIVEL_2 = /^(\d{1,2})\.\s+(.+)$/;
/** "a. texto" — tercer nivel. */
const RE_NIVEL_3 = /^([a-z])\.\s+(.+)$/;

const RE_NOTA = /^Nota:\s*(.*)$/;
const RE_NOTA_COD = /^Nota de codificaci[oó]n:\s*(.*)$/i;

/** Encabezado de bloque de especificacion. */
export function esCabeceraEspecificacion(texto: string): boolean {
  const p = plegar(texto);
  return /^especificar( si| la gravedad actual| el nivel de gravedad actual)?\b/.test(p);
}

/** Opcion con codigo CIE delante: "F90.2 Presentación combinada: Si se cumple…" */
const RE_OPCION_CON_CODIGO = /^(F\d{2}(?:\.\d{1,2})?)\s+(.+)$/;
/** Opcion con descripcion: "Leve: Pocos o ningún síntoma…" */
const RE_OPCION_CON_DESC = /^([^:]{2,110}):\s*(.+)$/;

function analizarOpcion(texto: string): OpcionEspecificador {
  let resto = texto;
  let codigo: string | null = null;

  const mCod = resto.match(RE_OPCION_CON_CODIGO);
  if (mCod) {
    codigo = mCod[1] ?? null;
    resto = mCod[2] ?? '';
  }

  const mDesc = resto.match(RE_OPCION_CON_DESC);
  if (mDesc) {
    return {
      codigo,
      etiqueta: (mDesc[1] ?? '').trim(),
      descripcion: (mDesc[2] ?? '').trim(),
      subopciones: [],
    };
  }

  return { codigo, etiqueta: resto.trim(), descripcion: null, subopciones: [] };
}

type Estado = {
  conjuntos: ConjuntoCriterios[];
  actual: ConjuntoCriterios;
  /** Pila de nodos abiertos por nivel: [nivel1, nivel2, nivel3]. */
  pila: (NodoCriterio | null)[];
  especificacion: BloqueEspecificacion | null;
};

function nuevoConjunto(idBase: string, indice: number): ConjuntoCriterios {
  return {
    id: indice === 0 ? `${idBase}-criterios` : `${idBase}-criterios-${indice + 1}`,
    nombre: null,
    codigo: null,
    preambulo: [],
    nodos: [],
    especificaciones: [],
  };
}

function cerrarEspecificacion(estado: Estado): void {
  if (estado.especificacion) {
    estado.actual.especificaciones.push(estado.especificacion);
    estado.especificacion = null;
  }
}

function adjuntar(estado: Estado, nodo: NodoCriterio, nivel: number, informe: Informe, linea: number): void {
  if (nivel === 1) {
    estado.actual.nodos.push(nodo);
    estado.pila = [nodo, null, null];
    return;
  }

  const padre = estado.pila[nivel - 2] ?? null;
  if (!padre) {
    informe.registrar(
      'criterio_sin_padre',
      'aviso',
      `Criterio de nivel ${nivel} sin criterio padre; se cuelga de la raíz`,
      { textoLiteral: nodo.texto.slice(0, 140), linea },
    );
    estado.actual.nodos.push(nodo);
    estado.pila = [nodo, null, null];
    return;
  }

  nodo.ruta = `${padre.ruta}.${nodo.etiqueta}`;
  padre.hijos.push(nodo);
  estado.pila[nivel - 1] = nodo;
  for (let n = nivel; n < estado.pila.length; n++) estado.pila[n] = null;
}

/** Nodo abierto mas profundo, para colgar notas y texto de continuacion. */
function masProfundo(estado: Estado): NodoCriterio | null {
  for (let n = estado.pila.length - 1; n >= 0; n--) {
    const nodo = estado.pila[n];
    if (nodo) return nodo;
  }
  return null;
}

export type EntradaCriterios = {
  texto: string;
  linea: number;
  /** Encabezado markdown que introducia un conjunto nombrado. */
  encabezado?: string;
};

export function construirCriterios(
  entradas: EntradaCriterios[],
  idBase: string,
  nombresDeConjunto: string[],
  informe: Informe,
): ConjuntoCriterios[] {
  const nombresPlegados = new Set(nombresDeConjunto.map(plegar));

  const estado: Estado = {
    conjuntos: [],
    actual: nuevoConjunto(idBase, 0),
    pila: [null, null, null],
    especificacion: null,
  };
  estado.conjuntos.push(estado.actual);

  /** Opcion que esta recogiendo subopciones planas, si la hay. */
  let agrupadora: OpcionEspecificador | null = null;

  const abrirConjunto = (nombre: string) => {
    cerrarEspecificacion(estado);
    // El primer conjunto puede estar vacio si el nombrado llega de inmediato.
    const vacio =
      estado.actual.nodos.length === 0 &&
      estado.actual.especificaciones.length === 0 &&
      estado.actual.nombre === null;
    const conjunto: ConjuntoCriterios = {
      id: `${idBase}-${slug(nombre)}`,
      nombre,
      codigo: null,
      preambulo: vacio ? [...estado.actual.preambulo] : [],
      nodos: [],
      especificaciones: [],
    };
    if (vacio) {
      estado.conjuntos.pop();
    }
    estado.conjuntos.push(conjunto);
    estado.actual = conjunto;
    estado.pila = [null, null, null];
  };

  for (const entrada of entradas) {
    const texto = entrada.texto.trim();
    if (!texto) continue;

    // Encabezado que abre un conjunto nombrado (los tres trastornos de tics).
    if (entrada.encabezado && nombresPlegados.has(plegar(entrada.encabezado))) {
      abrirConjunto(entrada.encabezado);
      informe.registrar(
        'conjunto_nombrado',
        'info',
        `Conjunto de criterios nombrado: "${entrada.encabezado}"`,
        { linea: entrada.linea },
      );
      continue;
    }

    // Codigo suelto: pertenece al conjunto en curso.
    if (/^F\d{2}(\.\d{1,2})?$/.test(texto)) {
      estado.actual.codigo ??= texto;
      continue;
    }

    // Cabecera de bloque de especificacion.
    if (esCabeceraEspecificacion(texto)) {
      cerrarEspecificacion(estado);
      agrupadora = null;
      estado.especificacion = { encabezado: texto.replace(/\s*$/, ''), opciones: [], notas: [] };
      continue;
    }

    const mNotaCod = texto.match(RE_NOTA_COD);
    if (mNotaCod) {
      const cuerpo = (mNotaCod[1] ?? '').trim();
      if (estado.especificacion) {
        estado.especificacion.notas.push(cuerpo);
      } else {
        const destino = masProfundo(estado);
        const nodo: NodoCriterio = {
          ruta: destino ? `${destino.ruta}.nota` : 'nota',
          etiqueta: null,
          tipo: 'nota_codificacion',
          texto: cuerpo,
          hijos: [],
        };
        if (destino) destino.hijos.push(nodo);
        else estado.actual.nodos.push(nodo);
      }
      continue;
    }

    const mNota = texto.match(RE_NOTA);
    if (mNota) {
      const cuerpo = (mNota[1] ?? '').trim();
      if (estado.especificacion) {
        estado.especificacion.notas.push(cuerpo);
      } else {
        const destino = masProfundo(estado);
        const nodo: NodoCriterio = {
          ruta: destino ? `${destino.ruta}.nota` : 'nota',
          etiqueta: null,
          tipo: 'nota',
          texto: cuerpo,
          hijos: [],
        };
        if (destino) destino.hijos.push(nodo);
        else estado.actual.nodos.push(nodo);
      }
      continue;
    }

    // Dentro de un bloque de especificacion todo lo demas son opciones.
    if (estado.especificacion) {
      const opcion = analizarOpcion(texto);
      // Un encabezado con codigo ("F81.0 Con dificultades en la lectura:") abre
      // un grupo: las opciones planas que le siguen son sus subaptitudes.
      const esAgrupadora = Boolean(entrada.encabezado) && opcion.codigo !== null;
      if (esAgrupadora) {
        estado.especificacion.opciones.push(opcion);
        agrupadora = opcion;
      } else if (agrupadora && opcion.codigo === null && opcion.descripcion === null) {
        agrupadora.subopciones.push(opcion.etiqueta);
      } else {
        agrupadora = null;
        estado.especificacion.opciones.push(opcion);
      }
      continue;
    }

    const m1 = texto.match(RE_NIVEL_1);
    if (m1) {
      const etiqueta = m1[1] ?? '';
      adjuntar(
        estado,
        { ruta: etiqueta, etiqueta, tipo: 'criterio', texto: (m1[2] ?? '').trim(), hijos: [] },
        1,
        informe,
        entrada.linea,
      );
      continue;
    }

    const m2 = texto.match(RE_NIVEL_2);
    if (m2) {
      const etiqueta = m2[1] ?? '';
      adjuntar(
        estado,
        { ruta: etiqueta, etiqueta, tipo: 'criterio', texto: (m2[2] ?? '').trim(), hijos: [] },
        2,
        informe,
        entrada.linea,
      );
      continue;
    }

    const m3 = texto.match(RE_NIVEL_3);
    if (m3) {
      const etiqueta = m3[1] ?? '';
      adjuntar(
        estado,
        { ruta: etiqueta, etiqueta, tipo: 'criterio', texto: (m3[2] ?? '').trim(), hijos: [] },
        3,
        informe,
        entrada.linea,
      );
      continue;
    }

    // Texto sin marcador: preambulo si aun no hay criterios, si no, aclaracion
    // colgada del nodo abierto mas profundo.
    const destino = masProfundo(estado);
    if (!destino) {
      estado.actual.preambulo.push(texto);
    } else {
      destino.hijos.push({
        ruta: `${destino.ruta}.texto${destino.hijos.length + 1}`,
        etiqueta: null,
        tipo: 'texto',
        texto,
        hijos: [],
      });
    }
  }

  cerrarEspecificacion(estado);
  return estado.conjuntos.filter(
    (c) => c.nodos.length > 0 || c.especificaciones.length > 0 || c.preambulo.length > 0,
  );
}
