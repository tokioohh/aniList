import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Cola de peticiones hacia APIs externas.
 *
 * Approach usado para el espaciado: prueba DIRECTA de `requestQueue.enqueue`
 * con reloj falso (`vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`), que
 * es lo que pide el enunciado. Se descartó la vía HTTP con fake timers porque
 * con el reloj congelado los sockets de supertest/Express nunca se resuelven y
 * la petición se queda colgada; por eso el test HTTP del final usa reloj real.
 *
 * Detalle importante: `requestQueue` es un singleton de módulo y guarda
 * `lastCallAt`. Entre tests el reloj falso se reinicia hacia atrás, así que
 * reutilizar la misma instancia haría que el siguiente test esperara un
 * espaciado ya "consumido". Por eso cada test hace `vi.resetModules()` y
 * reimporta el módulo para obtener una cola con el contador a cero.
 */

const JIKAN_OPTIONS = { spacingMs: 400, maxPerMinute: 55 };
const TMDB_OPTIONS = { spacingMs: 0, maxPerMinute: 0 };

/** Cola nueva, con contadores a cero. */
async function freshQueue() {
  vi.resetModules();
  const { requestQueue } = await import("../src/lib/requestQueue.js");
  return requestQueue;
}

describe("requestQueue.enqueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("espacia 400 ms tres llamadas consecutivas de Jikan", async () => {
    const requestQueue = await freshQueue();
    vi.useFakeTimers();

    const starts = [];
    const tasks = [0, 1, 2].map(() =>
      requestQueue.enqueue(() => {
        starts.push(Date.now());
        return Promise.resolve();
      }, JIKAN_OPTIONS)
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await Promise.all(tasks);

    expect(starts).toHaveLength(3);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(400);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(400);
    // Y no esperaron de más: ~400 ms entre llamadas, no ~800.
    expect(starts[2] - starts[0]).toBeLessThan(1_000);
  });

  it("la primera llamada no espera nada (lastCallAt es null)", async () => {
    const requestQueue = await freshQueue();
    vi.useFakeTimers();
    const t0 = Date.now();
    const starts = [];

    const task = requestQueue.enqueue(() => {
      starts.push(Date.now());
      return Promise.resolve();
    }, JIKAN_OPTIONS);

    await vi.advanceTimersByTimeAsync(50);
    await task;

    expect(starts).toHaveLength(1);
    expect(starts[0]).toBe(t0);
  });

  it("TMDB no aplica espaciado: varias llamadas salen en el mismo instante", async () => {
    const requestQueue = await freshQueue();
    vi.useFakeTimers();

    const starts = [];
    const tasks = [0, 1, 2].map(() =>
      requestQueue.enqueue(() => {
        starts.push(Date.now());
        return Promise.resolve();
      }, TMDB_OPTIONS)
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(tasks);

    expect(starts).toHaveLength(3);
    expect(new Set(starts).size).toBe(1);
  });

  it("respeta el orden de encolado", async () => {
    const requestQueue = await freshQueue();
    vi.useFakeTimers();

    const order = [];
    const tasks = ["a", "b", "c"].map((letter) =>
      requestQueue.enqueue(() => {
        order.push(letter);
        return Promise.resolve();
      }, JIKAN_OPTIONS)
    );

    await vi.advanceTimersByTimeAsync(5_000);
    await Promise.all(tasks);

    expect(order).toEqual(["a", "b", "c"]);
  });

  it("un fallo en una tarea no rompe la cadena de la cola", async () => {
    const requestQueue = await freshQueue();
    vi.useFakeTimers();

    const order = [];
    const failing = requestQueue.enqueue(() => {
      order.push("rota");
      return Promise.reject(new Error("fallo controlado"));
    }, JIKAN_OPTIONS);
    const following = requestQueue.enqueue(() => {
      order.push("sigue");
      return Promise.resolve();
    }, JIKAN_OPTIONS);

    await vi.advanceTimersByTimeAsync(5_000);
    await expect(failing).rejects.toThrow("fallo controlado");
    await following;

    expect(order).toEqual(["rota", "sigue"]);
  });

  it("el límite por minuto hace esperar cuando la ventana deslizante está llena", async () => {
    const requestQueue = await freshQueue();
    vi.useFakeTimers();

    const starts = [];
    // Con spacingMs 0 solo se observa el efecto de maxPerMinute.
    const options = { spacingMs: 0, maxPerMinute: 3 };
    const tasks = [0, 1, 2, 3].map(() =>
      requestQueue.enqueue(() => {
        starts.push(Date.now());
        return Promise.resolve();
      }, options)
    );

    await vi.advanceTimersByTimeAsync(180_000);
    await Promise.all(tasks);

    expect(starts).toHaveLength(4);
    expect(starts[1] - starts[0]).toBe(0);
    expect(starts[2] - starts[1]).toBe(0);
    // La cuarta espera a que expire la ventana de 60 s.
    expect(starts[3] - starts[2]).toBeGreaterThanOrEqual(60_000);
  });
});

describe("requestQueue.share", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("comparte la promesa entre llamadas simultáneas con la misma clave", async () => {
    const requestQueue = await freshQueue();
    let factoryCalls = 0;

    const factory = () => {
      factoryCalls += 1;
      return Promise.resolve("datos");
    };

    const a = requestQueue.share("clave-igual", factory);
    const b = requestQueue.share("clave-igual", factory);

    expect(await a).toBe("datos");
    expect(await b).toBe("datos");
    expect(factoryCalls).toBe(1);
  });

  it("una clave distinta sí genera su propia llamada", async () => {
    const requestQueue = await freshQueue();
    let factoryCalls = 0;

    const factory = () => {
      factoryCalls += 1;
      return Promise.resolve("datos");
    };

    await Promise.all([requestQueue.share("clave-a", factory), requestQueue.share("clave-b", factory)]);

    expect(factoryCalls).toBe(2);
  });

  it("una llamada en vuelo que falla no se queda cacheada para la siguiente", async () => {
    const requestQueue = await freshQueue();

    // El manejador se engancha de inmediato para evitar unhandled rejection.
    const fallida = requestQueue.share("clave-fallida", () => Promise.reject(new Error("boom")));
    await expect(fallida).rejects.toThrow("boom");

    const buena = requestQueue.share("clave-fallida", () => Promise.resolve("recuperado"));
    expect(await buena).toBe("recuperado");
  });
});

describe("Espaciado de Jikan medido a través de la API", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("la segunda búsqueda a Jikan tarda al menos 400 ms en salir", async () => {
    // Approach con reloj REAL (no fake timers): se registra el instante en que
    // el mock de fetch entra por cada llamada externa. Tarda ~400 ms de verdad,
    // pero ejercita la cola a través del endpoint HTTP real, con sockets de
    // verdad, que es justo lo que no funciona con el reloj congelado.
    const { app } = await import("../src/app.js");
    const { clearExternalCache } = await import("../src/lib/cache.js");
    const { createFetchMock, jikanRouter, tmdbRouter } = await import("./fixtures.js");
    const { client, restoreGlobals } = await import("./helpers.js");

    clearExternalCache();

    const enterTimes = [];
    const { mock } = createFetchMock({
      jikan: (url) => {
        enterTimes.push(Date.now());
        return jikanRouter()(url);
      },
      tmdb: tmdbRouter(),
    });

    const http = client(app);
    // Dos búsquedas DISTINTAS: si fueran iguales, la segunda saldría de la caché.
    await http.get("/api/catalog/search?q=alfa&type=ANIME");
    await http.get("/api/catalog/search?q=beta&type=ANIME");

    expect(mock).toHaveBeenCalledTimes(2);
    expect(enterTimes).toHaveLength(2);
    expect(enterTimes[1] - enterTimes[0]).toBeGreaterThanOrEqual(380);

    clearExternalCache();
    restoreGlobals();
  });
});
