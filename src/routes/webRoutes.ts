import { Router } from "express";
import path from "path";

const webPaths = new Set([
  "/",
  "/plugins",
  "/catalogue-image-studio",
  "/pricing",
  "/login",
  "/dashboard",
  "/account/billing",
  "/billing/success",
  "/billing/cancel",
  "/docs",
  "/support",
  "/terms",
  "/privacy",
  "/refund-policy"
]);

export const webRoutes = Router();

webRoutes.get([...webPaths], (_request, response) => {
  response.sendFile(path.resolve(process.cwd(), "public", "site", "index.html"));
});
