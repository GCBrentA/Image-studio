import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { optivraContentSecurityPolicyDirectives } from "./config/contentSecurityPolicy";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./middleware/logger";
import { notFound } from "./middleware/notFound";
import { staticDownloadAnalytics } from "./middleware/staticDownloadAnalytics";
import { routes } from "./routes";
import { billingWebhookRoutes } from "./routes/billingWebhookRoutes";
import { imageAuditRoutes } from "./routes/imageAuditRoutes";
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
} from "./controllers/imageAuditController";
import { imageStudioAuth } from "./middleware/imageStudioAuth";
import { requireDatabase } from "./middleware/requireDatabase";
import { webRoutes } from "./routes/webRoutes";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: optivraContentSecurityPolicyDirectives(env)
  }
}));

const allowedOrigins = new Set([
  "https://www.optivra.app",
  "https://optivra.app",
  "https://azraelsarmoury.com",
  "https://www.azraelsarmoury.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173"
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  }
}));

app.use((request, response, next) => {
  const host = request.hostname;
  const forwardedProto = request.header("x-forwarded-proto");
  const protocol = forwardedProto ?? request.protocol;
  const isOptivraHost = host === "optivra.app" || host === "www.optivra.app";

  if (isOptivraHost && (host !== "www.optivra.app" || protocol !== "https")) {
    response.redirect(301, `https://www.optivra.app${request.originalUrl}`);
    return;
  }

  next();
});
app.use("/billing/webhook", express.raw({ type: "application/json" }), billingWebhookRoutes);
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), billingWebhookRoutes);
app.use(express.json({ limit: "60mb" }));
app.use(logger);
app.get("/robots.txt", (_request, response) => {
  response.type("text/plain").sendFile(path.resolve(process.cwd(), "public", "site", "robots.txt"));
});
app.get("/sitemap.xml", (_request, response) => {
  response.type("application/xml").sendFile(path.resolve(process.cwd(), "public", "site", "sitemap.xml"));
});
app.use("/assets", express.static(path.resolve(process.cwd(), "public", "site", "assets")));
app.use("/downloads", staticDownloadAnalytics, express.static(path.resolve(process.cwd(), "public", "site", "downloads"), { redirect: false }));
app.use("/processed-images", express.static(path.resolve(process.cwd(), "storage", "processed-images")));

app.get("/account/dashboard", (request, response, next) => {
  const wantsHtml = request.accepts(["html", "json"]) === "html";

  if (wantsHtml && !request.headers.authorization) {
    response.redirect(302, "/dashboard");
    return;
  }

  next();
});

// Keep the Image Studio audit API explicitly mounted at the production plugin path.
// This guards the WooCommerce scan flow against accidental nested /api router changes.
app.use("/api/image-studio", imageAuditRoutes);
const requireImageStudioAuth = [requireDatabase, imageStudioAuth];
app.post("/api/image-studio/audits/start", requireImageStudioAuth, (request, response, next) => {
  startImageAudit(request, response).catch(next);
});
app.get("/api/image-studio/audits/latest", requireImageStudioAuth, (request, response, next) => {
  getLatestImageAudit(request, response).catch(next);
});
app.post("/api/image-studio/audits/:scan_id/items", requireImageStudioAuth, (request, response, next) => {
  addImageAuditItems(request, response).catch(next);
});
app.post("/api/image-studio/audits/:scan_id/complete", requireImageStudioAuth, (request, response, next) => {
  completeImageAudit(request, response).catch(next);
});
app.get("/api/image-studio/audits/:scan_id", requireImageStudioAuth, (request, response, next) => {
  getImageAuditReport(request, response).catch(next);
});
app.get("/api/image-studio/audits/:scan_id/issues", requireImageStudioAuth, (request, response, next) => {
  listImageAuditIssues(request, response).catch(next);
});
app.get("/api/image-studio/audits/:scan_id/items", requireImageStudioAuth, (request, response, next) => {
  listImageAuditItems(request, response).catch(next);
});
app.post("/api/image-studio/audits/:scan_id/issues/ignore", requireImageStudioAuth, (request, response, next) => {
  ignoreImageAuditIssues(request, response).catch(next);
});
app.post("/api/image-studio/audits/:scan_id/issues/queue", requireImageStudioAuth, (request, response, next) => {
  queueImageAuditIssues(request, response).catch(next);
});
app.post("/api/image-studio/audits/:scan_id/queue-recommendation", requireImageStudioAuth, (request, response, next) => {
  queueImageAuditRecommendation(request, response).catch(next);
});
app.use(routes);
app.use("/api", routes);

app.use(webRoutes);

app.use(notFound);
app.use(errorHandler);
