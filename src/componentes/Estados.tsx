/**
 * Los cuatro estados que debe manejar todo componente que carga datos.
 * Están aquí juntos para que no se resuelvan «al final» ni de forma distinta
 * en cada pantalla.
 */

import { AlertTriangle, FileQuestion, Inbox, RotateCw, SearchX } from 'lucide-react';
import type { ErrorDeCarga } from '@/lib/loader';

/* ------------------------------------------------------------------ */
/* 1 · Cargando                                                        */
/* ------------------------------------------------------------------ */

/**
 * Esqueleto de contenido en lugar de un indicador giratorio: mantiene la altura
 * y evita el salto de maquetación al llegar los datos.
 */
export function Cargando({ lineas = 5, etiqueta = 'Cargando…' }: { lineas?: number; etiqueta?: string }) {
  return (
    <div role="status" aria-live="polite" className="w-full max-w-lectura">
      <span className="sr-only">{etiqueta}</span>
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="h-5 w-2/5 rounded bg-fondo-sutil" />
        {Array.from({ length: lineas }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 rounded bg-fondo-sutil"
            style={{ width: `${[100, 96, 99, 88, 94, 97, 72][i % 7]}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Vacío (no hay nada que mostrar todavía)                          */
/* ------------------------------------------------------------------ */

export function Vacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-borde bg-fondo-sutil/50 px-5 py-6">
      <Inbox className="h-5 w-5 text-texto-tenue" aria-hidden="true" />
      <p className="font-medium text-texto">{titulo}</p>
      {descripcion && <p className="max-w-lectura text-sm text-texto-suave">{descripcion}</p>}
      {accion}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · Sin resultados (hay datos, pero el filtro no devuelve nada)      */
/* ------------------------------------------------------------------ */

export function SinResultados({
  consulta,
  sugerencia,
  accion,
}: {
  consulta?: string;
  sugerencia?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-start gap-2 rounded-md border border-borde px-5 py-6"
    >
      <SearchX className="h-5 w-5 text-texto-tenue" aria-hidden="true" />
      <p className="font-medium text-texto">
        {consulta ? (
          <>
            Sin resultados para <span className="font-semibold">«{consulta}»</span>
          </>
        ) : (
          'Sin resultados'
        )}
      </p>
      <p className="max-w-lectura text-sm text-texto-suave">
        {sugerencia ?? 'Prueba con menos palabras, con el código CIE o con un sinónimo.'}
      </p>
      {accion}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4 · Error de carga                                                  */
/* ------------------------------------------------------------------ */

/**
 * En una aplicación sin servidor el fallo más frecuente es un JSON mal formado.
 * Aquí se dice qué archivo es y, si el problema es de esquema, la ruta exacta
 * del campo. Nunca una pantalla en blanco.
 */
export function ErrorCarga({
  error,
  reintentar,
}: {
  error: ErrorDeCarga;
  reintentar?: () => void;
}) {
  return (
    <div
      role="alert"
      className="max-w-lectura rounded-md border border-peligro/40 bg-peligro-suave px-5 py-4"
      style={{ backgroundColor: 'var(--peligro-suave)' }}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ color: 'var(--peligro)' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-texto">{error.titulo}</p>

          <p className="mt-1.5 break-all font-mono text-[0.8125rem] text-texto-suave">
            public/dsm/{error.archivo}
          </p>

          <p className="mt-2 text-sm text-texto">{error.message}</p>

          {error.detalles.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-borde pt-3">
              {error.detalles.map((detalle, i) => (
                <li key={i} className="text-sm">
                  <code className="font-mono text-[0.8125rem]" style={{ color: 'var(--peligro)' }}>
                    {detalle.ruta}
                  </code>
                  <span className="text-texto-suave"> — {detalle.mensaje}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-sm text-texto-suave">{error.pista}</p>

          {reintentar && (
            <button
              type="button"
              onClick={reintentar}
              className="mt-3 inline-flex items-center gap-1.5 rounded border border-borde-fuerte bg-fondo-elevado px-3 py-1.5 text-sm font-medium text-texto transition hover:bg-fondo-hover"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Volver a intentarlo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Extra · Recurso no encontrado (ruta inválida)                       */
/* ------------------------------------------------------------------ */

export function NoEncontrado({ que, detalle }: { que: string; detalle?: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-borde px-5 py-6">
      <FileQuestion className="h-5 w-5 text-texto-tenue" aria-hidden="true" />
      <p className="font-medium text-texto">No se encontró {que}.</p>
      {detalle && <p className="max-w-lectura text-sm text-texto-suave">{detalle}</p>}
    </div>
  );
}
