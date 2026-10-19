/**
 * Estados de carga, error y vacío compartidos. Cada pantalla los usa para que
 * la interfaz siempre diga qué está pasando y qué hacer al respecto.
 *
 * El estado vacío no va en una caja: el vacío se explica con texto y aire.
 */
import { IconInfo } from "./icons.jsx";

export function Spinner({ label = "Cargando", hint }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted" role="status">
      <span className="flex items-center gap-3">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent"
          aria-hidden="true"
        />
        <span className="text-sm">{label}…</span>
      </span>
      {hint ? <p className="measure text-center text-xs">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ title = "Algo salió mal", message, onRetry }) {
  return (
    <div className="surface flex flex-col items-start gap-3 p-6" role="alert">
      <p className="flex items-center gap-2 text-base font-semibold">
        <IconInfo className="h-5 w-5 text-muted" />
        {title}
      </p>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {onRetry ? (
        <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
          Intentar de nuevo
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="text-xl font-semibold leading-[1.15] tracking-[-0.02em]">{title}</p>
      {message ? <p className="measure text-sm text-muted">{message}</p> : null}
      {action}
    </div>
  );
}
