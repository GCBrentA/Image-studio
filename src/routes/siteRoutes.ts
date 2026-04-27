import { Router } from "express";
import { confirmTransfer, connect, requestTransfer } from "../controllers/siteController";
import { jwtAuth } from "../middleware/jwtAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const siteRoutes = Router();

siteRoutes.post("/connect", requireDatabase, jwtAuth, (request, response, next) => {
  connect(request, response).catch(next);
});

siteRoutes.post("/transfer/request", requireDatabase, jwtAuth, (request, response, next) => {
  requestTransfer(request, response).catch(next);
});

siteRoutes.post("/transfer/confirm", requireDatabase, jwtAuth, (request, response, next) => {
  confirmTransfer(request, response).catch(next);
});
