import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { getTitleDetail } from "../catalog/service.js";
import { upsertTitleSnapshot, refreshStaleTitles } from "./snapshot.service.js";

const titleSelect = {
  source: true,
  externalId: true,
  type: true,
  title: true,
  year: true,
  posterUrl: true,
};

const entryInclude = { title: { select: titleSelect } };

// El listado necesita fetchedAt para saber qué snapshots están vencidos, pero ese
// campo no forma parte del contrato de respuesta: se quita antes de responder.
const listEntryInclude = { title: { select: { ...titleSelect, fetchedAt: true } } };

function withoutFetchedAt(title) {
  const { fetchedAt, ...rest } = title;
  return rest;
}

/** GET /api/me/list con filtros, paginación y orden por updatedAt desc. */
export async function listEntries(userId, filters) {
  const { status, reaction, favorite, type, page, limit } = filters;

  // El filtro siempre trae userId del token: un usuario nunca ve datos ajenos.
  const where = {
    userId,
    ...(status ? { status } : {}),
    ...(reaction ? { reaction } : {}),
    ...(favorite === undefined ? {} : { isFavorite: favorite }),
    ...(type ? { title: { type } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.userTitle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: listEntryInclude,
    }),
    prisma.userTitle.count({ where }),
  ]);

  // Los snapshots vencidos se refrescan sin bloquear la respuesta.
  refreshStaleTitles(rows);

  const items = rows.map((entry) => ({
    ...entry,
    title: withoutFetchedAt(entry.title),
  }));

  return { items, page, limit, total };
}

/**
 * Registro del usuario para un título, o null. Se lee DESPUÉS de la caché:
 * los datos por usuario nunca se cachean.
 */
export async function findMyEntry(userId, source, externalId) {
  return prisma.userTitle.findFirst({
    where: { userId, title: { source, externalId } },
    select: {
      id: true,
      status: true,
      reaction: true,
      isFavorite: true,
      rating: true,
      review: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * POST /api/me/list
 * El título se pide a la API externa para construir el snapshot en el servidor;
 * el cliente solo manda source y externalId.
 */
export async function createEntry(userId, payload) {
  const external = await getTitleDetail(payload.source, payload.externalId);

  const existing = await prisma.userTitle.findFirst({
    where: { userId, title: { source: payload.source, externalId: payload.externalId } },
    select: { id: true },
  });
  if (existing) {
    throw AppError.conflict("Ese título ya está en tu lista.");
  }

  const title = await upsertTitleSnapshot(external);

  try {
    return await prisma.userTitle.create({
      data: {
        userId,
        titleId: title.id,
        status: payload.status,
        reaction: payload.reaction ?? null,
        isFavorite: payload.isFavorite,
        rating: payload.rating ?? null,
        review: payload.review ?? null,
      },
      include: entryInclude,
    });
  } catch (error) {
    // Carrera: dos altas simultáneas del mismo título. El índice único
    // (userId, titleId) es la red de seguridad final.
    if (error?.code === "P2002") {
      throw AppError.conflict("Ese título ya está en tu lista.");
    }
    throw error;
  }
}

/** PATCH: filtra por { id, userId }. Si no coincide, 404 (nunca 403). */
export async function updateEntry(userId, id, data) {
  const entry = await prisma.userTitle.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!entry) throw AppError.notFound("Ese registro no existe en tu lista.");

  return prisma.userTitle.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.reaction !== undefined ? { reaction: data.reaction } : {}),
      ...(data.isFavorite !== undefined ? { isFavorite: data.isFavorite } : {}),
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.review !== undefined ? { review: data.review } : {}),
    },
    include: entryInclude,
  });
}

/** DELETE: mismo filtro { id, userId } → 404 si no es suyo. */
export async function deleteEntry(userId, id) {
  const entry = await prisma.userTitle.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!entry) throw AppError.notFound("Ese registro no existe en tu lista.");

  await prisma.userTitle.delete({ where: { id } });
}

/** GET /api/me/stats */
export async function getStats(userId) {
  const entries = await prisma.userTitle.findMany({
    where: { userId },
    select: {
      status: true,
      reaction: true,
      isFavorite: true,
      rating: true,
      title: { select: { type: true } },
    },
  });

  const byStatus = { PLAN_TO_WATCH: 0, WATCHING: 0, COMPLETED: 0, DROPPED: 0 };
  const byType = { MOVIE: 0, SERIES: 0, ANIME: 0 };
  let favorites = 0;
  let liked = 0;
  let disliked = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const entry of entries) {
    byStatus[entry.status] += 1;
    byType[entry.title.type] += 1;
    if (entry.isFavorite) favorites += 1;
    if (entry.reaction === "LIKED") liked += 1;
    if (entry.reaction === "DISLIKED") disliked += 1;
    if (typeof entry.rating === "number") {
      ratingSum += entry.rating;
      ratingCount += 1;
    }
  }

  return {
    total: entries.length,
    byStatus,
    byType,
    favorites,
    liked,
    disliked,
    // Un decimal, o null si el usuario todavía no ha calificado nada.
    avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
  };
}