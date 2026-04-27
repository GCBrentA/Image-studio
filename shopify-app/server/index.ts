import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import { validateStartupConfig, config } from "./config";
import { apiRouter } from "./routes/api";
import { authRouter } from "./routes/auth";
import { webhookRouter } from "./routes/webhooks";

validateStartupConfig();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(process.cwd(), "dist/client");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(webhookRouter);
app.use(express.json({ limit: "2mb" }));
app.use(authRouter);
app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "optivra-image-studio-shopify", timestamp: new Date().toISOString() });
});

app.get("/privacy", (_req, res) => {
  res.type("html").send("<h1>Privacy</h1><p>Optivra Image Studio processes selected Shopify product image data only after merchant installation and action.</p>");
});

app.get("/support", (_req, res) => {
  res.type("html").send("<h1>Support</h1><p>Contact support@optivra.app for Optivra Image Studio support.</p>");
});

app.use(express.static(clientDir));
app.get("*", (_req, res) => {
  const html = fs.readFileSync(path.join(clientDir, "index.html"), "utf8").replace(/__SHOPIFY_API_KEY__/g, config.shopifyApiKey);
  res.type("html").send(html);
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error.message);
  res.status(500).json({ error: error.message || "Internal Server Error" });
});

app.listen(config.port, () => {
  console.info(`Optivra Image Studio Shopify app listening on ${config.port}`);
});
