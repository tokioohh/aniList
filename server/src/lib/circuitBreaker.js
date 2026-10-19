/**
 * Corta-circuito por proveedor externo.
 *
 * Motivo: cuando una fuente está caída (red inalcanzable, 5xx persistente…),
 * cada petición paga el peor caso de `fetchWithRetry` (~4 intentos x 8 s de
 * timeout + backoff ≈ 35 s) antes de rendirse. Con el corta-circuito, tras
 * varias llamadas fallidas seguidas el proveedor se marca "abierto" y las
 * siguientes fallan al instante durante un enfriamiento, sin reintentos.
 *
 * No cambia el camino feliz: un solo éxito cierra el circuito y todo vuelve a
 * la normalidad. Es estado en memoria del proceso (suficiente para una sola
 * instancia; no pretende ser distribuido).
 */

const FAILURE_THRESHOLD = 3; // llamadas fallidas seguidas antes de abrir
const COOLDOWN_MS = 60_000; // tiempo "abierto" antes de dejar pasar un sondeo

const circuits = new Map(); // provider -> { failures, openedAt }

/**
 * ¿Está el proveedor en corta-circuito ahora mismo?
 * Al vencer el enfriamiento se deja pasar una llamada de sondeo (medio abierto):
 * si tiene éxito, se cierra; si falla, vuelve a abrirse.
 */
export function isCircuitOpen(provider, now = Date.now()) {
  const circuit = circuits.get(provider);
  if (!circuit || circuit.openedAt === null) return false;
  return now - circuit.openedAt < COOLDOWN_MS;
}

/** Registra una llamada que agotó sus reintentos (fallo real del proveedor). */
export function recordFailure(provider, now = Date.now()) {
  const circuit = circuits.get(provider) ?? { failures: 0, openedAt: null };
  circuit.failures += 1;
  if (circuit.failures >= FAILURE_THRESHOLD) circuit.openedAt = now;
  circuits.set(provider, circuit);
}

/** Registra una respuesta válida del proveedor: cierra el circuito. */
export function recordSuccess(provider) {
  circuits.delete(provider);
}

/** Limpia todo el estado (tests). */
export function resetCircuits() {
  circuits.clear();
}

export { FAILURE_THRESHOLD, COOLDOWN_MS };
