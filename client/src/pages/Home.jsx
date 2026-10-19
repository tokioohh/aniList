import { Link } from "react-router-dom";
import { useIsLoggedIn } from "../hooks/useMe.js";
import { TrendingRow } from "../components/TrendingRow.jsx";

export function Home() {
  const { isLoggedIn } = useIsLoggedIn();

  return (
    <>
      {/* Sin caja, sin degradado y sin etiqueta: solo el mensaje y dos salidas. */}
      <section className="py-12 md:py-16">
        <h1 className="max-w-[18ch] text-4xl font-semibold leading-[1.15] tracking-[-0.02em]">
          Todo lo que ves, en un solo lugar.
        </h1>

        <p className="measure mt-4 text-base text-muted">
          Califica del 1 al 10, guarda favoritos y escribe reseñas.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-5">
          {isLoggedIn ? (
            <>
              <Link to="/mi-lista" className="btn-primary">
                Ir a mi lista
              </Link>
              <Link
                to="/explorar"
                className="inline-flex min-h-11 items-center text-sm font-medium text-accent transition-colors hover:underline"
              >
                Explorar catálogo
              </Link>
            </>
          ) : (
            <>
              <Link to="/registro" className="btn-primary">
                Crear cuenta
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center text-sm font-medium text-accent transition-colors hover:underline"
              >
                Ya tengo cuenta
              </Link>
            </>
          )}
        </div>
      </section>

      {/* 80px entre secciones, 16px dentro de cada una. */}
      <div className="mt-20 space-y-20">
        <TrendingRow title="Anime en tendencia" type="ANIME" to="/explorar?type=ANIME" />
        <TrendingRow title="Películas en tendencia" type="MOVIE" to="/explorar?type=MOVIE" />
        <TrendingRow title="Series en tendencia" type="SERIES" to="/explorar?type=SERIES" />
      </div>
    </>
  );
}
