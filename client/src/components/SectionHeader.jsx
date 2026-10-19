/**
 * Cabecera de sección: título de 20px/600 y, a la derecha, la acción (por
 * defecto "Ver todo"). Sin filetes ni barras de color.
 */
export function SectionHeader({ title, action }) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4">
      <h2 className="text-xl font-semibold leading-[1.15] tracking-[-0.02em]">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
