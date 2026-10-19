import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { originCheck } from "../../middleware/originCheck.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { listQuerySchema, createEntrySchema, updateEntrySchema, entryParamsSchema } from "./schemas.js";
import {
  listController,
  createController,
  updateController,
  deleteController,
  statsController,
} from "./controller.js";

export const listRouter = Router();

// Todo /api/me/* exige sesión y el userId sale siempre del token.
listRouter.get("/me/list", requireAuth, validate({ query: listQuerySchema }), listController);

listRouter.get("/me/stats", requireAuth, statsController);

listRouter.post(
  "/me/list",
  originCheck,
  requireAuth,
  validate({ body: createEntrySchema }),
  createController
);

listRouter.patch(
  "/me/list/:id",
  originCheck,
  requireAuth,
  validate({ params: entryParamsSchema, body: updateEntrySchema }),
  updateController
);

listRouter.delete(
  "/me/list/:id",
  originCheck,
  requireAuth,
  validate({ params: entryParamsSchema }),
  deleteController
);