import { prisma } from "../lib/prisma.js";
import { verifyToken, COOKIE_NAME } from "../lib/jwt.js";
import { AppError } from "../lib/errors.js";

/** Busca el usuario del token en la BD. Nunca devuelve passwordHash. */
export async function resolveUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return null; // token manipulado, expirado o con alg: none
  }
  if (!payload?.sub) return null;

  // Se consulta la BD en cada petición: un usuario borrado deja de ser válido.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, username: true, createdAt: true },
  });
  return user;
}

/** Exige sesión. El userId SIEMPRE sale del token, nunca del body ni de la URL. */
export async function requireAuth(req, res, next) {
  const user = await resolveUser(req);
  if (!user) return next(AppError.unauthorized());
  req.user = user;
  next();
}

/** Sesión opcional: si no hay cookie o el token es inválido, sigue como anónimo. */
export async function optionalAuth(req, res, next) {
  const user = await resolveUser(req);
  if (user) req.user = user;
  next();
}