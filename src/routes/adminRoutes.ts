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
import {
  getPluginDownloadWorkflowEvents,
  getPluginDownloadWorkflowSummary,
  getPluginFeedbackAdmin
} from "../services/pluginLeadWorkflowService";
import { getEmailConfigurationStatus, sendDiagnosticEmail } from "../services/emailService";

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

adminRoutes.get("/plugins/downloads/summary", (_request, response, next) => {
  getPluginDownloadWorkflowSummary()
    .then((summary) => response.json({ ok: true, summary }))
    .catch(next);
});

adminRoutes.get("/plugins/downloads/events", (_request, response, next) => {
  getPluginDownloadWorkflowEvents()
    .then((events) => response.json({ ok: true, events }))
    .catch(next);
});

adminRoutes.get("/plugins/feedback", (_request, response, next) => {
  getPluginFeedbackAdmin()
    .then((feedback) => response.json({ ok: true, feedback }))
    .catch(next);
});

adminRoutes.get("/plugins/email/diagnostics", (_request, response) => {
  response.json({ ok: true, email: getEmailConfigurationStatus() });
});

adminRoutes.post("/plugins/email/test", (request, response, next) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ ok: false, error: "Enter a valid test email address." });
    return;
  }

  sendDiagnosticEmail(email)
    .then((result) => response.json({ ok: result.status === "sent", result }))
    .catch(next);
});
