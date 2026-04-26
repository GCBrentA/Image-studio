import { SubscriptionPlan } from "@prisma/client";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export const subscriptionPlans = {
  starter: {
    plan: SubscriptionPlan.starter,
    name: "Starter",
    monthly_price_usd: 19,
    credits: env.planCreditLimits.starter,
    priceId: env.stripePriceIds.starter
  },
  growth: {
    plan: SubscriptionPlan.growth,
    name: "Growth",
    monthly_price_usd: 69,
    credits: env.planCreditLimits.growth,
    priceId: env.stripePriceIds.growth
  },
  pro: {
    plan: SubscriptionPlan.pro,
    name: "Pro",
    monthly_price_usd: 159,
    credits: env.planCreditLimits.pro,
    priceId: env.stripePriceIds.pro
  },
  agency: {
    plan: SubscriptionPlan.agency,
    name: "Agency",
    monthly_price_usd: 429,
    credits: env.planCreditLimits.agency,
    priceId: env.stripePriceIds.agency
  }
} as const;

export const creditPacks = {
  credits_100: {
    key: "credits_100",
    name: "100 credits",
    credits: 100,
    price_usd: 19,
    priceId: env.stripeCreditPackPriceIds.credits_100
  },
  credits_300: {
    key: "credits_300",
    name: "300 credits",
    credits: 300,
    price_usd: 49,
    priceId: env.stripeCreditPackPriceIds.credits_300
  },
  credits_1000: {
    key: "credits_1000",
    name: "1000 credits",
    credits: 1000,
    price_usd: 129,
    priceId: env.stripeCreditPackPriceIds.credits_1000
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
    throw new HttpError(503, `Stripe price is not configured for ${selectedPack.name}`);
  }

  return selectedPack;
};

export const getCreditPackByPriceId = (priceId: string) =>
  Object.values(creditPacks).find((pack) => pack.priceId === priceId) ?? null;
