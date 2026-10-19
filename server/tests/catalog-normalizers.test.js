import { describe, it, expect } from "vitest";
import {
  normalizeTmdbMovie,
  normalizeTmdbTv,
  normalizeJikanAnime,
  normalizeBySource,
} from "../src/modules/catalog/normalizers.js";
import { POSTER_BASE } from "../src/modules/catalog/providers/tmdb.provider.js";
import {
  jikanAnime,
  jikanAnimeWithoutYear,
  tmdbMovieDetail,
  tmdbMovieListItem,
  tmdbTvDetail,
} from "./fixtures.js";

// Formato común exacto que el backend devuelve, sea cual sea la fuente.
const SHAPE = ["source", "externalId", "type", "title", "year", "posterUrl", "synopsis", "score", "genres"];

describe("Normalizadores del catálogo", () => {
  it("TMDB película de detalle devuelve el formato común completo", () => {
    const title = normalizeTmdbMovie(tmdbMovieDetail);

    expect(Object.keys(title)).toEqual(SHAPE);
    expect(title).toEqual({
      source: "TMDB_MOVIE",
      externalId: 27205,
      type: "MOVIE",
      title: "Inception",
      year: 2010,
      posterUrl: `${POSTER_BASE}/poster.jpg`,
      synopsis: expect.stringContaining("ladrón"),
      score: 8.4,
      genres: ["Science Fiction", "Drama"],
    });
  });

  it("TMDB película de listado deja genres en [] porque no vienen", () => {
    const title = normalizeTmdbMovie(tmdbMovieListItem);

    expect(Object.keys(title)).toEqual(SHAPE);
    expect(title.genres).toEqual([]);
    expect(title.source).toBe("TMDB_MOVIE");
    expect(title.type).toBe("MOVIE");
    expect(title.externalId).toBe(27205);
  });

  it("TMDB serie usa name, first_air_date y poster_path", () => {
    const title = normalizeTmdbTv(tmdbTvDetail);

    expect(Object.keys(title)).toEqual(SHAPE);
    expect(title).toEqual({
      source: "TMDB_TV",
      externalId: 1396,
      type: "SERIES",
      title: "Breaking Bad",
      year: 2008,
      posterUrl: `${POSTER_BASE}/bb.jpg`,
      synopsis: expect.any(String),
      score: 8.9,
      genres: ["Drama", "Crime"],
    });
  });

  it("el posterUrl de TMDB siempre lleva el prefijo de imagen w342", () => {
    expect(POSTER_BASE).toBe("https://image.tmdb.org/t/p/w342");

    for (const title of [normalizeTmdbMovie(tmdbMovieDetail), normalizeTmdbTv(tmdbTvDetail)]) {
      expect(title.posterUrl.startsWith(`${POSTER_BASE}/`)).toBe(true);
    }
  });

  it("Jikan anime devuelve el formato común completo", () => {
    const title = normalizeJikanAnime(jikanAnime);

    expect(Object.keys(title)).toEqual(SHAPE);
    expect(title).toEqual({
      source: "JIKAN_ANIME",
      externalId: 20,
      type: "ANIME",
      title: "Naruto",
      year: 2002,
      posterUrl: "https://cdn.myanimelist.net/images/anime/4/50000.jpg",
      synopsis: expect.stringContaining("Naruto"),
      score: 8.1,
      genres: ["Action", "Adventure"],
    });
  });

  it("Jikan saca el año de aired.prop.from.year cuando no viene `year`", () => {
    const title = normalizeJikanAnime(jikanAnimeWithoutYear);

    expect(title.year).toBe(2002);
    expect(title.posterUrl).toBeNull();
  });

  it("normaliza el score a un decimal y usa null si no es un número", () => {
    expect(normalizeTmdbMovie({ ...tmdbMovieDetail, vote_average: 7.26 }).score).toBe(7.3);
    expect(normalizeTmdbMovie({ ...tmdbMovieDetail, vote_average: 7 }).score).toBe(7);
    expect(normalizeTmdbMovie({ ...tmdbMovieDetail, vote_average: null }).score).toBeNull();
    expect(normalizeTmdbMovie({ ...tmdbMovieDetail, vote_average: undefined }).score).toBeNull();
    expect(normalizeJikanAnime({ ...jikanAnime, score: "8.1" }).score).toBeNull();
  });

  it("normaliza year, posterUrl y synopsis a null cuando faltan", () => {
    const title = normalizeTmdbMovie({
      id: 1,
      title: "Sin metadatos",
      release_date: "",
      poster_path: null,
      overview: "   ",
      vote_average: 5,
    });

    expect(title.year).toBeNull();
    expect(title.posterUrl).toBeNull();
    expect(title.synopsis).toBeNull();
  });

  it("descarta años imposibles y fechas mal formadas", () => {
    expect(normalizeTmdbMovie({ ...tmdbMovieDetail, release_date: "0000-01-01" }).year).toBeNull();
    expect(normalizeTmdbMovie({ ...tmdbMovieDetail, release_date: "n/a" }).year).toBeNull();
    expect(normalizeTmdbTv({ ...tmdbTvDetail, first_air_date: 2008 }).year).toBeNull();
  });

  it("cae en títulos genéricos si la fuente no trae nombre", () => {
    expect(normalizeTmdbMovie({ id: 1 }).title).toBe("Sin título");
    expect(normalizeTmdbTv({ id: 1 }).title).toBe("Sin título");
    expect(normalizeJikanAnime({ mal_id: 1 }).title).toBe("Sin título");
  });

  it("normaliza el externalId a número desde el id de cada proveedor", () => {
    expect(normalizeTmdbMovie({ id: "550" }).externalId).toBe(550);
    expect(normalizeTmdbTv({ id: "1396" }).externalId).toBe(1396);
    expect(normalizeJikanAnime({ mal_id: "20" }).externalId).toBe(20);
  });

  it("filtra géneros vacíos o sin nombre", () => {
    const title = normalizeTmdbMovie({
      id: 1,
      genres: [{ name: "Drama" }, { name: "" }, {}, null, "Sci-Fi"],
    });

    expect(title.genres).toEqual(["Drama"]);
  });

  it("normalizeBySource enruta cada fuente a su normalizador", () => {
    expect(normalizeBySource("TMDB_MOVIE", tmdbMovieDetail).source).toBe("TMDB_MOVIE");
    expect(normalizeBySource("TMDB_TV", tmdbTvDetail).source).toBe("TMDB_TV");
    expect(normalizeBySource("JIKAN_ANIME", jikanAnime).source).toBe("JIKAN_ANIME");
  });
});
