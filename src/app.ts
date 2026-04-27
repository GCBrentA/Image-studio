import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./middleware/logger";
import { notFound } from "./middleware/notFound";
import { routes } from "./routes";
import { billingWebhookRoutes } from "./routes/billingWebhookRoutes";
import { webRoutes } from "./routes/webRoutes";

export const app = express();

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      connectSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"]
    }
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
app.use("/downloads", express.static(path.resolve(process.cwd(), "public", "site", "downloads"), { redirect: false }));
app.use("/processed-images", express.static(path.resolve(process.cwd(), "storage", "processed-images")));

app.get("/account/dashboard", (request, response, next) => {
  const wantsHtml = request.accepts(["html", "json"]) === "html";

  if (wantsHtml && !request.headers.authorization) {
    response.redirect(302, "/dashboard");
    return;
  }

  next();
});

app.use(routes);
app.use("/api", routes);

app.use(webRoutes);

app.use(notFound);
app.use(errorHandler);
