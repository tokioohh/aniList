import { useId } from "react";

/**
 * Campo de formulario con label asociado y error accesible:
 * aria-invalid + aria-describedby apuntan al mensaje, para que los lectores
 * de pantalla anuncien el problema.
 */
export function FormField({
  label,
  error,
  hint,
  type = "text",
  autoComplete,
  inputMode,
  className = "",
  ...props
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        className="field-input h-10"
        {...props}
      />
      {hint ? (
        <p id={hintId} className="mt-2 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormArea({ label, error, rows = 5, maxLength, value, ...props }) {
  const id = useId();
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span id={counterId} className="meta">
          {value?.length ?? 0} / {maxLength ?? 2000}
        </span>
      </div>
      <textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={[error ? errorId : null, counterId].filter(Boolean).join(" ")}
        className="field-input resize-y py-3"
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
