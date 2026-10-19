import { STATUS_LABELS } from "../schemas/list.schema.js";
import { IconThumbUp, IconThumbDown, IconHeart } from "./icons.jsx";

export function StatusSelect({ value, onChange, disabled = false }) {
  return (
    <div>
      <label htmlFor="status-select" className="mb-2 block text-sm font-medium">
        Estado
      </label>
      <select
        id="status-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        // Los <option> heredan el fondo del sistema: se fuerzan a la superficie
        // para que el desplegable no aparezca blanco sobre el tema oscuro.
        className="field-input h-10 [&>option]:bg-surface [&>option]:text-text"
      >
        {Object.entries(STATUS_LABELS).map(([value_, label]) => (
          <option key={value_} value={value_}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Me gusta / No me gusta: elegir el mismo lo desactiva. */
export function ReactionToggle({ value, onChange, disabled = false }) {
  const options = [
    { key: "LIKED", label: "Me gusta", Icon: IconThumbUp },
    { key: "DISLIKED", label: "No me gusta", Icon: IconThumbDown },
  ];

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Tu reacción</legend>
      <div className="flex gap-2">
        {options.map(({ key, label, Icon }) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(selected ? null : key)}
              aria-pressed={selected}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                selected ? "border-accent" : "border-line hover:text-text"
              } ${selected ? "text-text" : "text-muted"}`}
            >
              <Icon filled={selected} className={`h-4 w-4 ${selected ? "text-accent" : ""}`} />
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FavoriteButton({ value, onChange, disabled = false }) {
  const selected = Boolean(value);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!selected)}
      aria-pressed={selected}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
        selected ? "border-accent text-text" : "border-line text-muted hover:text-text"
      }`}
    >
      <IconHeart filled={selected} className={`h-4 w-4 ${selected ? "text-accent" : ""}`} />
      {selected ? "En favoritos" : "Marcar como favorito"}
    </button>
  );
}
