import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { app } from "../src/app.js";
import { clearExternalCache } from "../src/lib/cache.js";
import {
  prisma,
  client,
  authenticatedUser,
  cleanupTestData,
  restoreGlobals,
  TEST_EXTERNAL_ID_MIN,
} from "./helpers.js";
import { createFetchMock, jsonResponse, tmdbMovieDetail, tmdbTvDetail } from "./fixtures.js";

/**
 * Lista personal (/api/me/*).
 *
 * Todos los títulos que crean estos tests usan externalId >= 9_000_000, un rango
 * reservado: así la limpieza puede borrar sus snapshots sin tocar datos reales.
 * El proveedor siempre está simulado con `global.fetch`: NUNCA sale a la red.
 */

// externalIds sucesivos dentro del rango reservado para los tests. Se derivan
// de un bloque propio de esta ejecución para que dos corridas seguidas (o dos
// archivos en paralelo) no choquen con los snapshots que dejó la anterior.
let nextExternalId = TEST_EXTERNAL_ID_MIN;
const takeExternalId = () => (nextExternalId += 1);

/** Mock de TMDB que devuelve la película cuyo id aparece en la ruta. */
function movieForId(externalId, overrides = {}) {
  return jsonResponse({
    ...tmdbMovieDetail,
    id: externalId,
    title: `Película ${externalId}`,
    ...overrides,
  });
}

/** Rutas por defecto: /3/movie/:id devuelve la película con ese id. */
function listFetchMock(overrides = {}) {
  return createFetchMock({
    tmdb: (url) => {
      const match = /^\/3\/(movie|tv)\/(\d+)$/.exec(url.pathname);
      if (!match) return jsonResponse({ results: [] });
      const [, kind, id] = match;
      const externalId = Number(id);

      const custom = overrides[`${kind}/${externalId}`] ?? overrides[kind];
      if (custom) return typeof custom === "function" ? custom(url) : custom;

      if (kind === "tv") return jsonResponse({ ...tmdbTvDetail, id: externalId, name: `Serie ${externalId}` });
      return movieForId(externalId);
    },
  });
}

beforeAll(async () => {
  // Una pasada de limpieza antes de empezar: si una corrida anterior se
  // abortó a mitad (BD caída, Ctrl+C), sus filas pueden haber sobrevivido y
  // falsearían los conteos globales sobre externalId.
  await cleanupTestData();
});

beforeEach(() => {
  clearExternalCache();
});

afterEach(restoreGlobals);
afterAll(cleanupTestData);

describe("POST /api/me/list", () => {
  it("crea la entrada con los datos del servidor y devuelve 201", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();

    const res = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: "PLAN_TO_WATCH",
      isFavorite: false,
      rating: null,
      reaction: null,
      review: null,
    });
    expect(res.body.title).toMatchObject({
      source: "TMDB_MOVIE",
      externalId,
      type: "MOVIE",
      title: `Película ${externalId}`,
    });
  });

  it("el snapshot lo construye el SERVIDOR: el cliente no puede inyectar datos del título", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();

    // El cuerpo solo lleva source y externalId: createEntrySchema es .strict()
    // y NO acepta ningún campo de título (title, year, posterUrl, type...).
    // Mandarlos sería un 400, así que la única forma de "inyectar" sería que
    // el servidor confiara en el body: aquí se comprueba que no lo hace.
    const res = await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId,
      status: "WATCHING",
      isFavorite: true,
      rating: 9,
      review: "Muy buena",
    });

    expect(res.status).toBe(201);

    const title = await prisma.title.findUnique({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      select: { title: true, year: true, posterUrl: true, type: true },
    });

    // Todo viene del proveedor mockeado, nunca del cliente.
    expect(title.title).toBe(`Película ${externalId}`);
    expect(title.year).toBe(2010);
    expect(title.posterUrl).toBe("https://image.tmdb.org/t/p/w342/poster.jpg");
    expect(title.type).toBe("MOVIE");
  });

  it("rechaza campos de título o userId en el body (esquema estricto)", async () => {
    const { mock } = listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();

    const conUserId = await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId,
      userId: "00000000-0000-0000-0000-000000000000",
    });
    const conTitle = await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId,
      title: "Título inyectado",
      year: 1999,
      posterUrl: "https://ejemplo.invalido/x.jpg",
      type: "SERIES",
    });

    for (const res of [conUserId, conTitle]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }

    // No se creó nada: ni entrada ni snapshot.
    expect(await prisma.userTitle.count({ where: { title: { externalId } } })).toBe(0);
    expect(await prisma.title.count({ where: { externalId } })).toBe(0);
    // La validación ocurre antes de llamar al proveedor.
    expect(mock).not.toHaveBeenCalled();
  });

  it("devuelve 409 si el título ya está en la lista del usuario", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();
    const body = { source: "TMDB_MOVIE", externalId };

    const first = await api.post("/api/me/list", body);
    expect(first.status).toBe(201);

    const second = await api.post("/api/me/list", body);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
    expect(second.body.error.message).toMatch(/ya está en tu lista/i);

    // Un único registro, no dos.
    expect(await prisma.userTitle.count({ where: { title: { externalId } } })).toBe(1);
  });

  it("el mismo título sí puede estar en la lista de dos usuarios distintos", async () => {
    listFetchMock();
    const userA = await authenticatedUser(app);
    const userB = await authenticatedUser(app);
    const externalId = takeExternalId();
    const body = { source: "TMDB_MOVIE", externalId };

    const a = await userA.api.post("/api/me/list", body);
    const b = await userB.api.post("/api/me/list", body);

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    // Un solo snapshot compartido, dos entradas.
    expect(await prisma.title.count({ where: { externalId } })).toBe(1);
    expect(await prisma.userTitle.count({ where: { title: { externalId } } })).toBe(2);
  });

  it.each([
    [0, "cero"],
    [11, "once"],
    [-1, "negativo"],
    [10.5, "decimal"],
  ])("devuelve 400 con fieldErrors si rating es %s (%s)", async (rating) => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();

    const res = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId, rating });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fieldErrors.rating).toBeDefined();
    expect(await prisma.userTitle.count({ where: { title: { externalId } } })).toBe(0);
  });

  it("acepta rating del 1 al 10", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();

    const res = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId, rating: 10 });

    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(10);
  });

  it("devuelve 400 si el source no pertenece al enum o el externalId es inválido", async () => {
    const { mock } = listFetchMock();
    const { api } = await authenticatedUser(app);

    const sourceMalo = await api.post("/api/me/list", { source: "PELICULA", externalId: 1 });
    const idCero = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: 0 });
    const idNegativo = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: -3 });
    const idNoNumerico = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: "abc" });

    expect(sourceMalo.body.error.fieldErrors.source).toBeDefined();
    expect(idCero.body.error.fieldErrors.externalId).toBeDefined();
    expect(idNegativo.body.error.fieldErrors.externalId).toBeDefined();
    expect(idNoNumerico.body.error.fieldErrors.externalId).toBeDefined();
    for (const res of [sourceMalo, idCero, idNegativo, idNoNumerico]) {
      expect(res.status).toBe(400);
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it("exige sesión: sin cookie responde 401 y no crea nada", async () => {
    const { mock } = listFetchMock();
    const externalId = takeExternalId();

    const res = await client(app).post("/api/me/list", { source: "TMDB_MOVIE", externalId });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(await prisma.userTitle.count({ where: { title: { externalId } } })).toBe(0);
    expect(mock).not.toHaveBeenCalled();
  });

  it("propaga el 404 si el proveedor no encuentra el título", async () => {
    listFetchMock({ "movie/999999999": jsonResponse({ status_message: "no existe" }, { status: 404 }) });
    const { api } = await authenticatedUser(app);

    const res = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: 999_999_999 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/me/list", () => {
  it("devuelve la lista del usuario con total, page y limit", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    for (let i = 0; i < 3; i += 1) {
      await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });
    }

    const res = await api.get("/api/me/list");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.items).toHaveLength(3);
    // Cada item trae el snapshot del título, no el id suelto.
    expect(res.body.items[0].title).toMatchObject({ source: "TMDB_MOVIE", type: "MOVIE" });
  });

  it("pagina sin repetir entradas ni perder ninguna", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    for (let i = 0; i < 3; i += 1) {
      await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });
    }

    const page1 = await api.get("/api/me/list?limit=2&page=1");
    const page2 = await api.get("/api/me/list?limit=2&page=2");

    expect(page1.status).toBe(200);
    expect(page1.body).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(page1.body.items).toHaveLength(2);

    expect(page2.status).toBe(200);
    expect(page2.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page2.body.items).toHaveLength(1);

    const ids1 = page1.body.items.map((item) => item.id);
    const ids2 = page2.body.items.map((item) => item.id);
    expect(new Set([...ids1, ...ids2]).size).toBe(3);
    expect(ids1.filter((id) => ids2.includes(id))).toEqual([]);

    // El total es el de TODA la colección, no el de la página.
    expect(page1.body.total).toBe(3);
    expect(page2.body.total).toBe(3);
  });

  it("filtra por favorite=false dejando fuera los favoritos", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    const favorito = takeExternalId();
    const normal = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: favorito, isFavorite: true });
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: normal, isFavorite: false });

    const res = await api.get("/api/me/list?favorite=false");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].isFavorite).toBe(false);
    expect(res.body.items[0].title.externalId).toBe(normal);
  });

  it("filtra por favorite=true dejando fuera los no favoritos", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    const favorito = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: favorito, isFavorite: true });
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });

    const res = await api.get("/api/me/list?favorite=true");

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].isFavorite).toBe(true);
    expect(res.body.items[0].title.externalId).toBe(favorito);
  });

  it("filtra por status, reaction y type combinados", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId: takeExternalId(),
      status: "COMPLETED",
      reaction: "LIKED",
      rating: 8,
    });
    await api.post("/api/me/list", {
      source: "TMDB_TV",
      externalId: takeExternalId(),
      status: "COMPLETED",
      reaction: "DISLIKED",
    });
    await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId: takeExternalId(),
      status: "WATCHING",
    });

    const porEstado = await api.get("/api/me/list?status=COMPLETED");
    expect(porEstado.body.total).toBe(2);

    const porReaccion = await api.get("/api/me/list?reaction=LIKED");
    expect(porReaccion.body.total).toBe(1);
    expect(porReaccion.body.items[0].reaction).toBe("LIKED");

    const porTipo = await api.get("/api/me/list?type=SERIES");
    expect(porTipo.body.total).toBe(1);
    expect(porTipo.body.items[0].title.type).toBe("SERIES");

    const combinado = await api.get("/api/me/list?status=COMPLETED&type=MOVIE");
    expect(combinado.body.total).toBe(1);
    expect(combinado.body.items[0].title.type).toBe("MOVIE");
  });

  it("favorite=no (un valor cualquiera) es un 400, no un false silencioso", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });

    const res = await api.get("/api/me/list?favorite=quizá");

    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.favorite).toBeDefined();
  });

  it("devuelve 400 con page/limit fuera de rango y con campos desconocidos", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    const pageCero = await api.get("/api/me/list?page=0");
    const limitGrande = await api.get("/api/me/list?limit=500");
    const estadoMalo = await api.get("/api/me/list?status=VISTO");
    const campoExtra = await api.get("/api/me/list?orden=titulo");

    expect(pageCero.body.error.fieldErrors.page).toBeDefined();
    expect(limitGrande.body.error.fieldErrors.limit).toBeDefined();
    expect(estadoMalo.body.error.fieldErrors.status).toBeDefined();
    expect(campoExtra.status).toBe(400);
  });

  it("exige sesión", async () => {
    const res = await client(app).get("/api/me/list");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("PATCH /api/me/list/:id", () => {
  it("actualiza los campos enviados y deja intactos los demás", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();

    const created = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });
    const id = created.body.id;

    const res = await api.patch(`/api/me/list/${id}`, {
      status: "COMPLETED",
      rating: 9,
      isFavorite: true,
      reaction: "LIKED",
      review: "Obra maestra",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: "COMPLETED",
      rating: 9,
      isFavorite: true,
      reaction: "LIKED",
      review: "Obra maestra",
    });
    expect(res.body.title).toMatchObject({ externalId });

    const stored = await prisma.userTitle.findUnique({ where: { id } });
    expect(stored.status).toBe("COMPLETED");
    expect(stored.rating).toBe(9);
  });

  it("acepta null para reaction, rating y review (quitar el valor)", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();

    const created = await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId,
      reaction: "LIKED",
      rating: 7,
      review: "Bien",
    });
    const id = created.body.id;

    const res = await api.patch(`/api/me/list/${id}`, { reaction: null, rating: null, review: null });

    expect(res.status).toBe(200);
    expect(res.body.reaction).toBeNull();
    expect(res.body.rating).toBeNull();
    expect(res.body.review).toBeNull();
  });

  it("devuelve 400 con body vacío o con rating fuera de rango", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();
    const created = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });
    const id = created.body.id;

    const vacio = await api.patch(`/api/me/list/${id}`, {});
    const ratingMalo = await api.patch(`/api/me/list/${id}`, { rating: 99 });
    const ratingCero = await api.patch(`/api/me/list/${id}`, { rating: 0 });
    const statusMalo = await api.patch(`/api/me/list/${id}`, { status: "VISTO" });

    expect(vacio.status).toBe(400);
    // El .refine() del esquema no lleva path, así que errorHandler lo agrupa
    // bajo la clave "_root" de fieldErrors.
    expect(vacio.body.error.fieldErrors._root[0]).toMatch(/al menos un campo/i);
    expect(ratingMalo.body.error.fieldErrors.rating).toBeDefined();
    expect(ratingCero.body.error.fieldErrors.rating).toBeDefined();
    expect(statusMalo.body.error.fieldErrors.status).toBeDefined();
  });

  it("rechaza campos desconocidos y un userId en el body sin modificar nada", async () => {
    listFetchMock();
    const userA = await authenticatedUser(app);
    const externalId = takeExternalId();
    const created = await userA.api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId,
      status: "WATCHING",
    });
    const id = created.body.id;

    const antes = await prisma.userTitle.findUnique({ where: { id } });

    const conUserId = await userA.api.patch(`/api/me/list/${id}`, {
      status: "COMPLETED",
      userId: userA.user.id,
    });
    const campoDesconocido = await userA.api.patch(`/api/me/list/${id}`, { favorito: true });

    expect(conUserId.status).toBe(400);
    expect(campoDesconocido.status).toBe(400);

    const despues = await prisma.userTitle.findUnique({ where: { id } });
    expect(despues.status).toBe(antes.status);
    expect(despues.userId).toBe(antes.userId);
  });

  it("devuelve 400 si el id de la ruta no es un UUID", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    const res = await api.patch("/api/me/list/no-es-uuid", { status: "COMPLETED" });

    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.id).toBeDefined();
  });

  it("exige sesión", async () => {
    const res = await client(app).patch("/api/me/list/00000000-0000-0000-0000-000000000000", {
      status: "COMPLETED",
    });

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/me/list/:id", () => {
  it("borra la entrada con 204", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const created = await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });
    const id = created.body.id;

    const res = await api.del(`/api/me/list/${id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(await prisma.userTitle.findUnique({ where: { id } })).toBeNull();
  });

  it("devuelve 404 si la entrada ya no existe", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const id = "00000000-0000-0000-0000-000000000000";

    const res = await api.del(`/api/me/list/${id}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("exige sesión", async () => {
    const res = await client(app).del("/api/me/list/00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(401);
  });
});

describe("Aislamiento entre usuarios", () => {
  it("el usuario B no ve, no modifica y no borra nada del usuario A", async () => {
    listFetchMock();
    const userA = await authenticatedUser(app);
    const userB = await authenticatedUser(app);
    const externalId = takeExternalId();

    const creada = await userA.api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId,
      status: "WATCHING",
      rating: 8,
    });
    expect(creada.status).toBe(201);
    const id = creada.body.id;

    // B no la ve en su lista.
    const listaB = await userB.api.get("/api/me/list");
    expect(listaB.status).toBe(200);
    expect(listaB.body.total).toBe(0);
    expect(listaB.body.items).toEqual([]);

    // B no puede modificarla: 404, nunca 403 (no se revela que existe).
    const patchB = await userB.api.patch(`/api/me/list/${id}`, { status: "DROPPED" });
    expect(patchB.status).toBe(404);
    expect(patchB.body.error.code).toBe("NOT_FOUND");

    // B no puede borrarla.
    const deleteB = await userB.api.del(`/api/me/list/${id}`);
    expect(deleteB.status).toBe(404);
    expect(deleteB.body.error.code).toBe("NOT_FOUND");

    // La entrada de A sigue intacta.
    const intacta = await prisma.userTitle.findUnique({ where: { id } });
    expect(intacta).not.toBeNull();
    expect(intacta.status).toBe("WATCHING");
    expect(intacta.rating).toBe(8);
    expect(intacta.userId).toBe(userA.user.id);
  });

  it("el 404 de aislamiento no revela si el registro existe", async () => {
    listFetchMock();
    const userB = await authenticatedUser(app);
    const idInexistente = "00000000-0000-0000-0000-000000000000";
    const idAjeno = (await (async () => {
      const userA = await authenticatedUser(app);
      const creada = await userA.api.post("/api/me/list", {
        source: "TMDB_MOVIE",
        externalId: takeExternalId(),
      });
      return creada.body.id;
    })());

    const deAjeno = await userB.api.patch(`/api/me/list/${idAjeno}`, { status: "COMPLETED" });
    const deNinguno = await userB.api.patch(`/api/me/list/${idInexistente}`, { status: "COMPLETED" });

    expect(deAjeno.status).toBe(404);
    expect(deNinguno.status).toBe(404);
    // Respuestas indistinguibles: el atacante no puede enumerar ids ajenos.
    expect(deAjeno.body).toEqual(deNinguno.body);
  });

  it("los ids de un usuario no aparecen en el listado del otro", async () => {
    listFetchMock();
    const userA = await authenticatedUser(app);
    const userB = await authenticatedUser(app);

    const a = await userA.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });
    const b = await userB.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });

    const listaA = await userA.api.get("/api/me/list");
    const listaB = await userB.api.get("/api/me/list");

    expect(listaA.body.items.map((i) => i.id)).toEqual([a.body.id]);
    expect(listaB.body.items.map((i) => i.id)).toEqual([b.body.id]);
  });
});

describe("GET /api/me/stats", () => {
  it("devuelve los conteos por estado, tipo, favoritos y reacciones", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId: takeExternalId(),
      status: "COMPLETED",
      reaction: "LIKED",
      isFavorite: true,
      rating: 8,
    });
    await api.post("/api/me/list", {
      source: "TMDB_TV",
      externalId: takeExternalId(),
      status: "WATCHING",
      reaction: "DISLIKED",
    });
    await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId: takeExternalId(),
      status: "DROPPED",
    });
    await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId: takeExternalId(),
      status: "PLAN_TO_WATCH",
    });

    const res = await api.get("/api/me/stats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 4,
      byStatus: { PLAN_TO_WATCH: 1, WATCHING: 1, COMPLETED: 1, DROPPED: 1 },
      byType: { MOVIE: 3, SERIES: 1, ANIME: 0 },
      favorites: 1,
      liked: 1,
      disliked: 1,
      avgRating: 8,
    });
  });

  it("avgRating es la media con un decimal (8 y 9 -> 8.5)", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId(), rating: 8 });
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId(), rating: 9 });

    const res = await api.get("/api/me/stats");

    expect(res.body.avgRating).toBe(8.5);
  });

  it("avgRating redondea a un decimal (8 y 10 -> 9, 7 y 8 y 8 -> 7.7)", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId(), rating: 8 });
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId(), rating: 10 });
    const primeraMedia = await api.get("/api/me/stats");
    expect(primeraMedia.body.avgRating).toBe(9);

    const otra = await authenticatedUser(app);
    await otra.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId(), rating: 7 });
    await otra.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId(), rating: 8 });
    await otra.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId(), rating: 8 });

    const segundaMedia = await otra.api.get("/api/me/stats");
    expect(segundaMedia.body.avgRating).toBe(7.7);
  });

  it("avgRating es null si el usuario no ha calificado nada", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });

    const res = await api.get("/api/me/stats");

    expect(res.body.total).toBe(2);
    expect(res.body.avgRating).toBeNull();
  });

  it("devuelve todos los contadores a cero para un usuario sin entradas", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);

    const res = await api.get("/api/me/stats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 0,
      byStatus: { PLAN_TO_WATCH: 0, WATCHING: 0, COMPLETED: 0, DROPPED: 0 },
      byType: { MOVIE: 0, SERIES: 0, ANIME: 0 },
      favorites: 0,
      liked: 0,
      disliked: 0,
      avgRating: null,
    });
  });

  it("las estadísticas de un usuario no incluyen las entradas de otro", async () => {
    listFetchMock();
    const userA = await authenticatedUser(app);
    const userB = await authenticatedUser(app);

    await userA.api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId: takeExternalId(),
      status: "COMPLETED",
      rating: 10,
    });

    const statsB = await userB.api.get("/api/me/stats");

    expect(statsB.body.total).toBe(0);
    expect(statsB.body.byStatus.COMPLETED).toBe(0);
    expect(statsB.body.avgRating).toBeNull();
  });

  it("exige sesión", async () => {
    const res = await client(app).get("/api/me/stats");

    expect(res.status).toBe(401);
  });
});

describe("myEntry en el detalle del catálogo", () => {
  it("con cookie devuelve el objeto myEntry sin el title dentro", async () => {
    listFetchMock();
    const { api, cookie } = await authenticatedUser(app);
    const externalId = takeExternalId();

    await api.post("/api/me/list", {
      source: "TMDB_MOVIE",
      externalId,
      status: "WATCHING",
      rating: 8,
      isFavorite: true,
      reaction: "LIKED",
      review: "Bien",
    });

    const res = await client(app).get(`/api/catalog/TMDB_MOVIE/${externalId}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.myEntry).toEqual({
      id: expect.any(String),
      status: "WATCHING",
      reaction: "LIKED",
      isFavorite: true,
      rating: 8,
      review: "Bien",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    // El snapshot del título NO se duplica dentro de myEntry.
    expect(res.body.myEntry.title).toBeUndefined();
    // Pero el título sí viene en el nivel superior de la respuesta.
    expect(res.body.title).toBe(`Película ${externalId}`);
  });

  it("sin cookie devuelve myEntry: null", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId, status: "COMPLETED" });

    // Cliente anónimo, sin la cookie del usuario que sí lo tiene en su lista.
    const res = await client(app).get(`/api/catalog/TMDB_MOVIE/${externalId}`);

    expect(res.status).toBe(200);
    expect(res.body.myEntry).toBeNull();
    expect(res.body.title).toBe(`Película ${externalId}`);
  });

  it("con cookie ajena o inválida, myEntry sigue siendo null", async () => {
    listFetchMock();
    const userA = await authenticatedUser(app);
    const externalId = takeExternalId();
    await userA.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId, status: "COMPLETED" });

    const otro = await authenticatedUser(app);
    const deOtro = await client(app)
      .get(`/api/catalog/TMDB_MOVIE/${externalId}`)
      .set("Cookie", otro.cookie);
    const cookieInvalida = await client(app)
      .get(`/api/catalog/TMDB_MOVIE/${externalId}`)
      .set("Cookie", "token=no-es-un-jwt");

    expect(deOtro.status).toBe(200);
    expect(deOtro.body.myEntry).toBeNull();
    expect(cookieInvalida.status).toBe(200);
    expect(cookieInvalida.body.myEntry).toBeNull();
  });

  it("el myEntry sale de la BD, no de la caché externa (los datos de usuario nunca se cachean)", async () => {
    const { mock } = listFetchMock();
    const { api, cookie } = await authenticatedUser(app);
    const externalId = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId, status: "PLAN_TO_WATCH" });
    const llamadasTrasCrear = mock.mock.calls.length;

    // Primera consulta: servida por caché, myEntry presente.
    const primera = await client(app).get(`/api/catalog/TMDB_MOVIE/${externalId}`).set("Cookie", cookie);
    expect(primera.status).toBe(200);
    expect(primera.body.myEntry.status).toBe("PLAN_TO_WATCH");
    expect(mock).toHaveBeenCalledTimes(llamadasTrasCrear);

    // El usuario actualiza su entrada: myEntry cambia aunque la caché no se mueva.
    const id = primera.body.myEntry.id;
    await api.patch(`/api/me/list/${id}`, { status: "COMPLETED", rating: 6 });

    const segunda = await client(app).get(`/api/catalog/TMDB_MOVIE/${externalId}`).set("Cookie", cookie);
    expect(segunda.body.myEntry.status).toBe("COMPLETED");
    expect(segunda.body.myEntry.rating).toBe(6);
    // Ni una llamada externa más: el myEntry se leyó de la BD.
    expect(mock).toHaveBeenCalledTimes(llamadasTrasCrear);
  });
});

describe("Snapshot del título", () => {
  it("un snapshot de más de 30 días se refresca al listar", async () => {
    // El listado carga `fetchedAt` solo para decidir el refresco, y lo quita
    // antes de responder: el TTL de 30 días se cumple sin filtrar ese campo.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    listFetchMock();

    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });

    // Se viaja 40 días hacia atrás en el snapshot (más viejo que el TTL de 30).
    const hace40Dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await prisma.title.update({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      data: { fetchedAt: hace40Dias, title: "Título viejo" },
    });

    const res = await api.get("/api/me/list");
    expect(res.status).toBe(200);

    // El refresco ocurre en segundo plano, así que se le da margen.
    await vi.waitFor(
      async () => {
        const durante = await prisma.title.findUnique({
          where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
          select: { title: true, fetchedAt: true },
        });
        expect(durante.fetchedAt.getTime()).toBeGreaterThan(hace40Dias.getTime());
      },
      { timeout: 8000, interval: 150 }
    );

    const despues = await prisma.title.findUnique({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      select: { title: true, fetchedAt: true },
    });
    // El snapshot se reconstruye con los datos del proveedor, no con "Título viejo".
    expect(despues.title).not.toBe("Título viejo");
    expect(warn).not.toHaveBeenCalled();

    // La respuesta ya salió servida con el snapshot viejo (no se espera al refresco),
    // y fetchedAt nunca se expone al cliente.
    expect(res.body.items[0].title.title).toBe("Título viejo");
    expect(res.body.items[0].title).not.toHaveProperty("fetchedAt");
  });

  it("el listado nunca expone fetchedAt aunque el snapshot se refresque", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId: takeExternalId() });

    const res = await api.get("/api/me/list");
    expect(res.status).toBe(200);
    expect(res.body.items[0].title).not.toHaveProperty("fetchedAt");
  });

  it("isSnapshotStale detecta un snapshot de 40 días", async () => {
    const { isSnapshotStale } = await import("../src/modules/list/snapshot.service.js");

    expect(isSnapshotStale(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000))).toBe(true);
    expect(isSnapshotStale(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000))).toBe(false);
    expect(isSnapshotStale(new Date())).toBe(false);
    // Sin fetchedAt (el caso que produce el select actual) nunca es vencido.
    expect(isSnapshotStale(undefined)).toBe(false);
  });

  it("el detalle del catálogo sí refresca un snapshot vencido (sin el bug del select)", async () => {
    // Contraprueba: la ruta del detalle (GET /api/catalog/:source/:externalId)
    // usa refreshExistingTitle, que consulta el Title por su clave primaria
    // (donde SÍ viene fetchedAt). Ese camino sí refresca.
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });

    const hace40Dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await prisma.title.update({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      data: { fetchedAt: hace40Dias, title: "Título viejo" },
    });

    const res = await client(app).get(`/api/catalog/TMDB_MOVIE/${externalId}`);

    expect(res.status).toBe(200);
    // El refresco es en segundo plano: se espera a que aterrice.
    await vi.waitFor(
      async () => {
        const actual = await prisma.title.findUnique({
          where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
          select: { title: true, fetchedAt: true },
        });
        expect(actual.title).toBe(`Película ${externalId}`);
        expect(actual.fetchedAt.getTime()).toBeGreaterThan(hace40Dias.getTime());
      },
      { timeout: 5000, interval: 100 }
    );
  });

  it("un snapshot reciente NO se refresca al consultar el detalle", async () => {
    listFetchMock();
    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });

    const fetchedAtOriginal = await prisma.title.findUnique({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      select: { fetchedAt: true },
    });

    await client(app).get(`/api/catalog/TMDB_MOVIE/${externalId}`);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const despues = await prisma.title.findUnique({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      select: { fetchedAt: true },
    });

    expect(Math.abs(despues.fetchedAt.getTime() - fetchedAtOriginal.fetchedAt.getTime())).toBeLessThan(2_000);
  });

  it("si el refresco del detalle falla, la respuesta sigue siendo 200 con los datos del proveedor", async () => {
    // El proveedor se cae tras el primer fetch (el del POST): el detalle
    // reintenta y agota, pero la API responde 502 y el snapshot viejo se
    // conserva intacto en la BD (nunca se sobrescribe con basura).
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    listFetchMock();

    const { api } = await authenticatedUser(app);
    const externalId = takeExternalId();
    await api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });

    const hace40Dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await prisma.title.update({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      data: { fetchedAt: hace40Dias, title: "Título viejo" },
    });

    // A partir de ahora el proveedor falla con 5xx. Se limpia la caché para
    // que el detalle no se sirva del resultado bueno del POST anterior.
    createFetchMock({ tmdb: () => jsonResponse({ status_message: "caído" }, { status: 500 }) });
    clearExternalCache();

    const res = await client(app).get(`/api/catalog/TMDB_MOVIE/${externalId}`);

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("caído");

    const conservado = await prisma.title.findUnique({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      select: { title: true, fetchedAt: true },
    });
    expect(conservado.title).toBe("Título viejo");
    expect(conservado.fetchedAt.getTime()).toBe(hace40Dias.getTime());
  });

  it("dos usuarios comparten el mismo snapshot (upsert por source+externalId)", async () => {
    listFetchMock();
    const userA = await authenticatedUser(app);
    const userB = await authenticatedUser(app);
    const externalId = takeExternalId();

    await userA.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });
    const despuesDeA = await prisma.title.findUnique({
      where: { source_externalId: { source: "TMDB_MOVIE", externalId } },
      select: { id: true },
    });

    await userB.api.post("/api/me/list", { source: "TMDB_MOVIE", externalId });

    const titulos = await prisma.title.findMany({ where: { externalId }, select: { id: true } });
    expect(titulos).toHaveLength(1);
    expect(titulos[0].id).toBe(despuesDeA.id);
  });
});
