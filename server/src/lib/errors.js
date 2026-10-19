/**
 * Errores de la aplicación con código y status estables.
 * El manejador de errores solo expone `message` (nunca texto crudo del proveedor externo).
 */
export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }

  static badRequest(message, details) {
    return new AppError(400, "VALIDATION_ERROR", message, details);
  }

  static unauthorized(message = "Necesitas iniciar sesión para continuar.") {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbiddenOrigin(message = "Origen de la solicitud no permitido.") {
    return new AppError(403, "FORBIDDEN_ORIGIN", message);
  }

  static notFound(message = "Recurso no encontrado.") {
    return new AppError(404, "NOT_FOUND", message);
  }

  static conflict(message, details) {
    return new AppError(409, "CONFLICT", message, details);
  }

  static rateLimited(message = "Demasiadas solicitudes. Inténtalo más tarde.") {
    return new AppError(429, "RATE_LIMITED", message);
  }

  static upstream(message = "El servicio externo no respondió correctamente.") {
    return new AppError(502, "UPSTREAM_ERROR", message);
  }
}

/** Construye el cuerpo de error estándar: { error: { code, message, fieldErrors? } } */
export function buildErrorBody(code, message, fieldErrors) {
  return { error: fieldErrors ? { code, message, fieldErrors } : { code, message } };
}