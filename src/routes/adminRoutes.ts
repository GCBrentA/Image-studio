import { Router } from "express";
import { getAdminSiteAnalyticsOverview } from "../controllers/analyticsController";
import {
  getAdminPluginAnalyticsEvents,
  getAdminPluginAnalyticsOverview,
  getAdminPluginAnalyticsStore,
  getAdminPluginAnalyticsStores
} from "../controllers/adminAnalyticsController";
import { jwtAuth } from "../middleware/jwtAuth";
import { requireDatabase } from "../middleware/requireDatabase";
import { requireInternalAdmin } from "../middleware/requireInternalAdmin";

export const adminRoutes = Router();

adminRoutes.use(requireDatabase, jwtAuth, requireInternalAdmin);

adminRoutes.get("/plugin-analytics", (request, response, next) => {
  getAdminPluginAnalyticsOverview(request, response).catch(next);
});

adminRoutes.get("/plugin-analytics/overview", (request, response, next) => {
  getAdminPluginAnalyticsOverview(request, response).catch(next);
});

adminRoutes.get("/plugin-analytics/stores", (request, response, next) => {
  getAdminPluginAnalyticsStores(request, response).catch(next);
});

adminRoutes.get("/plugin-analytics/events", (request, response, next) => {
  getAdminPluginAnalyticsEvents(request, response).catch(next);
});

adminRoutes.get("/plugin-analytics/stores/:id", (request, response, next) => {
  getAdminPluginAnalyticsStore(request, response).catch(next);
});

adminRoutes.get("/site-analytics/overview", (request, response, next) => {
  getAdminSiteAnalyticsOverview(request, response).catch(next);
});
