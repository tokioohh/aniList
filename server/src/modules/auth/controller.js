import { AppError } from "../../lib/errors.js";
import { signToken, expiresInToMs, COOKIE_NAME } from "../../lib/jwt.js";
import { cookieSecure, env } from "../../config/env.js";
import { register, login } from "./service.js";

const MAX_AGE = expiresInToMs(env.JWT_EXPIRES_IN);

// La cookie es httpOnly: el JavaScript del navegador nunca puede leer el token.
function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
  });
}

export async function registerController(req, res) {
  const result = await register(req.body);

  if (result?.conflict) {
    // 409 con fieldErrors: el cliente mapea el error al campo exacto.
    const message =
      result.conflict === "email"
        ? "Ese correo electrónico ya está registrado."
        : "Ese nombre de usuario ya está en uso.";
    throw AppError.conflict(message, { [result.conflict]: [message] });
  }

  setSessionCookie(res, signToken(result.id));
  res.status(201).json({ user: result });
}

export async function loginController(req, res) {
  const user = await login(req.body);
  setSessionCookie(res, signToken(user.id));
  res.status(200).json({ user });
}

export function logoutController(_req, res) {
  clearSessionCookie(res);
  res.status(204).end();
}

export function meController(req, res) {
  // requireAuth ya consultó la BD con un select explícito (sin passwordHash),
  // así que un usuario borrado deja de ser válido en la misma petición.
  res.status(200).json({ user: req.user });
}