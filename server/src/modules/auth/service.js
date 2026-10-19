import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

const BCRYPT_COST = 12;

// Hash precalculado (coste 12) de una contraseña aleatoria que nadie posee.
// Si el email no existe, comparamos contra este hash para que el tiempo de
// respuesta sea idéntico y no revele qué correos están registrados.
const DUMMY_HASH = "$2b$12$8TDqacaN26n6Ji5qw4vqPebHGAiWUK7t7lhXhDUqDul5LgAAbhSN6";

const GENERIC_LOGIN_ERROR = "Credenciales inválidas.";

// Campos que el servicio puede exponer: passwordHash nunca sale de aquí.
const publicUserSelect = { id: true, email: true, username: true, createdAt: true };

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export async function register({ username, email, password }) {
  const data = {
    username: normalizeUsername(username),
    email: normalizeEmail(email),
    passwordHash: await bcrypt.hash(password, BCRYPT_COST),
  };

  try {
    const user = await prisma.user.create({ data, select: publicUserSelect });
    return user;
  } catch (error) {
    // Violación de unicidad: se traduce al campo culpable para que el formulario
    // pueda marcarlo con setError.
    if (error?.code === "P2002") {
      const target = error.meta?.target ?? [];
      const isEmail = Array.isArray(target) ? target.includes("email") : target === "email";
      const field = isEmail ? "email" : "username";
      return { conflict: field };
    }
    throw error;
  }
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { ...publicUserSelect, passwordHash: true },
  });

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(password, hash);

  // Mismo mensaje y mismo trabajo en ambos casos: no revela si el correo existe.
  if (!user || !matches) throw AppError.unauthorized(GENERIC_LOGIN_ERROR);

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function getUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
}

export { normalizeEmail, normalizeUsername };