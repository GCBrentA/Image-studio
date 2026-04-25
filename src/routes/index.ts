import { Router } from "express";
import { authRoutes } from "./authRoutes";
import { healthRoutes } from "./healthRoutes";
import { imageRoutes } from "./imageRoutes";
import { siteRoutes } from "./siteRoutes";
import { usageRoutes } from "./usageRoutes";

export const routes = Router();

routes.use("/auth", authRoutes);
routes.use("/health", healthRoutes);
routes.use("/images", imageRoutes);
routes.use("/sites", siteRoutes);
routes.use("/usage", usageRoutes);
