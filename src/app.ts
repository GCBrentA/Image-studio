import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./middleware/logger";
import { notFound } from "./middleware/notFound";
import { routes } from "./routes";
import { billingWebhookRoutes } from "./routes/billingWebhookRoutes";

export const app = express();

app.disable("x-powered-by");

app.use(helmet());
app.use(cors());
app.use("/billing/webhook", express.raw({ type: "application/json" }), billingWebhookRoutes);
app.use(express.json());
app.use(logger);
app.use("/processed-images", express.static(path.resolve(process.cwd(), "storage", "processed-images")));

app.use(routes);

app.use(notFound);
app.use(errorHandler);
