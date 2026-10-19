import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSearch } from "../hooks/useCatalog.js";
import { TitleGrid } from "../components/TitleCard.jsx";
import { Spinner, ErrorState, EmptyState } from "../components/States.jsx";
import { IconSearch } from "../components/icons.jsx";

const TYPES = [
  { value: "ALL", label: "Todos" },
  { value: "ANIME", label: "Anime" },
  { value: "MOVIE", label: "Películas" },
  { value: "SERIES", label: "Series" },
];

export function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);

  const type = searchParams.get("type") ?? "ALL";

  const { data, isPending, isError, error, isFetching, refetch } = useSearch({ q: term, type, page });

  const changeType = (nextType) => {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (nextType === "ALL") params.delete("type");
    else params.set("type", nextType);
    setSearchParams(params, { replace: true });
  };

  const results = data?.results ?? [];
  const canSearch = term.trim().length >= 2;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">Explorar</h1>

      {/* El buscador y las pestañas no van en una caja: el aire los separa. */}
      <div className="space-y-6">
        <div className="relative max-w-md">
          <IconSearch
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Cowboy Bebop, Attack on Titan…"
            aria-label="Buscar títulos"
            className="field-input h-10 pl-11"
          />
        </div>

        <div
          className="scroll-x -mx-1 flex gap-6 overflow-x-auto px-1"
          role="group"
          aria-label="Filtrar por tipo"
        >
          {TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={type === item.value}
              onClick={() => changeType(item.value)}
              className={`tab ${type === item.value ? "tab-active" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!canSearch ? (
        <EmptyState
          title="Busca algo que quieras ver"
          message="Escribe al menos dos caracteres. Buscamos en anime, películas y series al mismo tiempo."
        />
      ) : null}

      {canSearch && isPending ? <Spinner label="Buscando" /> : null}

      {canSearch && isError ? (
        <ErrorState
          title="No pudimos completar la búsqueda"
          message={error?.message ?? "El servicio externo no respondió."}
          onRetry={() => refetch()}
        />
      ) : null}

      {canSearch && data ? (
        <section className={isFetching ? "opacity-60 transition-opacity" : undefined}>
          <p className="meta mb-4">
            {results.length} resultado{results.length === 1 ? "" : "s"}
            {data.hasMore ? " · hay más" : ""}
          </p>

          <TitleGrid titles={results} emptyMessage="No encontramos nada con ese texto." />

          <nav className="mt-12 flex items-center justify-center gap-4" aria-label="Paginación">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className="meta">Página {page}</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPage((value) => value + 1)}
              disabled={!data.hasMore}
            >
              Siguiente
            </button>
          </nav>
        </section>
      ) : null}
    </div>
  );
}
