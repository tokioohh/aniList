import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const COOKIE_NAME = "token";

// El payload solo lleva sub/iat/exp: nada de email ni roles en el token.
export function signToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// algorithms fijo en ["HS256"] bloquea el clásico ataque "alg: none".
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
}

// Convierte "7d" / "12h" / "30m" / "900s" a milisegundos.
export function expiresInToMs(value) {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(String(value).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return amount * unit;
}

export { COOKIE_NAME };