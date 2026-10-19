import * as tmdb from "./providers/tmdb.provider.js";
import * as jikan from "./providers/jikan.provider.js";
import {
  normalizeTmdbMovie,
  normalizeTmdbTv,
  normalizeJikanAnime,
  normalizeBySource,
} from "./normalizers.js";
import { AppError } from "../../lib/errors.js";
import { UPSTREAM_FALLBACK } from "../../lib/httpClient.js";

/**
 * Plazo por fuente dentro de la búsqueda combinada.
 * Sin esto, una fuente caída (Jikan, sin Timeouts más propios) alargaría la
 * espera del usuario hasta el peor caso de reintentos. Al vencer el plazo, esa
 * fuente se descarta y se devuelven las que sí respondieron.
 */
const SOURCE_DEADLINE_MS = 10_000;

function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Plazo que RECHAZA al vencer (en vez de resolver null). Se usa donde el
 * contrato espera un error explícito —la fila de anime, no la búsqueda
 * combinada— para no mostrar un "sin resultados" engañoso: si la fuente no
 * responde a tiempo, el cliente sigue viendo el estado de error con reintento,
 * pero acotado en tiempo en lugar de esperar el peor caso de reintentos.
 */
function withUpstreamDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(AppError.upstream(UPSTREAM_FALLBACK)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Búsqueda con type=ALL: las tres fuentes en paralelo con Promise.allSettled.
 * Si una falla (p. ej. TMDB sin token) se devuelven las otras; hasMore es
 * verdadero si alguna fuente tiene más páginas.
 */
export async function searchAll({ q, type, page }) {
  const wantsAnime = type === "ALL" || type === "ANIME";
  const wantsMovie = type === "ALL" || type === "MOVIE";
  const wantsSeries = type === "ALL" || type === "SERIES";

  const [animeRes, movieRes, seriesRes] = await Promise.allSettled([
    wantsAnime ? withDeadline(jikan.searchAnime(q, page), SOURCE_DEADLINE_MS) : null,
    wantsMovie ? withDeadline(tmdb.searchMovies(q, page), SOURCE_DEADLINE_MS) : null,
    wantsSeries ? withDeadline(tmdb.searchTv(q, page), SOURCE_DEADLINE_MS) : null,
  ]);

  const anime = animeRes.status === "fulfilled" && animeRes.value ? animeRes.value : null;
  const movie = movieRes.status === "fulfilled" && movieRes.value ? movieRes.value : null;
  const series = seriesRes.status === "fulfilled" && seriesRes.value ? seriesRes.value : null;

  // Orden del resultado: ANIME, MOVIE, SERIES.
  const results = [
    ...(anime?.data ?? []).map(normalizeJikanAnime),
    ...(movie?.results ?? []).map(normalizeTmdbMovie),
    ...(series?.results ?? []).map(normalizeTmdbTv),
  ];

  const hasMore = Boolean(
    (anime?.pagination?.has_next_page ?? false) ||
      (movie && (movie.page ?? 1) < (movie.total_pages ?? 1)) ||
      (series && (series.page ?? 1) < (series.total_pages ?? 1))
  );

  return { results, page, hasMore };
}

/** Tendencias. ANIME viene de Jikan (no tiene trending) y el resto de TMDB. */
export async function getTrending({ type }) {
  if (type === "ANIME") {
    // Acotado al mismo plazo que la búsqueda: una fuente caída no debe colgar
    // la fila durante el peor caso de reintentos (~35 s).
    const data = await withUpstreamDeadline(jikan.topAiringAnime(), SOURCE_DEADLINE_MS);
    return (data?.data ?? []).map(normalizeJikanAnime);
  }
  const data = type === "MOVIE" ? await tmdb.trendingMovies() : await tmdb.trendingTv();
  return (data?.results ?? []).map(type === "MOVIE" ? normalizeTmdbMovie : normalizeTmdbTv);
}

/** Detalle de un título, con `myEntry` agregado después (fuera de la caché). */
export async function getTitleDetail(source, externalId) {
  let raw;
  if (source === "TMDB_MOVIE") raw = await tmdb.getMovie(externalId);
  else if (source === "TMDB_TV") raw = await tmdb.getTv(externalId);
  else if (source === "JIKAN_ANIME") raw = await jikan.getAnime(externalId);
  else throw AppError.badRequest("Fuente no válida.");

  if (!raw || raw.error) {
    throw AppError.notFound("No encontramos ese título.");
  }

  return normalizeBySource(source, raw);
}