import { Router } from "express";
import { createPluginEvent } from "../controllers/pluginEventController";
import { apiTokenAuth } from "../middleware/apiTokenAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const pluginEventRoutes = Router();

pluginEventRoutes.post("/events", requireDatabase, apiTokenAuth, (request, response, next) => {
  createPluginEvent(request, response).catch(next);
});
