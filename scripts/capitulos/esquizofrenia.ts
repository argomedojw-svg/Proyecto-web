/**
 * Manifiesto del capitulo "Espectro de la esquizofrenia y otros trastornos
 * psicoticos".
 *
 * Todo lo que hay aqui esta tomado del archivo fuente del usuario. Los sinonimos
 * llevan la linea exacta donde aparecen para que el informe permita auditarlos
 * uno a uno. Ningun termino se ha anadido por conocimiento externo.
 *
 * Sobre las subcategorias: este capitulo del manual NO imprime rotulos de
 * agrupacion, salvo "Catatonia", que encabeza y presenta los tres diagnosticos
 * catatonicos. El resto de entradas van en un unico grupo que reutiliza el
 * nombre del propio capitulo, para no inventar un rotulo que la fuente no da.
 */

import type { CapituloDeclarado } from './tipos.js';

export const esquizofrenia: CapituloDeclarado = {
  id: 'espectro-de-la-esquizofrenia-y-otros-trastornos-psicoticos',
  nombre: 'Espectro de la esquizofrenia y otros trastornos psicóticos',
  orden: 2,
  archivoFuente: '02-Espectro de la esquizofrenia y otros transtornos psicóticos.md',
  subcategorias: [
    {
      // Mismo rotulo que el capitulo: la fuente no imprime ningun otro para
      // este grupo. El encabezado del capitulo lo consume el conversor antes de
      // llegar a la comprobacion de subcategoria, asi que no colisionan.
      nombre: 'Espectro de la esquizofrenia y otros trastornos psicóticos',
      trastornos: [
        {
          nombre: 'Trastorno esquizotípico (de la personalidad)',
          nombreCorto: 'Trastorno esquizotípico',
          // Entrada de remision: el manual lo menciona aqui pero desarrolla sus
          // criterios en el capitulo "Trastornos de la personalidad".
          tipoEntrada: 'variante',
          sinonimos: [
            { termino: 'Trastorno de la personalidad esquizotípica', lineaFuente: 71 },
          ],
        },
        { nombre: 'Trastorno delirante' },
        {
          nombre: 'Trastorno psicótico breve',
          sinonimos: [{ termino: 'Psicosis reactiva breve', lineaFuente: 211 }],
        },
        { nombre: 'Trastorno esquizofreniforme' },
        { nombre: 'Esquizofrenia' },
        { nombre: 'Trastorno esquizoafectivo' },
        {
          nombre: 'Trastorno psicótico inducido por sustancias/medicamentos',
          variantes: ['Trastorno psicótico inducido por sustancias/ medicamentos'],
        },
        { nombre: 'Trastorno psicótico debido a otra afección médica' },
        {
          // Aparece en la fuente despues del encabezado "Catatonia", pero no es
          // un diagnostico catatonico. El conversor avisa de la discrepancia y
          // aplica lo declarado aqui.
          nombre:
            'Otro trastorno del espectro de la esquizofrenia especificado y otro trastorno psicótico',
          nombreCorto: 'Otro trastorno del espectro de la esquizofrenia especificado',
          tipoEntrada: 'otro_especificado',
        },
        {
          nombre:
            'Trastorno del espectro de la esquizofrenia no especificado y otro trastorno psicótico',
          nombreCorto: 'Trastorno del espectro de la esquizofrenia no especificado',
          tipoEntrada: 'no_especificado',
        },
      ],
    },
    {
      nombre: 'Catatonía',
      trastornos: [
        {
          nombre: 'Catatonía asociada a otro trastorno mental (especificador de catatonía)',
          nombreCorto: 'Catatonía asociada a otro trastorno mental',
        },
        { nombre: 'Trastorno catatónico debido a otra afección médica' },
        {
          // El nombre va en femenino, asi que la deduccion por sufijo
          // (" no especificado") no lo reconoce: se declara explicitamente.
          nombre: 'Catatonía no especificada',
          tipoEntrada: 'no_especificado',
        },
      ],
    },
  ],
};
