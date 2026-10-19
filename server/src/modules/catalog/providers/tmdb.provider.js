import { env } from "../../../config/env.js";
import { externalRequest } from "../../../lib/httpClient.js";
import { AppError } from "../../../lib/errors.js";

const BASE_URL = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

// El token viaja como Bearer en una cabecera, nunca en la URL: si se colara en
// la query string quedaría en los logs del proveedor.
function authHeaders() {
  return {
    Authorization: `Bearer ${env.TMDB_API_KEY}`,
    Accept: "application/json",
  };
}

function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("language", "es-MX");
  url.searchParams.set("include_adult", "false");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function request(path, params) {
  const url = buildUrl(path, params);
  return externalRequest({
    provider: "tmdb",
    endpoint: path,
    params,
    headers: authHeaders(),
    url,
  });
}

export async function searchMovies(query, page) {
  return request("/search/movie", { query, page });
}

export async function searchTv(query, page) {
  return request("/search/tv", { query, page });
}

export async function trendingMovies() {
  return request("/trending/movie/week", {});
}

export async function trendingTv() {
  return request("/trending/tv/week", {});
}

export async function getMovie(id) {
  return request(`/movie/${id}`, {});
}

export async function getTv(id) {
  return request(`/tv/${id}`, {});
}

export { POSTER_BASE, BASE_URL, AppError };