import { Link } from "react-router-dom";
import { IconHeart, IconPlus, IconStar } from "./icons.jsx";

export function Poster({ src, alt }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface p-3 text-center text-xs text-muted">
        Sin póster
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />;
}

/**
 * Tarjeta de póster. Lo único protagonista es la imagen: sin borde, sin fondo
 * de tarjeta y sin sombra. Debajo, el título y una línea de metadatos.
 *
 * Al pasar el cursor el póster sube 2px y aparecen las dos acciones (favorito
 * y guardar). No hacen la mutación aquí: llevan al detalle, que es donde la
 * app ya sabe si el título está en tu lista. El tipo no se muestra porque cada
 * sección y cada filtro ya lo dicen.
 */
export function TitleCard({ title }) {
  const href = `/titulo/${title.source}/${title.externalId}`;
  const hasScore = typeof title.score === "number";

  return (
    <Link to={href} className="group block">
      <div className="relative overflow-hidden rounded-lg bg-surface transition-transform group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5">
        <div className="aspect-[2/3] w-full">
          <Poster src={title.posterUrl} alt={`Póster de ${title.title}`} />
        </div>

        <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg/75 text-text">
            <IconHeart className="h-5 w-5" />
            <span className="sr-only">Marcar como favorito</span>
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg/75 text-text">
            <IconPlus className="h-5 w-5" />
            <span className="sr-only">Guardar en mi lista</span>
          </span>
        </div>
      </div>

      <p className="mt-2 truncate text-sm font-medium">{title.title}</p>

      {title.year || hasScore ? (
        <p className="meta mt-1 flex items-center gap-1.5">
          {title.year ? <span>{title.year}</span> : null}
          {title.year && hasScore ? <span aria-hidden="true">·</span> : null}
          {hasScore ? (
            <>
              <IconStar filled className="h-3 w-3 text-rating" />
              {title.score.toFixed(1)}
            </>
          ) : null}
        </p>
      ) : null}
    </Link>
  );
}

export function TitleGrid({ titles, emptyMessage = "Sin títulos por aquí." }) {
  if (!titles || titles.length === 0) {
    return <p className="py-16 text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {titles.map((title) => (
        <TitleCard key={`${title.source}-${title.externalId}`} title={title} />
      ))}
    </div>
  );
}
