# Biblioteca DSM-5-TR

Biblioteca clínica interactiva de la Sección II del DSM-5-TR. Uso personal, sin
conexión a Internet, sin backend.

## Dónde está el proyecto

El código vive en **`C:\dev\dsm5tr`**, no en Google Drive.

Motivo: el sistema de archivos virtual de Drive no admite enlaces simbólicos ni
junctions, y `npm install` no puede extraer `node_modules` ahí (`TAR_ENTRY_ERROR
UNKNOWN: unknown error, write`). Tampoco sería deseable: serían ~200 MB de
dependencias sincronizándose en la nube.

Los archivos markdown de origen siguen en Drive y solo se leen. La ruta está en
`scripts/config.ts` y se puede cambiar con la variable de entorno `DSM_FUENTE`.

Para hacer copia de seguridad del proyecto en Drive (sin `node_modules`):

```
npm run sync:drive
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Compila a `dist/` (estático puro) |
| `npm run preview` | Sirve `dist/` en http://localhost:4173 — **así se usa la app** |
| `npm run convert` | Markdown → `public/dsm/**.json` + informe de conversión + índice de búsqueda |
| `npm run build:search` | Solo el índice de búsqueda |
| `npm run andamiaje` | Genera flashcards y preguntas de código a partir de tus propios JSON |
| `npm run validate` | Valida todos los JSON contra el esquema Zod, con archivo y ruta exacta del campo en cada error |
| `npm run verify` | Comprueba fidelidad y cobertura contra el markdown de origen |
| `npm run check` | Todo lo anterior en cadena, más `tsc --noEmit` |
| `npm run sync:drive` | Copia el proyecto a Drive (sin `node_modules`) |

### Reconvertir no destruye tu trabajo

`npm run convert` regenera `public/dsm/` desde cero, pero antes **rescata el
campo `educativo` y el código CIE-11 de cada ficha** y se los devuelve al
terminar. Puedes reconvertir tantas veces como quieras sin perder flashcards,
preguntas, casos ni algoritmos escritos a mano. El informe te dice cuántos
elementos ha conservado.

### Atajos de teclado

| Tecla | Dónde | Qué hace |
| --- | --- | --- |
| `/` | En cualquier sitio | Ir al buscador |
| `Esc` | Buscador, cajón lateral | Vaciar o cerrar |
| `↑` `↓` | Árbol, resultados, flashcards | Moverse |
| `→` `←` | Árbol | Desplegar / plegar |
| `Inicio` `Fin` | Árbol | Primer / último elemento |
| `Enter` | Árbol, resultados | Abrir |
| `Espacio` | Flashcards | Voltear la tarjeta |
| `Alt`+`←` `→` | Ficha de trastorno | Trastorno anterior / siguiente |

## Estructura de datos

```
public/dsm/
  index.json                              ← las 18 categorías de la Sección II
  trastornos-del-neurodesarrollo/
    index.json                            ← árbol de la categoría (carga diferida)
    trastorno-del-lenguaje.json
    …
```

`src/lib/schema.ts` es la única definición de la forma de los datos. El conversor
valida contra ella antes de escribir, así que nunca se genera un JSON inválido.

## Reglas del proyecto

1. **El conversor no genera contenido clínico.** Solo reestructura lo que hay en
   el markdown de origen. Un campo que la fuente no proporciona queda vacío o con
   `[PENDIENTE]`.
2. **Nada se pierde en silencio.** Toda decisión no trivial se registra en el
   informe y, cuando afecta a un trastorno concreto, también en el campo
   `advertencias` de su JSON.
3. **El contenido educativo (`educativo.*`) siempre nace vacío.** Lo escribe la
   persona usuaria. Cada elemento lleva `fuente` y `validado: boolean`; los que
   tengan `validado: false` reciben un tratamiento visual distinto en pantalla.
4. **Tres tratamientos visuales inconfundibles** sin leer etiquetas: contenido
   oficial, educativo validado y educativo sin validar. Por canales redundantes
   (familia tipográfica, filete lateral, sangría, trama), nunca solo por color.

## Añadir una categoría nueva

1. Crear `scripts/capitulos/<nombre>.ts` con el manifiesto (índice declarado del
   capítulo: subcategorías, trastornos, variantes tipográficas del encabezado y
   sinónimos con su línea de origen).
2. Añadirlo a `CAPITULOS` en `scripts/capitulos/registro.ts`.
3. `npm run check`.

No hay que tocar el conversor.
