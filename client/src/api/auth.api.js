import { request } from "./http.js";

export function registerUser(payload) {
  return request("/auth/register", { method: "POST", body: payload });
}

export function loginUser(payload) {
  return request("/auth/login", { method: "POST", body: payload });
}

export function logoutUser() {
  return request("/auth/logout", { method: "POST" });
}

export function fetchMe() {
  return request("/auth/me");
}