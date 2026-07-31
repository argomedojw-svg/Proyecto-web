/**
 * Utilidades de texto puramente mecanicas: plegado de acentos, slugs y
 * reparacion de cortes de pagina. Nada de esto interpreta contenido clinico.
 */

/** Quita tildes y dieresis, pasa a minusculas y colapsa espacios. */
export function plegar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug estable para ids y nombres de fichero. */
export function slug(texto: string): string {
  return plegar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

/** Colapsa espacios pero conserva acentos y mayusculas. Para texto que se muestra. */
export function limpiar(texto: string): string {
  return texto.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/**
 * El DSM imprime "trastorno por deficit de atencion/ hiperactividad" con
 * espacios erraticos alrededor de las barras. Normaliza solo para comparar.
 */
export function plegarNombre(texto: string): string {
  return plegar(texto).replace(/\s*\/\s*/g, '/');
}

const RE_CODIGO = /^F\d{2}(?:\.\d{1,2})?$/;

/** ¿La linea es un codigo CIE suelto, como "F80.2"? */
export function esCodigoSuelto(linea: string): boolean {
  return RE_CODIGO.test(linea.trim());
}

/** Extrae el primer codigo CIE que aparezca al principio del texto. */
export function extraerCodigoInicial(texto: string): string | null {
  const m = texto.trim().match(/^(F\d{2}(?:\.\d{1,2})?)\b/);
  return m ? (m[1] ?? null) : null;
}

/* ------------------------------------------------------------------ */
/* Reparacion de cortes de pagina                                      */
/* ------------------------------------------------------------------ */

export type UnionParrafo = {
  tipo: 'guion_de_corte' | 'parrafo_partido';
  lineaPrimera: number;
  lineaSegunda: number;
  muestra: string;
};

const FIN_DE_FRASE = /[.:;!?»"')\]]\s*$/;

/**
 * ¿El parrafo `a` continua en el parrafo `b`?
 *
 * El markdown viene de un OCR de PDF: las frases se parten en los saltos de
 * pagina y a veces con guion. Unirlas RESTAURA el original, no lo inventa;
 * aun asi cada union se reporta para que sea auditable.
 */
export function decidirUnion(a: string, b: string): UnionParrafo['tipo'] | null {
  const izq = a.trimEnd();
  const der = b.trimStart();
  if (!izq || !der) return null;

  // Palabra cortada con guion al final de pagina: "habi-" + "lidades".
  if (/[a-záéíóúñü]-$/i.test(izq) && /^[a-záéíóúñü]/.test(der)) {
    return 'guion_de_corte';
  }

  // Frase partida: la izquierda no cierra y la derecha arranca en minuscula.
  if (!FIN_DE_FRASE.test(izq) && /^[a-záéíóúñü(]/.test(der)) {
    return 'parrafo_partido';
  }

  return null;
}

/** Aplica la union decidida por `decidirUnion`. */
export function unir(a: string, b: string, tipo: UnionParrafo['tipo']): string {
  if (tipo === 'guion_de_corte') {
    return a.trimEnd().replace(/-$/, '') + b.trimStart();
  }
  return `${a.trimEnd()} ${b.trimStart()}`;
}
