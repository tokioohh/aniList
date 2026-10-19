import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Timeout del cliente HTTP externo.
 *
 * Vive en un archivo aparte a propósito:usa `vi.useFakeTimers()`, y el reloj
 * falso congela también los timers internos del pool de Prisma, así que no
 * puede compartir archivo (y por tanto worker) con tests que tocan la BD.
 *
 * Approach: se prueba `fetchWithRetry` directamente, sin HTTP ni sockets. El
 * mock de fetch se cuelga para siempre y solo se desbloquea cuando el
 * AbortController de `singleFetch` aborta, exactamente igual que hace el fetch
 * real con su AbortSignal. El setTimeout de 8 s del timeout queda bajo el
 * control del reloj falso, así que los 4 intentos (1 + 3 reintentos) con sus
 * backoffs pasan al instante en vez de esperar ~35 s de verdad.
 */

const TMDB_URL = "https://api.themoviedb.org/3/movie/27205";
const HEADERS = { Accept: "application/json" };

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

/** Fetch que nunca resuelve hasta que se aborta su signal. */
function hangingFetch() {
  return vi.fn(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("This operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
  );
}

describe("Timeout del cliente HTTP externo", () => {
  it("un fetch colgado se aborta a los 8 s y la llamada acaba en 502", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchWithRetry } = await import("../src/lib/httpClient.js");
    globalThis.fetch = hangingFetch();

    const outcome = await (async () => {
      const call = fetchWithRetry(TMDB_URL, { provider: "tmdb", headers: HEADERS });
      const settled = call.then(
        () => "resolved",
        (error) => error
      );
      // 4 intentos x (8 s de timeout + backoff exponencial) en un solo salto.
      await vi.advanceTimersByTimeAsync(300_000);
      return settled;
    })();

    expect(outcome).not.toBe("resolved");
    expect(outcome.name).toBe("AppError");
    expect(outcome.status).toBe(502);
    expect(outcome.code).toBe("UPSTREAM_ERROR");
    expect(outcome.message).toBe("El servicio externo no respondió correctamente. Inténtalo más tarde.");

    // 1 intento inicial + 3 reintentos (MAX_RETRIES = 3).
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it("el log de reintentos nombra el timeout sin filtrar detalles del error", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchWithRetry } = await import("../src/lib/httpClient.js");
    globalThis.fetch = hangingFetch();

    const call = fetchWithRetry(TMDB_URL, { provider: "tmdb", headers: HEADERS });
    const settled = call.catch((error) => error);
    await vi.advanceTimersByTimeAsync(300_000);
    await settled;

    const logged = warn.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
    expect(logged).toContain("[upstream] tmdb");
    // El motivo es el nombre del error (AbortError), no su mensaje ni la URL.
    expect(logged).toContain("AbortError");
    expect(logged).not.toContain("This operation was aborted");
  });

  it("un fetch que responde bien dentro del plazo no se aborta", async () => {
    vi.useFakeTimers();
    const { fetchWithRetry } = await import("../src/lib/httpClient.js");

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ id: 27205, title: "Inception" }),
    }));

    const call = fetchWithRetry(TMDB_URL, { provider: "tmdb", headers: HEADERS });
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(call).resolves.toEqual({ id: 27205, title: "Inception" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
