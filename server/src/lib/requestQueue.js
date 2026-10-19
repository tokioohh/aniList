/**
 * Cola de peticiones hacia las APIs externas.
 *
 * Motivo: Jikan limita a 3 req/s y 60 req/min. Reaccionar con backoff después
 * de recibir un 429 no basta: hay que espaciar las llamadas de antemano.
 *
 * - spacingMs: mínimo entre dos llamadas consecutivas.
 * - maxPerMinute: ventana deslizante; si ya hubo 55 en el minuto, espera.
 *
 * Además comparte las peticiones idénticas en vuelo: si dos usuarios piden el
 * mismo detalle a la vez, solo sale una llamada externa.
 */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RequestQueue {
  constructor() {
    this.chain = Promise.resolve();
    this.lastCallAt = null;
    this.recentCalls = [];
    this.inFlight = new Map();
  }

  #waitTime(spacingMs, maxPerMinute) {
    const now = Date.now();
    let wait = 0;

    if (spacingMs > 0 && this.lastCallAt !== null) {
      wait = Math.max(wait, spacingMs - (now - this.lastCallAt));
    }

    if (maxPerMinute > 0) {
      // Ventana deslizante: se olvidan las llamadas que ya salieron del minuto.
      this.recentCalls = this.recentCalls.filter((t) => now - t < 60_000);
      if (this.recentCalls.length >= maxPerMinute) {
        wait = Math.max(wait, this.recentCalls[0] + 60_000 - now);
      }
    }

    return wait;
  }

  /**
   * Encola una tarea. Un fallo no rompe la cadena: las siguientes siguen.
   *
   * Solo se serializa cuando hay ritmo que respetar (Jikan). Las fuentes sin
   * límite estricto (TMDB) se ejecutan de inmediato: si no, una fuente caída
   * con reintentos bloquearía a las demás.
   */
  enqueue(task, { spacingMs = 0, maxPerMinute = 0 } = {}) {
    if (spacingMs === 0 && maxPerMinute === 0) {
      return (async () => task())();
    }

    const run = async () => {
      const wait = this.#waitTime(spacingMs, maxPerMinute);
      if (wait > 0) await sleep(wait);

      this.lastCallAt = Date.now();
      this.recentCalls.push(this.lastCallAt);
      return task();
    };

    this.chain = this.chain.then(run, run);
    return this.chain;
  }

  /**
   * Comparte la promesa entre llamadas idénticas simultáneas (misma clave).
   */
  share(key, factory) {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = (async () => factory())().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }
}

export const requestQueue = new RequestQueue();