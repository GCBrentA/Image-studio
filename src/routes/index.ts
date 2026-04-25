import { Router } from "express";
import { healthRoutes } from "./healthRoutes";
import { imageRoutes } from "./imageRoutes";

export const routes = Router();

routes.use("/health", healthRoutes);
routes.use("/images", imageRoutes);
