import { prisma } from "../utils/prisma";
import { getUsageForUser } from "./usageService";

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
    }))
  };
};
