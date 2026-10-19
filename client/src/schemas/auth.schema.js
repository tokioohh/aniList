import { z } from "zod";

// Copia independiente de server/src/modules/auth/schemas.js (sin paquete compartido).
// Mismos mensajes en español: el cliente valida lo antes posible y el servidor
// sigue siendo la autoridad.

const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede tener más de 72 caracteres")
  .regex(/[A-ZÁÉÍÓÚÑ]/, "La contraseña debe incluir al menos una mayúscula")
  .regex(/[a-záéíóúñ]/, "La contraseña debe incluir al menos una minúscula")
  .regex(/[0-9]/, "La contraseña debe incluir al menos un número");

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9_]{3,20}$/i,
        "El usuario debe tener entre 3 y 20 caracteres: letras, números o guion bajo"
      ),
    email: z.email("Escribe un correo electrónico válido").trim().toLowerCase().max(254),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email("Escribe un correo electrónico válido").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const registerDefaults = { username: "", email: "", password: "", confirmPassword: "" };
export const loginDefaults = { email: "", password: "" };