/**
 * Conversor markdown -> public/dsm/<categoria>/<trastorno>.json
 *
 * Reglas que gobiernan este archivo:
 *  - No genera ni completa contenido clinico. Solo reestructura lo que hay.
 *  - Lo que no entiende, lo conserva y lo reporta. Nunca lo descarta.
 *  - El contenido educativo se escribe siempre vacio.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  ESQUEMA_CATEGORIA,
  ESQUEMA_INDICE,
  ESQUEMA_TRASTORNO,
  ORDEN_SECCION,
  VERSION_ESQUEMA,
  categoriaSchema,
  contenidoEducativoVacio,
  indiceSchema,
  trastornoSchema,
  type Advertencia,
  type BloqueContenido,
  type Categoria,
  type ClaveSeccion,
  type ConjuntoCriterios,
  type Seccion,
  type TipoEntrada,
  type Trastorno,
} from '../src/lib/schema.js';
import { DIR_FUENTE, DIR_SALIDA, RAIZ } from './config.js';
import { CAPITULOS, CONJUNTOS_NOMBRADOS, REGISTRO_CATEGORIAS } from './capitulos/registro.js';
import type { CapituloDeclarado, TrastornoDeclarado } from './capitulos/tipos.js';
import { construirCriterios, type EntradaCriterios } from './lib/criterios.js';
import { Informe, type Incidencia } from './lib/informe.js';
import { analizar, repararTrasCodigos, type Pieza } from './lib/lexico.js';
import { esEncabezadoDeEspecificacion, resolverSeccion } from './lib/secciones.js';
import { limpiar, plegar, plegarNombre, slug } from './lib/texto.js';

/* ------------------------------------------------------------------ */
/* Estructuras intermedias                                             */
/* ------------------------------------------------------------------ */

type BloqueTrastorno = {
  declarado: TrastornoDeclarado;
  subcategoria: string;
  lineaInicio: number;
  lineaFin: number;
  /** Piezas del cuerpo, ya clasificadas en secciones. */
  secciones: SeccionCruda[];
  /** Codigos sueltos que aparecen antes de la primera seccion. */
  codigosSueltos: string[];
  advertencias: Advertencia[];
};

type SeccionCruda = {
  titulo: string;
  linea: number;
  piezas: Pieza[];
  /** Encabezados absorbidos, con la linea de la pieza a la que preceden. */
  encabezadosInternos: Map<number, string>;
};

/* ------------------------------------------------------------------ */
/* Clasificacion de encabezados                                        */
/* ------------------------------------------------------------------ */

type IndiceManifiesto = {
  subcategoriasPorNombre: Map<string, string>;
  trastornosPorNombre: Map<string, { declarado: TrastornoDeclarado; subcategoria: string }>;
};

function indexarManifiesto(capitulo: CapituloDeclarado): IndiceManifiesto {
  const subcategoriasPorNombre = new Map<string, string>();
  const trastornosPorNombre = new Map<
    string,
    { declarado: TrastornoDeclarado; subcategoria: string }
  >();

  for (const sub of capitulo.subcategorias) {
    for (const nombre of [sub.nombre, ...(sub.variantes ?? [])]) {
      subcategoriasPorNombre.set(plegarNombre(nombre), sub.nombre);
    }
    for (const trastorno of sub.trastornos) {
      for (const nombre of [trastorno.nombre, ...(trastorno.variantes ?? [])]) {
        trastornosPorNombre.set(plegarNombre(nombre), {
          declarado: trastorno,
          subcategoria: sub.nombre,
        });
      }
    }
  }
  return { subcategoriasPorNombre, trastornosPorNombre };
}

/* ------------------------------------------------------------------ */
/* Paso 1: trocear el documento                                        */
/* ------------------------------------------------------------------ */

type Troceado = {
  introduccionCapitulo: Pieza[];
  subcategorias: { nombre: string; introduccion: Pieza[]; linea: number }[];
  trastornos: BloqueTrastorno[];
};

const RE_SOLO_CODIGO = /^F\d{2}(?:\.\d{1,2})?$/;

function trocear(
  piezas: Pieza[],
  capitulo: CapituloDeclarado,
  indice: IndiceManifiesto,
  informe: Informe,
): Troceado {
  const troceado: Troceado = {
    introduccionCapitulo: [],
    subcategorias: [],
    trastornos: [],
  };

  // El estado del recorrido va agrupado en un objeto a proposito: TypeScript no
  // sigue las escrituras que las funciones auxiliares hacen sobre variables
  // locales y las estrecharia a `never` en el resto del bucle.
  const est: {
    subcategoria: string | null;
    trastorno: BloqueTrastorno | null;
    seccion: SeccionCruda | null;
    ultimoEncabezado: string | null;
  } = { subcategoria: null, trastorno: null, seccion: null, ultimoEncabezado: null };

  const cerrarTrastorno = (lineaFin: number) => {
    if (est.trastorno) {
      est.trastorno.lineaFin = lineaFin;
      troceado.trastornos.push(est.trastorno);
    }
    est.trastorno = null;
    est.seccion = null;
  };

  const destinoIntro = (): Pieza[] => {
    if (est.subcategoria) {
      const sub = troceado.subcategorias[troceado.subcategorias.length - 1];
      if (sub) return sub.introduccion;
    }
    return troceado.introduccionCapitulo;
  };

  const abrirTrastorno = (
    declarado: TrastornoDeclarado,
    subcategoria: string,
    linea: number,
  ): void => {
    cerrarTrastorno(linea - 1);
    est.trastorno = {
      declarado,
      subcategoria,
      lineaInicio: linea,
      lineaFin: linea,
      secciones: [],
      codigosSueltos: [],
      advertencias: [],
    };
    informe.ambito(declarado.nombre);
  };

  /** Abre una seccion nueva dentro del trastorno en curso. */
  const abrirSeccion = (titulo: string, linea: number, piezasIniciales: Pieza[] = []): void => {
    if (!est.trastorno) return;
    const seccion: SeccionCruda = {
      titulo,
      linea,
      piezas: piezasIniciales,
      encabezadosInternos: new Map(),
    };
    est.trastorno.secciones.push(seccion);
    est.seccion = seccion;
  };

  /** ¿La seccion en curso es la de criterios diagnosticos? */
  const enCriterios = (): boolean =>
    est.seccion !== null && resolverSeccion(est.seccion.titulo).clave === 'criterios';

  for (const pieza of piezas) {
    /* ---------------- Encabezados ---------------- */
    if (pieza.tipo === 'encabezado') {
      const texto = pieza.texto;
      const plegado = plegarNombre(texto);

      // Encabezado que solo contiene un codigo CIE (p. ej. "## F90.8").
      if (RE_SOLO_CODIGO.test(texto.trim())) {
        const seccion = est.seccion;
        if (seccion) {
          seccion.piezas.push({ tipo: 'codigo', codigo: texto.trim(), linea: pieza.linea });
        } else if (est.trastorno) {
          est.trastorno.codigosSueltos.push(texto.trim());
        }
        continue;
      }

      // Subcategoria formada por un unico trastorno homonimo: el manual repite
      // el mismo rotulo dos veces seguidas (autismo, trastorno especifico del
      // aprendizaje). La segunda aparicion es el trastorno, no un duplicado.
      // Esta comprobacion va ANTES del colapso de duplicados a proposito.
      const homonimo = indice.trastornosPorNombre.get(plegado);
      if (
        homonimo &&
        est.subcategoria !== null &&
        plegarNombre(est.subcategoria) === plegado &&
        est.trastorno === null
      ) {
        informe.registrar(
          'encabezado_duplicado',
          'aviso',
          `"${texto}" rotula a la vez la subcategoría y su único trastorno; la segunda aparición se toma como el trastorno`,
          { textoLiteral: texto, linea: pieza.linea },
        );
        abrirTrastorno(homonimo.declarado, homonimo.subcategoria, pieza.linea);
        est.ultimoEncabezado = plegado;
        continue;
      }

      // Encabezado duplicado consecutivo sin contenido entre medias.
      if (est.ultimoEncabezado === plegado) {
        informe.registrar('encabezado_duplicado', 'aviso', `Encabezado repetido: "${texto}"`, {
          textoLiteral: texto,
          linea: pieza.linea,
        });
        continue;
      }

      // Titulo del capitulo.
      if (plegado === plegarNombre(capitulo.nombre) && !est.subcategoria) {
        est.ultimoEncabezado = plegado;
        continue;
      }

      // Encabezado absorbido dentro del apartado de criterios.
      const seccionCriterios = enCriterios() ? est.seccion : null;
      if (seccionCriterios && esEncabezadoDeEspecificacion(texto)) {
        informe.registrar(
          'encabezado_absorbido',
          'info',
          `Encabezado tratado como bloque de especificación: "${texto}"`,
          { textoLiteral: texto, linea: pieza.linea },
        );
        seccionCriterios.piezas.push({ tipo: 'parrafo', texto, linea: pieza.linea, lineaFin: pieza.linea });
        seccionCriterios.encabezadosInternos.set(pieza.linea, texto);
        est.ultimoEncabezado = plegado;
        continue;
      }

      // Conjunto de criterios nombrado (los tres trastornos de tics).
      const nombresConjunto = est.trastorno
        ? (CONJUNTOS_NOMBRADOS[slug(est.trastorno.declarado.nombre)] ?? [])
        : [];
      if (seccionCriterios && nombresConjunto.some((n) => plegarNombre(n) === plegado)) {
        seccionCriterios.piezas.push({ tipo: 'parrafo', texto, linea: pieza.linea, lineaFin: pieza.linea });
        seccionCriterios.encabezadosInternos.set(pieza.linea, texto);
        est.ultimoEncabezado = plegado;
        continue;
      }

      // Subcategoria. Se comprueba ANTES que trastorno, salvo cuando el nombre
      // coincide con la subcategoria ya abierta: ese es el patron
      // "subcategoria de un solo trastorno homonimo" (autismo, TDAH,
      // trastorno especifico del aprendizaje).
      const subDeclarada = indice.subcategoriasPorNombre.get(plegado);
      if (subDeclarada && subDeclarada !== est.subcategoria) {
        cerrarTrastorno(pieza.linea - 1);
        est.subcategoria = subDeclarada;
        troceado.subcategorias.push({
          nombre: subDeclarada,
          introduccion: [],
          linea: pieza.linea,
        });
        informe.ambito(subDeclarada);
        est.ultimoEncabezado = plegado;
        continue;
      }

      const trastornoDeclarado = indice.trastornosPorNombre.get(plegado);
      if (trastornoDeclarado) {
        if (est.subcategoria && trastornoDeclarado.subcategoria !== est.subcategoria) {
          informe.registrar(
            'discrepancia_manifiesto',
            'aviso',
            `"${texto}" aparece bajo "${est.subcategoria}" pero el manifiesto lo declara en "${trastornoDeclarado.subcategoria}". Gana el manifiesto.`,
            { textoLiteral: texto, linea: pieza.linea },
          );
        }
        abrirTrastorno(trastornoDeclarado.declarado, trastornoDeclarado.subcategoria, pieza.linea);
        est.ultimoEncabezado = plegado;
        continue;
      }

      // Seccion dentro del trastorno en curso.
      const resolucion = resolverSeccion(texto);
      if (est.trastorno) {
        if (resolucion.via === 'alias') {
          informe.registrar('seccion_por_alias', 'info', `"${texto}" → ${resolucion.clave}`, {
            textoLiteral: texto,
            linea: pieza.linea,
          });
        } else if (resolucion.via === 'prefijo') {
          informe.registrar('seccion_por_prefijo', 'info', `"${texto}" → ${resolucion.clave}`, {
            textoLiteral: texto,
            linea: pieza.linea,
          });
        } else if (resolucion.via === 'desconocida') {
          informe.registrar(
            'seccion_desconocida',
            'aviso',
            `Título de sección fuera del mapa de normalización`,
            { textoLiteral: texto, linea: pieza.linea },
          );
        }
        abrirSeccion(texto, pieza.linea);
        est.ultimoEncabezado = plegado;
        continue;
      }

      // Encabezado sin trastorno abierto: subtitulo de introduccion.
      destinoIntro().push(pieza);
      est.ultimoEncabezado = plegado;
      continue;
    }

    /* ---------------- Contenido ---------------- */
    est.ultimoEncabezado = null;

    // Titulo huerfano: parrafo suelto que nombra el trastorno, sin encabezado.
    if (pieza.tipo === 'parrafo' && !est.trastorno && est.subcategoria) {
      const candidato = indice.trastornosPorNombre.get(plegarNombre(pieza.texto));
      if (candidato?.declarado.tituloHuerfano) {
        informe.registrar(
          'titulo_huerfano',
          'aviso',
          `Título de trastorno tomado de un párrafo sin encabezado: "${pieza.texto}"`,
          { textoLiteral: pieza.texto, linea: pieza.linea },
        );
        abrirTrastorno(candidato.declarado, candidato.subcategoria, pieza.linea);
        continue;
      }
    }

    // Tabla que contiene los criterios diagnosticos (no hay encabezado propio).
    if (
      pieza.tipo === 'tabla' &&
      est.trastorno &&
      plegar(pieza.encabezados[0] ?? '') === 'criterios diagnosticos'
    ) {
      informe.registrar(
        'tabla_como_criterios',
        'aviso',
        'Los criterios diagnósticos venían dentro de una tabla HTML; se han reestructurado',
        { linea: pieza.linea },
      );
      abrirSeccion('Criterios diagnósticos', pieza.linea, [pieza]);
      continue;
    }

    if (est.trastorno) {
      if (!est.seccion) {
        if (pieza.tipo === 'codigo') {
          est.trastorno.codigosSueltos.push(pieza.codigo);
          continue;
        }
        // Prosa antes de cualquier seccion: las entradas "no especificado" son
        // solo un codigo y un parrafo. Se guarda como seccion sin titulo.
        abrirSeccion('', pieza.linea);
      }
      est.seccion?.piezas.push(pieza);
      continue;
    }

    destinoIntro().push(pieza);
  }

  cerrarTrastorno(Number.MAX_SAFE_INTEGER);
  informe.ambito(null);
  return troceado;
}

/* ------------------------------------------------------------------ */
/* Paso 2: construir el contenido de una seccion                       */
/* ------------------------------------------------------------------ */

const RE_OCR_SOSPECHOSO = /[a-záéíóúñ][.,;][a-záéíóúñA-ZÁÉÍÓÚÑ]/g;

function contarDanoOcr(texto: string): number {
  return (texto.match(RE_OCR_SOSPECHOSO) ?? []).length;
}

function piezaATexto(pieza: Pieza): string {
  switch (pieza.tipo) {
    case 'parrafo':
      return pieza.texto;
    case 'codigo':
      return pieza.codigo;
    default:
      return '';
  }
}

/** Extrae los codigos de una lista de piezas y repara los parrafos que partian. */
function extraerCodigos(piezas: Pieza[], informe: Informe): { piezas: Pieza[]; codigos: string[] } {
  const codigos: string[] = [];
  const resto: Pieza[] = [];
  for (const pieza of piezas) {
    if (pieza.tipo === 'codigo') {
      codigos.push(pieza.codigo);
      continue;
    }
    resto.push(pieza);
  }
  return { piezas: repararTrasCodigos(resto, informe), codigos };
}

function construirEntradasCriterios(seccion: SeccionCruda, informe: Informe): {
  entradas: EntradaCriterios[];
  codigos: string[];
} {
  const entradas: EntradaCriterios[] = [];
  const codigos: string[] = [];

  for (const pieza of seccion.piezas) {
    if (pieza.tipo === 'tabla') {
      // Solo se aplana la tabla-criterios, cuya primera fila es
      // ["Criterios diagnósticos", código]. Una tabla cualquiera que caiga
      // dentro del apartado (la rejilla de códigos CIE-10-MC del trastorno
      // psicótico inducido por sustancias) es una tabla de verdad: aplanarla
      // metería sus celdas sueltas en el árbol de criterios y además perdería
      // su primera fila. Se deja pasar; `construirContenido` la conserva
      // intacta como bloque `tabla` justo detrás de los criterios.
      if (plegar(pieza.encabezados[0] ?? '') !== 'criterios diagnosticos') continue;

      const codigoTabla = pieza.encabezados[1]?.trim();
      if (codigoTabla && RE_SOLO_CODIGO.test(codigoTabla)) {
        codigos.push(codigoTabla);
        entradas.push({ texto: codigoTabla, linea: pieza.linea });
      }
      for (const fila of pieza.filasCrudas.slice(1)) {
        for (const celda of fila) {
          for (const linea of celda) {
            if (linea.trim().length > 0) entradas.push({ texto: linea, linea: pieza.linea });
          }
        }
      }
      continue;
    }
    if (pieza.tipo === 'imagen') continue;
    if (pieza.tipo === 'codigo') {
      // El codigo se conserva TAMBIEN como entrada: el constructor de criterios
      // lo asigna al conjunto en curso, que es lo que da su codigo a cada uno de
      // los tres trastornos de tics.
      codigos.push(pieza.codigo);
      entradas.push({ texto: pieza.codigo, linea: pieza.linea });
      continue;
    }
    if (pieza.tipo !== 'parrafo') continue;
    const encabezado = seccion.encabezadosInternos.get(pieza.linea);
    entradas.push(
      encabezado ? { texto: pieza.texto, linea: pieza.linea, encabezado } : { texto: pieza.texto, linea: pieza.linea },
    );
  }

  // Repara los criterios que un codigo al margen habia partido en dos (el
  // "F82" que cae en mitad del criterio A del trastorno de la coordinacion).
  // La comparacion salta por encima de las entradas de codigo.
  const reunidas: EntradaCriterios[] = [];
  let ultimoTexto: EntradaCriterios | null = null;
  for (const entrada of entradas) {
    const esCodigo = RE_SOLO_CODIGO.test(entrada.texto.trim());
    if (esCodigo) {
      reunidas.push(entrada);
      continue;
    }
    if (ultimoTexto && !entrada.encabezado && !ultimoTexto.encabezado) {
      const izq = ultimoTexto.texto.trimEnd();
      const der = entrada.texto.trimStart();
      if (!/[.:;!?»"')\]]\s*$/.test(izq) && /^[a-záéíóúñü(]/.test(der)) {
        informe.registrar(
          'parrafo_partido',
          'info',
          `Criterio reunido tras un código al margen (línea ${entrada.linea})`,
          { textoLiteral: `…${izq.slice(-40)} ⟨+⟩ ${der.slice(0, 40)}…`, linea: entrada.linea },
        );
        ultimoTexto.texto = `${izq} ${der}`;
        continue;
      }
    }
    reunidas.push(entrada);
    ultimoTexto = entrada;
  }

  for (const entrada of reunidas) {
    const dano = contarDanoOcr(entrada.texto);
    if (dano >= 3) {
      informe.registrar(
        'ocr_sospechoso',
        'aviso',
        `Criterio con ${dano} posibles daños de OCR (falta espacio tras puntuación); el texto se conserva literal`,
        { textoLiteral: entrada.texto.slice(0, 120), linea: entrada.linea },
      );
    }
  }

  return { entradas: reunidas, codigos };
}

function construirContenido(
  seccion: SeccionCruda,
  clave: ClaveSeccion | null,
  idBase: string,
  nombresConjunto: string[],
  informe: Informe,
): { contenido: BloqueContenido[]; codigos: string[]; conjuntos: ConjuntoCriterios[] } {
  const contenido: BloqueContenido[] = [];

  if (clave === 'criterios') {
    const { entradas, codigos } = construirEntradasCriterios(seccion, informe);
    const conjuntos = construirCriterios(entradas, idBase, nombresConjunto, informe);
    contenido.push({ tipo: 'criterios', conjuntos });

    // Las tablas de la seccion de criterios que NO eran los criterios se
    // conservan como tablas (p. ej. las escalas de gravedad).
    for (const pieza of seccion.piezas) {
      if (pieza.tipo === 'tabla' && plegar(pieza.encabezados[0] ?? '') !== 'criterios diagnosticos') {
        contenido.push({
          tipo: 'tabla',
          titulo: pieza.titulo,
          encabezados: pieza.encabezados,
          filas: pieza.filas,
          fragmentosUnidos: pieza.fragmentos,
        });
      }
      if (pieza.tipo === 'imagen') {
        contenido.push({
          tipo: 'imagen_ausente',
          referenciaOriginal: pieza.src,
          descripcion: '[PENDIENTE]',
        });
      }
    }
    return { contenido, codigos, conjuntos };
  }

  const { piezas, codigos } = extraerCodigos(seccion.piezas, informe);

  for (const pieza of piezas) {
    switch (pieza.tipo) {
      case 'parrafo': {
        const texto = limpiar(pieza.texto);
        if (texto.length === 0) break;
        // Guion de corte cuya continuacion no era contigua: entre las dos
        // mitades se habia colado una imagen o una tabla, asi que la reunion
        // automatica no llego. El texto no se pierde, pero queda partido.
        if (/[a-záéíóúñü]-$/i.test(texto)) {
          informe.registrar(
            'guion_sin_pareja',
            'aviso',
            'Párrafo cortado por guion cuya continuación no era contigua (hay una figura o tabla en medio). Queda partido en dos bloques.',
            { textoLiteral: `…${texto.slice(-70)}`, linea: pieza.linea },
          );
        }
        const dano = contarDanoOcr(texto);
        if (dano >= 3) {
          informe.registrar(
            'ocr_sospechoso',
            'info',
            `Párrafo con ${dano} posibles daños de OCR (falta espacio tras puntuación)`,
            { textoLiteral: texto.slice(0, 120), linea: pieza.linea },
          );
        }
        contenido.push({ tipo: 'parrafo', texto });
        break;
      }
      case 'encabezado':
        contenido.push({ tipo: 'subtitulo', texto: pieza.texto });
        break;
      case 'tabla':
        // Las tablas numeradas del manual ("TABLA n") pertenecen conceptualmente
        // al apartado que las referencia, pero el OCR las deja donde cayo el
        // salto de pagina. Se conservan en su posicion del documento y se avisa:
        // moverlas seria una decision editorial, no una conversion.
        // (la rama de `criterios` ya salio antes de llegar aqui)
        if (pieza.titulo && clave !== null && clave !== 'especificadores') {
          informe.registrar(
            'tabla_posicion_dudosa',
            'aviso',
            `La tabla "${pieza.titulo}" quedó dentro de "${clave}"; el manual la referencia desde otro apartado. Se conserva donde aparece.`,
            { linea: pieza.linea },
          );
        }
        contenido.push({
          tipo: 'tabla',
          titulo: pieza.titulo,
          encabezados: pieza.encabezados,
          filas: pieza.filas,
          fragmentosUnidos: pieza.fragmentos,
        });
        break;
      case 'imagen':
        informe.registrar(
          'imagen_remota',
          'aviso',
          'Imagen con URL remota: no funciona sin conexión. Se deja un hueco explícito.',
          { textoLiteral: pieza.src.slice(0, 90), linea: pieza.linea },
        );
        contenido.push({
          tipo: 'imagen_ausente',
          referenciaOriginal: pieza.src,
          descripcion: '[PENDIENTE]',
        });
        break;
      default:
        break;
    }
  }

  return { contenido, codigos, conjuntos: [] };
}

/* ------------------------------------------------------------------ */
/* Paso 3: ensamblar el trastorno                                      */
/* ------------------------------------------------------------------ */

function deducirTipoEntrada(declarado: TrastornoDeclarado): TipoEntrada {
  if (declarado.tipoEntrada) return declarado.tipoEntrada;
  const p = plegar(declarado.nombre);
  if (/^otro .* especificado$/.test(p)) return 'otro_especificado';
  if (/ no especificado$/.test(p)) return 'no_especificado';
  return 'trastorno';
}

function sinonimosDelTitulo(nombre: string): string[] {
  const m = nombre.match(/\(([^)]+)\)/g);
  if (!m) return [];
  return m.map((s) => limpiar(s.replace(/[()]/g, ''))).filter((s) => s.length > 2);
}

function ensamblarTrastorno(
  bloque: BloqueTrastorno,
  capitulo: CapituloDeclarado,
  orden: number,
  archivoFuente: string,
  informe: Informe,
): Trastorno {
  informe.ambito(bloque.declarado.nombre);

  const id = slug(bloque.declarado.nombre);
  const nombresConjunto = CONJUNTOS_NOMBRADOS[id] ?? [];
  const secciones: Seccion[] = [];
  const codigosRecogidos: string[] = [...bloque.codigosSueltos];
  let conjuntosCriterios: ConjuntoCriterios[] = [];
  const clavesVistas = new Set<ClaveSeccion>();

  bloque.secciones.forEach((cruda, indice) => {
    const resolucion = cruda.titulo
      ? resolverSeccion(cruda.titulo)
      : { clave: null, claveOriginal: '', via: 'desconocida' as const };

    if (resolucion.clave) {
      if (clavesVistas.has(resolucion.clave)) {
        informe.registrar(
          'seccion_duplicada',
          'aviso',
          `La clave "${resolucion.clave}" aparece más de una vez; se conservan ambas en orden`,
          { textoLiteral: cruda.titulo, linea: cruda.linea },
        );
      }
      clavesVistas.add(resolucion.clave);
    }

    const { contenido, codigos, conjuntos } = construirContenido(
      cruda,
      resolucion.clave,
      id,
      nombresConjunto,
      informe,
    );
    codigosRecogidos.push(...codigos);
    if (conjuntos.length > 0) conjuntosCriterios = conjuntos;

    if (contenido.length === 0) return;

    const ultimaPieza = cruda.piezas[cruda.piezas.length - 1];
    secciones.push({
      clave: resolucion.clave,
      claveOriginal: resolucion.claveOriginal || `(sin título, línea ${cruda.linea})`,
      titulo: cruda.titulo || 'Descripción',
      reconocida: resolucion.clave !== null,
      orden: indice,
      contenido,
      procedencia: {
        archivoFuente,
        lineaInicio: cruda.linea,
        lineaFin:
          ultimaPieza && 'lineaFin' in ultimaPieza ? ultimaPieza.lineaFin : (ultimaPieza?.linea ?? cruda.linea),
      },
    });
  });

  /* --- Codigos --- */
  const codigosAdicionales: { etiqueta: string; codigo: string }[] = [];
  for (const conjunto of conjuntosCriterios) {
    if (conjunto.codigo && conjunto.nombre) {
      codigosAdicionales.push({ etiqueta: conjunto.nombre, codigo: conjunto.codigo });
    }
    for (const bloqueEsp of conjunto.especificaciones) {
      for (const opcion of bloqueEsp.opciones) {
        if (opcion.codigo) {
          codigosAdicionales.push({ etiqueta: opcion.etiqueta, codigo: opcion.codigo });
        }
      }
    }
  }

  // Codigo principal: el suelto o el del conjunto sin nombre. Si el manual solo
  // imprime codigos por especificador (TDAH, aprendizaje, discapacidad
  // intelectual) o uno por conjunto nombrado (trastornos de tics), queda null y
  // se reporta. No se inventa uno ni se toma prestado el de un subconjunto.
  const hayConjuntosNombrados = conjuntosCriterios.some((c) => c.nombre !== null);
  const codigoPrincipal =
    bloque.codigosSueltos[0] ??
    conjuntosCriterios.find((c) => c.nombre === null)?.codigo ??
    (hayConjuntosNombrados ? null : (codigosRecogidos[0] ?? null));

  const advertencias: Advertencia[] = [...bloque.advertencias];

  if (!codigoPrincipal) {
    advertencias.push(
      informe.registrar(
        'sin_codigo',
        'aviso',
        codigosAdicionales.length > 0
          ? `Sin código único: el manual solo imprime códigos por especificador (${codigosAdicionales.length})`
          : 'Sin código CIE localizado en la fuente',
        { linea: bloque.lineaInicio },
      ),
    );
  }
  if (!secciones.some((s) => s.clave === 'criterios')) {
    advertencias.push(
      informe.registrar('sin_criterios', 'info', 'Sin apartado de criterios diagnósticos', {
        linea: bloque.lineaInicio,
      }),
    );
  }

  /* --- Sinonimos: solo los declarados y los del propio titulo --- */
  const sinonimos = [
    ...sinonimosDelTitulo(bloque.declarado.nombre),
    ...(bloque.declarado.sinonimos ?? []).map((s) => s.termino),
  ];
  const sinonimosUnicos = [...new Set(sinonimos.map(limpiar))].filter(Boolean);

  /* --- Relaciones: coincidencia literal contra el resto del capitulo --- */
  const textoDiferencial = secciones
    .filter((s) => s.clave === 'diagnostico_diferencial')
    .flatMap((s) => s.contenido)
    .map((b) => (b.tipo === 'parrafo' ? b.texto : ''))
    .join(' ');
  const plegadoDiferencial = plegar(textoDiferencial);

  const comparadoCon: Trastorno['relaciones']['comparadoCon'] = [];
  for (const sub of capitulo.subcategorias) {
    for (const otro of sub.trastornos) {
      if (otro.nombre === bloque.declarado.nombre) continue;
      const candidatos = [otro.nombre, ...(otro.sinonimos ?? []).map((s) => s.termino)];
      const acierto = candidatos.find((c) => c.length > 8 && plegadoDiferencial.includes(plegar(c)));
      if (acierto) {
        comparadoCon.push({
          idTrastorno: slug(otro.nombre),
          nombre: otro.nombre,
          procedencia: 'extraida',
          nota: null,
        });
      }
    }
  }

  const subcategoriaId = slug(bloque.subcategoria);

  const trastorno: Trastorno = {
    esquema: ESQUEMA_TRASTORNO,
    version: VERSION_ESQUEMA,
    id,
    nombre: bloque.declarado.nombre,
    nombreCorto: bloque.declarado.nombreCorto ?? null,
    sinonimos: sinonimosUnicos,
    abreviaturas: (bloque.declarado.abreviaturas ?? []).map((a) => a.termino),
    codigos: {
      dsm5tr: codigoPrincipal,
      // El DSM-5-TR imprime el codigo CIE-10-MC; se copia literal, no se infiere.
      cie10: codigoPrincipal,
      // La fuente no contiene codigos CIE-11.
      cie11: null,
    },
    codigosAdicionales,
    categoria: { id: capitulo.id, nombre: capitulo.nombre },
    subcategoria: { id: subcategoriaId, nombre: bloque.subcategoria },
    tipoEntrada: deducirTipoEntrada(bloque.declarado),
    orden,
    secciones,
    educativo: contenidoEducativoVacio(),
    relaciones: { comparadoCon, referenciasCruzadas: [] },
    procedencia: {
      archivoFuente,
      lineaInicio: bloque.lineaInicio,
      lineaFin: bloque.lineaFin === Number.MAX_SAFE_INTEGER ? bloque.lineaInicio : bloque.lineaFin,
    },
    advertencias,
  };

  return trastorno;
}

/* ------------------------------------------------------------------ */
/* Conversion de un capitulo                                           */
/* ------------------------------------------------------------------ */

function bloquesDeIntroduccion(piezas: Pieza[]): BloqueContenido[] {
  const bloques: BloqueContenido[] = [];
  for (const pieza of piezas) {
    if (pieza.tipo === 'parrafo') bloques.push({ tipo: 'parrafo', texto: pieza.texto });
    else if (pieza.tipo === 'encabezado') bloques.push({ tipo: 'subtitulo', texto: pieza.texto });
    else if (pieza.tipo === 'tabla') {
      bloques.push({
        tipo: 'tabla',
        titulo: pieza.titulo,
        encabezados: pieza.encabezados,
        filas: pieza.filas,
        fragmentosUnidos: pieza.fragmentos,
      });
    }
  }
  return bloques;
}

async function convertirCapitulo(
  capitulo: CapituloDeclarado,
  informe: Informe,
): Promise<{ categoria: Categoria; trastornos: Trastorno[] }> {
  const rutaFuente = join(DIR_FUENTE, capitulo.archivoFuente);
  const contenido = await readFile(rutaFuente, 'utf8');
  const piezas = analizar(contenido, informe);
  const indice = indexarManifiesto(capitulo);
  const troceado = trocear(piezas, capitulo, indice, informe);

  /* --- Reconciliacion con el manifiesto --- */
  const encontrados = new Set(troceado.trastornos.map((t) => t.declarado.nombre));
  for (const sub of capitulo.subcategorias) {
    for (const declarado of sub.trastornos) {
      if (!encontrados.has(declarado.nombre)) {
        informe.registrar(
          'declarado_no_encontrado',
          'grave',
          `Declarado en el manifiesto pero no localizado en la fuente: "${declarado.nombre}"`,
          { textoLiteral: declarado.nombre, ambito: sub.nombre },
        );
      }
    }
  }

  const trastornos = troceado.trastornos.map((bloque, i) =>
    ensamblarTrastorno(bloque, capitulo, i, capitulo.archivoFuente, informe),
  );

  const ordenSub = new Map(capitulo.subcategorias.map((s, i) => [s.nombre, i]));

  const categoria: Categoria = {
    esquema: ESQUEMA_CATEGORIA,
    version: VERSION_ESQUEMA,
    id: capitulo.id,
    nombre: capitulo.nombre,
    orden: capitulo.orden,
    introduccion: bloquesDeIntroduccion(troceado.introduccionCapitulo),
    subcategorias: capitulo.subcategorias.map((sub, i) => {
      const troceada = troceado.subcategorias.find((s) => s.nombre === sub.nombre);
      return {
        id: slug(sub.nombre),
        nombre: sub.nombre,
        orden: i,
        introduccion: troceada ? bloquesDeIntroduccion(troceada.introduccion) : [],
        procedencia: troceada
          ? {
              archivoFuente: capitulo.archivoFuente,
              lineaInicio: troceada.linea,
              lineaFin: troceada.linea,
            }
          : null,
      };
    }),
    trastornos: trastornos.map((t) => {
      const conjuntos =
        t.secciones
          .flatMap((s) => s.contenido)
          .find((b): b is Extract<BloqueContenido, { tipo: 'criterios' }> => b.tipo === 'criterios')
          ?.conjuntos ?? [];
      return {
        id: t.id,
        nombre: t.nombre,
        nombreCorto: t.nombreCorto,
        codigo: t.codigos.dsm5tr,
        tipoEntrada: t.tipoEntrada,
        subcategoriaId: t.subcategoria?.id ?? null,
        orden: t.orden,
        archivo: `${capitulo.id}/${t.id}.json`,
        totalSecciones: t.secciones.length,
        subentradas: conjuntos
          .filter((c) => c.nombre !== null)
          .map((c) => ({ nombre: c.nombre as string, codigo: c.codigo, ancla: c.id })),
      };
    }),
    procedencia: { archivoFuente: capitulo.archivoFuente, lineaInicio: 1, lineaFin: 0 },
    advertencias: [],
  };

  // Orden estable: por subcategoria declarada y luego por aparicion.
  categoria.trastornos.sort((a, b) => {
    const sa = ordenSub.get(trastornos.find((t) => t.id === a.id)?.subcategoria?.nombre ?? '') ?? 99;
    const sb = ordenSub.get(trastornos.find((t) => t.id === b.id)?.subcategoria?.nombre ?? '') ?? 99;
    return sa !== sb ? sa - sb : a.orden - b.orden;
  });

  return { categoria, trastornos };
}

/* ------------------------------------------------------------------ */
/* Informe                                                             */
/* ------------------------------------------------------------------ */

const COLOR = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  rojo: '[31m',
  amarillo: '[33m',
  verde: '[32m',
  cian: '[36m',
};

function titulo(texto: string): void {
  console.log(`\n${COLOR.bold}${COLOR.cian}${texto}${COLOR.reset}`);
  console.log(COLOR.dim + '─'.repeat(Math.min(texto.length + 8, 78)) + COLOR.reset);
}

function agrupar(incidencias: Incidencia[]): Map<string, Incidencia[]> {
  const mapa = new Map<string, Incidencia[]>();
  for (const i of incidencias) {
    const lista = mapa.get(i.codigo) ?? [];
    lista.push(i);
    mapa.set(i.codigo, lista);
  }
  return mapa;
}

function imprimirInforme(
  informe: Informe,
  trastornos: Trastorno[],
  categorias: Categoria[],
): void {
  titulo('INFORME DE CONVERSIÓN — DSM-5-TR');
  for (const categoria of categorias) {
    console.log(`Capítulo: ${categoria.nombre}`);
    console.log(`Fuente:   ${categoria.procedencia?.archivoFuente ?? '?'}`);
    console.log(`Salida:   public/dsm/${categoria.id}/`);
  }

  /* --- 1. Trastornos convertidos --- */
  titulo(`1 · TRASTORNOS CONVERTIDOS (${trastornos.length})`);
  let capActual = '';
  let subActual = '';
  for (const t of trastornos) {
    if (t.categoria.nombre !== capActual) {
      capActual = t.categoria.nombre;
      subActual = '';
      console.log(`\n${COLOR.cian}${t.categoria.nombre}${COLOR.reset}`);
    }
    const sub = t.subcategoria?.nombre ?? '—';
    if (sub !== subActual) {
      subActual = sub;
      console.log(`\n  ${COLOR.bold}${sub}${COLOR.reset}`);
    }
    const claves = t.secciones.filter((s) => s.reconocida).length;
    const desconocidas = t.secciones.filter((s) => !s.reconocida).length;
    const codigo = t.codigos.dsm5tr ?? (t.codigosAdicionales.length > 0 ? `${t.codigosAdicionales.length} códigos` : '—');
    const marca = t.advertencias.some((a) => a.severidad === 'grave') ? COLOR.rojo + '!' : ' ';
    console.log(
      `  ${marca}${COLOR.reset} ${codigo.padEnd(13)} ${t.nombre}`,
    );
    console.log(
      `      ${COLOR.dim}${claves} secciones reconocidas` +
        (desconocidas > 0 ? `, ${desconocidas} sin reconocer` : '') +
        `, líneas ${t.procedencia.lineaInicio}–${t.procedencia.lineaFin}${COLOR.reset}`,
    );
  }

  /* --- 2. Secciones no reconocidas --- */
  const desconocidas = informe.porCodigo('seccion_desconocida');
  titulo(`2 · SECCIONES NO RECONOCIDAS (${desconocidas.length})`);
  if (desconocidas.length === 0) {
    console.log(`  ${COLOR.verde}Ninguna.${COLOR.reset}`);
  } else {
    console.log(
      `  ${COLOR.dim}Se conservan íntegras con clave null. Añádelas a scripts/lib/secciones.ts y vuelve a convertir.${COLOR.reset}\n`,
    );
    for (const i of desconocidas) {
      console.log(`  ${COLOR.amarillo}línea ${String(i.linea).padStart(5)}${COLOR.reset}  "${i.textoLiteral}"`);
      console.log(`  ${' '.repeat(11)}  ${COLOR.dim}en: ${i.ambito ?? '—'}${COLOR.reset}`);
    }
  }

  /* --- 3. Campos vacios --- */
  titulo('3 · CAMPOS VACÍOS');
  const total = trastornos.length;
  const contarVacios = (predicado: (t: Trastorno) => boolean, etiqueta: string) => {
    const n = trastornos.filter(predicado).length;
    if (n === 0) return;
    const color = n === total ? COLOR.amarillo : COLOR.dim;
    console.log(`  ${color}${String(n).padStart(2)}/${total}${COLOR.reset}  ${etiqueta}`);
  };
  contarVacios((t) => t.codigos.dsm5tr === null, 'codigos.dsm5tr');
  contarVacios((t) => t.codigos.cie11 === null, 'codigos.cie11  (la fuente no contiene códigos CIE-11)');
  contarVacios((t) => t.sinonimos.length === 0, 'sinonimos');
  contarVacios((t) => t.abreviaturas.length === 0, 'abreviaturas');
  contarVacios((t) => t.nombreCorto === null, 'nombreCorto');
  contarVacios((t) => t.relaciones.comparadoCon.length === 0, 'relaciones.comparadoCon');
  contarVacios((t) => t.relaciones.referenciasCruzadas.length === 0, 'relaciones.referenciasCruzadas');
  console.log(
    `  ${COLOR.amarillo}${String(total).padStart(2)}/${total}${COLOR.reset}  educativo.*  ${COLOR.dim}(vacío por diseño: solo lo rellenas tú)${COLOR.reset}`,
  );

  console.log(`\n  ${COLOR.bold}Secciones oficiales ausentes por trastorno${COLOR.reset}`);
  console.log(`  ${COLOR.dim}(la ausencia es lo normal, no un error)${COLOR.reset}\n`);
  for (const clave of ORDEN_SECCION) {
    const presentes = trastornos.filter((t) => t.secciones.some((s) => s.clave === clave)).length;
    const barra = '█'.repeat(presentes) + COLOR.dim + '·'.repeat(total - presentes) + COLOR.reset;
    console.log(`  ${clave.padEnd(30)} ${String(presentes).padStart(2)}/${total}  ${barra}`);
  }

  /* --- 4. Incidencias --- */
  const otras = informe.incidencias.filter((i) => i.codigo !== 'seccion_desconocida');
  titulo(`4 · OTRAS INCIDENCIAS (${otras.length})`);
  const grupos = agrupar(otras);
  const ordenGrupos = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [codigo, lista] of ordenGrupos) {
    const severidad = lista[0]?.severidad ?? 'info';
    const color =
      severidad === 'grave' ? COLOR.rojo : severidad === 'aviso' ? COLOR.amarillo : COLOR.dim;
    console.log(`\n  ${color}${codigo}${COLOR.reset} ${COLOR.dim}(${lista.length})${COLOR.reset}`);
    const muestra = severidad === 'info' ? lista.slice(0, 4) : lista;
    for (const i of muestra) {
      const donde = i.linea ? `l.${i.linea}` : '—';
      console.log(`    ${COLOR.dim}${donde.padEnd(8)}${COLOR.reset}${i.mensaje}`);
      if (i.textoLiteral && severidad !== 'info') {
        console.log(`    ${' '.repeat(8)}${COLOR.dim}› ${i.textoLiteral.slice(0, 100)}${COLOR.reset}`);
      }
    }
    if (muestra.length < lista.length) {
      console.log(`    ${COLOR.dim}… y ${lista.length - muestra.length} más${COLOR.reset}`);
    }
  }

  /* --- 5. Resumen --- */
  titulo('5 · RESUMEN');
  const secciones = trastornos.reduce((n, t) => n + t.secciones.length, 0);
  const criterios = trastornos.reduce(
    (n, t) =>
      n +
      t.secciones
        .flatMap((s) => s.contenido)
        .filter((b) => b.tipo === 'criterios')
        .reduce((m, b) => m + (b.tipo === 'criterios' ? b.conjuntos.length : 0), 0),
    0,
  );
  console.log(`  Capítulos convertidos .......... ${categorias.length}`);
  console.log(`  Trastornos convertidos ......... ${trastornos.length}`);
  console.log(
    `  Subcategorías .................. ${categorias.reduce((n, c) => n + c.subcategorias.length, 0)}`,
  );
  console.log(`  Secciones totales .............. ${secciones}`);
  console.log(`  Conjuntos de criterios ......... ${criterios}`);
  console.log(`  Secciones no reconocidas ....... ${desconocidas.length}`);
  console.log(`  Incidencias totales ............ ${informe.total}`);
  console.log(
    `  ${COLOR.rojo}graves${COLOR.reset} ${informe.graves}  ` +
      `${COLOR.amarillo}avisos${COLOR.reset} ${informe.incidencias.filter((i) => i.severidad === 'aviso').length}  ` +
      `${COLOR.dim}info${COLOR.reset} ${informe.incidencias.filter((i) => i.severidad === 'info').length}`,
  );
}

/* ------------------------------------------------------------------ */
/* Programa principal                                                  */
/* ------------------------------------------------------------------ */

/**
 * Lee lo que la persona usuaria haya escrito a mano en los JSON existentes para
 * poder devolvérselo tras regenerar.
 *
 * Sin esto, `npm run convert` borraría public/dsm/ y se llevaría por delante
 * meses de flashcards, preguntas y casos. La conversión debe poder repetirse
 * tantas veces como haga falta sin coste.
 */
type Rescatado = {
  educativo: Trastorno['educativo'];
  cie11: string | null;
};

async function rescatarContenidoPropio(informe: Informe): Promise<Map<string, Rescatado>> {
  const rescatado = new Map<string, Rescatado>();
  if (!existsSync(DIR_SALIDA)) return rescatado;

  const { readdir } = await import('node:fs/promises');
  for (const entrada of await readdir(DIR_SALIDA, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    const dir = join(DIR_SALIDA, entrada.name);
    for (const archivo of await readdir(dir)) {
      if (!archivo.endsWith('.json') || archivo === 'index.json') continue;
      try {
        const bruto = (await readFile(join(dir, archivo), 'utf8')).replace(/^﻿/, '');
        const previo = trastornoSchema.parse(JSON.parse(bruto));
        const educativo = previo.educativo;
        const tieneAlgo =
          educativo.resumen !== null ||
          educativo.perlas.length +
            educativo.preguntas.length +
            educativo.flashcards.length +
            educativo.casos.length +
            educativo.instrumentos.length +
            educativo.algoritmos.length >
            0;
        if (tieneAlgo || previo.codigos.cie11) {
          rescatado.set(previo.id, { educativo, cie11: previo.codigos.cie11 });
        }
      } catch {
        // Un archivo ilegible no debe impedir la conversión, pero sí avisarse:
        // si tenía contenido propio, se va a perder.
        informe.registrar(
          'campo_vacio',
          'grave',
          `No se pudo leer ${entrada.name}/${archivo} para rescatar su contenido educativo. Si lo tenía, se perderá al regenerar.`,
          { textoLiteral: archivo, ambito: null },
        );
      }
    }
  }
  return rescatado;
}

async function main(): Promise<void> {
  const informe = new Informe();

  // Se rescata ANTES de borrar.
  const rescatado = await rescatarContenidoPropio(informe);

  if (existsSync(DIR_SALIDA)) {
    await rm(DIR_SALIDA, { recursive: true, force: true });
  }
  await mkdir(DIR_SALIDA, { recursive: true });

  const categoriasGeneradas: Categoria[] = [];
  const todosTrastornos: Trastorno[] = [];

  for (const capitulo of CAPITULOS) {
    const { categoria, trastornos } = await convertirCapitulo(capitulo, informe);
    const dir = join(DIR_SALIDA, capitulo.id);
    await mkdir(dir, { recursive: true });

    for (const trastorno of trastornos) {
      // Se devuelve lo que la persona usuaria hubiera escrito antes de regenerar.
      const previo = rescatado.get(trastorno.id);
      if (previo) {
        trastorno.educativo = previo.educativo;
        trastorno.codigos.cie11 = previo.cie11;
      }

      const validado = trastornoSchema.safeParse(trastorno);
      if (!validado.success) {
        console.error(`\n${COLOR.rojo}El trastorno "${trastorno.id}" no cumple el esquema:${COLOR.reset}`);
        for (const issue of validado.error.issues) {
          console.error(`  ${issue.path.join('.') || '(raíz)'}: ${issue.message}`);
        }
        process.exitCode = 1;
        continue;
      }
      await writeFile(
        join(dir, `${trastorno.id}.json`),
        `${JSON.stringify(validado.data, null, 2)}\n`,
        'utf8',
      );
    }

    const categoriaValidada = categoriaSchema.safeParse(categoria);
    if (!categoriaValidada.success) {
      console.error(`\n${COLOR.rojo}El índice de "${categoria.id}" no cumple el esquema:${COLOR.reset}`);
      for (const issue of categoriaValidada.error.issues) {
        console.error(`  ${issue.path.join('.') || '(raíz)'}: ${issue.message}`);
      }
      process.exitCode = 1;
    } else {
      await writeFile(
        join(dir, 'index.json'),
        `${JSON.stringify(categoriaValidada.data, null, 2)}\n`,
        'utf8',
      );
    }

    categoriasGeneradas.push(categoria);
    todosTrastornos.push(...trastornos);
  }

  /* --- Indice raiz con las 18 categorias --- */
  const indice = indiceSchema.parse({
    esquema: ESQUEMA_INDICE,
    version: VERSION_ESQUEMA,
    generadoEn: new Date().toISOString(),
    categorias: REGISTRO_CATEGORIAS.map((entrada) => {
      const generada = categoriasGeneradas.find((c) => c.id === entrada.id);
      return {
        id: entrada.id,
        nombre: entrada.nombre,
        orden: entrada.orden,
        archivo: `${entrada.id}/index.json`,
        disponible: Boolean(generada),
        totalTrastornos: generada?.trastornos.length ?? 0,
      };
    }),
  });
  await writeFile(join(DIR_SALIDA, 'index.json'), `${JSON.stringify(indice, null, 2)}\n`, 'utf8');

  if (categoriasGeneradas.length > 0) {
    imprimirInforme(informe, todosTrastornos, categoriasGeneradas);
  }

  if (rescatado.size > 0) {
    const elementos = [...rescatado.values()].reduce((n, r) => {
      const e = r.educativo;
      return (
        n +
        (e.resumen ? 1 : 0) +
        e.perlas.length +
        e.preguntas.length +
        e.flashcards.length +
        e.casos.length +
        e.instrumentos.length +
        e.algoritmos.length
      );
    }, 0);
    console.log(
      `\n${COLOR.verde}Contenido propio conservado:${COLOR.reset} ${elementos} elemento(s) educativo(s) en ${rescatado.size} ficha(s).`,
    );
  }

  // Copia del informe en JSON para poder revisarlo sin volver a convertir.
  await writeFile(
    join(RAIZ, 'informe-conversion.json'),
    `${JSON.stringify({ generadoEn: new Date().toISOString(), incidencias: informe.incidencias }, null, 2)}\n`,
    'utf8',
  );
  console.log(`\n${COLOR.dim}Informe completo en informe-conversion.json${COLOR.reset}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
