import { Router } from "express";
import path from "path";

const webPaths = new Set([
  "/",
  "/plugins",
  "/catalogue-image-studio",
  "/optivra-image-studio",
  "/pricing",
  "/downloads",
  "/resources",
  "/resources/how-to-optimise-woocommerce-product-images-for-seo",
  "/resources/woocommerce-product-image-seo-checklist",
  "/resources/how-to-write-alt-text-for-woocommerce-product-images",
  "/resources/how-to-replace-product-image-backgrounds-in-woocommerce",
  "/resources/ai-product-photography-for-woocommerce-stores",
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
  "/docs/optivra-image-studio",
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
