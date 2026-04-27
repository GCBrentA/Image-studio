import { ImageJobStatus, SubscriptionStatus } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";

const sinceDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const planMrr: Record<string, number> = {
  starter: 19,
  growth: 69,
  pro: 159,
  agency: 429
};

const mrrForPlan = (plan?: string | null): number => (plan ? planMrr[plan] ?? 0 : 0);

const asIso = (value?: Date | null): string | null => value?.toISOString() ?? null;

export const getPluginAnalyticsOverview = async () => {
  const last7 = sinceDays(7);

  const [
    connectedStores,
    activeStores7d,
    newStores7d,
    processedEvents7d,
    failedEvents7d,
    approvedEvents7d,
    creditsUsed7d,
    activeSubscriptions,
    subscriptions
  ] = await Promise.all([
    prisma.connectedSite.count(),
    prisma.connectedSite.count({
      where: {
        last_seen_at: {
          gte: last7
        }
      }
    }),
    prisma.connectedSite.count({
      where: {
        first_connected_at: {
          gte: last7
        }
      }
    }),
    prisma.pluginEvent.count({
      where: {
        event_type: "processing_completed",
        created_at: {
          gte: last7
        }
      }
    }),
    prisma.pluginEvent.count({
      where: {
        event_type: {
          in: ["processing_failed", "preview_failed"]
        },
        created_at: {
          gte: last7
        }
      }
    }),
    prisma.pluginEvent.count({
      where: {
        event_type: "image_approved",
        created_at: {
          gte: last7
        }
      }
    }),
    prisma.creditLedger.aggregate({
      where: {
        amount: {
          lt: 0
        },
        createdAt: {
          gte: last7
        }
      },
      _sum: {
        amount: true
      }
    }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.active
      }
    }),
    prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.active
      },
      select: {
        plan: true
      }
    })
  ]);

  const totalAttempts7d = processedEvents7d + failedEvents7d;
  const mrr = subscriptions.reduce((total, subscription) => total + mrrForPlan(subscription.plan), 0);

  return {
    cards: {
      connected_stores: connectedStores,
      active_stores_7d: activeStores7d,
      new_stores_7d: newStores7d,
      images_processed_7d: processedEvents7d,
      credits_consumed_7d: Math.abs(creditsUsed7d._sum.amount ?? 0),
      processing_failure_rate: totalAttempts7d > 0 ? failedEvents7d / totalAttempts7d : 0,
      approval_rate: processedEvents7d > 0 ? approvedEvents7d / processedEvents7d : 0,
      active_subscriptions: activeSubscriptions,
      mrr_usd: mrr
    },
    app_base_url: env.publicBaseUrl
  };
};

export const getPluginAnalyticsSeries = async () => {
  const last30 = sinceDays(30);
  const events = await prisma.pluginEvent.groupBy({
    by: ["event_type"],
    where: {
      created_at: {
        gte: last30
      }
    },
    _count: {
      _all: true
    }
  });

  return events.map((event) => ({
    event_type: event.event_type,
    count: event._count._all
  }));
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
