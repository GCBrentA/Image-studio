import type { Request, Response } from "express";
import type { JwtAuthenticatedRequest } from "../middleware/jwtAuth";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  processStripeEvent
} from "../services/billingService";
import { constructStripeWebhookEvent } from "../services/stripeService";

type CheckoutSessionBody = {
  type?: unknown;
  plan?: unknown;
  pack?: unknown;
};

export const createCheckout = async (
  request: JwtAuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  const body = request.body as CheckoutSessionBody;
  const session = await createCheckoutSession(request.user.userId, {
    type: body.type === "credit_pack" ? "credit_pack" : "subscription",
    plan: typeof body.plan === "string" ? body.plan : undefined,
    pack: typeof body.pack === "string" ? body.pack : undefined
  });

  response.status(201).json(session);
};

export const createPortal = async (
  request: JwtAuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  response.status(201).json(await createCustomerPortalSession(request.user.userId));
};

export const handleStripeWebhook = async (request: Request, response: Response): Promise<void> => {
  const event = constructStripeWebhookEvent(
    request.body as Buffer,
    request.header("stripe-signature") ?? undefined
  );
  const result = await processStripeEvent(event);

  response.status(200).json({
    received: true,
    result
  });
};
