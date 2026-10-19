import { useState } from "react";
import { Link } from "react-router-dom";
import { useMyList } from "../hooks/useList.js";
import { useUpdateEntry, useDeleteEntry } from "../hooks/useListMutations.js";
import { Spinner, ErrorState, EmptyState } from "../components/States.jsx";
import { SectionHeader } from "../components/SectionHeader.jsx";
import { RatingInput } from "../components/RatingInput.jsx";
import { StatusSelect, ReactionToggle, FavoriteButton } from "../components/ListControls.jsx";
import { ConfirmDialog, Pagination } from "../components/Dialog.jsx";
import { Poster } from "../components/TitleCard.jsx";
import { STATUS_LABELS } from "../schemas/list.schema.js";
import { IconHeart, IconStar, IconTrash } from "../components/icons.jsx";

const FILTERS = [
  { key: "ALL", label: "Todos" },
  { key: "favorite", label: "Favoritos" },
  { key: "LIKED", label: "Me gustó" },
  { key: "DISLIKED", label: "No me gustó" },
  { key: "PLAN_TO_WATCH", label: "Pendientes" },
  { key: "WATCHING", label: "Viendo" },
  { key: "COMPLETED", label: "Terminados" },
];

/** Traduce la pestaña activa a los queryparams que entiende el servidor. */
function filtersToQuery(filter) {
  if (filter === "ALL") return {};
  if (filter === "favorite") return { favorite: "true" };
  if (filter === "LIKED" || filter === "DISLIKED") return { reaction: filter };
  return { status: filter };
}

function EntryRow({ entry, onDelete, isEditing, onToggleEdit }) {
  const source = entry.title.source;
  const externalId = entry.title.externalId;
  const update = useUpdateEntry(source, externalId);

  const href = `/titulo/${source}/${externalId}`;

  return (
    <article className="flex gap-4 border-b border-line pb-6 last:border-b-0 sm:gap-6">
      <Link to={href} className="w-20 shrink-0 overflow-hidden rounded-lg sm:w-24">
        <div className="aspect-[2/3]">
          <Poster src={entry.title.posterUrl} alt={`Póster de ${entry.title.title}`} />
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={href} className="text-sm font-semibold transition-colors hover:text-accent">
              {entry.title.title}
            </Link>

            <p className="meta mt-1 flex flex-wrap items-center gap-1.5">
              {entry.title.year ? <span>{entry.title.year}</span> : null}
              {entry.title.year ? <span aria-hidden="true">·</span> : null}
              <span>{STATUS_LABELS[entry.status]}</span>
              {entry.isFavorite ? (
                <>
                  <span aria-hidden="true">·</span>
                  <IconHeart filled className="h-3 w-3 text-accent" />
                  <span className="sr-only">Es favorito</span>
                </>
              ) : null}
              {entry.rating ? (
                <>
                  <span aria-hidden="true">·</span>
                  <IconStar filled className="h-3 w-3 text-rating" />
                  <span className="text-rating">{entry.rating}/10</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className="btn-ghost" onClick={() => onToggleEdit(entry.id)}>
              {isEditing ? "Cancelar" : "Editar"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-muted transition-colors hover:text-danger"
              onClick={() => onDelete(entry)}
              aria-label={`Quitar ${entry.title.title} de tu lista`}
            >
              <IconTrash />
            </button>
          </div>
        </div>

        {entry.review ? <p className="line-clamp-2 text-sm text-muted">“{entry.review}”</p> : null}

        {isEditing ? (
          <div className="mt-2 space-y-5 border-t border-line pt-5">
            <StatusSelect
              value={entry.status}
              onChange={(status) => update.mutate({ id: entry.id, status })}
              disabled={update.isPending}
            />
            <ReactionToggle
              value={entry.reaction}
              onChange={(reaction) => update.mutate({ id: entry.id, reaction })}
              disabled={update.isPending}
            />
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px] flex-1">
                <RatingInput
                  value={entry.rating}
                  onChange={(rating) => update.mutate({ id: entry.id, rating })}
                  disabled={update.isPending}
                />
              </div>
              <FavoriteButton
                value={entry.isFavorite}
                onChange={(isFavorite) => update.mutate({ id: entry.id, isFavorite })}
                disabled={update.isPending}
              />
            </div>
            {update.isError ? (
              <p role="alert" className="text-sm text-danger">
                {update.error.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function MyList() {
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const filters = filtersToQuery(filter);
  const { data, isPending, isError, error, refetch } = useMyList({ ...filters, page, limit: 20 });

  const remove = useDeleteEntry(toDelete?.title.source, toDelete?.title.externalId);

  const items = data?.items ?? [];

  const changeFilter = (key) => {
    setFilter(key);
    setPage(1);
    setEditingId(null);
  };

  return (
    <div className="space-y-8">
      <SectionHeader title="Mi lista" />

      <div
        className="scroll-x -mx-1 flex gap-6 overflow-x-auto px-1"
        role="group"
        aria-label="Filtrar mi lista"
      >
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => changeFilter(item.key)}
            className={`tab ${filter === item.key ? "tab-active" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isPending ? <Spinner label="Cargando tu lista" /> : null}

      {isError ? (
        <ErrorState
          title="No pudimos cargar tu lista"
          message={error?.message ?? "Inténtalo de nuevo."}
          onRetry={() => refetch()}
        />
      ) : null}

      {data && items.length === 0 ? (
        <EmptyState
          title="Aquí todavía no hay nada."
          message="Marca un título con el corazón y aparecerá en esta lista con su estado, tu reacción y tu calificación."
          action={
            <Link to="/explorar" className="btn-primary mt-2">
              Explorar catálogo
            </Link>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-6">
          {items.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              isEditing={editingId === entry.id}
              onToggleEdit={(id) => setEditingId((current) => (current === id ? null : id))}
              onDelete={setToDelete}
            />
          ))}
        </div>
      ) : null}

      {data ? (
        <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
      ) : null}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="¿Quitar de tu lista?"
        message={toDelete ? `Se borrará "${toDelete.title.title}" y tu reseña.` : ""}
        confirmLabel="Quitar"
        busy={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          remove.mutate(toDelete.id, {
            onSuccess: () => setToDelete(null),
            onError: () => setToDelete(null),
          })
        }
      />
    </div>
  );
}
