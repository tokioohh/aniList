import * as catalogService from "./service.js";
import { findMyEntry } from "../list/service.js";
import { refreshExistingTitle } from "../list/snapshot.service.js";

export async function searchController(req, res) {
  const { q, type, page } = req.query;
  const payload = await catalogService.searchAll({ q, type, page });
  res.status(200).json(payload);
}

export async function trendingController(req, res) {
  const results = await catalogService.getTrending({ type: req.query.type });
  res.status(200).json({ results });
}

export async function detailController(req, res) {
  const { source, externalId } = req.params;

  const title = await catalogService.getTitleDetail(source, externalId);

  // Si el título ya está guardado, se actualiza su snapshot (solo update).
  // Si falla, se sigue mostrando el snapshot guardado y se reintenta luego.
  refreshExistingTitle(source, Number(externalId), title).catch((error) => {
    console.warn(`[snapshot] no se pudo refrescar ${source}/${externalId}: ${error.code ?? "error"}`);
  });

  // myEntry se lee DESPUÉS de la caché: los datos por usuario nunca se cachean.
  const myEntry = req.user ? await findMyEntry(req.user.id, source, Number(externalId)) : null;

  res.status(200).json({ ...title, myEntry });
}