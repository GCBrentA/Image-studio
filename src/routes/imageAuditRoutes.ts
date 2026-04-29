import { Router } from "express";
import {
  addImageAuditItems,
  completeImageAudit,
  getImageAuditReport,
  getLatestImageAudit,
  ignoreImageAuditIssues,
  listImageAudits,
  listImageAuditIssues,
  listImageAuditItems,
  listImageAuditQueueJobs,
  queueImageAuditIssues,
  queueImageAuditRecommendation,
  startImageAudit
} from "../controllers/imageAuditController";
import { imageStudioAuth } from "../middleware/imageStudioAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const imageAuditRoutes = Router();

imageAuditRoutes.get("/health", (_request, response) => {
  response.status(200).json({
    ok: true,
    service: "image-studio",
    routes: [
      "POST /api/image-studio/audits/start",
      "POST /api/image-studio/audits/:scanId/items",
      "POST /api/image-studio/audits/:scanId/complete",
      "GET /api/image-studio/audits/latest",
      "GET /api/image-studio/audits/:scanId",
      "GET /api/image-studio/audits/:scanId/issues",
      "GET /api/image-studio/audits/:scanId/items",
      "GET /api/image-studio/audits/:scanId/queue-jobs",
      "GET /api/image-studio/audit-queue",
      "POST /api/image-studio/audits/:scanId/issues/queue",
      "POST /api/image-studio/audits/:scanId/queue-recommendation"
    ]
  });
});

imageAuditRoutes.use(requireDatabase, imageStudioAuth);

imageAuditRoutes.post("/audits/start", (request, response, next) => {
  startImageAudit(request, response).catch(next);
});

imageAuditRoutes.get("/audits/latest", (request, response, next) => {
  getLatestImageAudit(request, response).catch(next);
});

imageAuditRoutes.get("/audits", (request, response, next) => {
  listImageAudits(request, response).catch(next);
});

imageAuditRoutes.get("/audit-queue", (request, response, next) => {
  listImageAuditQueueJobs(request, response).catch(next);
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

imageAuditRoutes.get("/audits/:scan_id/queue-jobs", (request, response, next) => {
  listImageAuditQueueJobs(request, response).catch(next);
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
