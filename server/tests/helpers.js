import { randomUUID } from "node:crypto";
import request from "supertest";
import { vi } from "vitest";
import { prisma } from "../src/lib/prisma.js";

export const CLIENT_ORIGIN = "http://localhost:5173";

const originalFetch = globalThis.fetch;

/** Restaura fetch y timers: se llama en el afterEach de cada suite. */
export function restoreGlobals() {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
}

let ipCounter = 0;

/**
 * Cliente HTTP con cabecera Origin (obligatoria en mutaciones) y una IP propia.
 * La IP dedicada evita que los contadores de express-rate-limit (singletons a
 * nivel de módulo) se sharing entre tests: cada uno tiene su propio cubo.
 */
export function client(app, ip = `10.10.0.${(ipCounter = (ipCounter + 1) % 250) + 1}`) {
  const withCommon = (req) => req.set("Origin", CLIENT_ORIGIN).set("X-Forwarded-For", ip);

  return {
    ip,
    get: (url) => withCommon(request(app).get(url)),
    post: (url, body) => withCommon(request(app).post(url)).send(body ?? {}),
    patch: (url, body) => withCommon(request(app).patch(url)).send(body ?? {}),
    del: (url) => withCommon(request(app).delete(url)),
    /** Petición sin Origin, para probar el originCheck. */
    raw: () => request(app),
  };
}

export function cookieFrom(res) {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return "";
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw.split(";")[0];
}

export function findCookie(res, name = "token") {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return undefined;
  return (Array.isArray(setCookie) ? setCookie : [setCookie]).find((c) => c.startsWith(`${name}=`));
}

const VALID_PASSWORD = "Prueba1234";

/** Sufijo aleatorio corto: el username del esquema admite máx. 20 caracteres. */
export function uniqueSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Registra un usuario real contra la API y devuelve su cookie de sesión. */
export async function registerUser(app, options = {}) {
  const unique = uniqueSuffix();
  const payload = {
    username: options.username ?? `qa_${unique}`,
    email: options.email ?? `qa-${unique}@test.local`,
    password: options.password ?? VALID_PASSWORD,
    confirmPassword: options.confirmPassword ?? options.password ?? VALID_PASSWORD,
  };

  const http = client(app, options.ip);
  const res = await http.post("/api/auth/register", payload);

  if (res.status !== 201) {
    throw new Error(`registerUser falló con ${res.status}: ${JSON.stringify(res.body)}`);
  }

  return { http, payload, res, cookie: cookieFrom(res), user: res.body?.user };
}

/** Cliente ya autenticado de un usuario recién creado. */
export async function authenticatedUser(app, options = {}) {
  const { http, cookie, payload, user, res } = await registerUser(app, options);
  return {
    api: {
      get: (url) => http.get(url).set("Cookie", cookie),
      post: (url, body) => http.post(url, body).set("Cookie", cookie),
      patch: (url, body) => http.patch(url, body).set("Cookie", cookie),
      del: (url) => http.del(url).set("Cookie", cookie),
    },
    http,
    cookie,
    payload,
    user,
    registerRes: res,
  };
}

// Rango de externalId reservado para los títulos que crean los tests de lista,
// para poder limpiar sus snapshots sin tocar datos reales del catálogo.
export const TEST_EXTERNAL_ID_MIN = 9_000_000;

/**
 * Limpieza: los usuarios de test usan correos @test.local y se van en cascada
 * con sus entradas; sus snapshots huérfanos (Title sin UserTitle) también.
 */
export async function cleanupTestData() {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
  await prisma.title.deleteMany({
    where: { externalId: { gte: TEST_EXTERNAL_ID_MIN }, userTitles: { none: {} } },
  });
}

export { prisma };
