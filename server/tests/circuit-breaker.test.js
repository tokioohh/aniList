import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Corta-circuito por proveedor externo.
 *
 * Prueba pura del estado (sin HTTP ni base de datos), más una comprobación de
 * que `fetchWithRetry` responde 502 al instante —sin llamar a `fetch`— cuando
 * el circuito del proveedor está abierto.
 */

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("Corta-circuito por proveedor", () => {
  it("se abre tras varios fallos seguidos y se cierra con un éxito", async () => {
    const { isCircuitOpen, recordFailure, recordSuccess, resetCircuits, FAILURE_THRESHOLD } =
      await import("../src/lib/circuitBreaker.js");

    resetCircuits();
    expect(isCircuitOpen("jikan")).toBe(false);

    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) recordFailure("jikan");
    expect(isCircuitOpen("jikan")).toBe(true);

    // Un solo éxito devuelve el proveedor a la normalidad.
    recordSuccess("jikan");
    expect(isCircuitOpen("jikan")).toBe(false);
  });

  it("se abre por proveedor y deja pasar un sondeo al vencer el enfriamiento", async () => {
    const { isCircuitOpen, recordFailure, resetCircuits, FAILURE_THRESHOLD, COOLDOWN_MS } =
      await import("../src/lib/circuitBreaker.js");

    resetCircuits();
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) recordFailure("tmdb");

    // Abierto para TMDB, pero Jikan sigue disponible.
    expect(isCircuitOpen("tmdb")).toBe(true);
    expect(isCircuitOpen("jikan")).toBe(false);

    // Pasado el enfriamiento se permite una llamada de sondeo (medio abierto).
    expect(isCircuitOpen("tmdb", Date.now() + COOLDOWN_MS + 1)).toBe(false);
  });

  it("con el proveedor abierto, fetchWithRetry responde 502 sin llamar a fetch", async () => {
    const { recordFailure, resetCircuits, FAILURE_THRESHOLD } = await import(
      "../src/lib/circuitBreaker.js"
    );
    const { fetchWithRetry } = await import("../src/lib/httpClient.js");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mock = vi.fn();
    globalThis.fetch = mock;

    resetCircuits();
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) recordFailure("jikan");

    const error = await fetchWithRetry("https://api.jikan.moe/v4/anime/1", {
      provider: "jikan",
    }).catch((e) => e);

    expect(error.name).toBe("AppError");
    expect(error.status).toBe(502);
    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(mock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
