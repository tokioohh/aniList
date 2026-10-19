import { Link, NavLink } from "react-router-dom";
import { IconHome, IconSearch, IconList, IconUser } from "../icons.jsx";

export const NAV_ITEMS = [
  { to: "/", label: "Inicio", Icon: IconHome },
  { to: "/explorar", label: "Explorar", Icon: IconSearch },
  { to: "/mi-lista", label: "Mi lista", Icon: IconList },
  { to: "/perfil", label: "Perfil", Icon: IconUser },
];

// En escritorio el logo ya es "Inicio", así que la barra muestra los otros tres.
const DESKTOP_LINKS = NAV_ITEMS.slice(1);

export function Navbar({ isLoggedIn }) {
  return (
    <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-8 px-4">
        <Link
          to="/"
          className="text-xl font-semibold leading-none tracking-[-0.02em]"
        >
          AniList
        </Link>

        <nav className="hidden h-full items-center gap-6 md:flex" aria-label="Principal">
          {DESKTOP_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-5 md:flex">
          {isLoggedIn ? (
            <Link
              to="/perfil"
              className="inline-flex min-h-11 items-center text-sm text-muted transition-colors hover:text-text"
            >
              Mi cuenta
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center text-sm text-muted transition-colors hover:text-text"
              >
                Iniciar sesión
              </Link>
              <Link to="/registro" className="btn-primary">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Barra inferior de la versión móvil. Aquí sí se repiten los cuatro destinos:
 * en pantallas pequeñas el logo es un objetivo demasiado pequeño y la barra
 * funciona como navegación principal. En lugar del subrayado (que en una
 * barra inferior se lee mal) el activo cambia de color.
 */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-bg/95 backdrop-blur md:hidden"
      aria-label="Navegación"
    >
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            [
              "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              isActive ? "text-text" : "text-muted",
            ].join(" ")
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
