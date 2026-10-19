import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { originCheck } from "../../middleware/originCheck.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { loginLimiter, registerLimiter } from "../../middleware/rateLimiters.js";
import { registerSchema, loginSchema } from "./schemas.js";
import {
  registerController,
  loginController,
  logoutController,
  meController,
} from "./controller.js";

export const authRouter = Router();

// Todas las mutaciones pasan por originCheck (CSRF), además de la cookie SameSite=Lax.
authRouter.post(
  "/auth/register",
  originCheck,
  registerLimiter,
  validate({ body: registerSchema }),
  registerController
);

authRouter.post(
  "/auth/login",
  originCheck,
  loginLimiter,
  validate({ body: loginSchema }),
  loginController
);

// Idempotente: cerrar sesión sin estar conectado también responde 204.
authRouter.post("/auth/logout", originCheck, logoutController);

authRouter.get("/auth/me", requireAuth, meController);