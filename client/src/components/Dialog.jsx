import { useEffect, useRef } from "react";

/** Confirmación antes de una acción destructiva (quitar de la lista). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Quitar",
  onConfirm,
  onCancel,
  busy,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="surface w-full max-w-sm p-6"
      >
        <h2 id="confirm-title" className="text-xl font-semibold leading-[1.15] tracking-[-0.02em]">
          {title}
        </h2>
        {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Quitando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pagination({ page, limit, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;

  return (
    <nav className="mt-12 flex items-center justify-center gap-4" aria-label="Paginación">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
      >
        Anterior
      </button>
      <span className="meta">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
      >
        Siguiente
      </button>
    </nav>
  );
}
