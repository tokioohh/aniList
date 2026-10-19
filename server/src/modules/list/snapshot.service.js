import { prisma } from "../../lib/prisma.js";
import { getTitleDetail } from "../catalog/service.js";

// Los términos de TMDB prohíben conservar sus datos más de 6 meses: el
// snapshot se refresca a los 30 días y solo guarda lo mínimo del modelo Title.
const SNAPSHOT_MAX_AGE_DAYS = 30;
const MAX_BACKGROUND_REFRESH = 5;

const TYPE_BY_SOURCE = {
  TMDB_MOVIE: "MOVIE",
  TMDB_TV: "SERIES",
  JIKAN_ANIME: "ANIME",
};

export function isSnapshotStale(fetchedAt) {
  return Date.now() - new Date(fetchedAt).getTime() > SNAPSHOT_MAX_AGE_DAYS * 86_400_000;
}

/** Datos del snapshot a partir de la respuesta de la API externa. */
function snapshotData(external) {
  return {
    type: TYPE_BY_SOURCE[external.source],
    title: external.title,
    year: external.year,
    posterUrl: external.posterUrl,
    fetchedAt: new Date(),
  };
}

/**
 * Upsert del snapshot por (source, externalId).
 * El título SIEMPRE se pide a la API externa: si el cliente manda title, year o
 * posterUrl, se ignoran (no hay ni un solo campo de título en el body).
 */
export async function upsertTitleSnapshot(external) {
  return prisma.title.upsert({
    where: { source_externalId: { source: external.source, externalId: external.externalId } },
    create: {
      source: external.source,
      externalId: external.externalId,
      ...snapshotData(external),
    },
    update: snapshotData(external),
  });
}

/**
 * Refresca en segundo plano los snapshots vencidos de una página de la lista,
 * máximo 5 por petición y usando la misma cola de llamadas.
 * Si un refresco falla se conserva el snapshot y se reintenta más adelante.
 */
export function refreshStaleTitles(items) {
  const stale = items.filter((item) => isSnapshotStale(item.title.fetchedAt)).slice(0, MAX_BACKGROUND_REFRESH);

  for (const item of stale) {
    getTitleDetail(item.title.source, item.title.externalId)
      .then((external) => upsertTitleSnapshot(external))
      .catch((error) => {
        console.warn(
          `[snapshot] no se pudo refrescar ${item.title.source}/${item.title.externalId}: ${error.code ?? "error"}`
        );
      });
  }

  return stale.length;
}

/**
 * Refresco en el detalle: si el título ya existe en la BD, solo se actualiza.
 * Nunca se crea aquí: la creación ocurre al agregarlo a la lista.
 */
export async function refreshExistingTitle(source, externalId, external) {
  const existing = await prisma.title.findUnique({
    where: { source_externalId: { source, externalId } },
    select: { id: true, fetchedAt: true },
  });
  if (!existing) return null;
  return refreshIfStale(existing, external);
}

export function refreshIfStale(existing, external) {
  if (!isSnapshotStale(existing.fetchedAt)) return Promise.resolve(null);
  return upsertTitleSnapshot(external);
}

export { SNAPSHOT_MAX_AGE_DAYS };