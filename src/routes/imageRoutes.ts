import { Router } from "express";
import { processImage } from "../controllers/imageController";
import { apiTokenAuth } from "../middleware/apiTokenAuth";

export const imageRoutes = Router();

imageRoutes.post("/process", apiTokenAuth, (request, response, next) => {
  processImage(request, response).catch(next);
});
