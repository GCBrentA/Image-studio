import { Router } from "express";
import { getUsage } from "../controllers/usageController";
import { apiTokenAuth } from "../middleware/apiTokenAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const usageRoutes = Router();

usageRoutes.get("/", requireDatabase, apiTokenAuth, (request, response, next) => {
  getUsage(request, response).catch(next);
});
