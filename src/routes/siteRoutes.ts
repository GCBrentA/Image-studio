import { Router } from "express";
import { connect } from "../controllers/siteController";
import { jwtAuth } from "../middleware/jwtAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const siteRoutes = Router();

siteRoutes.post("/connect", requireDatabase, jwtAuth, (request, response, next) => {
  connect(request, response).catch(next);
});
