import path from "node:path";

// src/config/env.js valida process.env AL IMPORTAR y hace process.exit(1) si
// falta algo. Por eso el .env (y los valores de prueba) deben existir antes de
// que se importe cualquier módulo de src/.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../.env"));
} catch {
  // Sin .env no pasa nada: los valores de prueba de abajo rellenan los huecos.
  // Ojo: process.loadEnvFile no existe en Node < 20.12; el try/catch lo cubre.
}

// Lo que SÍ hereda del .env: DATABASE_URL (los tests usan la PostgreSQL de
// desarrollo) y JWT_SECRET.
// El resto se fuerza con valores de test para que la suite sea determinista
// aunque el .env de la máquina cambie: NODE_ENV=test (cookie sin Secure) y un
// CLIENT_ORIGIN fijo, que es el que exigen las cabeceras Origin de los tests.
process.env.NODE_ENV = "test";
process.env.PORT ??= "3001";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
// El .env local puede traer COOKIE_SECURE=true (docker sobre http:// no
// viaja la cookie); en test la cookie nunca debe llevar Secure.
delete process.env.COOKIE_SECURE;
// 48 caracteres: el esquema de env exige mínimo 32 para HS256.
process.env.JWT_SECRET ??= "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmn";
process.env.JWT_EXPIRES_IN ??= "7d";
process.env.DATABASE_URL ??=
  "postgresql://app_user:cambia_esta_password@localhost:5432/app_db?schema=public";
process.env.TMDB_API_KEY ??= "test-token";
// Base determinista para los tests: se fija al Jikan v4 original para que las
// aserciones de host/ruta (/v4/...) no dependan del .env de la máquina. En la
// app el valor por defecto es Tenrai, de esquema idéntico (jikan-rest#613).
process.env.JIKAN_BASE_URL = "https://api.jikan.moe/v4";
