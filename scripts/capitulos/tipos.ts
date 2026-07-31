/**
 * Tipos del manifiesto de capitulo.
 *
 * El manifiesto es el indice DECLARADO de un capitulo: lo que el humano afirma
 * que contiene el archivo fuente. El conversor clasifica los encabezados por
 * heuristica y despues reconcilia contra el manifiesto; cada discrepancia se
 * reporta en vez de resolverse en silencio.
 *
 * Anadir un capitulo nuevo = anadir un fichero aqui. No se toca el conversor.
 */

export type SinonimoDeclarado = {
  termino: string;
  /**
   * Linea del archivo fuente donde aparece literalmente el termino.
   * Obligatorio: obliga a que todo sinonimo sea verificable en la fuente y no
   * conocimiento aportado desde fuera.
   */
  lineaFuente: number;
};

export type TrastornoDeclarado = {
  /** Nombre tal y como debe mostrarse. */
  nombre: string;
  /** Variantes tipograficas con las que aparece el encabezado en la fuente. */
  variantes?: string[];
  /** Titulo corto para migas de pan y columnas del comparador. */
  nombreCorto?: string;
  sinonimos?: SinonimoDeclarado[];
  abreviaturas?: SinonimoDeclarado[];
  tipoEntrada?: 'trastorno' | 'otro_especificado' | 'no_especificado' | 'variante';
  /**
   * true cuando el titulo no lleva encabezado propio en el markdown y aparece
   * como parrafo suelto justo despues del encabezado de subcategoria.
   */
  tituloHuerfano?: boolean;
};

export type SubcategoriaDeclarada = {
  nombre: string;
  variantes?: string[];
  trastornos: TrastornoDeclarado[];
};

export type CapituloDeclarado = {
  id: string;
  nombre: string;
  /** Posicion en la Seccion II del DSM-5-TR (1..18). */
  orden: number;
  archivoFuente: string;
  subcategorias: SubcategoriaDeclarada[];
};

/** Registro de las 18 categorias de la Seccion II. Las no convertidas van sin manifiesto. */
export type EntradaRegistro = {
  id: string;
  nombre: string;
  orden: number;
};
