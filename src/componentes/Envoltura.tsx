/**
 * Envoltura visual del contenido que añade la persona usuaria.
 *
 * Los tres tratamientos son inconfundibles sin leer ninguna etiqueta porque no
 * dependen del color: cambian la familia tipográfica, el filete lateral, la
 * sangría y la trama de fondo a la vez.
 */

import { CircleCheck, CircleDashed } from 'lucide-react';

export function EnvolturaPropia({
  validado,
  children,
  etiqueta,
  alAlternar,
}: {
  validado: boolean;
  children: React.ReactNode;
  etiqueta?: string;
  alAlternar?: () => void;
}) {
  return (
    <div className={validado ? 'propio' : 'propio-sin-validar'}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <IndicadorValidado validado={validado} alAlternar={alAlternar} />
        {etiqueta && (
          <span className="text-[0.6875rem] uppercase tracking-wide text-texto-tenue">
            {etiqueta}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Indicador de validación. Cuando el elemento está validado desaparece: no se
 * sustituye por una marca verde, simplemente deja de haber aviso.
 */
export function IndicadorValidado({
  validado,
  alAlternar,
}: {
  validado: boolean;
  alAlternar?: () => void;
}) {
  if (validado) {
    if (!alAlternar) return null;
    return (
      <button
        type="button"
        onClick={alAlternar}
        aria-pressed={true}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[0.6875rem] text-texto-tenue transition hover:bg-fondo-hover hover:text-texto-suave"
        title="Marcar como no validado"
      >
        <CircleCheck className="h-3 w-3" aria-hidden="true" />
        validado
      </button>
    );
  }

  const contenido = (
    <>
      <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
      Sin validar
    </>
  );

  if (!alAlternar) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-[0.6875rem] font-medium"
        style={{ color: 'var(--sin-validar)', borderColor: 'var(--sin-validar)' }}
      >
        {contenido}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={alAlternar}
      aria-pressed={false}
      title="Marcar como validado"
      className="inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-[0.6875rem] font-medium transition hover:bg-fondo-hover"
      style={{ color: 'var(--sin-validar)', borderColor: 'var(--sin-validar)' }}
    >
      {contenido}
    </button>
  );
}
