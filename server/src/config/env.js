import { z } from "zod";

// Valida TODAS las variables de entorno al arrancar y falla con un mensaje claro.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    // Origen permitido para CORS y para el control CSRF (originCheck)
    CLIENT_ORIGIN: z.url("CLIENT_ORIGIN debe ser una URL válida (ej. http://localhost:5173)"),
    // HS256 necesita suficiente entropía; menos de 32 caracteres es귀 inseguro
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
    JWT_EXPIRES_IN: z.string().min(1).default("7d"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
    // "API Read Access Token" de TMDB. Puede ser un marcador hasta la Fase 3.
    TMDB_API_KEY: z.string().min(1, "TMDB_API_KEY es obligatoria"),
    // Base de la API de anime. Por defecto Tenrai (esquema compatible con
    // Jikan v4) porque la API pública de Jikan (api.jikan.moe/v4) se
    // descontinuó el 1-oct-2026 (ver jikan-me/jikan-rest#613). Cámbiala a una
    // instancia propia de Jikan u otra base compatible si lo necesitas.
    JIKAN_BASE_URL: z.url().default("https://api.tenrai.org/v1"),
    // Opcional: si no está, se deriva de NODE_ENV
    COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  })
  // Sin .strict(): process.env trae cientos de variables del sistema (Path, TEMP...)
  // y strict las rechazaría. Aquí solo se validan las claves que nos importan.
  .loose();

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  console.error(
    `\n[env] Configuración inválida. Revisa tu archivo .env (copia .env.example):\n${details}\n`
  );
  process.exit(1);
}

export const env = parsed.data;

// La cookie es Secure en producción salvo que se fuerce el valor explícitamente.
export const cookieSecure =
  env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE === "true" : env.NODE_ENV === "production";

export const isProduction = env.NODE_ENV === "production";