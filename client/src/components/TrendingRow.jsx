import { Link } from "react-router-dom";
import { useTrending } from "../hooks/useCatalog.js";
import { SectionHeader } from "./SectionHeader.jsx";
import { TitleGrid } from "./TitleCard.jsx";
import { Spinner, ErrorState } from "./States.jsx";

/**
 * Fila de tendencias reutilizable. Cada fila es independiente: una fuente caída
 * muestra su propio error sin arrastrar a las demás.
 */
export function TrendingRow({ title, type, to }) {
  const { data, isPending, isError, error, refetch } = useTrending(type);

  return (
    <section>
      <SectionHeader
        title={title}
        action={
          <Link to={to} className="text-sm text-muted transition-colors hover:text-text">
            Ver todo
          </Link>
        }
      />

      {isPending ? <Spinner label={`Cargando ${title.toLowerCase()}`} /> : null}

      {isError ? (
        <ErrorState
          title={`No pudimos cargar ${title.toLowerCase()}`}
          message={error?.message ?? "El servicio externo no respondió."}
          onRetry={() => refetch()}
        />
      ) : null}

      {data ? <TitleGrid titles={data.results} /> : null}
    </section>
  );
}
