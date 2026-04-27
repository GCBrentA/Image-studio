import { Router } from "express";
import path from "path";

const webPaths = new Set([
  "/",
  "/plugins",
  "/catalogue-image-studio",
  "/pricing",
  "/downloads",
  "/login",
  "/dashboard",
  "/admin",
  "/admin/plugin-analytics",
  "/account/billing",
  "/billing/success",
  "/billing/cancel",
  "/billing/credits/success",
  "/billing/credits/cancel",
  "/docs",
  "/docs/ai-image-studio",
  "/support",
  "/terms",
  "/privacy",
  "/refund-policy"
]);

export const webRoutes = Router();

webRoutes.get("/account", (_request, response) => {
  response.redirect(302, "/dashboard");
});

webRoutes.get("/account/sites", (_request, response) => {
  response.redirect(302, "/dashboard");
});

webRoutes.get("/account/credits", (_request, response) => {
  response.redirect(302, "/account/billing#buy-credits");
});

webRoutes.get([...webPaths], (_request, response) => {
  response.sendFile(path.resolve(process.cwd(), "public", "site", "index.html"));
});
