import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { optionalAuth } from "../../middleware/requireAuth.js";
import { catalogLimiter } from "../../middleware/rateLimiters.js";
import {
  searchQuerySchema,
  trendingQuerySchema,
  detailParamsSchema,
} from "./schemas.js";
import {
  searchController,
  trendingController,
  detailController,
} from "./controller.js";

export const catalogRouter = Router();

catalogRouter.get(
  "/catalog/search",
  catalogLimiter,
  validate({ query: searchQuerySchema }),
  searchController
);

catalogRouter.get(
  "/catalog/trending",
  catalogLimiter,
  validate({ query: trendingQuerySchema }),
  trendingController
);

// La sesión es opcional: sin cookie se responde igual, con myEntry: null.
catalogRouter.get(
  "/catalog/:source/:externalId",
  catalogLimiter,
  validate({ params: detailParamsSchema }),
  optionalAuth,
  detailController
);