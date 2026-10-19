import { AppError } from "./errors.js";
import { requestQueue } from "./requestQueue.js";
import { externalCache, cacheKey } from "./cache.js";
import { isCircuitOpen, recordFailure, recordSuccess } from "./circuitBreaker.js";

const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 3; // hasta 3 reintentos después del intento inicial

// Mensaje único para todos los fallos de upstream: nunca se filtra el del proveedor.
const UPSTREAM_FALLBACK = "El servicio externo no respondió correctamente. Inténtalo más tarde.";

// Límites de Jikan aplicados por la cola (3 req/s y 60 req/min, con margen).
// TMDB va sin espaciado: espiar todo haría lenta la búsqueda.
const QUEUE_OPTIONS = {
  jikan: { spacingMs: 400, maxPerMinute: 55 },
  tmdb: { spacingMs: 0, maxPerMinute: 0 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryAfterMs(response) {
  const header = response.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 10_000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, Math.min(date - Date.now(), 10_000));
}

/** Backoff exponencial con jitter, acotado a unos segundos. */
function backoffMs(attempt) {
  const base = Math.min(500 * 2 ** attempt, 4_000);
  return base + Math.floor(Math.random() * 250);
}

async function singleFetch(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Petición JSON con timeout y reintentos acotados (solo 429, 5xx y red).
 * El cuerpo o mensaje del proveedor nunca se reenvía al cliente.
 */
async function fetchWithRetry(url, { headers = {}, provider = "tmdb" }) {
  // Corta-circuito: con el proveedor caído no encolamos ni reintentamos; se
  // responde al instante para no arrastrar al usuario ~35 s por cada petición.
  if (isCircuitOpen(provider)) {
    console.warn(`[upstream] ${provider} en corta-circuito; se omite la llamada`);
    throw AppError.upstream(UPSTREAM_FALLBACK);
  }

  return requestQueue.enqueue(
    async () => {
      let lastStatus = null;
      let lastError = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          const response = await singleFetch(url, headers);

          // Cualquier respuesta HTTP prueba que el proveedor está vivo.
          if (response.ok) {
            recordSuccess(provider);
            return await response.json();
          }

          if (response.status === 404) {
            recordSuccess(provider);
            throw AppError.notFound("No encontramos ese título.");
          }

          if (response.status === 429 || response.status >= 500) {
            lastStatus = response.status;
            if (attempt === MAX_RETRIES) break;
            await sleep(retryAfterMs(response) ?? backoffMs(attempt));
            continue;
          }

          // 4xx del cliente (401, 403…): el servicio responde, no está caído.
          recordSuccess(provider);
          throw AppError.upstream("El servicio externo rechazó la consulta.");
        } catch (error) {
          if (error instanceof AppError) throw error;

          // Error de red o timeout (AbortError).
          lastError = error;
          if (attempt === MAX_RETRIES) break;
          await sleep(backoffMs(attempt));
        }
      }

      // Se agotaron los reintentos: cuenta como fallo para el corta-circuito.
      recordFailure(provider);
      const reason = lastStatus ? `HTTP ${lastStatus}` : lastError?.name ?? "sin respuesta";
      console.warn(`[upstream] ${provider} agotó reintentos (${reason})`);
      throw AppError.upstream(UPSTREAM_FALLBACK);
    },
    QUEUE_OPTIONS[provider] ?? QUEUE_OPTIONS.tmdb
  );
}

/**
 * Petición externa cacheable (10 min) con peticiones idénticas en vuelo
 * compartidas: si dos usuarios piden lo mismo a la vez, sale una sola llamada.
 */
export function externalRequest({ provider, endpoint, params, headers, url }) {
  const key = cacheKey(provider, endpoint, params);
  if (externalCache.has(key)) return Promise.resolve(externalCache.get(key));

  return requestQueue.share(key, () => fetchWithRetry(url, { headers, provider })).then((data) => {
    externalCache.set(key, data);
    return data;
  });
}

export { fetchWithRetry, UPSTREAM_FALLBACK };