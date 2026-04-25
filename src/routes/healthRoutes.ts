import { Router } from "express";
import { healthCheck } from "../controllers/healthController";

export const healthRoutes = Router();

healthRoutes.get("/", healthCheck);
