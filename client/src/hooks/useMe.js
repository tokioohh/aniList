import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../api/auth.api.js";
import { ApiError } from "../api/http.js";

/**
 * Única fuente de verdad sobre la sesión: GET /api/auth/me.
 * Un 401 significa "sin sesión" y no es un error que haya que mostrar.
 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });
}

export function useIsLoggedIn() {
  const { data, isLoading } = useMe();
  return { isLoggedIn: Boolean(data?.user), user: data?.user ?? null, isLoading };
}

export function useIsUnauthenticatedError(error) {
  return error instanceof ApiError && error.status === 401;
}