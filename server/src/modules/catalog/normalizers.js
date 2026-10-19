import { POSTER_BASE } from "./providers/tmdb.provider.js";

/**
 * Formato común que devuelve el backend, sea cual sea la fuente:
 * { source, externalId, type, title, year, posterUrl, synopsis, score, genres }
 */

// Un decimal para el score (0-10), o null si la fuente no lo trae.
function roundScore(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function yearFromDate(date) {
  if (typeof date !== "string" || date.length < 4) return null;
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : null;
}

function genresFromTmdb(list) {
  return Array.isArray(list) ? list.map((genre) => genre?.name).filter(Boolean) : [];
}

function genresFromJikan(list) {
  return Array.isArray(list) ? list.map((genre) => genre?.name).filter(Boolean) : [];
}

function optionalText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ---- TMDB: películas ----

export function normalizeTmdbMovie(movie) {
  return {
    source: "TMDB_MOVIE",
    externalId: Number(movie.id),
    type: "MOVIE",
    title: movie.title ?? movie.original_title ?? "Sin título",
    year: yearFromDate(movie.release_date),
    posterUrl: movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : null,
    synopsis: optionalText(movie.overview),
    score: roundScore(movie.vote_average),
    // En listados TMDB solo trae ids de género: aquí puede quedar vacío.
    genres: genresFromTmdb(movie.genres),
  };
}

// ---- TMDB: series ----

export function normalizeTmdbTv(tv) {
  return {
    source: "TMDB_TV",
    externalId: Number(tv.id),
    type: "SERIES",
    title: tv.name ?? tv.original_name ?? "Sin título",
    year: yearFromDate(tv.first_air_date),
    posterUrl: tv.poster_path ? `${POSTER_BASE}${tv.poster_path}` : null,
    synopsis: optionalText(tv.overview),
    score: roundScore(tv.vote_average),
    genres: genresFromTmdb(tv.genres),
  };
}

// ---- Jikan: anime (incluidas las películas anime) ----

export function normalizeJikanAnime(anime) {
  const jpg = anime.images?.jpg ?? {};
  return {
    source: "JIKAN_ANIME",
    externalId: Number(anime.mal_id),
    type: "ANIME",
    title: anime.title ?? "Sin título",
    year: Number.isInteger(anime.year) ? anime.year : anime.aired?.prop?.from?.year ?? null,
    posterUrl: jpg.large_image_url ?? jpg.image_url ?? null,
    synopsis: optionalText(anime.synopsis),
    score: roundScore(anime.score),
    genres: genresFromJikan(anime.genres),
  };
}

/** Elige el normalizador según la fuente del título. */
export function normalizeBySource(source, raw) {
  if (source === "TMDB_MOVIE") return normalizeTmdbMovie(raw);
  if (source === "TMDB_TV") return normalizeTmdbTv(raw);
  return normalizeJikanAnime(raw);
}