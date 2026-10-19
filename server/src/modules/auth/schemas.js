import { z } from "zod";

// Contraseña: 8-72 caracteres. El máximo no es arbitrario: bcrypt trunca a 72 bytes.
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
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1, "Escribe tu correo electrónico").max(254),
    password: z.string().min(1, "Escribe tu contraseña").max(72),
  })
  .strict();