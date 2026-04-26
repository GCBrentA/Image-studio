import { Router } from "express";
import { createCheckout, createCreditCheckout, createPortal } from "../controllers/billingController";
import { jwtAuth } from "../middleware/jwtAuth";
import { requireDatabase } from "../middleware/requireDatabase";

export const billingRoutes = Router();

billingRoutes.post("/checkout-session", requireDatabase, jwtAuth, (request, response, next) => {
  createCheckout(request, response).catch(next);
});

billingRoutes.post("/create-checkout-session", requireDatabase, jwtAuth, (request, response, next) => {
  createCheckout(request, response).catch(next);
});

billingRoutes.post("/create-credit-checkout-session", requireDatabase, jwtAuth, (request, response, next) => {
  createCreditCheckout(request, response).catch(next);
});

billingRoutes.post("/portal", requireDatabase, jwtAuth, (request, response, next) => {
  createPortal(request, response).catch(next);
});

billingRoutes.post("/create-portal-session", requireDatabase, jwtAuth, (request, response, next) => {
  createPortal(request, response).catch(next);
});
