/**
 * Marcas de validación guardadas en localStorage.
 *
 * El JSON es la fuente de verdad, pero marcar algo como revisado no debería
 * obligar a abrir un editor. Aquí se guarda una capa de anulaciones por id de
 * elemento; `validadoEfectivo` combina las dos.
 */

import { CLAVES, escribir, leer } from './almacenamiento';

type Marcas = Record<string, boolean>;

export function leerMarcas(): Marcas {
  return leer<Marcas>(CLAVES.validados, {});
}

/** Valor real que debe usar la interfaz: la anulación local gana al JSON. */
export function validadoEfectivo(id: string, validadoEnJson: boolean, marcas: Marcas): boolean {
  return marcas[id] ?? validadoEnJson;
}

export function marcarValidado(id: string, valor: boolean): Marcas {
  const marcas = leerMarcas();
  marcas[id] = valor;
  escribir(CLAVES.validados, marcas);
  return { ...marcas };
}

export function limpiarMarcas(): Marcas {
  escribir(CLAVES.validados, {});
  return {};
}

/** Ids marcados a mano, para poder volcarlos al JSON cuando se quiera. */
export function idsValidadosLocalmente(): string[] {
  const marcas = leerMarcas();
  return Object.entries(marcas)
    .filter(([, valor]) => valor)
    .map(([id]) => id);
}
