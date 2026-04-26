import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { getUserCredits, type LowCreditThreshold } from "./creditService";
import { env } from "../config/env";

export type UsageResponse = {
  plan: SubscriptionPlan;
  credits_remaining: number;
  credits_total: number;
  low_credit_thresholds: LowCreditThreshold[];
  subscription_status: SubscriptionStatus;
  next_reset_at: string | null;
  current_period_end: string | null;
  account_urls: {
    account: string;
    billing: string;
    credits: string;
  };
};

const getAccountBaseUrl = (): string =>
  (env.appUrl || env.apiBaseUrl || "https://www.optivra.app").replace(/\/+$/, "");

export const getUsageForUser = async (userId: string): Promise<UsageResponse> => {
  const [credits, subscription] = await Promise.all([
    getUserCredits(userId),
    prisma.subscription.findFirst({
      where: {
        user_id: userId
      },
      orderBy: {
        created_at: "desc"
      },
      select: {
        plan: true,
        status: true,
        current_period_end: true
      }
    })
  ]);

  const currentPeriodEnd = subscription?.current_period_end.toISOString() ?? null;
  const accountBaseUrl = getAccountBaseUrl();

  return {
    plan: subscription?.plan ?? SubscriptionPlan.starter,
    credits_remaining: credits.credits_remaining,
    credits_total: credits.credits_total,
    low_credit_thresholds: credits.low_credit_thresholds,
    subscription_status: subscription?.status ?? SubscriptionStatus.incomplete,
    next_reset_at: currentPeriodEnd,
    current_period_end: currentPeriodEnd,
    account_urls: {
      account: `${accountBaseUrl}/dashboard`,
      billing: `${accountBaseUrl}/account/billing`,
      credits: `${accountBaseUrl}/account/billing#buy-credits`
    }
  };
};
