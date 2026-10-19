import { useQuery } from "@tanstack/react-query";
import { searchCatalog, fetchTrending, fetchTitleDetail } from "../api/catalog.api.js";
import { useDebounced } from "./useDebounced.js";
import { useIsLoggedIn } from "./useMe.js";

const MIN_CHARS = 2;

/** Tendencias. El catálogo se considera fresco 5-10 minutos. */
export function useTrending(type = "ANIME") {
  return useQuery({
    queryKey: ["catalog", "trending", type],
    queryFn: () => fetchTrending(type),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Búsqueda con debounce de 400 ms. Solo se dispara con 2 caracteres o más
 * para no gastar cuota de las APIs externas.
 */
export function useSearch({ q, type = "ALL", page = 1 }) {
  const debouncedQ = useDebounced(q.trim(), 400);
  const enabled = debouncedQ.length >= MIN_CHARS;

  return useQuery({
    queryKey: ["catalog", "search", { q: debouncedQ, type, page }],
    queryFn: () => searchCatalog({ q: debouncedQ, type, page }),
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous, // al paginar no parpadea la grilla
  });
}

/**
 * Detalle con myEntry (null si no hay sesión).
 * La sesión forma parte de la clave: al iniciar o cerrar sesión la consulta se
 * repite y además el detalle público nunca se mezcla con el de un usuario.
 */
export function useTitleDetail(source, externalId) {
  const { isLoggedIn } = useIsLoggedIn();

  return useQuery({
    queryKey: ["catalog", "detail", source, externalId, isLoggedIn],
    queryFn: () => fetchTitleDetail(source, externalId),
    enabled: Boolean(source && externalId),
    staleTime: 5 * 60 * 1000,
  });
}