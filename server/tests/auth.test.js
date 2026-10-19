import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma, client, cookieFrom, findCookie, cleanupTestData, restoreGlobals, uniqueSuffix, CLIENT_ORIGIN } from "./helpers.js";

const registerBody = (overrides = {}) => ({
  username: "ana_tester",
  email: "ana@test.local",
  password: "Prueba1234",
  confirmPassword: "Prueba1234",
  ...overrides,
});

describe("POST /api/auth/register", () => {
  afterAll(cleanupTestData);

  it("crea el usuario, devuelve 201 y la cookie de sesión", async () => {
    const unique = `reg_${uniqueSuffix()}`;
    const body = registerBody({ username: unique, email: `${unique}@test.local` });

    const res = await client(app).post("/api/auth/register", body);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: body.username, email: body.email });
    expect(typeof res.body.user.id).toBe("string");
    expect(res.body.user.createdAt).toBeTruthy();
    expect(findCookie(res)).toBeDefined();
  });

  it("normaliza el correo y el usuario a minúsculas", async () => {
    const unique = `norm_${uniqueSuffix()}`;
    const res = await client(app).post(
      "/api/auth/register",
      registerBody({ username: unique.toUpperCase(), email: `${unique.toUpperCase()}@TEST.local` })
    );

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe(unique.toLowerCase());
    expect(res.body.user.email).toBe(`${unique.toLowerCase()}@test.local`);
  });

  it("devuelve 400 con fieldErrors por cada campo inválido", async () => {
    const res = await client(app).post(
      "/api/auth/register",
      registerBody({ username: "a", email: "no-es-correo", password: "corta", confirmPassword: "otra" })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fieldErrors.username).toBeDefined();
    expect(res.body.error.fieldErrors.email).toBeDefined();
    expect(res.body.error.fieldErrors.password).toBeDefined();
    expect(res.body.error.fieldErrors.confirmPassword).toBeDefined();
  });

  it("devuelve 400 si las contraseñas no coinciden", async () => {
    const unique = `mm_${uniqueSuffix()}`;
    const res = await client(app).post(
      "/api/auth/register",
      registerBody({ username: unique, email: `${unique}@test.local`, confirmPassword: "Otra1234" })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.confirmPassword[0]).toMatch(/no coinciden/i);
  });

  it("devuelve 409 con fieldErrors.email si el correo ya existe", async () => {
    const unique = `dup_${uniqueSuffix()}`;
    const first = registerBody({ username: unique, email: `${unique}@test.local` });
    expect((await client(app).post("/api/auth/register", first)).status).toBe(201);

    const res = await client(app).post(
      "/api/auth/register",
      registerBody({ username: `${unique}_otro`, email: first.email })
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.fieldErrors.email).toBeDefined();
    expect(res.body.error.fieldErrors.username).toBeUndefined();
  });

  it("devuelve 409 con fieldErrors.username si el usuario ya existe", async () => {
    const unique = `dupu_${uniqueSuffix()}`;
    const first = registerBody({ username: unique, email: `${unique}@test.local` });
    expect((await client(app).post("/api/auth/register", first)).status).toBe(201);

    const res = await client(app).post(
      "/api/auth/register",
      registerBody({ username: unique, email: `${unique}_alt@test.local` })
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.fieldErrors.username).toBeDefined();
    expect(res.body.error.fieldErrors.email).toBeUndefined();
  });

  it("rechaza campos desconocidos en el body (esquema estricto)", async () => {
    const res = await client(app).post("/api/auth/register", registerBody({ role: "admin" }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/login", () => {
  afterAll(cleanupTestData);

  let credentials;
  let http;

  beforeAll(async () => {
    const unique = `login_${uniqueSuffix()}`;
    http = client(app);
    const reg = await http.post("/api/auth/register", {
      username: unique,
      email: `${unique}@test.local`,
      password: "Prueba1234",
      confirmPassword: "Prueba1234",
    });
    credentials = { email: reg.body.user.email, password: "Prueba1234" };
  });

  it("devuelve 200 y la cookie con la contraseña correcta", async () => {
    const res = await client(app).post("/api/auth/login", credentials);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(credentials.email);
    expect(findCookie(res)).toBeDefined();
  });

  it("devuelve 401 si la contraseña es incorrecta", async () => {
    const res = await client(app).post("/api/auth/login", {
      email: credentials.email,
      password: "Incorrecta123",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("devuelve 401 si el correo no existe, con un mensaje idéntico al de contraseña incorrecta", async () => {
    const inexistente = await client(app).post("/api/auth/login", {
      email: "nadie-aqui@test.local",
      password: "Prueba1234",
    });
    const incorrecta = await client(app).post("/api/auth/login", {
      email: credentials.email,
      password: "Incorrecta123",
    });

    expect(inexistente.status).toBe(401);
    expect(inexistente.body).toEqual(incorrecta.body);
    expect(inexistente.body.error.message).toBe("Credenciales inválidas.");
  });
});

describe("POST /api/auth/logout", () => {
  it("devuelve 204 y limpia la cookie", async () => {
    const unique = `lo_${uniqueSuffix()}`;
    const http = client(app);
    const reg = await http.post("/api/auth/register", {
      username: unique,
      email: `${unique}@test.local`,
      password: "Prueba1234",
      confirmPassword: "Prueba1234",
    });

    const res = await http.post("/api/auth/logout").set("Cookie", cookieFrom(reg));

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const cookie = findCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/^token=;/);
  });

  it("es idempotente: responde 204 aunque no haya sesión", async () => {
    const res = await client(app).post("/api/auth/logout");

    expect(res.status).toBe(204);
  });
});

describe("GET /api/auth/me", () => {
  afterAll(cleanupTestData);

  let cookie;
  let userId;

  beforeAll(async () => {
    const unique = `me_${uniqueSuffix()}`;
    const reg = await client(app).post("/api/auth/register", {
      username: unique,
      email: `${unique}@test.local`,
      password: "Prueba1234",
      confirmPassword: "Prueba1234",
    });
    cookie = cookieFrom(reg);
    userId = reg.body.user.id;
  });

  it("devuelve el usuario de la cookie válida", async () => {
    const res = await client(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: userId });
  });

  it("devuelve 401 sin cookie", async () => {
    const res = await client(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("devuelve 401 con el token manipulado (firma alterada)", async () => {
    const [, value] = cookie.split("=");
    const [header, signature] = value.split(".");
    const flipped = `${signature.slice(0, -1)}${signature.slice(-1) === "A" ? "B" : "A"}`;

    const res = await client(app)
      .get("/api/auth/me")
      .set("Cookie", `token=${header}.${header}.${flipped}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("devuelve 401 con un token expirado", async () => {
    const expired = jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: "HS256", expiresIn: -1 });

    const res = await client(app).get("/api/auth/me").set("Cookie", `token=${expired}`);

    expect(res.status).toBe(401);
  });

  it("devuelve 401 con un token firmado con alg: none", async () => {
    const none = jwt.sign({ sub: userId }, "", { algorithm: "none" });

    const res = await client(app).get("/api/auth/me").set("Cookie", `token=${none}`);

    expect(res.status).toBe(401);
  });

  it("devuelve 401 si el usuario del token ya no existe", async () => {
    const ghost = jwt.sign({ sub: "00000000-0000-0000-0000-000000000000" }, env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "7d",
    });

    const res = await client(app).get("/api/auth/me").set("Cookie", `token=${ghost}`);

    expect(res.status).toBe(401);
  });
});

describe("Seguridad de la respuesta de auth", () => {
  afterAll(cleanupTestData);

  it("ningún body expone passwordHash ni el hash de la contraseña", async () => {
    const unique = `hash_${uniqueSuffix()}`;
    const http = client(app);
    const payload = {
      username: unique,
      email: `${unique}@test.local`,
      password: "Prueba1234",
      confirmPassword: "Prueba1234",
    };

    const reg = await http.post("/api/auth/register", payload);
    const login = await client(app).post("/api/auth/login", {
      email: payload.email,
      password: payload.password,
    });
    const me = await client(app).get("/api/auth/me").set("Cookie", cookieFrom(reg));

    const stored = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { passwordHash: true },
    });

    const bodies = [reg.body, login.body, me.body];
    for (const body of bodies) {
      const text = JSON.stringify(body);
      expect(text).not.toContain("passwordHash");
      expect(text).not.toContain(stored.passwordHash);
      expect(text).not.toContain("$2b$");
    }
  });
});

describe("Control CSRF por Origin en las mutaciones", () => {
  const payload = {
    username: "origen_prueba",
    email: "origen@test.local",
    password: "Prueba1234",
    confirmPassword: "Prueba1234",
  };

  const mutations = [
    ["post", "/api/auth/register", payload],
    ["post", "/api/auth/login", { email: payload.email, password: payload.password }],
    ["post", "/api/auth/logout"],
  ];

  it.each(mutations)("%s %s devuelve 403 sin cabecera Origin", async (method, url, body) => {
    const res = await request(app)[method](url).send(body ?? {});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it.each(mutations)("%s %s devuelve 403 con un Origin ajeno", async (method, url, body) => {
    const res = await request(app)[method](url).set("Origin", "https://sitio-malicioso.example").send(body ?? {});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("acepta el Origin exactamente igual a CLIENT_ORIGIN", async () => {
    const res = await request(app).post("/api/auth/logout").set("Origin", CLIENT_ORIGIN).send({});

    expect(res.status).toBe(204);
  });
});

describe("Atributos de la cookie de sesión", () => {
  afterAll(cleanupTestData);

  it("es HttpOnly, SameSite=Lax, Path=/ y dura 7 días", async () => {
    const unique = `ck_${uniqueSuffix()}`;
    const res = await client(app).post("/api/auth/register", {
      username: unique,
      email: `${unique}@test.local`,
      password: "Prueba1234",
      confirmPassword: "Prueba1234",
    });

    const cookie = findCookie(res);
    expect(cookie).toMatch(/^token=.+;/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);

    const maxAge = /Max-Age=(\d+)/i.exec(cookie);
    expect(maxAge).not.toBeNull();
    expect(Number(maxAge[1])).toBe(7 * 24 * 60 * 60);
  });

  it("no lleva Secure porque NODE_ENV es test", async () => {
    const unique = `in_${uniqueSuffix()}`;
    const res = await client(app).post("/api/auth/register", {
      username: unique,
      email: `${unique}@test.local`,
      password: "Prueba1234",
      confirmPassword: "Prueba1234",
    });

    expect(env.NODE_ENV).toBe("test");
    expect(findCookie(res)).not.toMatch(/Secure/i);
  });
});

describe("Límite de intentos de login (429)", () => {
  afterEach(restoreGlobals);
  afterAll(cleanupTestData);

  // Los limitadores de express-rate-limit son singletons a nivel de módulo:
  // reimportar app.js con vi.resetModules() devuelve contadores a cero.
  it("bloquea con 429 RATE_LIMITED al undécimo intento desde la misma IP", async () => {
    vi.resetModules();
    const { app: freshApp } = await import("../src/app.js");

    const ip = "203.0.113.77";
    const body = { email: "no-existe@test.local", password: "Prueba1234" };
    const statuses = [];

    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const res = await request(freshApp)
        .post("/api/auth/login")
        .set("Origin", CLIENT_ORIGIN)
        .set("X-Forwarded-For", ip)
        .send(body);
      statuses.push(res.status);

      if (attempt === 11) {
        expect(res.status).toBe(429);
        expect(res.body.error.code).toBe("RATE_LIMITED");
      }
    }

    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses).toHaveLength(11);
  });

  it("otra IP no comparte el cubo del limitador", async () => {
    vi.resetModules();
    const { app: freshApp } = await import("../src/app.js");

    const body = { email: "no-existe@test.local", password: "Prueba1234" };
    const res = await request(freshApp)
      .post("/api/auth/login")
      .set("Origin", CLIENT_ORIGIN)
      .set("X-Forwarded-For", "198.51.100.9")
      .send(body);

    expect(res.status).toBe(401);
  });
});

describe("Rutas de API desconocidas", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("responde 404 en JSON, nunca el HTML del SPA", async () => {
    const res = await request(app).get("/api/no-existe");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
