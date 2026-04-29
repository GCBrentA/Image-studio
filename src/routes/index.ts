import { Router } from "express";
import { adminRoutes } from "./adminRoutes";
import { authRoutes } from "./authRoutes";
import { billingRoutes } from "./billingRoutes";
import { dashboardRoutes } from "./dashboardRoutes";
import { healthRoutes } from "./healthRoutes";
import { imageAuditRoutes } from "./imageAuditRoutes";
import { imageRoutes } from "./imageRoutes";
import { siteRoutes } from "./siteRoutes";
import { usageRoutes } from "./usageRoutes";
import { pluginEventRoutes } from "./pluginEventRoutes";
import { analyticsRoutes } from "./analyticsRoutes";

export const routes = Router();

routes.use("/auth", authRoutes);
routes.use("/admin", adminRoutes);
routes.use("/billing", billingRoutes);
routes.use("/account/dashboard", dashboardRoutes);
routes.use("/health", healthRoutes);
routes.use("/image-studio", imageAuditRoutes);
routes.use("/images", imageRoutes);
routes.use("/sites", siteRoutes);
routes.use("/plugin", pluginEventRoutes);
routes.use("/usage", usageRoutes);
routes.use("/analytics", analyticsRoutes);
