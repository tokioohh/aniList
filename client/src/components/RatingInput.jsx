import { useId } from "react";

/**
 * Calificación de 1 a 10 dibujada como 10 barras: se lee de un vistazo en
 * móvil y es más precisa que cinco estrellas. Pulsar el valor activo la borra.
 * El dorado está reservado a la nota: es el único lugar de la interfaz que lo usa.
 */
export function RatingInput({ value, onChange, disabled = false }) {
  const groupId = useId();

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span id={groupId} className="text-sm font-medium">
          Tu calificación
        </span>
        <span className={`text-xs tabular-nums ${value ? "text-rating" : "text-muted"}`}>
          {value ? `${value} / 10` : "Sin calificar"}
        </span>
      </div>

      <div role="group" aria-labelledby={groupId} className="flex gap-1.5">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => {
          const isFilled = typeof value === "number" && number <= value;
          const isExact = value === number;
          return (
            <button
              key={number}
              type="button"
              disabled={disabled}
              onClick={() => onChange(isExact ? null : number)}
              aria-label={`Calificar con ${number}`}
              aria-pressed={isExact}
              className={`h-10 flex-1 rounded-lg transition-colors disabled:opacity-50 ${
                isFilled ? "bg-rating" : "bg-surface hover:bg-line"
              } ${isExact ? "outline-2 outline-offset-2 outline-rating" : ""}`}
            >
              <span className="sr-only">{number}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
