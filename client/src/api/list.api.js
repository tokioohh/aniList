import { request, toQuery } from "./http.js";

export function fetchMyList(filters = {}) {
  return request(`/me/list${toQuery(filters)}`);
}

export function createListEntry(payload) {
  return request("/me/list", { method: "POST", body: payload });
}

export function updateListEntry(id, payload) {
  return request(`/me/list/${id}`, { method: "PATCH", body: payload });
}

export function deleteListEntry(id) {
  return request(`/me/list/${id}`, { method: "DELETE" });
}

export function fetchStats() {
  return request("/me/stats");
}