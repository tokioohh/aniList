import { z } from "zod";
import { titleSource, titleType } from "../catalog/schemas.js";

const watchStatus = z.enum(["PLAN_TO_WATCH", "WATCHING", "COMPLETED", "DROPPED"]);
const reaction = z.enum(["LIKED", "DISLIKED"]);

// Booleano de query: NO se usa z.coerce.boolean() porque "false" se coerciona a true.
// Solo se aceptan exactamente "true" o "false".
const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const listQuerySchema = z
  .object({
    status: watchStatus.optional(),
    reaction: reaction.optional(),
    favorite: booleanQuery.optional(),
    type: titleType.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

// La reseña se puede mandar vacía (se guarda como null) o no mandarse.
// Importante: si NO viene, el resultado es undefined y no null; si no, un PATCH
// de solo la calificación borraría la reseña sin querer.
const review = z
  .union([z.string().trim().max(2000, "La reseña es demasiado larga"), z.null()])
  .transform((value) => (value ? value : null))
  .optional();

export const createEntrySchema = z
  .object({
    source: titleSource,
    externalId: z.coerce.number().int().positive(),
    status: watchStatus.default("PLAN_TO_WATCH"),
    reaction: reaction.nullish(),
    isFavorite: z.boolean().default(false),
    rating: z.coerce
      .number()
      .int("La calificación debe ser un número entero")
      .min(1, "La calificación va de 1 a 10")
      .max(10, "La calificación va de 1 a 10")
      .nullish(),
    review,
  })
  .strict();

// PATCH parcial: al menos un campo editable. reaction, rating y review aceptan null
// porque "quitar el valor" es una operación válida.
export const updateEntrySchema = z
  .object({
    status: watchStatus.optional(),
    reaction: reaction.nullish(),
    isFavorite: z.boolean().optional(),
    rating: z.coerce
      .number()
      .int("La calificación debe ser un número entero")
      .min(1, "La calificación va de 1 a 10")
      .max(10, "La calificación va de 1 a 10")
      .nullish(),
    review,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Envía al menos un campo para actualizar",
  });

export const entryParamsSchema = z
  .object({
    id: z.uuid("El identificador no es válido"),
  })
  .strict();

export { watchStatus, reaction };