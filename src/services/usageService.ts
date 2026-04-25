import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { getUserCredits } from "./creditService";

export type UsageResponse = {
  plan: SubscriptionPlan;
  credits_remaining: number;
  credits_total: number;
  subscription_status: SubscriptionStatus;
};

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
        status: true
      }
    })
  ]);

  return {
    plan: subscription?.plan ?? SubscriptionPlan.starter,
    credits_remaining: credits.credits_remaining,
    credits_total: credits.credits_total,
    subscription_status: subscription?.status ?? SubscriptionStatus.incomplete
  };
};
