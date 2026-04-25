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
app.use(cors());
app.use("/billing/webhook", express.raw({ type: "application/json" }), billingWebhookRoutes);
app.use(express.json());
app.use(logger);
app.use("/assets", express.static(path.resolve(process.cwd(), "public", "site", "assets")));
app.use("/processed-images", express.static(path.resolve(process.cwd(), "storage", "processed-images")));

app.use(routes);

app.use(webRoutes);

app.use(notFound);
app.use(errorHandler);
