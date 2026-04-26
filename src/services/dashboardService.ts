import { Prisma, SubscriptionPlan } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { getUsageForUser } from "./usageService";

const isMissingColumnError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";

type DashboardBilling = {
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  billing_email: string | null;
  stripe_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  credits_reset_at: string | null;
  cancel_at_period_end: boolean;
  credits_remaining: number;
  credits_total: number;
  credits_used: number;
};

export const getDashboardSummary = async (userId: string) => {
  const [usage, sites, creditLedger, imageJobs] = await Promise.all([
    getUsageForUser(userId),
    prisma.connectedSite.findMany({
      where: {
        user_id: userId
      },
      orderBy: {
        created_at: "desc"
      },
      select: {
        id: true,
        domain: true,
        created_at: true,
        updated_at: true
      }
    }),
    prisma.creditLedger.findMany({
      where: {
        user_id: userId
      },
      orderBy: {
        created_at: "desc"
      },
      take: 20,
      select: {
        id: true,
        change_amount: true,
        reason: true,
        created_at: true
      }
    }),
    prisma.imageJob.findMany({
      where: {
        user_id: userId
      },
      orderBy: {
        created_at: "desc"
      },
      take: 20,
      select: {
        id: true,
        original_url: true,
        processed_url: true,
        status: true,
        credit_deducted_at: true,
        created_at: true,
        updated_at: true
      }
    })
  ]);

  const fallbackBilling: DashboardBilling = {
    plan: usage.plan ?? SubscriptionPlan.starter,
    status: "unknown",
    stripe_customer_id: null,
    billing_email: null,
    stripe_price_id: null,
    current_period_start: null,
    current_period_end: usage.current_period_end,
    credits_reset_at: usage.next_reset_at,
    cancel_at_period_end: false,
    credits_remaining: usage.credits_remaining,
    credits_total: usage.credits_total,
    credits_used: Math.max(usage.credits_total - usage.credits_remaining, 0)
  };

  let billing: DashboardBilling = fallbackBilling;

  try {
    const [user, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          stripe_customer_id: true,
          billing_email: true
        }
      }),
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
          stripe_price_id: true,
          current_period_start: true,
          current_period_end: true,
          cancel_at_period_end: true,
          credits_reset_at: true,
          billing_email: true
        }
      })
    ]);

    billing = {
      plan: subscription?.plan ?? usage.plan,
      status: subscription?.status ?? usage.subscription_status,
      stripe_customer_id: user?.stripe_customer_id ?? null,
      billing_email: subscription?.billing_email ?? user?.billing_email ?? null,
      stripe_price_id: subscription?.stripe_price_id ?? null,
      current_period_start: subscription?.current_period_start?.toISOString() ?? null,
      current_period_end: subscription?.current_period_end?.toISOString() ?? usage.current_period_end,
      credits_reset_at: subscription?.credits_reset_at?.toISOString() ?? usage.next_reset_at,
      cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
      credits_remaining: usage.credits_remaining,
      credits_total: usage.credits_total,
      credits_used: Math.max(usage.credits_total - usage.credits_remaining, 0)
    };
  } catch (error) {
    const message = isMissingColumnError(error)
      ? "Dashboard billing query failed because production migrations are missing billing columns"
      : "Dashboard billing query failed";

    console.error(message, error instanceof Error ? error.message : error);
    billing = {
      ...fallbackBilling,
      status: isMissingColumnError(error) ? "migration_required" : "unknown"
    };
  }

  return {
    usage,
    connected_sites: sites.map((site) => ({
      id: site.id,
      domain: site.domain,
      api_token_status: "configured",
      created_at: site.created_at.toISOString(),
      updated_at: site.updated_at.toISOString()
    })),
    usage_history: creditLedger.map((entry) => ({
      id: entry.id,
      change_amount: entry.change_amount,
      reason: entry.reason,
      created_at: entry.created_at.toISOString()
    })),
    image_jobs: imageJobs.map((job) => ({
      id: job.id,
      original_url: job.original_url,
      processed_url: job.processed_url,
      status: job.status,
      credit_deducted_at: job.credit_deducted_at?.toISOString() ?? null,
      created_at: job.created_at.toISOString(),
      updated_at: job.updated_at.toISOString()
    })),
    billing
  };
};
