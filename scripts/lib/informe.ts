/**
 * Recolector del informe de conversion.
 *
 * Principio: nada se pierde en silencio. Toda decision no trivial del conversor
 * pasa por aqui y acaba impresa. Vale mas un informe con 40 advertencias que una
 * biblioteca con huecos que se descubren meses despues.
 */

import type { Advertencia, SeveridadAdvertencia } from '../../src/lib/schema.js';

export type Incidencia = Advertencia & {
  /** Trastorno o categoria al que pertenece. null si es de ambito global. */
  ambito: string | null;
};

export const CODIGOS_ADVERTENCIA = {
  seccion_desconocida: 'Sección con título fuera del mapa de normalización',
  seccion_por_alias: 'Sección resuelta mediante alias declarado',
  seccion_por_prefijo: 'Sección resuelta mediante patrón de prefijo',
  seccion_duplicada: 'La misma clave de sección aparece dos veces en el trastorno',
  encabezado_duplicado: 'Encabezado repetido consecutivamente y colapsado',
  encabezado_absorbido: 'Encabezado absorbido dentro del bloque de criterios',
  titulo_huerfano: 'Título de trastorno sin encabezado, tomado de párrafo suelto',
  discrepancia_manifiesto: 'La heurística y el manifiesto no coinciden',
  no_declarado: 'Encabezado de trastorno detectado pero no presente en el manifiesto',
  declarado_no_encontrado: 'Trastorno declarado en el manifiesto que no aparece en la fuente',
  parrafo_partido: 'Párrafo partido por salto de página y reunido',
  guion_de_corte: 'Palabra cortada con guion en salto de página y reunida',
  codigo_intercalado: 'Código CIE intercalado dentro de un párrafo y extraído',
  tabla_fragmentada: 'Tabla reconstruida a partir de fragmentos "(cont.)"',
  tabla_como_criterios: 'Criterios diagnósticos venían dentro de una tabla HTML',
  tabla_posicion_dudosa: 'Tabla situada en una sección distinta a la que la referencia',
  imagen_remota: 'Imagen con URL remota: inservible sin conexión, hueco explícito',
  criterio_sin_padre: 'Criterio anidado sin criterio padre; colgado de la raíz',
  campo_vacio: 'Campo del esquema que quedó vacío',
  conjunto_nombrado: 'Conjunto de criterios nombrado dentro del apartado',
  html_desconocido: 'Etiqueta HTML no contemplada en la fuente',
  ocr_sospechoso: 'Texto con daño de OCR (falta de espacio tras puntuación)',
  guion_sin_pareja:
    'Párrafo que termina en guion de corte y cuya continuación no era contigua: queda partido',
  sin_criterios: 'Trastorno sin apartado de criterios diagnósticos',
  sin_codigo: 'Trastorno sin código CIE localizado en la fuente',
} as const;

export type CodigoAdvertencia = keyof typeof CODIGOS_ADVERTENCIA;

export class Informe {
  readonly incidencias: Incidencia[] = [];
  private ambitoActual: string | null = null;

  ambito(nombre: string | null): void {
    this.ambitoActual = nombre;
  }

  registrar(
    codigo: CodigoAdvertencia,
    severidad: SeveridadAdvertencia,
    mensaje: string,
    opciones: { textoLiteral?: string | null; linea?: number | null; ambito?: string | null } = {},
  ): Advertencia {
    const advertencia: Advertencia = {
      codigo,
      severidad,
      mensaje,
      textoLiteral: opciones.textoLiteral ?? null,
      linea: opciones.linea ?? null,
    };
    this.incidencias.push({
      ...advertencia,
      ambito: opciones.ambito !== undefined ? opciones.ambito : this.ambitoActual,
    });
    return advertencia;
  }

  porCodigo(codigo: CodigoAdvertencia): Incidencia[] {
    return this.incidencias.filter((i) => i.codigo === codigo);
  }

  contar(codigo: CodigoAdvertencia): number {
    return this.porCodigo(codigo).length;
  }

  get total(): number {
    return this.incidencias.length;
  }

  get graves(): number {
    return this.incidencias.filter((i) => i.severidad === 'grave').length;
  }
}
