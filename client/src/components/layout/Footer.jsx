import { Link } from "react-router-dom";
import { useIsLoggedIn } from "../../hooks/useMe.js";
import { useLogout } from "../../hooks/useAuthMutations.js";
import tmdbLogo from "../../assets/tmdb-logo.svg";

/**
 * Pie sobrio: la atribución de TMDB es obligatoria, pero no necesita centro ni
 * caja. Todo alineado a la izquierda, como el resto de los bloques de texto.
 */
export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-4 px-4 py-10">
        <Link to="/" className="text-sm font-semibold tracking-[-0.02em]">
          AniList
        </Link>

        <img src={tmdbLogo} alt="TMDB" className="h-5 w-auto opacity-60" loading="lazy" />

        <p className="measure text-xs text-muted">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
          <br />
          Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
        </p>

        <p className="measure text-xs text-muted">
          Los datos de anime llegan de una API de esquema compatible con Jikan, no oficial de
          MyAnimeList.
        </p>

        <nav className="flex gap-6 pt-2 text-sm text-muted">
          <Link to="/" className="transition-colors hover:text-text">
            Inicio
          </Link>
          <Link to="/explorar" className="transition-colors hover:text-text">
            Explorar
          </Link>
          <Link to="/acerca" className="transition-colors hover:text-text">
            Acerca de
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** Cierre de sesión en la página de perfil. */
export function LogoutButton({ className = "btn-secondary" }) {
  const { isLoggedIn } = useIsLoggedIn();
  const logout = useLogout();

  if (!isLoggedIn) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
    >
      {logout.isPending ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
