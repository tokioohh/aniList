/**
 * Único wrapper de fetch del cliente.
 * - credentials: "include" para que viaje la cookie httpOnly de sesión.
 * - Normaliza los errores de la API en un ApiError con status/code/fieldErrors.
 */
export class ApiError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export async function request(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor.");
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "INTERNAL_ERROR",
      payload?.error?.message ?? "Ocurrió un error inesperado.",
      payload?.error?.fieldErrors
    );
  }

  return payload;
}

/** Serializa queryparams omitiendo valores vacíos. */
export function toQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}