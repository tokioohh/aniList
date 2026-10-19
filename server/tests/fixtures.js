// Fixtures que imitan la forma real de las respuestas de Jikan y TMDB.
// Nada de red: estos objetos son la única "fuente externa" de los tests.
import { vi } from "vitest";

// ---- Jikan (api.jikan.moe) ----

export const jikanAnime = {
  mal_id: 20,
  url: "https://myanimelist.net/anime/20/Naruto",
  images: {
    jpg: {
      image_url: "https://cdn.myanimelist.net/images/anime/4/50000.jpg",
      large_image_url: "https://cdn.myanimelist.net/images/anime/4/50000.jpg",
    },
  },
  title: "Naruto",
  title_japanese: "ナルト",
  type: "TV",
  episodes: 220,
  status: "Finished Airing",
  airing: false,
  duration_per_episode: 23,
  score: 8.14,
  scored_by: 1_800_000,
  rank: 7,
  year: 2002,
  aired: {
    from: "2002-10-03T00:00:00+00:00",
    to: "2007-04-08T00:00:00+00:00",
    prop: { from: { year: 2002, month: 10, day: 3 }, to: { year: 2007, month: 4, day: 8 } },
  },
  genres: [
    { mal_id: 1, name: "Action" },
    { mal_id: 2, name: "Adventure" },
  ],
  synopsis:
    "Naruto Uzumaki, un ninja hiperactivo que crece en la Aldea Hoja, lucha por ser Hokage.",
  background: "Ninja",
  demographics: [],
};

// Variante sin `year` explícito: el año debe salir de aired.prop.from.year.
export const jikanAnimeWithoutYear = {
  ...jikanAnime,
  mal_id: 1735,
  title: "Shingeki no Kyojin",
  year: null,
  score: 8.63,
  images: { jpg: {} },
  genres: [{ mal_id: 1, name: "Action" }],
  synopsis: "La humanidad sobrevive tras la aparición de titanes.",
};

export const jikanListResponse = {
  data: [jikanAnime],
  pagination: { has_next_page: true, current_page: 1, last_visible_page: 5, items: { total: 120 } },
};

export const jikanTopResponse = { data: [jikanAnime, jikanAnimeWithoutYear] };

// ---- TMDB películas ----

export const tmdbMovieDetail = {
  adult: false,
  backdrop_path: "/backdrop.jpg",
  id: 27205,
  original_language: "en",
  original_title: "Inception",
  overview:
    "Un ladrón que roba secretos dentro de los sueños descubre que debe infiltrarse en la mente de un heredero.",
  poster_path: "/poster.jpg",
  release_date: "2010-07-15",
  runtime: 148,
  status: "Released",
  title: "Inception",
  vote_average: 8.369,
  vote_count: 36_000,
  genres: [
    { id: 28, name: "Science Fiction" },
    { id: 18, name: "Drama" },
  ],
};

export const tmdbMovieListItem = {
  // En listados TMDB NO viene `genres`: el normalizador debe devolver [].
  adult: false,
  id: 27205,
  overview: "Un ladrón que roba secretos dentro de los sueños.",
  poster_path: "/poster.jpg",
  release_date: "2010-07-15",
  title: "Inception",
  video: false,
  vote_average: 8.369,
};

export const tmdbMovieListResponse = {
  page: 1,
  results: [tmdbMovieListItem],
  total_pages: 4,
  total_results: 87,
};

// ---- TMDB series ----

export const tmdbTvDetail = {
  id: 1396,
  name: "Breaking Bad",
  original_name: "Breaking Bad",
  overview: "Un profesor de química con cáncer entra en el mundo de laoxone.",
  poster_path: "/bb.jpg",
  first_air_date: "2008-01-20",
  last_air_date: "2013-09-29",
  number_of_seasons: 5,
  number_of_episodes: 62,
  vote_average: 8.92,
  genres: [
    { id: 18, name: "Drama" },
    { id: 80, name: "Crime" },
  ],
};

export const tmdbTvListItem = {
  id: 1396,
  name: "Breaking Bad",
  overview: "Un profesor de química con cáncer entra en el mundo de la apprentice.",
  poster_path: "/bb.jpg",
  first_air_date: "2008-01-20",
  vote_average: 8.92,
};

export const tmdbTvListResponse = {
  page: 1,
  results: [tmdbTvListItem],
  total_pages: 3,
  total_results: 55,
};

export const tmdbTrendingResponse = { page: 1, results: [tmdbMovieListItem] };

// ---- Helpers de fetch simulado ----

/** Respuesta JSON mínima con la forma que consume lib/httpClient.js. */
export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headers[String(name).toLowerCase()] ?? null,
    },
    async json() {
      return body;
    },
  };
}

/** Respuesta de error con el cuerpo "secreto" del proveedor. */
export function errorResponse(status, secretText) {
  return jsonResponse({ status_code: status, status_message: secretText, detail: secretText }, { status });
}

/**
 * Mock de fetch que enruta por hostname:
 *  - api.jikan.moe    -> { data: [...] }
 *  - api.themoviedb.org -> { results: [...] } o el objeto directo en detalle.
 * `handlers` acepta funciones (url, callIndex) => respuesta, con estado propio.
 */
export function createFetchMock(handlers = {}) {
  const calls = [];

  const mock = vi.fn(async (input) => {
    const url = typeof input === "string" ? input : input.url ?? String(input);
    const parsed = new URL(url);
    calls.push(parsed);

    const key = parsed.hostname === "api.jikan.moe" ? "jikan" : "tmdb";
    const handler = handlers[key] ?? handlers.default;

    if (!handler) throw new Error(`Sin mock para ${parsed.hostname}${parsed.pathname}`);

    const result = await handler(parsed, calls.length - 1);
    if (result instanceof Error) throw result;
    return result ?? jsonResponse(key === "jikan" ? { data: [] } : { results: [] });
  });

  global.fetch = mock;
  return { mock, calls };
}

/** Routea por pathname de TMDB para cubrir detalle/listado con un solo mock. */
export function tmdbRouter(overrides = {}) {
  return (url) => {
    const override = overrides[url.pathname];
    if (typeof override === "function") return override(url);

    if (url.pathname === "/3/movie/27205") return jsonResponse(tmdbMovieDetail);
    if (url.pathname === "/3/tv/1396") return jsonResponse(tmdbTvDetail);
    if (url.pathname.startsWith("/3/movie/")) return jsonResponse(tmdbMovieListItem);
    if (url.pathname.startsWith("/3/tv/")) return jsonResponse(tmdbTvListItem);
    if (url.pathname === "/3/trending/movie/week") return jsonResponse(tmdbTrendingResponse);
    if (url.pathname === "/3/trending/tv/week") return jsonResponse(tmdbTvListResponse);
    if (url.pathname === "/3/search/movie") return jsonResponse(tmdbMovieListResponse);
    if (url.pathname === "/3/search/tv") return jsonResponse(tmdbTvListResponse);

    return errorResponse(404, "detalle secreto de tmdb");
  };
}

export function jikanRouter(overrides = {}) {
  return (url) => {
    const override = overrides[url.pathname];
    if (typeof override === "function") return override(url);

    if (url.pathname === "/v4/anime/20") return jsonResponse({ data: jikanAnime });
    if (url.pathname === "/v4/anime") return jsonResponse(jikanListResponse);
    if (url.pathname === "/v4/top/anime") return jsonResponse(jikanTopResponse);

    return errorResponse(404, "detalle secreto de jikan");
  };
}
