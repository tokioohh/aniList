import { LRUCache } from "lru-cache";
import { resetCircuits } from "./circuitBreaker.js";

const TEN_MINUTES = 10 * 60 * 1000;

// Caché LRU solo para datos EXTERNOS (TMDB/Jikan). Nunca datos por usuario:
// myEntry se agrega después de leer la caché.
export const externalCache = new LRUCache({
  max: 500,
  ttl: TEN_MINUTES,
});

/** Clave estable: proveedor + endpoint + parámetros ordenados. */
export function cacheKey(provider, endpoint, params = {}) {
  const normalized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return `${provider}:${endpoint}${normalized ? `?${normalized}` : ""}`;
}

/** Restablece todo el estado externo: caché de respuestas y corta-circuitos. */
export function clearExternalCache() {
  externalCache.clear();
  resetCircuits();
}