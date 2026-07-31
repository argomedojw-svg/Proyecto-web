/**
 * Carga de datos desde public/dsm/.
 *
 * Sin servidor y sin API: solo `fetch` de ficheros estáticos. El fallo más
 * probable de esta aplicación es un JSON mal formado editado a mano, así que
 * todo error se convierte en un `ErrorDeCarga` que dice qué archivo falló y
 * exactamente qué campo está mal, nunca en una pantalla en blanco.
 */

import {
  categoriaSchema,
  indiceBusquedaSchema,
  indiceSchema,
  trastornoSchema,
  type Categoria,
  type Indice,
  type IndiceBusqueda,
  type Trastorno,
} from './schema';
import type { ZodError, ZodTypeAny } from 'zod';

/** Base de las rutas de datos, respetando `base` de Vite. */
const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/dsm`;

export type TipoErrorCarga = 'red' | 'json' | 'esquema';

export type DetalleEsquema = {
  ruta: string;
  mensaje: string;
};

export class ErrorDeCarga extends Error {
  readonly tipo: TipoErrorCarga;
  readonly archivo: string;
  readonly detalles: DetalleEsquema[];

  constructor(
    tipo: TipoErrorCarga,
    archivo: string,
    mensaje: string,
    detalles: DetalleEsquema[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorDeCarga';
    this.tipo = tipo;
    this.archivo = archivo;
    this.detalles = detalles;
  }

  /** Título corto para la interfaz. */
  get titulo(): string {
    switch (this.tipo) {
      case 'red':
        return 'No se pudo leer el archivo';
      case 'json':
        return 'El archivo no es JSON válido';
      case 'esquema':
        return 'El archivo no cumple el esquema';
    }
  }

  /** Pista accionable, en la línea de lo que haría falta para arreglarlo. */
  get pista(): string {
    switch (this.tipo) {
      case 'red':
        return 'Comprueba que el archivo existe en public/dsm/ y que estás usando el servidor local (npm run preview). Con el protocolo file:// el navegador bloquea la lectura de JSON.';
      case 'json':
        return 'Suele ser una coma de más, una coma que falta o unas comillas sin cerrar. El mensaje indica la posición.';
      case 'esquema':
        return 'Ejecuta «npm run validate» para revisar todos los archivos de una vez.';
    }
  }
}

function formatearRuta(ruta: (string | number)[]): string {
  if (ruta.length === 0) return '(raíz)';
  return ruta
    .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? p : `.${p}`))
    .join('');
}

async function cargarJson<T>(rutaRelativa: string, schema: ZodTypeAny): Promise<T> {
  const url = `${BASE}/${rutaRelativa}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, { cache: 'no-cache' });
  } catch (error) {
    throw new ErrorDeCarga(
      'red',
      rutaRelativa,
      error instanceof Error ? error.message : 'Error de red desconocido',
    );
  }

  if (!respuesta.ok) {
    throw new ErrorDeCarga(
      'red',
      rutaRelativa,
      `El servidor respondió ${respuesta.status} ${respuesta.statusText}`,
    );
  }

  // Se descarta la marca de orden de bytes: en Windows es fácil guardar un JSON
  // como «UTF-8 con BOM» y JSON.parse falla con un mensaje incomprensible.
  const texto = (await respuesta.text()).replace(/^﻿/, '');

  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch (error) {
    throw new ErrorDeCarga(
      'json',
      rutaRelativa,
      error instanceof Error ? error.message : 'JSON mal formado',
    );
  }

  const resultado = schema.safeParse(dato);
  if (!resultado.success) {
    const zodError = resultado.error as ZodError;
    const detalles = zodError.issues.slice(0, 12).map((issue) => ({
      ruta: formatearRuta(issue.path),
      mensaje: issue.message,
    }));
    throw new ErrorDeCarga(
      'esquema',
      rutaRelativa,
      `${zodError.issues.length} problema(s) de validación`,
      detalles,
    );
  }

  return resultado.data as T;
}

/* ------------------------------------------------------------------ */
/* Caché en memoria                                                    */
/* ------------------------------------------------------------------ */

/*
 * Se guardan las promesas, no los resultados: si dos componentes piden la misma
 * categoría a la vez solo se hace una petición. Un fallo se descarta de la caché
 * para que reintentar tenga sentido.
 */
const cache = new Map<string, Promise<unknown>>();

function memorizar<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  const existente = cache.get(clave) as Promise<T> | undefined;
  if (existente) return existente;
  const promesa = cargar().catch((error: unknown) => {
    cache.delete(clave);
    throw error;
  });
  cache.set(clave, promesa);
  return promesa;
}

/** Vacía la caché. Útil tras editar un JSON sin recargar la página entera. */
export function vaciarCache(): void {
  cache.clear();
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

/** Índice raíz: las 18 categorías de la Sección II. */
export function cargarIndice(): Promise<Indice> {
  return memorizar('indice', () => cargarJson<Indice>('index.json', indiceSchema));
}

/** Índice de una categoría. Es la unidad de carga diferida. */
export function cargarCategoria(categoriaId: string): Promise<Categoria> {
  return memorizar(`categoria:${categoriaId}`, () =>
    cargarJson<Categoria>(`${categoriaId}/index.json`, categoriaSchema),
  );
}

/** Ficha completa de un trastorno. */
export function cargarTrastorno(categoriaId: string, trastornoId: string): Promise<Trastorno> {
  return memorizar(`trastorno:${categoriaId}/${trastornoId}`, () =>
    cargarJson<Trastorno>(`${categoriaId}/${trastornoId}.json`, trastornoSchema),
  );
}

/** Índice de búsqueda pre-construido (fase 3). */
export function cargarIndiceBusqueda(): Promise<IndiceBusqueda> {
  return memorizar('busqueda', () =>
    cargarJson<IndiceBusqueda>('search-index.json', indiceBusquedaSchema),
  );
}
