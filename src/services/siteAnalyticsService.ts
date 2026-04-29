import type { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { approvedAnalyticsEvents, conversionCandidateEvents } from "../lib/analytics/eventMap";
import { detectRouteGroup } from "../lib/analytics/attribution";
import { sanitizeAnalyticsEventName, sanitizeAnalyticsParams } from "../lib/analytics/privacy";
import { prisma } from "../utils/prisma";

type TrackSiteAnalyticsEventInput = {
  eventName: string;
  eventSource?: string;
  params?: Record<string, unknown>;
};

const sinceDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const safeText = (value: unknown): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return text || undefined;
};

export const trackSiteAnalyticsEvent = async ({
  eventName,
  eventSource = "website",
  params = {}
}: TrackSiteAnalyticsEventInput): Promise<void> => {
  const sanitizedEventName = sanitizeAnalyticsEventName(eventName);
  if (!approvedAnalyticsEvents.has(sanitizedEventName)) {
    return;
  }

  const safe = sanitizeAnalyticsParams({
    ...params,
    environment: params.environment || env.nodeEnv
  });
  const pagePath = safeText(safe.page_path);
  const routeGroup = safeText(safe.route_group) || (pagePath ? detectRouteGroup(pagePath) : undefined);

  await prisma.analyticsEvent.create({
    data: {
      event_name: sanitizedEventName,
      event_source: safeText(eventSource) || "website",
      route_group: routeGroup,
      page_path: pagePath,
      clean_url: safeText(safe.clean_url),
      session_engagement_id: safeText(safe.session_engagement_id),
      visitor_type: safeText(safe.visitor_type),
      referrer_domain: safeText(safe.referrer_domain),
      first_touch_source: safeText(safe.first_touch_source),
      first_touch_medium: safeText(safe.first_touch_medium),
      first_touch_campaign: safeText(safe.first_touch_campaign),
      last_touch_source: safeText(safe.last_touch_source),
      last_touch_medium: safeText(safe.last_touch_medium),
      last_touch_campaign: safeText(safe.last_touch_campaign),
      landing_page: safeText(safe.landing_page),
      entry_route_group: safeText(safe.entry_route_group),
      funnel_stage: safeText(safe.funnel_stage),
      product_slug: safeText(safe.product_slug),
      plugin_slug: safeText(safe.plugin_slug),
      plan_name: safeText(safe.plan_name),
      content_slug: safeText(safe.content_slug),
      cta_location: safeText(safe.cta_location),
      environment: safeText(safe.environment),
      metadata: safe as Prisma.InputJsonObject
    }
  });
};

const countEvents = async (eventNames: string[], since?: Date): Promise<number> =>
  prisma.analyticsEvent.count({
    where: {
      event_name: { in: eventNames },
      ...(since ? { created_at: { gte: since } } : {})
    }
  });

const topBy = async (field: "landing_page" | "referrer_domain" | "first_touch_campaign" | "content_slug" | "page_path", since?: Date) => {
  const rows = await prisma.analyticsEvent.groupBy({
    by: [field],
    where: {
      ...(since ? { created_at: { gte: since } } : {}),
      [field]: { not: null }
    },
    _count: { _all: true },
    orderBy: { _count: { [field]: "desc" } },
    take: 10
  });

  return rows.map((row) => ({
    label: String(row[field] || "-"),
    count: row._count._all
  }));
};

export const getSiteAnalyticsOverview = async (days = 30) => {
  const since = days > 0 ? sinceDays(days) : undefined;
  const whereDate = since ? { created_at: { gte: since } } : {};

  const [
    visitors,
    totalEvents,
    productPageViews,
    downloadClicks,
    downloadCompletions,
    pricingClicks,
    checkoutStarts,
    checkoutSuccesses,
    contactSubmits,
    shopifyInstalls,
    topLandingPages,
    topReferrers,
    topCampaigns,
    topBlogPosts,
    dropOffRows,
    sourceRows,
    landingRows
  ] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["session_engagement_id"],
      where: {
        ...whereDate,
        session_engagement_id: { not: null }
      },
      _count: { _all: true }
    }),
    prisma.analyticsEvent.count({ where: whereDate }),
    countEvents(["image_studio_page_view"], since),
    countEvents(["plugin_download_click", "image_studio_download_click"], since),
    countEvents(["plugin_download_completed", "server_plugin_download_completed"], since),
    countEvents(["pricing_cta_click", "image_studio_pricing_click"], since),
    countEvents(["checkout_started"], since),
    countEvents(["checkout_success_landing", "server_checkout_success"], since),
    countEvents(["contact_form_success"], since),
    countEvents(["shopify_install_success", "server_shopify_install_success"], since),
    topBy("landing_page", since),
    topBy("referrer_domain", since),
    topBy("first_touch_campaign", since),
    topBy("content_slug", since),
    prisma.analyticsEvent.groupBy({
      by: ["event_name"],
      where: whereDate,
      _count: { _all: true },
      orderBy: { _count: { event_name: "desc" } },
      take: 20
    }),
    prisma.analyticsEvent.groupBy({
      by: ["first_touch_source"],
      where: {
        ...whereDate,
        first_touch_source: { not: null }
      },
      _count: { _all: true },
      orderBy: { _count: { first_touch_source: "desc" } },
      take: 20
    }),
    prisma.analyticsEvent.groupBy({
      by: ["landing_page"],
      where: {
        ...whereDate,
        landing_page: { not: null }
      },
      _count: { _all: true },
      orderBy: { _count: { landing_page: "desc" } },
      take: 20
    })
  ]);

  const conversions = await prisma.analyticsEvent.groupBy({
    by: ["first_touch_source"],
    where: {
      ...whereDate,
      event_name: { in: Array.from(conversionCandidateEvents) },
      first_touch_source: { not: null }
    },
    _count: { _all: true },
    orderBy: { _count: { first_touch_source: "desc" } },
    take: 20
  });

  const landingConversions = await prisma.analyticsEvent.groupBy({
    by: ["landing_page"],
    where: {
      ...whereDate,
      event_name: { in: Array.from(conversionCandidateEvents) },
      landing_page: { not: null }
    },
    _count: { _all: true },
    orderBy: { _count: { landing_page: "desc" } },
    take: 20
  });

  const conversionBySource = sourceRows.map((row) => {
    const converted = conversions.find((item) => item.first_touch_source === row.first_touch_source)?._count._all ?? 0;
    return {
      source: row.first_touch_source,
      visits: row._count._all,
      conversions: converted,
      conversion_rate: row._count._all ? converted / row._count._all : 0
    };
  });

  const conversionByLandingPage = landingRows.map((row) => {
    const converted = landingConversions.find((item) => item.landing_page === row.landing_page)?._count._all ?? 0;
    return {
      landing_page: row.landing_page,
      visits: row._count._all,
      conversions: converted,
      conversion_rate: row._count._all ? converted / row._count._all : 0
    };
  });

  return {
    range_days: days,
    cards: {
      total_visitors: visitors.length,
      total_events: totalEvents,
      product_page_views: productPageViews,
      download_clicks: downloadClicks,
      download_completions: downloadCompletions,
      pricing_cta_clicks: pricingClicks,
      checkout_starts: checkoutStarts,
      checkout_successes: checkoutSuccesses,
      contact_submits: contactSubmits,
      shopify_installs: shopifyInstalls
    },
    top_landing_pages: topLandingPages,
    top_referrers: topReferrers,
    top_utm_campaigns: topCampaigns,
    top_blog_posts: topBlogPosts,
    drop_off_points: dropOffRows.map((row) => ({ event_name: row.event_name, count: row._count._all })),
    conversion_rate_by_source: conversionBySource,
    conversion_rate_by_landing_page: conversionByLandingPage
  };
};
