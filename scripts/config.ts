/**
 * Rutas del proyecto.
 *
 * El codigo vive en disco local porque Google Drive no admite enlaces
 * simbolicos ni junctions y npm no puede extraer node_modules ahi. Los archivos
 * markdown de origen siguen en Drive; solo se leen.
 *
 * Se puede sobrescribir con la variable de entorno DSM_FUENTE.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Raiz del proyecto (donde estan package.json, src/ y public/). */
export const RAIZ = resolve(AQUI, '..');

/** Carpeta que contiene los markdown de origen del DSM-5-TR. */
export const DIR_FUENTE =
  process.env.DSM_FUENTE ?? 'G:\\Mi unidad\\Libros\\DSM5-TR';

/** Destino de los JSON generados. */
export const DIR_SALIDA = resolve(RAIZ, 'public', 'dsm');
