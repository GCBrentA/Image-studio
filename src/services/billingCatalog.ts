import { SubscriptionPlan } from "@prisma/client";
import { env } from "../config/env";
import { PRODUCT_NAME } from "../config/product";
import { HttpError } from "../utils/httpError";

export const subscriptionPlans = {
  starter: {
    plan: SubscriptionPlan.starter,
    name: `${PRODUCT_NAME} Starter`,
    monthly_price_usd: 19,
    credits: env.planCreditLimits.starter,
    priceId: env.stripePriceIds.starter,
    priceEnvVar: "STRIPE_PRICE_STARTER"
  },
  growth: {
    plan: SubscriptionPlan.growth,
    name: `${PRODUCT_NAME} Growth`,
    monthly_price_usd: 69,
    credits: env.planCreditLimits.growth,
    priceId: env.stripePriceIds.growth,
    priceEnvVar: "STRIPE_PRICE_GROWTH"
  },
  pro: {
    plan: SubscriptionPlan.pro,
    name: `${PRODUCT_NAME} Pro`,
    monthly_price_usd: 159,
    credits: env.planCreditLimits.pro,
    priceId: env.stripePriceIds.pro,
    priceEnvVar: "STRIPE_PRICE_PRO"
  },
  agency: {
    plan: SubscriptionPlan.agency,
    name: `${PRODUCT_NAME} Agency`,
    monthly_price_usd: 429,
    credits: env.planCreditLimits.agency,
    priceId: env.stripePriceIds.agency,
    priceEnvVar: "STRIPE_PRICE_AGENCY"
  }
} as const;

export const creditPacks = {
  small: {
    key: "small",
    name: `${PRODUCT_NAME} Credits - Small Pack`,
    displayName: `${PRODUCT_NAME} Credits - Small Pack`,
    credits: 25,
    displayPrice: "$10 USD",
    currency: "usd",
    priceId: env.stripeCreditPackPriceIds.small,
    priceEnvVar: "STRIPE_CREDIT_PRICE_SMALL"
  },
  medium: {
    key: "medium",
    name: `${PRODUCT_NAME} Credits - Medium Pack`,
    displayName: `${PRODUCT_NAME} Credits - Medium Pack`,
    credits: 100,
    displayPrice: "$35 USD",
    currency: "usd",
    priceId: env.stripeCreditPackPriceIds.medium,
    priceEnvVar: "STRIPE_CREDIT_PRICE_MEDIUM"
  },
  large: {
    key: "large",
    name: `${PRODUCT_NAME} Credits - Large Pack`,
    displayName: `${PRODUCT_NAME} Credits - Large Pack`,
    credits: 300,
    displayPrice: "$90 USD",
    currency: "usd",
    priceId: env.stripeCreditPackPriceIds.large,
    priceEnvVar: "STRIPE_CREDIT_PRICE_LARGE"
  },
  agency: {
    key: "agency",
    name: `${PRODUCT_NAME} Credits - Agency Pack`,
    displayName: `${PRODUCT_NAME} Credits - Agency Pack`,
    credits: 1000,
    displayPrice: "$250 USD",
    currency: "usd",
    priceId: env.stripeCreditPackPriceIds.agency,
    priceEnvVar: "STRIPE_CREDIT_PRICE_AGENCY"
  }
} as const;

export type SubscriptionPlanKey = keyof typeof subscriptionPlans;
export type CreditPackKey = keyof typeof creditPacks;

export const getPlanByKey = (plan: string) => {
  if (!Object.hasOwn(subscriptionPlans, plan)) {
    throw new HttpError(400, "Invalid subscription plan");
  }

  const selectedPlan = subscriptionPlans[plan as SubscriptionPlanKey];

  if (!selectedPlan.priceId) {
    throw new HttpError(503, `Stripe price is not configured for ${selectedPlan.name}`);
  }

  return selectedPlan;
};

export const getPlanByPriceId = (priceId: string) =>
  Object.values(subscriptionPlans).find((plan) => plan.priceId === priceId) ?? null;

export const getCreditPackByKey = (pack: string) => {
  if (!Object.hasOwn(creditPacks, pack)) {
    throw new HttpError(400, "Invalid credit pack");
  }

  const selectedPack = creditPacks[pack as CreditPackKey];

  if (!selectedPack.priceId) {
    throw new HttpError(503, `Stripe credit price for ${selectedPack.displayName} is not configured correctly. Check ${selectedPack.priceEnvVar} in Render.`);
  }

  return selectedPack;
};

export const getCreditPackByPriceId = (priceId: string) =>
  Object.values(creditPacks).find((pack) => pack.priceId === priceId) ?? null;
