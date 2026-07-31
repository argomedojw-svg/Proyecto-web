/**
 * Esquema de datos de la biblioteca DSM-5-TR.
 *
 * Regla de oro de todo este archivo: NADA aqui genera contenido clinico.
 * El esquema solo describe la forma que tienen los datos extraidos del archivo
 * fuente del usuario. La ausencia de una seccion es un estado valido y esperado,
 * no un error de validacion.
 *
 * Convencion: los nombres de dominio van en espanol (son terminos del DSM y del
 * dominio clinico); el codigo, los tipos de utilidad y los comentarios tecnicos
 * van en ingles solo cuando no describen dominio.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Versionado del esquema                                              */
/* ------------------------------------------------------------------ */

/**
 * Identificador de version del formato. Va escrito en cada JSON generado.
 * Si algun dia cambia la forma, el cargador puede distinguir ficheros viejos
 * de nuevos en vez de fallar con un error ininteligible.
 */
export const VERSION_ESQUEMA = 1 as const;

export const ESQUEMA_TRASTORNO = 'dsm5tr-trastorno/1' as const;
export const ESQUEMA_CATEGORIA = 'dsm5tr-categoria/1' as const;
export const ESQUEMA_INDICE = 'dsm5tr-indice/1' as const;
export const ESQUEMA_BUSQUEDA = 'dsm5tr-busqueda/1' as const;

/** Marcador para campos que la fuente no proporciona y que el usuario rellenara. */
export const PENDIENTE = '[PENDIENTE]' as const;

/* ------------------------------------------------------------------ */
/* Claves canonicas de seccion                                         */
/* ------------------------------------------------------------------ */

/**
 * Vocabulario cerrado de secciones del DSM-5-TR.
 * Una seccion cuyo titulo no se resuelva a una de estas claves NO se descarta:
 * se conserva con `clave: null` y `reconocida: false` (vease `seccionSchema`).
 */
export const CLAVES_SECCION = [
  'criterios',
  'especificadores',
  'procedimientos_registro',
  'caracteristicas_diagnosticas',
  'caracteristicas_asociadas',
  'prevalencia',
  'desarrollo_curso',
  'factores_riesgo_pronostico',
  'cultura',
  'sexo_genero',
  'marcadores_diagnosticos',
  'suicidio',
  'consecuencias_funcionales',
  'diagnostico_diferencial',
  'comorbilidad',
  'relacion_otras_clasificaciones',
] as const;

export type ClaveSeccion = (typeof CLAVES_SECCION)[number];

export const claveSeccionSchema = z.enum(CLAVES_SECCION);

/** Titulos de presentacion por defecto. Solo etiquetas de interfaz, no contenido. */
export const TITULO_SECCION: Record<ClaveSeccion, string> = {
  criterios: 'Criterios diagnósticos',
  especificadores: 'Especificadores',
  procedimientos_registro: 'Procedimientos de registro',
  caracteristicas_diagnosticas: 'Características diagnósticas',
  caracteristicas_asociadas: 'Características asociadas',
  prevalencia: 'Prevalencia',
  desarrollo_curso: 'Desarrollo y curso',
  factores_riesgo_pronostico: 'Factores de riesgo y pronóstico',
  cultura: 'Aspectos diagnósticos relacionados con la cultura',
  sexo_genero: 'Aspectos diagnósticos relacionados con el sexo y el género',
  marcadores_diagnosticos: 'Marcadores diagnósticos',
  suicidio: 'Asociación con pensamientos o conductas suicidas',
  consecuencias_funcionales: 'Consecuencias funcionales',
  diagnostico_diferencial: 'Diagnóstico diferencial',
  comorbilidad: 'Comorbilidad',
  relacion_otras_clasificaciones: 'Relación con otras clasificaciones',
};

/** Orden canonico de presentacion cuando se necesite ordenar (p. ej. comparador). */
export const ORDEN_SECCION: ClaveSeccion[] = [...CLAVES_SECCION];

/* ------------------------------------------------------------------ */
/* Procedencia y advertencias de conversion                            */
/* ------------------------------------------------------------------ */

/**
 * De donde salio cada cosa. Sin esto no se puede auditar la conversion
 * seis meses despues, cuando ya no se recuerda el estado del markdown.
 */
export const procedenciaSchema = z.object({
  archivoFuente: z.string(),
  lineaInicio: z.number().int().nonnegative(),
  lineaFin: z.number().int().nonnegative(),
});
export type Procedencia = z.infer<typeof procedenciaSchema>;

export const SEVERIDADES_ADVERTENCIA = ['info', 'aviso', 'grave'] as const;
export type SeveridadAdvertencia = (typeof SEVERIDADES_ADVERTENCIA)[number];

/**
 * Una advertencia de conversion viaja DENTRO del JSON, no solo en el informe
 * de consola. Asi la interfaz puede mostrar "este trastorno tuvo 3 incidencias
 * de conversion" en lugar de fingir que todo esta perfecto.
 */
export const advertenciaSchema = z.object({
  codigo: z.string(),
  severidad: z.enum(SEVERIDADES_ADVERTENCIA),
  mensaje: z.string(),
  /** Texto literal de la fuente, sin reescribir. Imprescindible para auditar. */
  textoLiteral: z.string().nullable().default(null),
  linea: z.number().int().nonnegative().nullable().default(null),
});
export type Advertencia = z.infer<typeof advertenciaSchema>;

/* ------------------------------------------------------------------ */
/* Criterios diagnosticos: arbol recursivo                             */
/* ------------------------------------------------------------------ */

export const TIPOS_NODO_CRITERIO = [
  /** Un criterio numerado o con letra: A, A.1, A.1.a */
  'criterio',
  /** Bloque "Nota:" del manual, adjunto al criterio que lo precede. */
  'nota',
  /** Bloque "Nota de codificacion:". */
  'nota_codificacion',
  /** Texto sin marcador que pertenece al bloque (continuacion o aclaracion). */
  'texto',
] as const;
export type TipoNodoCriterio = (typeof TIPOS_NODO_CRITERIO)[number];

export type NodoCriterio = {
  /** Ruta estable y unica dentro del conjunto: "A", "A.1", "A.1.a". Anclas y referencias cruzadas. */
  ruta: string;
  /** Marcador tal y como lo imprime el manual: "A", "1", "a". null en notas y texto suelto. */
  etiqueta: string | null;
  tipo: TipoNodoCriterio;
  texto: string;
  hijos: NodoCriterio[];
};

export const nodoCriterioSchema: z.ZodType<NodoCriterio> = z.lazy(() =>
  z.object({
    ruta: z.string(),
    etiqueta: z.string().nullable(),
    tipo: z.enum(TIPOS_NODO_CRITERIO),
    texto: z.string(),
    hijos: z.array(nodoCriterioSchema),
  }),
);

/** Una opcion dentro de un bloque "Especificar si:" / "Especificar la gravedad actual:". */
export const opcionEspecificadorSchema = z.object({
  /** Codigo CIE cuando el manual lo imprime junto a la opcion (p. ej. F90.2). */
  codigo: z.string().nullable().default(null),
  etiqueta: z.string(),
  descripcion: z.string().nullable().default(null),
  /** Sub-opciones: p. ej. las subaptitudes bajo "F81.0 Con dificultades en la lectura". */
  subopciones: z.array(z.string()).default([]),
});
export type OpcionEspecificador = z.infer<typeof opcionEspecificadorSchema>;

export const bloqueEspecificacionSchema = z.object({
  /** Encabezado literal: "Especificar si:", "Especificar la gravedad actual:". */
  encabezado: z.string(),
  opciones: z.array(opcionEspecificadorSchema).default([]),
  notas: z.array(z.string()).default([]),
});
export type BloqueEspecificacion = z.infer<typeof bloqueEspecificacionSchema>;

/**
 * Un conjunto de criterios con identidad propia.
 *
 * El caso normal es UN conjunto sin nombre. Los trastornos de tics comparten un
 * unico apartado "Criterios diagnosticos" que contiene tres trastornos
 * nombrados, cada uno con su codigo y sus criterios A-E. Modelarlo aqui evita
 * tener que reeditar ficheros a mano cuando el mismo patron reaparezca en otros
 * capitulos.
 */
export const conjuntoCriteriosSchema = z.object({
  /** Identificador estable dentro de la ficha; sirve de ancla en la URL. */
  id: z.string(),
  /** Nombre del subconjunto cuando existe (p. ej. "Trastorno de la Tourette"). */
  nombre: z.string().nullable().default(null),
  codigo: z.string().nullable().default(null),
  /** Prosa que precede al criterio A. */
  preambulo: z.array(z.string()).default([]),
  nodos: z.array(nodoCriterioSchema).default([]),
  especificaciones: z.array(bloqueEspecificacionSchema).default([]),
});
export type ConjuntoCriterios = z.infer<typeof conjuntoCriteriosSchema>;

/* ------------------------------------------------------------------ */
/* Bloques de contenido de una seccion                                 */
/* ------------------------------------------------------------------ */

export const bloqueParrafoSchema = z.object({
  tipo: z.literal('parrafo'),
  texto: z.string(),
});

/** Subtitulo dentro de una introduccion de capitulo o de una seccion larga. */
export const bloqueSubtituloSchema = z.object({
  tipo: z.literal('subtitulo'),
  texto: z.string(),
});

export const bloqueListaSchema = z.object({
  tipo: z.literal('lista'),
  ordenada: z.boolean().default(false),
  items: z.array(z.object({ marca: z.string().nullable().default(null), texto: z.string() })),
});

export const bloqueNotaSchema = z.object({
  tipo: z.literal('nota'),
  variante: z.enum(['nota', 'codificacion']),
  texto: z.string(),
});

export const bloqueTablaSchema = z.object({
  tipo: z.literal('tabla'),
  titulo: z.string().nullable().default(null),
  encabezados: z.array(z.string()).default([]),
  filas: z.array(z.array(z.string())).default([]),
  /** true si se reconstruyo uniendo fragmentos "(cont.)" repartidos por paginas. */
  fragmentosUnidos: z.number().int().nonnegative().default(1),
});

export const bloqueCriteriosSchema = z.object({
  tipo: z.literal('criterios'),
  conjuntos: z.array(conjuntoCriteriosSchema).default([]),
});

export const bloqueEspecificacionContenidoSchema = z.object({
  tipo: z.literal('especificacion'),
  bloque: bloqueEspecificacionSchema,
});

/**
 * Hueco explicito. El markdown fuente contiene <img> apuntando a una URL remota
 * de OCR: inservible sin conexion y no es contenido que podamos reconstruir.
 * Se deja constancia del hueco en los datos en vez de fingir que no habia nada.
 */
export const bloqueImagenAusenteSchema = z.object({
  tipo: z.literal('imagen_ausente'),
  /** Referencia original tal cual, para que el usuario pueda ir al PDF. */
  referenciaOriginal: z.string(),
  descripcion: z.string().default(PENDIENTE),
});

export const bloqueContenidoSchema = z.discriminatedUnion('tipo', [
  bloqueParrafoSchema,
  bloqueSubtituloSchema,
  bloqueListaSchema,
  bloqueNotaSchema,
  bloqueTablaSchema,
  bloqueCriteriosSchema,
  bloqueEspecificacionContenidoSchema,
  bloqueImagenAusenteSchema,
]);
export type BloqueContenido = z.infer<typeof bloqueContenidoSchema>;

/* ------------------------------------------------------------------ */
/* Seccion                                                             */
/* ------------------------------------------------------------------ */

export const seccionSchema = z.object({
  /** null cuando el titulo no se resolvio a ninguna clave canonica. */
  clave: claveSeccionSchema.nullable(),
  /** Titulo normalizado de la fuente. Sirve para agrupar desconocidas repetidas. */
  claveOriginal: z.string(),
  /** Titulo literal tal y como aparece impreso. Es lo que se muestra. */
  titulo: z.string(),
  reconocida: z.boolean(),
  /** Posicion en el documento original. El orden de lectura se respeta siempre. */
  orden: z.number().int().nonnegative(),
  contenido: z.array(bloqueContenidoSchema).default([]),
  procedencia: procedenciaSchema,
});
export type Seccion = z.infer<typeof seccionSchema>;

/* ------------------------------------------------------------------ */
/* Contenido educativo (aportado por el usuario, nunca por el conversor)*/
/* ------------------------------------------------------------------ */

export const ORIGENES_EDUCATIVOS = [
  /** Escrito por el usuario. */
  'usuario',
  /** Andamiaje generado como plantilla. Siempre nace con validado: false. */
  'andamiaje',
  /** Procedente de una fuente externa citada. */
  'externa',
] as const;

export const fuenteEducativaSchema = z.object({
  origen: z.enum(ORIGENES_EDUCATIVOS),
  /** Cita o referencia libre. */
  referencia: z.string().nullable().default(null),
  /** Apartado del manual del que se deriva, para poder volver al original. */
  seccionOrigen: claveSeccionSchema.nullable().default(null),
});
export type FuenteEducativa = z.infer<typeof fuenteEducativaSchema>;

/** Campos comunes a todo elemento educativo. `validado` gobierna el tratamiento visual. */
const baseEducativa = {
  id: z.string(),
  validado: z.boolean().default(false),
  fuente: fuenteEducativaSchema,
  notas: z.string().nullable().default(null),
  creadoEn: z.string().nullable().default(null),
};

export const opcionPreguntaSchema = z.object({
  id: z.string(),
  texto: z.string(),
});

export const preguntaSchema = z.object({
  ...baseEducativa,
  enunciado: z.string(),
  opciones: z.array(opcionPreguntaSchema).default([]),
  /** id de la opcion correcta. null mientras no este definida. */
  respuestaCorrecta: z.string().nullable().default(null),
  explicacion: z.string().default(PENDIENTE),
  /** Apartado del manual que sustenta la respuesta. Exigido por Fase 5. */
  seccionReferencia: claveSeccionSchema.nullable().default(null),
});
export type Pregunta = z.infer<typeof preguntaSchema>;

export const flashcardSchema = z.object({
  ...baseEducativa,
  anverso: z.string(),
  reverso: z.string(),
  etiquetas: z.array(z.string()).default([]),
});
export type Flashcard = z.infer<typeof flashcardSchema>;

export const casoClinicoSchema = z.object({
  ...baseEducativa,
  titulo: z.string(),
  vineta: z.string(),
  preguntas: z.array(preguntaSchema).default([]),
  puntosClave: z.array(z.string()).default([]),
});
export type CasoClinico = z.infer<typeof casoClinicoSchema>;

export const instrumentoSchema = z.object({
  ...baseEducativa,
  nombre: z.string(),
  acronimo: z.string().nullable().default(null),
  descripcion: z.string().default(PENDIENTE),
  rangoEdad: z.string().nullable().default(null),
  tipo: z.string().nullable().default(null),
});
export type Instrumento = z.infer<typeof instrumentoSchema>;

/** Nodo de un algoritmo diagnostico. Grafo dirigido simple: pregunta -> ramas. */
export const nodoAlgoritmoSchema = z.object({
  id: z.string(),
  tipo: z.enum(['pregunta', 'resultado', 'nota']),
  texto: z.string(),
  /** Apartado del manual que respalda este paso. */
  seccionReferencia: claveSeccionSchema.nullable().default(null),
  ramas: z
    .array(
      z.object({
        etiqueta: z.string(),
        destino: z.string(),
      }),
    )
    .default([]),
});

export const algoritmoSchema = z.object({
  ...baseEducativa,
  titulo: z.string(),
  nodoInicial: z.string().nullable().default(null),
  nodos: z.array(nodoAlgoritmoSchema).default([]),
});
export type Algoritmo = z.infer<typeof algoritmoSchema>;

export const resumenSchema = z.object({
  ...baseEducativa,
  texto: z.string(),
});
export type Resumen = z.infer<typeof resumenSchema>;

export const perlaSchema = z.object({
  ...baseEducativa,
  texto: z.string(),
});
export type Perla = z.infer<typeof perlaSchema>;

export const contenidoEducativoSchema = z.object({
  resumen: resumenSchema.nullable().default(null),
  perlas: z.array(perlaSchema).default([]),
  preguntas: z.array(preguntaSchema).default([]),
  flashcards: z.array(flashcardSchema).default([]),
  casos: z.array(casoClinicoSchema).default([]),
  instrumentos: z.array(instrumentoSchema).default([]),
  algoritmos: z.array(algoritmoSchema).default([]),
});
export type ContenidoEducativo = z.infer<typeof contenidoEducativoSchema>;

/** Contenido educativo vacio. El conversor SIEMPRE escribe esto. */
export const contenidoEducativoVacio = (): ContenidoEducativo => ({
  resumen: null,
  perlas: [],
  preguntas: [],
  flashcards: [],
  casos: [],
  instrumentos: [],
  algoritmos: [],
});

/* ------------------------------------------------------------------ */
/* Relaciones                                                          */
/* ------------------------------------------------------------------ */

export const referenciaTrastornoSchema = z.object({
  /** id del trastorno si se pudo resolver; null si solo se conoce el nombre literal. */
  idTrastorno: z.string().nullable().default(null),
  nombre: z.string(),
  /** Como se detecto: extraccion mecanica o declaracion del usuario. */
  procedencia: z.enum(['extraida', 'declarada']).default('extraida'),
  nota: z.string().nullable().default(null),
});
export type ReferenciaTrastorno = z.infer<typeof referenciaTrastornoSchema>;

export const relacionesSchema = z.object({
  /** Trastornos con los que el manual lo contrasta en Diagnostico diferencial. */
  comparadoCon: z.array(referenciaTrastornoSchema).default([]),
  /** Menciones cruzadas en cualquier otro apartado. */
  referenciasCruzadas: z.array(referenciaTrastornoSchema).default([]),
});
export type Relaciones = z.infer<typeof relacionesSchema>;

/* ------------------------------------------------------------------ */
/* Trastorno                                                           */
/* ------------------------------------------------------------------ */

export const TIPOS_ENTRADA = [
  /** Trastorno completo con criterios propios. */
  'trastorno',
  /** "Otro trastorno ... especificado". */
  'otro_especificado',
  /** "Trastorno ... no especificado". */
  'no_especificado',
  /** Entrada breve sin criterios propios (p. ej. Retraso global del desarrollo). */
  'variante',
] as const;
export type TipoEntrada = (typeof TIPOS_ENTRADA)[number];

export const codigosSchema = z.object({
  /**
   * Codigo tal y como lo imprime el DSM-5-TR. El manual imprime el codigo
   * CIE-10-MC, por eso `cie10` repite el mismo valor: es copia literal, no
   * inferencia.
   */
  dsm5tr: z.string().nullable().default(null),
  cie10: z.string().nullable().default(null),
  /** La fuente no contiene codigos CIE-11. Queda null hasta que el usuario lo rellene. */
  cie11: z.string().nullable().default(null),
});
export type Codigos = z.infer<typeof codigosSchema>;

export const referenciaCategoriaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
});

export const trastornoSchema = z.object({
  esquema: z.literal(ESQUEMA_TRASTORNO),
  version: z.literal(VERSION_ESQUEMA),

  /* --- Identificacion --- */
  id: z.string().min(1),
  nombre: z.string().min(1),
  /** Nombre abreviado para migas de pan y columnas del comparador. */
  nombreCorto: z.string().nullable().default(null),
  /** Nombres alternativos presentes literalmente en la fuente. Alimentan la busqueda. */
  sinonimos: z.array(z.string()).default([]),
  abreviaturas: z.array(z.string()).default([]),
  codigos: codigosSchema,
  /** Codigos adicionales derivados de especificadores (gravedad, subtipo). */
  codigosAdicionales: z
    .array(z.object({ etiqueta: z.string(), codigo: z.string() }))
    .default([]),

  categoria: referenciaCategoriaSchema,
  subcategoria: referenciaCategoriaSchema.nullable().default(null),
  tipoEntrada: z.enum(TIPOS_ENTRADA).default('trastorno'),
  /** Orden de aparicion dentro de la categoria. Gobierna anterior/siguiente. */
  orden: z.number().int().nonnegative().default(0),

  /* --- Contenido oficial --- */
  /** Arreglo ORDENADO. La ausencia de una seccion es normal, no un error. */
  secciones: z.array(seccionSchema).default([]),

  /* --- Contenido del usuario --- */
  educativo: contenidoEducativoSchema,

  /* --- Relaciones --- */
  relaciones: relacionesSchema,

  /* --- Trazabilidad --- */
  procedencia: procedenciaSchema,
  advertencias: z.array(advertenciaSchema).default([]),
});
export type Trastorno = z.infer<typeof trastornoSchema>;

/* ------------------------------------------------------------------ */
/* Indice de categoria (un fichero por capitulo: carga diferida)       */
/* ------------------------------------------------------------------ */

export const entradaIndiceTrastornoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  nombreCorto: z.string().nullable().default(null),
  codigo: z.string().nullable().default(null),
  tipoEntrada: z.enum(TIPOS_ENTRADA),
  subcategoriaId: z.string().nullable().default(null),
  orden: z.number().int().nonnegative(),
  /** Ruta relativa a public/dsm/. */
  archivo: z.string(),
  /** Numero de secciones oficiales presentes. Permite avisar de fichas incompletas. */
  totalSecciones: z.number().int().nonnegative().default(0),
  /**
   * Trastornos nombrados que comparten ficha porque el manual les da un unico
   * apartado de criterios y secciones comunes (los trastornos de tics: Tourette,
   * persistente, provisional). El arbol de navegacion los muestra como hijos y
   * enlaza al ancla, sin duplicar el texto oficial en tres ficheros.
   */
  subentradas: z
    .array(
      z.object({
        nombre: z.string(),
        codigo: z.string().nullable().default(null),
        /** Ancla dentro de la ficha: id del conjunto de criterios. */
        ancla: z.string(),
      }),
    )
    .default([]),
});

export const subcategoriaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  orden: z.number().int().nonnegative(),
  introduccion: z.array(bloqueContenidoSchema).default([]),
  procedencia: procedenciaSchema.nullable().default(null),
});

export const categoriaSchema = z.object({
  esquema: z.literal(ESQUEMA_CATEGORIA),
  version: z.literal(VERSION_ESQUEMA),
  id: z.string(),
  nombre: z.string(),
  orden: z.number().int().nonnegative(),
  introduccion: z.array(bloqueContenidoSchema).default([]),
  subcategorias: z.array(subcategoriaSchema).default([]),
  trastornos: z.array(entradaIndiceTrastornoSchema).default([]),
  procedencia: procedenciaSchema.nullable().default(null),
  advertencias: z.array(advertenciaSchema).default([]),
});
export type Categoria = z.infer<typeof categoriaSchema>;

/* ------------------------------------------------------------------ */
/* Indice raiz (las 18 categorias de la Seccion II)                    */
/* ------------------------------------------------------------------ */

export const entradaIndiceCategoriaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  orden: z.number().int().nonnegative(),
  archivo: z.string(),
  /** false mientras la categoria no se haya convertido. La interfaz la muestra en gris. */
  disponible: z.boolean().default(false),
  totalTrastornos: z.number().int().nonnegative().default(0),
});

export const indiceSchema = z.object({
  esquema: z.literal(ESQUEMA_INDICE),
  version: z.literal(VERSION_ESQUEMA),
  generadoEn: z.string(),
  categorias: z.array(entradaIndiceCategoriaSchema).default([]),
});
export type Indice = z.infer<typeof indiceSchema>;

/* ------------------------------------------------------------------ */
/* Indice de busqueda (Fase 3; sin texto completo)                     */
/* ------------------------------------------------------------------ */

export const entradaBusquedaSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  sinonimos: z.array(z.string()).default([]),
  abreviaturas: z.array(z.string()).default([]),
  codigos: z.array(z.string()).default([]),
  palabrasClave: z.array(z.string()).default([]),
  categoriaId: z.string(),
  categoriaNombre: z.string(),
  subcategoriaNombre: z.string().nullable().default(null),
  archivo: z.string(),
});

export const indiceBusquedaSchema = z.object({
  esquema: z.literal(ESQUEMA_BUSQUEDA),
  version: z.literal(VERSION_ESQUEMA),
  generadoEn: z.string(),
  entradas: z.array(entradaBusquedaSchema).default([]),
});
export type IndiceBusqueda = z.infer<typeof indiceBusquedaSchema>;
