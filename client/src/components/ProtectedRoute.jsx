import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIsLoggedIn } from "../hooks/useMe.js";
import { Spinner } from "./States.jsx";

/**
 * Rutas protegidas. La sesión se determina solo con useQuery(["me"]) sobre
 * GET /api/auth/me: no hay estado global de autenticación que se pueda desincronizar.
 * Si no hay sesión, se redirige a /login guardando la ruta de origen.
 */
export function ProtectedRoute() {
  const { isLoggedIn, isLoading } = useIsLoggedIn();
  const location = useLocation();

  if (isLoading) return <Spinner label="Comprobando tu sesión" />;

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}