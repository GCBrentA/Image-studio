import {
  CreditLedgerReason,
  ImageJobStatus,
  Prisma,
  SubscriptionPlan
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { env } from "../config/env";

export const PLAN_CREDIT_LIMITS: Record<SubscriptionPlan, number> = {
  starter: env.planCreditLimits.starter,
  growth: env.planCreditLimits.growth,
  pro: env.planCreditLimits.pro,
  agency: env.planCreditLimits.agency
};

export const FREE_TRIAL_CREDITS = 10;

const lowCreditThresholdPercents = [50, 80, 95, 0] as const;

export type LowCreditThresholdPercent = (typeof lowCreditThresholdPercents)[number];

export type LowCreditThreshold = {
  percent: LowCreditThresholdPercent;
  reached: boolean;
  credits_remaining_at_threshold: number;
};

export type CreditResponse = {
  credits_remaining: number;
  credits_total: number;
  low_credit_thresholds: LowCreditThreshold[];
  error_if_any: string | null;
};

type CreditTotals = Pick<CreditResponse, "credits_remaining" | "credits_total">;

export type DeductCreditOptions = {
  imageJobId?: string;
  idempotencyKey?: string;
};

export type CreditLedgerSource =
  | "free_signup_credits"
  | "free_trial"
  | "stripe_invoice_payment_succeeded"
  | "stripe_credit_purchase"
  | "credit_purchase"
  | "image_processing"
  | "manual_adjustment";

const noCreditsError = "No credits remaining";
const invalidCreditAmountError = "Credit amount must be greater than zero";
const maxSerializableRetries = 3;

const isKnownPrismaError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

const runSerializableTransaction = async <T>(
  callback: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxSerializableRetries; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      lastError = error;

      if (!isKnownPrismaError(error) || error.code !== "P2034" || attempt === maxSerializableRetries) {
        throw error;
      }
    }
  }

  throw lastError;
};

const getPeriodStart = async (
  userId: string,
  client: Prisma.TransactionClient | typeof prisma
): Promise<Date | null> => {
  const latestReset = await client.creditLedger.findFirst({
    where: {
      userId,
      reason: CreditLedgerReason.reset
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true
    }
  });

  return latestReset?.createdAt ?? null;
};

const getCreditTotals = async (
  userId: string,
  client: Prisma.TransactionClient | typeof prisma
): Promise<CreditTotals> => {
  const periodStart = await getPeriodStart(userId, client);
  const periodFilter = periodStart ? { gte: periodStart } : undefined;

  const [remaining, positiveCredits] = await Promise.all([
    client.creditLedger.aggregate({
      where: {
        userId,
        ...(periodFilter ? { createdAt: periodFilter } : {})
      },
      _sum: {
        changeAmount: true
      }
    }),
    client.creditLedger.aggregate({
      where: {
        userId,
        changeAmount: {
          gt: 0
        },
        ...(periodFilter ? { createdAt: periodFilter } : {})
      },
      _sum: {
        changeAmount: true
      }
    })
  ]);

  return {
    credits_remaining: Math.max(remaining._sum.changeAmount ?? 0, 0),
    credits_total: positiveCredits._sum.changeAmount ?? 0
  };
};

const toCreditResponse = (
  totals: CreditTotals,
  error: string | null = null
): CreditResponse => ({
  ...totals,
  low_credit_thresholds: getLowCreditThresholds(totals.credits_remaining, totals.credits_total),
  error_if_any: error
});

const syncUserCreditMirror = async (
  userId: string,
  totals: CreditTotals,
  client: Prisma.TransactionClient | typeof prisma
): Promise<void> => {
  await client.user.update({
    where: {
      id: userId
    },
    data: {
      credits_included: totals.credits_total,
      credits_remaining: totals.credits_remaining,
      credits_used: Math.max(totals.credits_total - totals.credits_remaining, 0)
    }
  });
};

const assertLedgerIntegers = (amount: number, balanceAfter: number): void => {
  if (!Number.isInteger(amount)) {
    throw new Error("Credit ledger amount must be an integer");
  }

  if (!Number.isInteger(balanceAfter)) {
    throw new Error("Credit ledger balanceAfter must be an integer");
  }
};

const getCurrentBalance = async (
  userId: string,
  client: Prisma.TransactionClient | typeof prisma
): Promise<number> => {
  const totals = await getCreditTotals(userId, client);

  return totals.credits_remaining;
};

export const getLowCreditThresholds = (
  creditsRemaining: number,
  creditsTotal: number
): LowCreditThreshold[] =>
  lowCreditThresholdPercents.map((percent) => {
    const creditsRemainingAtThreshold =
      percent === 0 ? 0 : Math.floor(creditsTotal * ((100 - percent) / 100));

    return {
      percent,
      reached:
        percent === 0
          ? creditsRemaining <= 0
          : creditsTotal > 0 && creditsRemaining <= creditsRemainingAtThreshold,
      credits_remaining_at_threshold: creditsRemainingAtThreshold
    };
  });

export const getUserCredits = async (userId: string): Promise<CreditResponse> => {
  const totals = await getCreditTotals(userId, prisma);

  return toCreditResponse(totals);
};

export const addCredits = async (
  userId: string,
  amount: number,
  reason: CreditLedgerReason,
  options: {
    idempotencyKey?: string;
    source?: CreditLedgerSource;
    description?: string;
    stripeEventId?: string;
  } = {}
): Promise<CreditResponse> => {
  if (!Number.isInteger(amount) || amount <= 0) {
    const totals = await getCreditTotals(userId, prisma);

    return toCreditResponse(totals, invalidCreditAmountError);
  }

  return runSerializableTransaction(
    async (transaction) => {
      const currentBalance = await getCurrentBalance(userId, transaction);
      const balanceAfter = Math.max(0, currentBalance + amount);
      assertLedgerIntegers(amount, balanceAfter);

      await transaction.user.update({
        where: {
          id: userId
        },
        data: {
          credits_remaining: balanceAfter
        }
      });

      await transaction.creditLedger.create({
        data: {
          userId,
          accountId: userId,
          changeAmount: amount,
          amount,
          balanceAfter,
          reason,
          source: options.source ?? reason,
          description: options.description,
          stripeEventId: options.stripeEventId,
          idempotencyKey: options.idempotencyKey
        }
      });

      const totals = await getCreditTotals(userId, transaction);
      await syncUserCreditMirror(userId, totals, transaction);

      return toCreditResponse(totals);
    }
  );
};

export const deductCredit = async (
  userId: string,
  options: DeductCreditOptions = {}
): Promise<CreditResponse> => {
  const idempotencyKey =
    options.idempotencyKey ?? (options.imageJobId ? `image-job:${options.imageJobId}:credit-deduction` : undefined);

  try {
    return await runSerializableTransaction(
      async (transaction) => {
        if (idempotencyKey) {
          const existingDeduction = await transaction.creditLedger.findUnique({
            where: {
              idempotencyKey
            }
          });

          if (existingDeduction) {
            const totals = await getCreditTotals(userId, transaction);

            return toCreditResponse(totals);
          }
        }

        if (options.imageJobId) {
          const imageJob = await transaction.imageJob.findFirst({
            where: {
              id: options.imageJobId,
              user_id: userId
            },
            select: {
              status: true,
              credit_deducted_at: true
            }
          });

          if (!imageJob) {
            const totals = await getCreditTotals(userId, transaction);

            return toCreditResponse(totals, "Image job not found");
          }

          if (imageJob.status !== ImageJobStatus.completed) {
            const totals = await getCreditTotals(userId, transaction);

            return toCreditResponse(totals, "Credit can only be deducted after successful image processing");
          }

          if (imageJob.credit_deducted_at) {
            const totals = await getCreditTotals(userId, transaction);

            return toCreditResponse(totals);
          }
        }

        const currentBalance = await getCurrentBalance(userId, transaction);

        if (currentBalance < 1) {
          const totalsBeforeDeduction = await getCreditTotals(userId, transaction);
          return toCreditResponse(totalsBeforeDeduction, noCreditsError);
        }

        const balanceAfter = currentBalance - 1;
        assertLedgerIntegers(-1, balanceAfter);

        await transaction.user.update({
          where: {
            id: userId
          },
          data: {
            credits_remaining: balanceAfter,
            credits_used: {
              increment: 1
            }
          }
        });

        await transaction.creditLedger.create({
          data: {
            userId,
            accountId: userId,
            changeAmount: -1,
            amount: -1,
            balanceAfter,
            reason: CreditLedgerReason.usage,
            source: "image_processing",
            description: "Image processing credit used",
            idempotencyKey
          }
        });

        if (options.imageJobId) {
          await transaction.imageJob.update({
            where: {
              id: options.imageJobId
            },
            data: {
              credit_deducted_at: new Date()
            }
          });
        }

        const totals = await getCreditTotals(userId, transaction);
        await syncUserCreditMirror(userId, totals, transaction);

        return toCreditResponse(totals);
      }
    );
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      return getUserCredits(userId);
    }

    throw error;
  }
};

export const resetMonthlyCredits = async (
  userId: string,
  plan: SubscriptionPlan,
  options: {
    idempotencyKey?: string;
    source?: CreditLedgerSource;
    description?: string;
    stripeEventId?: string;
    creditsResetAt?: Date;
  } = {}
): Promise<CreditResponse> => {
  const creditsForPlan = PLAN_CREDIT_LIMITS[plan];
  const resetMonth = new Date().toISOString().slice(0, 7);
  const idempotencyKey = options.idempotencyKey ?? `monthly-reset:${userId}:${resetMonth}`;

  try {
    return await runSerializableTransaction(
      async (transaction) => {
        const balanceAfter = creditsForPlan;
        assertLedgerIntegers(creditsForPlan, balanceAfter);

        await transaction.user.update({
          where: {
            id: userId
          },
          data: {
            credits_included: creditsForPlan,
            credits_remaining: balanceAfter,
            credits_used: 0,
            credits_reset_at: options.creditsResetAt
          }
        });

        await transaction.creditLedger.create({
          data: {
            userId,
            accountId: userId,
            changeAmount: creditsForPlan,
            amount: creditsForPlan,
            balanceAfter,
            reason: CreditLedgerReason.reset,
            source: options.source ?? "stripe_invoice_payment_succeeded",
            description: options.description ?? "Monthly subscription credits reset",
            stripeEventId: options.stripeEventId,
            idempotencyKey
          }
        });

        const totals = await getCreditTotals(userId, transaction);
        await syncUserCreditMirror(userId, totals, transaction);

        return toCreditResponse(totals);
      }
    );
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      return getUserCredits(userId);
    }

    throw error;
  }
};
