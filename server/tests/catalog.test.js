import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { app } from "../src/app.js";
import { clearExternalCache } from "../src/lib/cache.js";
import { client, restoreGlobals, cleanupTestData } from "./helpers.js";
import {
  createFetchMock,
  jsonResponse,
  errorResponse,
  jikanRouter,
  tmdbRouter,
  jikanAnime,
  jikanListResponse,
  tmdbMovieDetail,
  tmdbTvDetail,
} from "./fixtures.js";

const SECRET = "detalle secreto de tmdb";

describe("GET /api/catalog/search", () => {
  beforeEach(() => {
    clearExternalCache();
  });
  afterEach(restoreGlobals);
  afterEach(cleanupTestData);

  it("busca anime en Jikan con type=ANIME", async () => {
    const { mock, calls } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/search?q=naruto&type=ANIME");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, hasMore: true });
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toEqual({
      source: "JIKAN_ANIME",
      externalId: 20,
      type: "ANIME",
      title: "Naruto",
      year: 2002,
      posterUrl: "https://cdn.myanimelist.net/images/anime/4/50000.jpg",
      synopsis: expect.any(String),
      score: 8.1,
      genres: ["Action", "Adventure"],
    });

    // Con type=ANIME solo se llama a Jikan, nunca a TMDB.
    expect(mock).toHaveBeenCalledTimes(1);
    expect(calls[0].hostname).toBe("api.jikan.moe");
    expect(calls[0].searchParams.get("q")).toBe("naruto");
    expect(calls[0].searchParams.get("sfw")).toBe("true");
  });

  it("busca películas en TMDB con type=MOVIE y no toca Jikan", async () => {
    const { mock, calls } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/search?q=inception&type=MOVIE");

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      source: "TMDB_MOVIE",
      type: "MOVIE",
      externalId: 27205,
      // Sin `genres` en el listado de TMDB.
      genres: [],
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(calls[0].hostname).toBe("api.themoviedb.org");
    expect(calls[0].pathname).toBe("/3/search/movie");
  });

  it("busca series en TMDB con type=SERIES", async () => {
    const { mock, calls } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/search?q=breaking&type=SERIES");

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({ source: "TMDB_TV", type: "SERIES", externalId: 1396 });
    expect(calls[0].pathname).toBe("/3/search/tv");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("con type=ALL combina las tres fuentes y ordena ANIME, MOVIE, SERIES", async () => {
    const { mock, calls } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/search?q=matrix&type=ALL");

    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.type)).toEqual(["ANIME", "MOVIE", "SERIES"]);
    expect(mock).toHaveBeenCalledTimes(3);
    expect(calls).toHaveLength(3);
  });

  it("devuelve las fuentes que sí respondieron aunque una falle", async () => {
    // Jikan revienta con 5xx persistente; TMDB responde bien.
    createFetchMock({
      jikan: () => errorResponse(500, SECRET),
      tmdb: tmdbRouter(),
    });

    const res = await client(app).get("/api/catalog/search?q=matrix&type=ALL");

    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.type)).toEqual(["MOVIE", "SERIES"]);
  });

  it("hasMore es false cuando ninguna fuente tiene más páginas", async () => {
    createFetchMock({
      jikan: () => jsonResponse({ data: [], pagination: { has_next_page: false } }),
      tmdb: () => jsonResponse({ page: 1, results: [], total_pages: 1, total_results: 0 }),
    });

    const res = await client(app).get("/api/catalog/search?q=nada&type=ALL");

    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.results).toEqual([]);
  });

  it("hasMore es true si solo una de las tres fuentes tiene más páginas", async () => {
    createFetchMock({
      jikan: () => jsonResponse({ data: [], pagination: { has_next_page: true } }),
      tmdb: () => jsonResponse({ page: 1, results: [], total_pages: 1, total_results: 0 }),
    });

    const res = await client(app).get("/api/catalog/search?q=nada&type=ALL");

    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(true);
  });

  it("respeta el número de página pedido hacia los tres proveedores", async () => {
    const { calls } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/search?q=naruto&type=ALL&page=3");

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(calls.find((c) => c.hostname === "api.jikan.moe").searchParams.get("page")).toBe("3");
    expect(calls.find((c) => c.pathname === "/3/search/movie").searchParams.get("page")).toBe("3");
    expect(calls.find((c) => c.pathname === "/3/search/tv").searchParams.get("page")).toBe("3");
  });

  it("rechaza q vacío, type inválido y page fuera de rango con 400", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });
    const http = client(app);

    const vacio = await http.get("/api/catalog/search?q=%20&type=ANIME");
    const typeMalo = await http.get("/api/catalog/search?q=naruto&type=PELICULA");
    const pageMala = await http.get("/api/catalog/search?q=naruto&type=ANIME&page=99");
    const campoExtra = await http.get("/api/catalog/search?q=naruto&type=ANIME&orden=asc");

    for (const res of [vacio, typeMalo, pageMala, campoExtra]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }

    // Ninguna llamada sale al proveedor cuando la validación falla.
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("GET /api/catalog/trending", () => {
  beforeEach(() => {
    clearExternalCache();
  });
  afterEach(restoreGlobals);

  it("devuelve las tendencias de anime desde Jikan (top airing)", async () => {
    const { mock, calls } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/trending?type=ANIME");

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toMatchObject({ source: "JIKAN_ANIME", externalId: 20 });
    expect(res.body.results[1].posterUrl).toBeNull();
    expect(calls[0].pathname).toBe("/v4/top/anime");
    expect(calls[0].searchParams.get("filter")).toBe("airing");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("devuelve las tendencias de películas y series desde TMDB", async () => {
    const movies = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });
    const resPeliculas = await client(app).get("/api/catalog/trending?type=MOVIE");

    expect(resPeliculas.status).toBe(200);
    expect(resPeliculas.body.results[0]).toMatchObject({ source: "TMDB_MOVIE", type: "MOVIE" });
    expect(movies.calls[0].pathname).toBe("/3/trending/movie/week");

    clearExternalCache();
    const series = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });
    const resSeries = await client(app).get("/api/catalog/trending?type=SERIES");

    expect(resSeries.status).toBe(200);
    expect(resSeries.body.results[0]).toMatchObject({ source: "TMDB_TV", type: "SERIES" });
    expect(series.calls[0].pathname).toBe("/3/trending/tv/week");
  });

  it("rechaza un type inválido con 400 sin llamar al proveedor", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/trending?type=MANGA");

    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.type).toBeDefined();
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("GET /api/catalog/:source/:externalId", () => {
  beforeEach(() => {
    clearExternalCache();
  });
  afterEach(restoreGlobals);
  afterEach(cleanupTestData);

  it("devuelve el detalle normalizado de una película de TMDB con myEntry null", async () => {
    createFetchMock({ tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/TMDB_MOVIE/27205");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      source: "TMDB_MOVIE",
      externalId: 27205,
      type: "MOVIE",
      title: "Inception",
      year: 2010,
      posterUrl: "https://image.tmdb.org/t/p/w342/poster.jpg",
      synopsis: expect.any(String),
      score: 8.4,
      genres: ["Science Fiction", "Drama"],
      myEntry: null,
    });
  });

  it("devuelve el detalle normalizado de una serie de TMDB", async () => {
    createFetchMock({ tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/TMDB_TV/1396");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      source: "TMDB_TV",
      type: "SERIES",
      title: "Breaking Bad",
      year: 2008,
      myEntry: null,
    });
  });

  it("devuelve el detalle normalizado de un anime de Jikan", async () => {
    const { mock, calls } = createFetchMock({ jikan: jikanRouter() });

    const res = await client(app).get("/api/catalog/JIKAN_ANIME/20");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      source: "JIKAN_ANIME",
      externalId: 20,
      type: "ANIME",
      title: "Naruto",
      year: 2002,
      posterUrl: "https://cdn.myanimelist.net/images/anime/4/50000.jpg",
      synopsis: expect.any(String),
      score: 8.1,
      genres: ["Action", "Adventure"],
      myEntry: null,
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(calls[0].pathname).toBe("/v4/anime/20");
  });

  it("regresión: el detalle de Jikan desenvuelve la envoltura { data }", async () => {
    // Jikan devuelve /anime/:id envuelto en { data: {...} }. Si el provider no
    // lo desenvuelve, el normalizador recibe la envoltura y TODOS los campos
    // salen vacíos (externalId null, title "Sin título", score null...).
    // Este test falla si alguien deshace el `json?.data` de getAnime.
    createFetchMock({ jikan: jikanRouter() });

    const res = await client(app).get("/api/catalog/JIKAN_ANIME/20");

    expect(res.body.externalId).toBe(20);
    expect(res.body.title).not.toBe("Sin título");
    expect(res.body.score).toBe(8.1);
    expect(res.body.genres).toEqual(["Action", "Adventure"]);
  });

  it("devuelve 400 si la fuente no pertenece al enum", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    const res = await client(app).get("/api/catalog/PELICULA/27205");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fieldErrors.source).toBeDefined();
    // La validación evita construir una ruta arbitraria hacia el proveedor.
    expect(mock).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el externalId no es numérico o no es positivo", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });
    const http = client(app);

    const noNumerico = await http.get("/api/catalog/TMDB_MOVIE/abc");
    const cero = await http.get("/api/catalog/TMDB_MOVIE/0");
    const negativo = await http.get("/api/catalog/JIKAN_ANIME/-5");
    const decimal = await http.get("/api/catalog/TMDB_TV/1.5");

    for (const res of [noNumerico, cero, negativo, decimal]) {
      expect(res.status).toBe(400);
      expect(res.body.error.fieldErrors.externalId).toBeDefined();
    }
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("Caché de respuestas externas", () => {
  beforeEach(() => {
    clearExternalCache();
  });
  afterEach(restoreGlobals);

  it("dos peticiones idénticas hacen UNA sola llamada a fetch", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });
    const http = client(app);

    const first = await http.get("/api/catalog/search?q=naruto&type=ANIME");
    const second = await http.get("/api/catalog/search?q=naruto&type=ANIME");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("el detalle repetido también se cachea", async () => {
    const { mock } = createFetchMock({ tmdb: tmdbRouter() });
    const http = client(app);

    await http.get("/api/catalog/TMDB_MOVIE/27205");
    await http.get("/api/catalog/TMDB_MOVIE/27205");
    await http.get("/api/catalog/TMDB_MOVIE/27205");

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("peticiones distintas (params distintos) sí generan llamadas distintas", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });
    const http = client(app);

    await http.get("/api/catalog/search?q=naruto&type=ANIME");
    await http.get("/api/catalog/search?q=bleach&type=ANIME");

    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("clearExternalCache fuerza una llamada nueva", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });
    const http = client(app);

    await http.get("/api/catalog/search?q=naruto&type=ANIME");
    clearExternalCache();
    await http.get("/api/catalog/search?q=naruto&type=ANIME");

    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe("Reintentos ante fallos del proveedor", () => {
  beforeEach(() => {
    clearExternalCache();
  });
  afterEach(restoreGlobals);

  it("si el primer fetch devuelve 429 y el segundo 200, la llamada tiene éxito con 2 intentos", async () => {
    let attempts = 0;
    const { mock } = createFetchMock({
      tmdb: () => {
        attempts += 1;
        // El primer intento agota el cuota; Retry-After: 0 hace el backoff instantáneo.
        if (attempts === 1) return errorResponse(429, SECRET);
        return jsonResponse(tmdbMovieDetail);
      },
    });

    const res = await client(app).get("/api/catalog/TMDB_MOVIE/27205");

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Inception");
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("reintenta también los 5xx y termina bien si el proveedor se recupera", async () => {
    let attempts = 0;
    const { mock } = createFetchMock({
      tmdb: () => {
        attempts += 1;
        if (attempts < 3) return errorResponse(503, SECRET);
        return jsonResponse(tmdbTvDetail);
      },
    });

    const res = await client(app).get("/api/catalog/TMDB_TV/1396");

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Breaking Bad");
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("tras agotar los reintentos responde 502 UPSTREAM_ERROR sin filtrar texto del proveedor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { mock } = createFetchMock({ tmdb: () => errorResponse(500, SECRET) });

    const res = await client(app).get("/api/catalog/TMDB_MOVIE/27205");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
    // El cuerpo del proveedor nunca se reenvía al cliente.
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(res.body.error.message).not.toContain(SECRET);

    // 1 intento inicial + 3 reintentos (MAX_RETRIES = 3).
    expect(mock).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalled();
  });

  it("un error de red (AbortError por timeout) acaba en 502 sin filtrar detalles", async () => {
    // El timeout real son 8 s; el mock rechaza al instante con un AbortError,
    // que es exactamente lo que vería el httpClient cuando aborta el fetch.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const abortError = new Error("This operation was aborted");
    abortError.name = "AbortError";

    const { mock } = createFetchMock({ tmdb: () => abortError });

    const res = await client(app).get("/api/catalog/TMDB_MOVIE/27205");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("aborted");
    expect(mock).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalled();
  });

  // El caso "fetch que nunca resuelve y dispara el timeout real de 8 s" está
  // en tests/catalog-timeout.test.js: necesita reloj falso, y el reloj falso
  // congela los sockets de Prisma, así que no puede convivir en este archivo
  // con los tests que tocan la base de datos.

  it("un 404 del proveedor se traduce a 404 NOT_FOUND sin reintentar", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { mock } = createFetchMock({ tmdb: () => errorResponse(404, SECRET) });

    const res = await client(app).get("/api/catalog/TMDB_MOVIE/999999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    // El 404 es terminal: no se reintenta.
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("un 4xx distinto de 404 responde 502 sin reintentar", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { mock } = createFetchMock({ tmdb: () => errorResponse(401, SECRET) });

    const res = await client(app).get("/api/catalog/TMDB_MOVIE/27205");

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("un cuerpo de error del proveedor con campo `error` se trata como no encontrado", async () => {
    const { mock } = createFetchMock({
      jikan: () => jsonResponse({ status_code: 404, error: "Not Found" }),
    });

    const res = await client(app).get("/api/catalog/JIKAN_ANIME/999999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe("Fuga de credenciales y de datos del proveedor", () => {
  beforeEach(() => {
    clearExternalCache();
  });
  afterEach(restoreGlobals);

  it("ni la respuesta ni los logs contienen el TMDB_API_KEY ni la cabecera Bearer", async () => {
    const { env } = await import("../src/config/env.js");
    const secret = env.TMDB_API_KEY;
    expect(secret).toBeTruthy();

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    createFetchMock({
      jikan: jikanRouter(),
      tmdb: () => errorResponse(500, SECRET),
    });

    const http = client(app);
    const ok = await http.get("/api/catalog/search?q=naruto&type=ALL");
    const fallo = await http.get("/api/catalog/TMDB_MOVIE/27205");

    for (const res of [ok, fallo]) {
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(secret);
      expect(text).not.toContain("Bearer");
      expect(text).not.toContain("authorization");
    }

    const logs = [logSpy, warnSpy, errorSpy]
      .flatMap((spy) => spy.mock.calls.map((args) => args.map(String).join(" ")))
      .join("\n");

    expect(logs).not.toContain(secret);
    expect(logs).not.toContain("Bearer");
  });

  it("el token de TMDB viaja en la cabecera Authorization y no en la URL", async () => {
    const { env } = await import("../src/config/env.js");
    const { mock } = createFetchMock({ tmdb: tmdbRouter() });

    await client(app).get("/api/catalog/TMDB_MOVIE/27205");

    const [, init] = mock.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${env.TMDB_API_KEY}`);

    // La URL no lleva el token: viaja solo en la cabecera Authorization.
    const url = String(mock.mock.calls[0][0]);
    expect(url).not.toContain(env.TMDB_API_KEY);
    expect(url).toBe(
      "https://api.themoviedb.org/3/movie/27205?language=es-MX&include_adult=false"
    );
  });

  it("las peticiones a Jikan no llevan ninguna credencial", async () => {
    const { mock } = createFetchMock({ jikan: jikanRouter(), tmdb: tmdbRouter() });

    await client(app).get("/api/catalog/search?q=naruto&type=ANIME");

    const [url, init] = mock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.jikan.moe/v4/anime?q=naruto&page=1&limit=24&sfw=true"
    );
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it("el 502 nunca incluye el mensaje de error del proveedor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    createFetchMock({ tmdb: () => errorResponse(500, SECRET) });

    const res = await client(app).get("/api/catalog/TMDB_MOVIE/27205");

    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe("El servicio externo no respondió correctamente. Inténtalo más tarde.");

    // Tampoco en los logs: solo el proveedor y el status, nunca el cuerpo.
    const logged = warn.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).not.toContain(SECRET);
    expect(logged).toContain("tmdb");
    expect(logged).toContain("HTTP 500");
  });
});
