import { Router } from "express";
import { createAnalyticsEvent } from "../controllers/analyticsController";
import { requireDatabase } from "../middleware/requireDatabase";

export const analyticsRoutes = Router();

analyticsRoutes.post("/events", requireDatabase, (request, response, next) => {
  createAnalyticsEvent(request, response).catch(next);
});

