import { ZodError } from "zod";
import { AppError, buildErrorBody } from "../lib/errors.js";

// Convierte los issues de Zod en { campo: [mensajes] } con mensajes en español.
function zodToFieldErrors(error) {
  const fieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_root");
    if (!fieldErrors[field]) fieldErrors[field] = [];
    fieldErrors[field].push(issue.message);
  }
  return fieldErrors;
}

// Manejador de errores central. En Express 5 los errores de handlers async
// (y los de middlewares) llegan aquí sin necesidad de envoltorios.
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Ocurrió un error inesperado. Inténtalo más tarde.";
  let fieldErrors;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    fieldErrors = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Revisa los datos enviados.";
    fieldErrors = zodToFieldErrors(err);
  } else if (err?.type === "entity.parse.failed") {
    // JSON malformado en el body
    status = 400;
    code = "VALIDATION_ERROR";
    message = "El cuerpo de la solicitud no es JSON válido.";
  } else if (err?.type === "entity.too.large") {
    status = 413;
    code = "VALIDATION_ERROR";
    message = "El cuerpo de la solicitud es demasiado grande.";
  }

  // El detalle (stack) se registra solo en el servidor; nunca se envía al cliente.
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(status).json(buildErrorBody(code, message, fieldErrors));
}