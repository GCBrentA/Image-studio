import { ImageJobStatus, SubscriptionStatus } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";

const sinceDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const rangeToSince = (days = 7): Date | undefined => {
  if (!Number.isFinite(days) || days <= 0) {
    return undefined;
  }
  return sinceDays(days);
};

const planMrr: Record<string, number> = {
  starter: 19,
  growth: 69,
  pro: 159,
  agency: 429
};

const mrrForPlan = (plan?: string | null): number => (plan ? planMrr[plan] ?? 0 : 0);

const asIso = (value?: Date | null): string | null => value?.toISOString() ?? null;

export const getPluginAnalyticsOverview = async (days = 7) => {
  const since = rangeToSince(days);
  const whereDate = since ? { gte: since } : undefined;

  const [
    connectedStores,
    activeStores,
    newStores,
    processedImages,
    completedJobs,
    attemptedJobs,
    failedJobs,
    approvedEvents,
    creditsUsed,
    activeSubscriptions,
    subscriptions
  ] = await Promise.all([
    prisma.connectedSite.count(),
    prisma.connectedSite.count({
      where: whereDate ? { last_seen_at: whereDate } : {}
    }),
    prisma.connectedSite.count({
      where: whereDate ? { first_connected_at: whereDate } : {}
    }),
    prisma.processedImage.count({
      where: whereDate ? { created_at: whereDate } : {}
    }),
    prisma.imageJob.count({
      where: {
        status: ImageJobStatus.completed,
        ...(whereDate ? { updated_at: whereDate } : {})
      }
    }),
    prisma.imageJob.count({
      where: {
        status: {
          in: [ImageJobStatus.processing, ImageJobStatus.completed, ImageJobStatus.failed]
        },
        ...(whereDate ? { updated_at: whereDate } : {})
      }
    }),
    prisma.imageJob.count({
      where: {
        status: ImageJobStatus.failed,
        ...(whereDate ? { updated_at: whereDate } : {})
      }
    }),
    prisma.pluginEvent.count({
      where: {
        event_type: "image_approved",
        ...(whereDate ? { created_at: whereDate } : {})
      }
    }),
    prisma.creditLedger.aggregate({
      where: {
        amount: {
          lt: 0
        },
        ...(whereDate ? { createdAt: whereDate } : {})
      },
      _sum: {
        amount: true
      }
    }),
    prisma.subscription.count({
      where: {
        status: {
          in: [SubscriptionStatus.active, SubscriptionStatus.trialing]
        }
      }
    }),
    prisma.subscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.active, SubscriptionStatus.trialing]
        }
      },
      select: {
        plan: true,
        cancel_at_period_end: true
      }
    })
  ]);

  const imagesProcessed = Math.max(processedImages, completedJobs);
  const mrr = subscriptions.reduce((total, subscription) => total + mrrForPlan(subscription.plan), 0);

  return {
    cards: {
      connected_stores: connectedStores,
      active_stores: activeStores,
      new_stores: newStores,
      images_processed: imagesProcessed,
      credits_consumed: Math.abs(creditsUsed._sum.amount ?? 0),
      processing_failure_rate: attemptedJobs > 0 ? failedJobs / attemptedJobs : 0,
      processing_attempts: attemptedJobs,
      approval_rate: imagesProcessed > 0 ? approvedEvents / imagesProcessed : 0,
      approved_images: approvedEvents,
      active_subscriptions: activeSubscriptions,
      mrr_usd: mrr
    },
    range_days: days,
    empty_states: {
      images_processed: imagesProcessed === 0 ? "No processed images in this period." : null,
      processing_failure_rate: attemptedJobs === 0 ? "No processing attempts in this period." : null,
      approval_rate: imagesProcessed === 0 ? "No processed images approved yet." : null,
      active_subscriptions: activeSubscriptions === 0 ? "No active paid subscriptions yet." : null
    },
    app_base_url: env.publicBaseUrl
  };
};

export const getPluginAnalyticsSeries = async (days = 30) => {
  const since = rangeToSince(days);
  const events = await prisma.pluginEvent.groupBy({
    by: ["event_type"],
    where: since ? { created_at: { gte: since } } : {},
    _count: {
      _all: true
    }
  });

  return events.map((event) => ({
    event_type: event.event_type,
    count: event._count._all
  }));
};

export const getPluginAnalyticsTrends = async (days = 30) => {
  const since = rangeToSince(days);
  const [processed, approved, failed, credits] = await Promise.all([
    prisma.processedImage.groupBy({
      by: ["created_at"],
      where: since ? { created_at: { gte: since } } : {},
      _count: { _all: true }
    }),
    prisma.pluginEvent.findMany({
      where: {
        event_type: "image_approved",
        ...(since ? { created_at: { gte: since } } : {})
      },
      select: { created_at: true }
    }),
    prisma.imageJob.findMany({
      where: {
        status: ImageJobStatus.failed,
        ...(since ? { updated_at: { gte: since } } : {})
      },
      select: { updated_at: true }
    }),
    prisma.creditLedger.findMany({
      where: since ? { createdAt: { gte: since } } : {},
      select: { createdAt: true, amount: true, source: true }
    })
  ]);

  type TrendRow = {
    date: string;
    processed: number;
    approved: number;
    failed: number;
    credits_consumed: number;
    credits_added: number;
  };
  const bucket = new Map<string, TrendRow>();
  const dayKey = (date: Date) => date.toISOString().slice(0, 10);
  const add = (date: Date, key: keyof Omit<TrendRow, "date">, amount = 1) => {
    const day = dayKey(date);
    const row = bucket.get(day) ?? { date: day, processed: 0, approved: 0, failed: 0, credits_consumed: 0, credits_added: 0 };
    row[key] = (row[key] ?? 0) + amount;
    bucket.set(day, row);
  };

  processed.forEach((row) => add(row.created_at, "processed", row._count._all));
  approved.forEach((row) => add(row.created_at, "approved"));
  failed.forEach((row) => add(row.updated_at, "failed"));
  credits.forEach((row) => {
    if (row.amount < 0) add(row.createdAt, "credits_consumed", Math.abs(row.amount));
    if (row.amount > 0) add(row.createdAt, "credits_added", row.amount);
  });

  return Array.from(bucket.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

export const getPluginAnalyticsStores = async () => {
  const stores = await prisma.connectedSite.findMany({
    orderBy: {
      last_seen_at: "desc"
    },
    take: 100,
    select: {
      id: true,
      domain: true,
      canonical_domain: true,
      site_url: true,
      plugin_version: true,
      wordpress_version: true,
      woocommerce_version: true,
      php_version: true,
      claim_status: true,
      first_connected_at: true,
      last_seen_at: true,
      user: {
        select: {
          id: true,
          email: true,
          billing_plan: true,
          billing_status: true,
          credits_remaining: true
        }
      },
      plugin_events: {
        select: {
          event_type: true
        }
      }
    }
  });

  return stores.map((store) => {
    const counts = store.plugin_events.reduce<Record<string, number>>((summary, event) => {
      summary[event.event_type] = (summary[event.event_type] ?? 0) + 1;
      return summary;
    }, {});

    return {
      id: store.id,
      domain: store.canonical_domain ?? store.domain,
      site_url: store.site_url,
      account_email: store.user.email,
      plan: store.user.billing_plan,
      billing_status: store.user.billing_status,
      credits_remaining: store.user.credits_remaining,
      plugin_version: store.plugin_version,
      wordpress_version: store.wordpress_version,
      woocommerce_version: store.woocommerce_version,
      php_version: store.php_version,
      total_scanned: counts.scan_completed ?? 0,
      total_queued: counts.image_queued ?? counts.queue_created ?? 0,
      total_processed: counts.processing_completed ?? 0,
      total_approved: counts.image_approved ?? 0,
      total_failed: (counts.processing_failed ?? 0) + (counts.preview_failed ?? 0),
      first_connected_at: asIso(store.first_connected_at),
      last_seen_at: asIso(store.last_seen_at),
      claim_status: store.claim_status
    };
  });
};

export const getPluginAnalyticsEvents = async () => {
  const events = await prisma.pluginEvent.findMany({
    orderBy: {
      created_at: "desc"
    },
    take: 100,
    select: {
      id: true,
      event_type: true,
      canonical_domain: true,
      plugin_version: true,
      wordpress_version: true,
      woocommerce_version: true,
      plan: true,
      credits_remaining: true,
      metadata: true,
      created_at: true
    }
  });

  return events.map((event) => ({
    ...event,
    created_at: event.created_at.toISOString()
  }));
};

export const getPluginAnalyticsStoreDetail = async (storeId: string) => {
  const store = await prisma.connectedSite.findUnique({
    where: {
      id: storeId
    },
    select: {
      id: true,
      domain: true,
      canonical_domain: true,
      site_url: true,
      home_url: true,
      wordpress_install_id: true,
      plugin_version: true,
      wordpress_version: true,
      woocommerce_version: true,
      php_version: true,
      claim_status: true,
      first_connected_at: true,
      last_seen_at: true,
      user: {
        select: {
          id: true,
          email: true,
          billing_plan: true,
          billing_status: true,
          credits_remaining: true,
          credits_used: true
        }
      }
    }
  });

  if (!store) {
    throw new HttpError(404, "Store not found");
  }

  const [events, jobs, ledger] = await Promise.all([
    prisma.pluginEvent.findMany({
      where: {
        store_id: storeId
      },
      orderBy: {
        created_at: "desc"
      },
      take: 50
    }),
    prisma.imageJob.findMany({
      where: {
        user_id: store.user.id
      },
      orderBy: {
        updated_at: "desc"
      },
      take: 20,
      select: {
        id: true,
        status: true,
        created_at: true,
        updated_at: true,
        credit_deducted_at: true
      }
    }),
    prisma.creditLedger.findMany({
      where: {
        userId: store.user.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20,
      select: {
        id: true,
        source: true,
        amount: true,
        balanceAfter: true,
        description: true,
        createdAt: true
      }
    })
  ]);

  return {
    store: {
      ...store,
      first_connected_at: asIso(store.first_connected_at),
      last_seen_at: asIso(store.last_seen_at)
    },
    events: events.map((event) => ({
      id: event.id,
      event_type: event.event_type,
      metadata: event.metadata,
      created_at: event.created_at.toISOString()
    })),
    recent_jobs: jobs.map((job) => ({
      ...job,
      status: job.status ?? ImageJobStatus.queued,
      created_at: job.created_at.toISOString(),
      updated_at: job.updated_at.toISOString(),
      credit_deducted_at: asIso(job.credit_deducted_at)
    })),
    credit_ledger: ledger.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString()
    }))
  };
};
