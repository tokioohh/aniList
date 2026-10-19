import { request, toQuery } from "./http.js";

export function searchCatalog({ q, type = "ALL", page = 1 }) {
  return request(`/catalog/search${toQuery({ q, type, page })}`);
}

export function fetchTrending(type = "ANIME") {
  return request(`/catalog/trending${toQuery({ type })}`);
}

export function fetchTitleDetail(source, externalId) {
  return request(`/catalog/${source}/${externalId}`);
}