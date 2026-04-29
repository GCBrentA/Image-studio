import { Router } from "express";
import {
  addImageAuditItems,
  completeImageAudit,
  getImageAuditReport,
  getLatestImageAudit,
  ignoreImageAuditIssues,
  listImageAuditIssues,
  listImageAuditItems,
  queueImageAuditIssues,
  queueImageAuditRecommendation,
  startImageAudit
} from "../controllers/imageAuditController";
import { imageStudioAuth } from "../middleware/imageStudioAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const imageAuditRoutes = Router();

imageAuditRoutes.use(requireDatabase, imageStudioAuth);

imageAuditRoutes.post("/audits/start", (request, response, next) => {
  startImageAudit(request, response).catch(next);
});

imageAuditRoutes.get("/audits/latest", (request, response, next) => {
  getLatestImageAudit(request, response).catch(next);
});

imageAuditRoutes.post("/audits/:scan_id/items", (request, response, next) => {
  addImageAuditItems(request, response).catch(next);
});

imageAuditRoutes.post("/audits/:scan_id/complete", (request, response, next) => {
  completeImageAudit(request, response).catch(next);
});

imageAuditRoutes.get("/audits/:scan_id", (request, response, next) => {
  getImageAuditReport(request, response).catch(next);
});

imageAuditRoutes.get("/audits/:scan_id/issues", (request, response, next) => {
  listImageAuditIssues(request, response).catch(next);
});

imageAuditRoutes.get("/audits/:scan_id/items", (request, response, next) => {
  listImageAuditItems(request, response).catch(next);
});

imageAuditRoutes.post("/audits/:scan_id/issues/ignore", (request, response, next) => {
  ignoreImageAuditIssues(request, response).catch(next);
});

imageAuditRoutes.post("/audits/:scan_id/issues/queue", (request, response, next) => {
  queueImageAuditIssues(request, response).catch(next);
});

imageAuditRoutes.post("/audits/:scan_id/queue-recommendation", (request, response, next) => {
  queueImageAuditRecommendation(request, response).catch(next);
});

