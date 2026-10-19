import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { buildErrorBody } from "./lib/errors.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { authRouter } from "./modules/auth/routes.js";
import { catalogRouter } from "./modules/catalog/routes.js";
import { listRouter } from "./modules/list/routes.js";

// Build del frontend: ../public respecto a src/.
// En Docker: /app/src -> /app/public. En desarrollo no existe y se omite el SPA.
const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");

export function createApp() {
  const app = express();

  // Registradoras de confianzas: detrás de un proxy inverso hay que configurar esto.
  app.set("trust proxy", 1);

  // Cabeceras de seguridad. CSP ajustada: el frontend evita estilos inline,
  // pero las imágenes se cargan directo del CDN de TMDB y MyAnimeList.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https://image.tmdb.org", "https://cdn.myanimelist.net"],
          scriptSrc: ["'self'"],
          // Google Fonts: la hoja de estilos va a fonts.googleapis.com y los
          // .woff2 a fonts.gstatic.com. Nada más se permite de origen externo.
          styleSrc: ["'self'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          // Se desactiva porque en la escuela el despliegue es http:// y
          // el navegador intentaría subir todo a https:// rompiendo la app.
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS con lista blanca: nunca "*", y con credenciales para la cookie de sesión.
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  // Límite de 10kb: frena body abuse.
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: false, limit: "10kb" }));
  app.use(cookieParser());

  // Morgan: nunca registra bodies, contraseñas ni tokens.
  app.use(morgan("combined"));

  // ---- API ----
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Límite general de /api; cada módulo añade el suyo más estricto.
  app.use("/api", apiLimiter);
  app.use("/api", authRouter);
  app.use("/api", catalogRouter);
  app.use("/api", listRouter);

  // Rutas /api desconocidas: JSON con el formato estándar, nunca el HTML del SPA.
  app.use("/api", (_req, res) => {
    res.status(404).json(buildErrorBody("NOT_FOUND", "Ruta de API no encontrada."));
  });

  // ---- Frontend compilado (producción, un solo origen) ----
  const hasBuild = fs.existsSync(INDEX_HTML);
  if (hasBuild) {
    app.use(express.static(PUBLIC_DIR));
    // Un asset inexistente responde 404: si devolviera el HTML del SPA, el
    // navegador intentaría ejecutar index.html como si fuera un .js.
    app.use("/assets", (_req, res) => {
      res.status(404).json(buildErrorBody("NOT_FOUND", "Recurso no encontrado."));
    });
    // Fallback del SPA (sintaxis de Express 5). No captura /api porque el 404
    // de /api ya se resolvió antes.
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(INDEX_HTML);
    });
  }

  app.use((_req, res) => {
    res
      .status(404)
      .json(buildErrorBody("NOT_FOUND", "Recurso no encontrado."));
  });

  app.use(errorHandler);

  return app;
}

export const app = createApp();