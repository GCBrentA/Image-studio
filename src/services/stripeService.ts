import Stripe = require("stripe");
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";
import { subscriptionPlans, type SubscriptionPlanKey } from "./billingCatalog";

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

let stripeClient: Stripe.Stripe | null = null;
let billingValidationPromise: Promise<void> | null = null;

export const getStripe = (): Stripe.Stripe => {
  if (!env.stripeSecretKey) {
    throw new HttpError(503, "Stripe is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
};

const maskPriceId = (priceId: string): string =>
  `${priceId.slice(0, Math.min(priceId.length, 12))}...`;

const validateEnvPrefix = (name: string, value: string, prefixes: string[]): string | null => {
  if (!value) {
    return `${name} is missing`;
  }

  if (!prefixes.some((prefix) => value.startsWith(prefix))) {
    return `${name} has an invalid format`;
  }

  return null;
};

export const validateBillingEnvironment = (): string[] => {
  const checks: Array<[string, string, string[]]> = [
    ["STRIPE_SECRET_KEY", env.stripeSecretKey, ["sk_test_", "sk_live_"]],
    ["STRIPE_PUBLISHABLE_KEY", env.stripePublishableKey, ["pk_test_", "pk_live_"]],
    ["STRIPE_WEBHOOK_SECRET", env.stripeWebhookSecret, ["whsec_"]],
    ["STRIPE_PRICE_STARTER", env.stripePriceIds.starter, ["price_"]],
    ["STRIPE_PRICE_GROWTH", env.stripePriceIds.growth, ["price_"]],
    ["STRIPE_PRICE_PRO", env.stripePriceIds.pro, ["price_"]],
    ["STRIPE_PRICE_AGENCY", env.stripePriceIds.agency, ["price_"]]
  ];

  const errors = checks
    .map(([name, value, prefixes]) => validateEnvPrefix(name, value, prefixes))
    .filter((error): error is string => Boolean(error));

  if (!env.stripeSuccessUrl) errors.push("STRIPE_SUCCESS_URL is missing");
  if (!env.stripeCancelUrl) errors.push("STRIPE_CANCEL_URL is missing");
  if (!env.appUrl) errors.push("APP_BASE_URL is missing");

  if (process.env.NODE_ENV !== "test") {
    console.info("Billing configuration", {
      stripeSecretKey: Boolean(env.stripeSecretKey),
      stripePublishableKey: Boolean(env.stripePublishableKey),
      stripeWebhookSecret: Boolean(env.stripeWebhookSecret),
      stripePrices: {
        starter: env.stripePriceIds.starter ? maskPriceId(env.stripePriceIds.starter) : "missing",
        growth: env.stripePriceIds.growth ? maskPriceId(env.stripePriceIds.growth) : "missing",
        pro: env.stripePriceIds.pro ? maskPriceId(env.stripePriceIds.pro) : "missing",
        agency: env.stripePriceIds.agency ? maskPriceId(env.stripePriceIds.agency) : "missing"
      },
      stripeSuccessUrl: Boolean(env.stripeSuccessUrl),
      stripeCancelUrl: Boolean(env.stripeCancelUrl),
      appBaseUrl: Boolean(env.appUrl)
    });
  }

  return errors;
};

const validateStripePrice = async (planKey: SubscriptionPlanKey, priceId: string): Promise<void> => {
  try {
    const price = await getStripe().prices.retrieve(priceId);

    if (!price.active || price.type !== "recurring" || price.currency !== "usd" || price.recurring?.interval !== "month") {
      console.error(`Invalid Stripe price configured for ${planKey}: ${maskPriceId(priceId)}`);
      throw new HttpError(503, `Invalid Stripe price configured for ${planKey}`);
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    console.error(`Invalid Stripe price configured for ${planKey}: ${maskPriceId(priceId)}`);
    throw new HttpError(503, `Invalid Stripe price configured for ${planKey}`);
  }
};

export const ensureBillingReady = async (): Promise<void> => {
  const envErrors = validateBillingEnvironment();

  if (envErrors.length > 0) {
    throw new HttpError(503, `Billing is not fully configured: ${envErrors.join(", ")}`);
  }

  if (!billingValidationPromise) {
    billingValidationPromise = Promise.all(
      (Object.keys(subscriptionPlans) as SubscriptionPlanKey[]).map((planKey) =>
        validateStripePrice(planKey, subscriptionPlans[planKey].priceId)
      )
    ).then(() => undefined);
  }

  await billingValidationPromise;
};

export const validateBillingAtStartup = (): void => {
  const envErrors = validateBillingEnvironment();

  if (envErrors.length > 0) {
    console.warn(`Billing configuration incomplete: ${envErrors.join(", ")}`);
    return;
  }

  ensureBillingReady().catch((error: unknown) => {
    console.error("Billing startup validation failed", error instanceof Error ? error.message : error);
  });
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
