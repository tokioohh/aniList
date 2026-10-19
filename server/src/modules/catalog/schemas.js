import { z } from "zod";

const titleSource = z.enum(["TMDB_MOVIE", "TMDB_TV", "JIKAN_ANIME"]);
const titleType = z.enum(["MOVIE", "SERIES", "ANIME"]);

// El source es un enum y externalId un entero: así el servidor no puede
// construir rutas arbitrarias hacia TMDB o Jikan.
export const searchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(1, "La búsqueda no puede estar vacía")
      .max(100, "La búsqueda es demasiado larga"),
    type: z.enum(["ALL", "MOVIE", "SERIES", "ANIME"]).default("ALL"),
    page: z.coerce.number().int().min(1).max(50).default(1),
  })
  .strict();

export const trendingQuerySchema = z
  .object({
    type: z.enum(["MOVIE", "SERIES", "ANIME"]).default("ANIME"),
  })
  .strict();

export const detailParamsSchema = z
  .object({
    source: titleSource,
    externalId: z.coerce
      .number()
      .int("El identificador debe ser un número entero")
      .positive("El identificador debe ser un número positivo"),
  })
  .strict();

export { titleSource, titleType };