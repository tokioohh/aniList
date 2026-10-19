import { z } from "zod";

// Copia independiente de server/src/modules/list/schemas.js.

export const watchStatusSchema = z.enum(["PLAN_TO_WATCH", "WATCHING", "COMPLETED", "DROPPED"]);
export const reactionSchema = z.enum(["LIKED", "DISLIKED"]);
export const titleTypeSchema = z.enum(["MOVIE", "SERIES", "ANIME"]);

export const ratingSchema = z.coerce
  .number()
  .int("La calificación debe ser un número entero")
  .min(1, "La calificación va de 1 a 10")
  .max(10, "La calificación va de 1 a 10");

export const listEntrySchema = z.object({
  status: watchStatusSchema,
  reaction: reactionSchema.nullish(),
  isFavorite: z.boolean(),
  rating: ratingSchema.nullish(),
  review: z.string().trim().max(2000, "La reseña es demasiado larga").nullish(),
});

// Etiquetas en español de los enums del servidor.
export const STATUS_LABELS = {
  PLAN_TO_WATCH: "Pendiente",
  WATCHING: "Viendo",
  COMPLETED: "Terminado",
  DROPPED: "Abandonado",
};