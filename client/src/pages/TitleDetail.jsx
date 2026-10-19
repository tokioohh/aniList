import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTitleDetail } from "../hooks/useCatalog.js";
import { useIsLoggedIn } from "../hooks/useMe.js";
import { useCreateEntry, useUpdateEntry, useDeleteEntry } from "../hooks/useListMutations.js";
import { Spinner, ErrorState } from "../components/States.jsx";
import { RatingInput } from "../components/RatingInput.jsx";
import { StatusSelect, ReactionToggle, FavoriteButton } from "../components/ListControls.jsx";
import { FormArea } from "../components/FormField.jsx";
import { ConfirmDialog } from "../components/Dialog.jsx";
import { Poster } from "../components/TitleCard.jsx";
import { IconStar, IconBack, IconTrash } from "../components/icons.jsx";

const EMPTY_FORM = {
  status: "PLAN_TO_WATCH",
  reaction: null,
  isFavorite: false,
  rating: null,
  review: "",
};

export function TitleDetail() {
  const { source, externalId } = useParams();
  const navigate = useNavigate();

  const { isLoggedIn } = useIsLoggedIn();
  const { data: title, isPending, isError, error, refetch } = useTitleDetail(source, externalId);

  const create = useCreateEntry(source, externalId);
  const update = useUpdateEntry(source, externalId);
  const remove = useDeleteEntry(source, externalId);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const myEntry = title?.myEntry ?? null;

  // Si myEntry existe, el formulario entra en modo edición.
  useEffect(() => {
    if (!myEntry) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      status: myEntry.status,
      reaction: myEntry.reaction ?? null,
      isFavorite: myEntry.isFavorite,
      rating: myEntry.rating ?? null,
      review: myEntry.review ?? "",
    });
  }, [myEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const busy = create.isPending || update.isPending;
  const mutationError = create.error ?? update.error;

  function onSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const payload = {
      status: form.status,
      reaction: form.reaction,
      isFavorite: form.isFavorite,
      rating: form.rating,
      review: form.review?.trim() ? form.review.trim() : null,
    };

    if (myEntry) {
      update.mutate({ id: myEntry.id, ...payload }, { onError: setFormError });
    } else {
      create.mutate({ source, externalId: Number(externalId), ...payload }, { onError: setFormError });
    }
  }

  if (isPending) {
    return (
      <Spinner
        label="Cargando título"
        hint="Consultamos la fuente del título. Si tarda es porque el servicio externo va lento: el servidor reintenta hasta tres veces antes de rendirse."
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={error?.status === 404 ? "Ese título no existe" : "No pudimos cargar el título"}
        message={error?.message ?? "Inténtalo de nuevo."}
        onRetry={error?.status === 404 ? undefined : () => refetch()}
      />
    );
  }

  const hasScore = typeof title.score === "number";

  return (
    <div className="space-y-12">
      <button type="button" onClick={() => navigate(-1)} className="btn-ghost -ml-2">
        <IconBack className="h-4 w-4" />
        Volver
      </button>

      <div className="grid gap-8 md:grid-cols-[minmax(0,260px)_1fr] md:gap-12">
        <div className="mx-auto w-44 md:mx-0 md:w-full">
          <div className="overflow-hidden rounded-lg">
            <div className="aspect-[2/3]">
              <Poster src={title.posterUrl} alt={`Póster de ${title.title}`} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <header className="space-y-3">
            <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
              {title.title}
            </h1>

            {title.year || hasScore ? (
              <p className="meta flex items-center gap-1.5 text-sm">
                {title.year ? <span>{title.year}</span> : null}
                {title.year && hasScore ? <span aria-hidden="true">·</span> : null}
                {hasScore ? (
                  <>
                    <IconStar filled className="h-4 w-4 text-rating" />
                    <span className="text-rating">{title.score.toFixed(1)}</span>
                    <span className="text-muted">de la comunidad</span>
                  </>
                ) : (
                  <span className="text-muted">Sin puntuación</span>
                )}
              </p>
            ) : null}

            {title.genres?.length ? (
              <p className="text-sm text-muted">{title.genres.join(" · ")}</p>
            ) : null}
          </header>

          {title.synopsis ? (
            <p className="measure text-base text-muted">{title.synopsis}</p>
          ) : (
            <p className="text-sm text-muted">Esta fuente no trae sinopsis para este título.</p>
          )}
        </div>
      </div>

      {/* ---- Formulario de mi lista ---- */}
      <section className="surface p-6">
        <h2 className="text-xl font-semibold leading-[1.15] tracking-[-0.02em]">
          {myEntry ? "En tu lista" : "Guardar en mi lista"}
        </h2>

        {!isLoggedIn ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Inicia sesión para guardar este título y calificarlo.
            </p>
            <Link to="/login" className="btn-primary">
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <StatusSelect
                value={form.status}
                onChange={(value) => set({ status: value })}
                disabled={busy}
              />
              <FavoriteButton
                value={form.isFavorite}
                onChange={(value) => set({ isFavorite: value })}
                disabled={busy}
              />
            </div>

            <ReactionToggle
              value={form.reaction}
              onChange={(value) => set({ reaction: value })}
              disabled={busy}
            />

            <RatingInput
              value={form.rating}
              onChange={(value) => set({ rating: value })}
              disabled={busy}
            />

            <FormArea
              label="Tu reseña"
              value={form.review}
              maxLength={2000}
              placeholder="¿Qué te pareció? Cuéntalo como se lo contarías a un amigo."
              onChange={(event) => set({ review: event.target.value })}
              disabled={busy}
            />

            {(formError || mutationError) && !mutationError?.fieldErrors ? (
              <p role="alert" className="text-sm text-danger">
                {(formError ?? mutationError).message}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Guardando…" : myEntry ? "Guardar cambios" : "Guardar en mi lista"}
              </button>

              {myEntry ? (
                <button
                  type="button"
                  className="btn-secondary text-danger"
                  onClick={() => setConfirmOpen(true)}
                  disabled={remove.isPending}
                >
                  <IconTrash />
                  Quitar de mi lista
                </button>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Quitar de tu lista?"
        message={`Se borrará "${title.title}" junto con tu calificación y tu reseña. No se puede deshacer.`}
        confirmLabel="Quitar"
        busy={remove.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          remove.mutate(myEntry.id, {
            onSuccess: () => setConfirmOpen(false),
            onError: () => setConfirmOpen(false),
          })
        }
      />
    </div>
  );
}
