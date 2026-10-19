import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

/**
 * Segunda capa de CSRF (la primera es la cookie SameSite=Lax).
 * En POST/PATCH/DELETE el header Origin debe existir y coincidir con CLIENT_ORIGIN:
 * un formulario cross-site o un fetch desde otra web nunca lo envía.
 */
export function originCheck(req, res, next) {
  const origin = req.get("origin");
  if (!origin || origin !== env.CLIENT_ORIGIN) {
    return next(AppError.forbiddenOrigin());
  }
  next();
}