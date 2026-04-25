import Stripe = require("stripe");
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

let stripeClient: Stripe.Stripe | null = null;

export const getStripe = (): Stripe.Stripe => {
  if (!env.stripeSecretKey) {
    throw new HttpError(503, "Stripe is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
};

export const constructStripeWebhookEvent = (
  payload: Buffer,
  signature: string | undefined
): StripeWebhookEvent => {
  if (!env.stripeWebhookSecret) {
    throw new HttpError(503, "Stripe webhook secret is not configured");
  }

  if (!signature) {
    throw new HttpError(400, "Missing Stripe signature");
  }

  return getStripe().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret) as StripeWebhookEvent;
};
