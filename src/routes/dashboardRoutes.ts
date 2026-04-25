import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController";
import { jwtAuth } from "../middleware/jwtAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", requireDatabase, jwtAuth, (request, response, next) => {
  getDashboard(request, response).catch(next);
});
