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

const validateUrl = (name: string, value: string): string | null => {
  if (!value) {
    return `${name} is missing`;
  }

  try {
    const parsed = new URL(value);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return `${name} must be a valid URL`;
    }
  } catch {
    return `${name} must be a valid URL`;
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

  const urlErrors = [
    validateUrl("STRIPE_SUCCESS_URL", env.stripeSuccessUrl),
    validateUrl("STRIPE_CANCEL_URL", env.stripeCancelUrl),
    validateUrl("APP_BASE_URL", env.appUrl)
  ].filter((error): error is string => Boolean(error));

  errors.push(...urlErrors);

  if (!process.env.BILLING_CURRENCY) {
    errors.push("BILLING_CURRENCY is missing");
  } else if (env.billingCurrency !== "usd") {
    errors.push("BILLING_CURRENCY must be usd");
  }

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
      appBaseUrl: Boolean(env.appUrl),
      billingCurrency: env.billingCurrency
    });
  }

  return errors;
};

const validateStripePrice = async (planKey: SubscriptionPlanKey, priceId: string): Promise<void> => {
  const planName = subscriptionPlans[planKey].name;
  const envVarName = subscriptionPlans[planKey].priceEnvVar;

  try {
    const price = await getStripe().prices.retrieve(priceId);

    if (
      !price.active ||
      price.type !== "recurring" ||
      price.currency !== env.billingCurrency ||
      price.recurring?.interval !== "month"
    ) {
      console.error(`Stripe price for ${planName} is not configured correctly: ${maskPriceId(priceId)}`);
      throw new HttpError(503, `Stripe price for ${planName} is not configured correctly. Check ${envVarName} in Render.`);
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    console.error(`Stripe price for ${planName} is not configured correctly: ${maskPriceId(priceId)}`);
    throw new HttpError(503, `Stripe price for ${planName} is not configured correctly. Check ${envVarName} in Render.`);
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
