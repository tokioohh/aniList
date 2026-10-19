import { useIsLoggedIn } from "../hooks/useMe.js";
import { useStats } from "../hooks/useList.js";
import { Spinner, ErrorState } from "../components/States.jsx";
import { SectionHeader } from "../components/SectionHeader.jsx";
import { LogoutButton } from "../components/layout/Footer.jsx";
import { STATUS_LABELS } from "../schemas/list.schema.js";

/** Cifra grande: el tamaño hace el trabajo que antes hacía la caja. */
function Stat({ label, value, rating = false }) {
  return (
    <div>
      <p className="meta">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${rating ? "text-rating" : "text-text"}`}
      >
        {value}
      </p>
    </div>
  );
}

/** Fila etiqueta/número con filete: el borde solo aparece donde separa. */
function CountRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

function formatAverage(value) {
  return typeof value === "number" ? value.toFixed(1) : "—";
}

export function Stats() {
  const { user } = useIsLoggedIn();
  const { data, isPending, isError, error, refetch } = useStats();

  if (isPending) return <Spinner label="Calculando tus estadísticas" />;

  if (isError) {
    return (
      <ErrorState
        title="No pudimos calcular tus estadísticas"
        message={error?.message ?? "Inténtalo de nuevo."}
        onRetry={() => refetch()}
      />
    );
  }

  const typeLabels = {
    MOVIE: "Películas",
    SERIES: "Series",
    ANIME: "Anime",
  };

  return (
    <div className="space-y-20">
      <SectionHeader title="Perfil" />

      <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-xl font-semibold leading-[1.15] tracking-[-0.02em]">
            {user?.username}
          </p>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
          <p className="meta mt-2">
            Cuenta creada el {new Date(user?.createdAt ?? Date.now()).toLocaleDateString("es-MX")}
          </p>
        </div>
        <LogoutButton />
      </div>

      <section>
        <SectionHeader title="Resumen" />
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="En tu lista" value={data.total} />
          <Stat label="Favoritos" value={data.favorites} />
          <Stat label="Calificación media" value={formatAverage(data.avgRating)} rating />
          <Stat label="Me gustó" value={data.liked} />
          <Stat label="No me gustó" value={data.disliked} />
        </div>
      </section>

      <section>
        <SectionHeader title="Por estado" />
        <div>
          {Object.entries(data.byStatus).map(([status, count]) => (
            <CountRow key={status} label={STATUS_LABELS[status]} value={count} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Por tipo" />
        <div>
          {Object.entries(data.byType).map(([type, count]) => (
            <CountRow key={type} label={typeLabels[type] ?? type} value={count} />
          ))}
        </div>
      </section>
    </div>
  );
}
