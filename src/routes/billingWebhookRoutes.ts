import { Router } from "express";
import { handleStripeWebhook } from "../controllers/billingController";
import { requireDatabase } from "../middleware/requireDatabase";

export const billingWebhookRoutes = Router();

billingWebhookRoutes.post("/", requireDatabase, (request, response, next) => {
  handleStripeWebhook(request, response).catch(next);
});
