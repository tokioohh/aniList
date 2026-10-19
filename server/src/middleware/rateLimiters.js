import { rateLimit } from "express-rate-limit";
import { buildErrorBody } from "../lib/errors.js";

// Respuesta 429 con el formato estándar de la API.
const handler = (_req, res) => {
  res
    .status(429)
    .json(buildErrorBody("RATE_LIMITED", "Demasiadas solicitudes. Inténtalo más tarde."));
};

// Detrás de un proxy inverso hay que configurar trust proxy para que la IP
// real llegue a los limitadores (por eso app.set("trust proxy", 1)).
const common = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
};

export const loginLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 10 });
export const registerLimiter = rateLimit({ ...common, windowMs: 60 * 60_000, limit: 10 });
export const catalogLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 60 });
export const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 100 });