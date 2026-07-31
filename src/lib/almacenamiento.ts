/**
 * Persistencia en localStorage: tema, progreso, favoritos y recientes.
 * Local, borrable, sin nube. Todo acceso va envuelto en try/catch porque en
 * modo privado el navegador puede lanzar al escribir.
 */

const PREFIJO = 'dsm5tr:';

export const CLAVES = {
  tema: `${PREFIJO}tema`,
  secciones: `${PREFIJO}secciones-abiertas`,
  recientes: `${PREFIJO}recientes`,
  favoritos: `${PREFIJO}favoritos`,
  progresoFlashcards: `${PREFIJO}progreso-flashcards`,
  progresoPreguntas: `${PREFIJO}progreso-preguntas`,
  validados: `${PREFIJO}validados`,
  arbolAbierto: `${PREFIJO}arbol-abierto`,
} as const;

export function leer<T>(clave: string, porDefecto: T): T {
  try {
    const bruto = localStorage.getItem(clave);
    if (bruto === null) return porDefecto;
    return JSON.parse(bruto) as T;
  } catch {
    return porDefecto;
  }
}

export function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin espacio o almacenamiento bloqueado: se ignora, no es crítico.
  }
}

export function borrar(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* vacío a proposito */
  }
}

/* ------------------------------------------------------------------ */
/* Listas de recientes y favoritos                                     */
/* ------------------------------------------------------------------ */

export type EntradaReciente = {
  categoriaId: string;
  trastornoId: string;
  nombre: string;
  visitadoEn: number;
};

const MAX_RECIENTES = 12;

export function leerRecientes(): EntradaReciente[] {
  return leer<EntradaReciente[]>(CLAVES.recientes, []);
}

export function registrarReciente(entrada: Omit<EntradaReciente, 'visitadoEn'>): void {
  const previas = leerRecientes().filter((r) => r.trastornoId !== entrada.trastornoId);
  const nuevas = [{ ...entrada, visitadoEn: Date.now() }, ...previas].slice(0, MAX_RECIENTES);
  escribir(CLAVES.recientes, nuevas);
}

export function leerFavoritos(): string[] {
  return leer<string[]>(CLAVES.favoritos, []);
}

export function alternarFavorito(trastornoId: string): string[] {
  const actuales = leerFavoritos();
  const nuevos = actuales.includes(trastornoId)
    ? actuales.filter((id) => id !== trastornoId)
    : [...actuales, trastornoId];
  escribir(CLAVES.favoritos, nuevos);
  return nuevos;
}
