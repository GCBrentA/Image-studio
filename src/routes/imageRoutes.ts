import { Router } from "express";
import { processImage } from "../controllers/imageController";
import { apiTokenAuth } from "../middleware/apiTokenAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const imageRoutes = Router();

imageRoutes.post("/process", requireDatabase, apiTokenAuth, (request, response, next) => {
  processImage(request, response).catch(next);
});
