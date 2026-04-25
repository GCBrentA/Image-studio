import {
  CreditLedgerReason,
  ImageJobStatus,
  Prisma,
  SubscriptionPlan
} from "@prisma/client";
import { prisma } from "../utils/prisma";

export const PLAN_CREDIT_LIMITS: Record<SubscriptionPlan, number> = {
  starter: 80,
  growth: 600,
  pro: 1500,
  agency: 5000
};

export const FREE_TRIAL_CREDITS = 20;

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
      user_id: userId,
      reason: CreditLedgerReason.reset
    },
    orderBy: {
      created_at: "desc"
    },
    select: {
      created_at: true
    }
  });

  return latestReset?.created_at ?? null;
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
        user_id: userId,
        ...(periodFilter ? { created_at: periodFilter } : {})
      },
      _sum: {
        change_amount: true
      }
    }),
    client.creditLedger.aggregate({
      where: {
        user_id: userId,
        change_amount: {
          gt: 0
        },
        ...(periodFilter ? { created_at: periodFilter } : {})
      },
      _sum: {
        change_amount: true
      }
    })
  ]);

  return {
    credits_remaining: Math.max(remaining._sum.change_amount ?? 0, 0),
    credits_total: positiveCredits._sum.change_amount ?? 0
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
  } = {}
): Promise<CreditResponse> => {
  if (!Number.isInteger(amount) || amount <= 0) {
    const totals = await getCreditTotals(userId, prisma);

    return toCreditResponse(totals, invalidCreditAmountError);
  }

  return runSerializableTransaction(
    async (transaction) => {
      await transaction.creditLedger.create({
        data: {
          user_id: userId,
          change_amount: amount,
          reason,
          idempotency_key: options.idempotencyKey
        }
      });

      const totals = await getCreditTotals(userId, transaction);

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
              idempotency_key: idempotencyKey
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

        const totalsBeforeDeduction = await getCreditTotals(userId, transaction);

        if (totalsBeforeDeduction.credits_remaining < 1) {
          return toCreditResponse(totalsBeforeDeduction, noCreditsError);
        }

        await transaction.creditLedger.create({
          data: {
            user_id: userId,
            change_amount: -1,
            reason: CreditLedgerReason.usage,
            idempotency_key: idempotencyKey
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
  } = {}
): Promise<CreditResponse> => {
  const creditsForPlan = PLAN_CREDIT_LIMITS[plan];
  const resetMonth = new Date().toISOString().slice(0, 7);
  const idempotencyKey = options.idempotencyKey ?? `monthly-reset:${userId}:${resetMonth}`;

  try {
    return await runSerializableTransaction(
      async (transaction) => {
        await transaction.creditLedger.create({
          data: {
            user_id: userId,
            change_amount: creditsForPlan,
            reason: CreditLedgerReason.reset,
            idempotency_key: idempotencyKey
          }
        });

        const totals = await getCreditTotals(userId, transaction);

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
