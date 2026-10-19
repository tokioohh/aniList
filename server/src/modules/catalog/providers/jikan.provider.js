import { env } from "../../../config/env.js";
import { externalRequest } from "../../../lib/httpClient.js";

// Configurable para poder apuntar a un proxy/mirror si api.jikan.moe queda
// inalcanzable desde la red de despliegue. Por defecto, el host oficial.
const BASE_URL = env.JIKAN_BASE_URL;
const PROVIDER = "jikan";

function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function request(path, params) {
  const url = buildUrl(path, params);
  return externalRequest({
    provider: PROVIDER,
    endpoint: path,
    params,
    headers: { Accept: "application/json" },
    url,
  });
}

// sfw: solo resultados aptos para todos. Límite de 24 por página.
export async function searchAnime(query, page, limit = 24) {
  return request("/anime", { q: query, page, limit, sfw: true });
}

// Jikan no tiene "trending": top con filtro de airing es el equivalente más cercano.
export async function topAiringAnime() {
  return request("/top/anime", { filter: "airing" });
}

// El detalle también viene envuelto en { data: {...} }; se desenvuelve aquí para
// que el normalizador siempre reciba el objeto del anime, no la envoltura.
export async function getAnime(id) {
  const json = await request(`/anime/${id}`, {});
  return json?.data ?? null;
}

export { BASE_URL };