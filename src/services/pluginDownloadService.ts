import { createHash, randomBytes } from "crypto";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import type { Response } from "express";
import { env } from "../config/env";
import { sendGa4ServerEvent } from "../lib/analytics/server";
import { HttpError } from "../utils/httpError";
import { prisma } from "../utils/prisma";
import { trackSiteAnalyticsEvent } from "./siteAnalyticsService";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenBytes = 32;
const maxTextLength = 2000;
const downloadRoot = path.resolve(process.cwd(), "public", "site", "downloads");

export type DownloadRequestInput = {
  slug: string;
  email: string;
  name?: string;
  marketingConsent: boolean;
  privacyAccepted: boolean;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  ip?: string;
  userAgent?: string;
};

export type ReviewInput = {
  slug: string;
  email: string;
  rating: number;
  title: string;
  body: string;
  displayName: string;
};

const cleanString = (value: unknown, maxLength = 255): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const hashValue = (value?: string): string | undefined =>
  value ? createHash("sha256").update(`${env.apiTokenSalt}:${value}`).digest("hex") : undefined;

const getPublicDownloadUrl = (token: string): string => `/api/plugin-downloads/${token}`;

const getPluginOrThrow = async (slug: string) => {
  const plugin = await prisma.pluginProduct.findFirst({
    where: {
      slug,
      isActive: true
    }
  });

  if (!plugin) {
    throw new HttpError(404, "Plugin not found");
  }

  return plugin;
};

const getSafeDownloadPath = (downloadFilePath: string): string => {
  const resolved = path.resolve(process.cwd(), downloadFilePath);

  if (!resolved.startsWith(`${downloadRoot}${path.sep}`)) {
    throw new HttpError(500, "Plugin download file is not in the allowed downloads directory");
  }

  if (!existsSync(resolved)) {
    throw new HttpError(404, "Plugin download file is not available");
  }

  return resolved;
};

const sendTransactionalDownloadEmail = async (
  email: string,
  pluginName: string,
  downloadUrl: string
): Promise<void> => {
  /*
   * Email provider integration point.
   *
   * Configure this with a transactional provider such as Brevo, Postmark, or Resend.
   * This function intentionally no-ops when no provider key is configured so download
   * requests are not blocked by email delivery settings. Do not send marketing email
   * from here; this is only for the requested download/setup link.
   */
  if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY && !process.env.POSTMARK_SERVER_TOKEN) {
    return;
  }

  console.info("Transactional plugin download email provider is configured but not implemented in this build", {
    email_domain: email.split("@")[1] ?? "unknown",
    plugin: pluginName,
    download_path: downloadUrl
  });
};

export const createPluginDownloadRequest = async (input: DownloadRequestInput) => {
  const email = normalizeEmail(input.email);

  if (!emailPattern.test(email)) {
    throw new HttpError(400, "Enter a valid email address");
  }

  if (!input.privacyAccepted) {
    throw new HttpError(400, "Privacy Policy acceptance is required before downloading");
  }

  const plugin = await getPluginOrThrow(input.slug);
  const ipHash = hashValue(input.ip);
  const userAgentHash = hashValue(input.userAgent);
  const lead = await prisma.pluginLead.upsert({
    where: {
      email
    },
    update: {
      name: cleanString(input.name, 120),
      marketingConsent: input.marketingConsent,
      privacyAccepted: true,
      source: cleanString(input.source, 120),
      utmSource: cleanString(input.utmSource, 120),
      utmMedium: cleanString(input.utmMedium, 120),
      utmCampaign: cleanString(input.utmCampaign, 160),
      referrer: cleanString(input.referrer, 500),
      ipHash,
      userAgentHash
    },
    create: {
      email,
      name: cleanString(input.name, 120),
      marketingConsent: input.marketingConsent,
      privacyAccepted: true,
      source: cleanString(input.source, 120),
      utmSource: cleanString(input.utmSource, 120),
      utmMedium: cleanString(input.utmMedium, 120),
      utmCampaign: cleanString(input.utmCampaign, 160),
      referrer: cleanString(input.referrer, 500),
      ipHash,
      userAgentHash
    }
  });
  const token = randomBytes(tokenBytes).toString("base64url");

  await prisma.pluginDownload.create({
    data: {
      pluginId: plugin.id,
      leadId: lead.id,
      version: plugin.currentVersion,
      token,
      status: "requested",
      source: cleanString(input.source, 120),
      ipHash,
      userAgentHash
    }
  });

  const downloadUrl = getPublicDownloadUrl(token);
  await sendTransactionalDownloadEmail(email, plugin.name, `${env.publicBaseUrl}${downloadUrl}`).catch((error) => {
    console.warn("Plugin download email failed", {
      plugin: plugin.slug,
      reason: error instanceof Error ? error.message : "Unknown error"
    });
  });

  return {
    success: true,
    downloadUrl
  };
};

export const streamPluginDownload = async (token: string, response: Response): Promise<void> => {
  const safeToken = cleanString(token, 120);

  if (!safeToken || !/^[A-Za-z0-9_-]{24,}$/.test(safeToken)) {
    throw new HttpError(404, "Download link not found");
  }

  const download = await prisma.pluginDownload.findUnique({
    where: {
      token: safeToken
    },
    include: {
      plugin: true
    }
  });

  if (!download || !download.plugin.isActive) {
    throw new HttpError(404, "Download link not found");
  }

  const filePath = getSafeDownloadPath(download.plugin.downloadFilePath);
  const fileName = `${download.plugin.slug}-v${download.version}.zip`;
  const fileStats = statSync(filePath);

  await prisma.pluginDownload.update({
    where: {
      id: download.id
    },
    data: {
      status: download.completedAt ? download.status : "started",
      startedAt: download.startedAt ?? new Date()
    }
  });

  response.setHeader("Content-Type", "application/zip");
  response.setHeader("Content-Length", fileStats.size);
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.setHeader("X-Content-Type-Options", "nosniff");

  const stream = createReadStream(filePath);

  stream.on("error", () => {
    prisma.pluginDownload.update({
      where: {
        id: download.id
      },
      data: {
        status: "failed",
        failedAt: new Date()
      }
    }).then(() => Promise.allSettled([
      trackSiteAnalyticsEvent({
        eventName: "plugin_download_failed",
        eventSource: "server",
        params: {
          plugin_slug: download.plugin.slug,
          plugin_version: download.version,
          download_type: "zip",
          result: "failure",
          error_category: "file_stream",
          funnel_stage: "conversion"
        }
      }),
      sendGa4ServerEvent({
        eventName: "plugin_download_failed",
        params: {
          plugin_slug: download.plugin.slug,
          plugin_version: download.version,
          download_type: "zip",
          result: "failure",
          error_category: "file_stream",
          funnel_stage: "conversion"
        }
      })
    ])).catch(() => undefined);
    response.end();
  });

  response.on("finish", () => {
    if (response.statusCode >= 200 && response.statusCode < 300 && !download.completedAt) {
      prisma.pluginDownload.update({
        where: {
          id: download.id
        },
        data: {
          status: "completed",
          completedAt: new Date()
        }
      }).then(() => {
        const params = {
          plugin_slug: download.plugin.slug,
          plugin_version: download.version,
          download_type: "zip",
          result: "success",
          funnel_stage: "conversion",
          event_source: "server"
        };
        return Promise.allSettled([
          trackSiteAnalyticsEvent({ eventName: "server_plugin_download_completed", eventSource: "server", params }),
          sendGa4ServerEvent({ eventName: "server_plugin_download_completed", params })
        ]);
      }).catch(() => undefined);
    }
  });

  stream.pipe(response);
};

export const createPluginReview = async (input: ReviewInput) => {
  const email = normalizeEmail(input.email);

  if (!emailPattern.test(email)) {
    throw new HttpError(400, "Enter a valid email address");
  }

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new HttpError(400, "Rating must be between 1 and 5");
  }

  const plugin = await getPluginOrThrow(input.slug);
  const lead = await prisma.pluginLead.findUnique({
    where: {
      email
    }
  });
  const verifiedDownload = lead
    ? await prisma.pluginDownload.count({
      where: {
        pluginId: plugin.id,
        leadId: lead.id,
        status: "completed"
      }
    }) > 0
    : false;

  await prisma.pluginReview.create({
    data: {
      pluginId: plugin.id,
      leadId: lead?.id,
      rating: input.rating,
      title: cleanString(input.title, 160) ?? "Plugin review",
      body: cleanString(input.body, maxTextLength) ?? "",
      displayName: cleanString(input.displayName, 80) ?? "WooCommerce user",
      verifiedDownload,
      status: "pending"
    }
  });

  return {
    success: true,
    message: "Thanks. Your review has been submitted and is pending approval."
  };
};

export const getPublicPluginReviews = async (slug: string) => {
  const plugin = await getPluginOrThrow(slug);
  const [reviews, ratingGroups, downloadCount] = await Promise.all([
    prisma.pluginReview.findMany({
      where: {
        pluginId: plugin.id,
        status: "approved"
      },
      orderBy: {
        approvedAt: "desc"
      },
      take: 20
    }),
    prisma.pluginReview.groupBy({
      by: ["rating"],
      where: {
        pluginId: plugin.id,
        status: "approved"
      },
      _count: {
        rating: true
      }
    }),
    prisma.pluginDownload.count({
      where: {
        pluginId: plugin.id,
        status: "completed"
      }
    })
  ]);
  const reviewCount = reviews.length;
  const ratingBreakdown = [1, 2, 3, 4, 5].reduce<Record<string, number>>((summary, rating) => {
    summary[rating] = ratingGroups.find((group) => group.rating === rating)?._count.rating ?? 0;
    return summary;
  }, {});
  const totalRating = ratingGroups.reduce((total, group) => total + group.rating * group._count.rating, 0);
  const totalReviews = ratingGroups.reduce((total, group) => total + group._count.rating, 0);

  return {
    plugin: {
      slug: plugin.slug,
      name: plugin.name,
      version: plugin.currentVersion,
      description: plugin.description
    },
    averageRating: totalReviews ? Number((totalRating / totalReviews).toFixed(1)) : 0,
    reviewCount: totalReviews,
    downloadCount,
    ratingBreakdown,
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      displayName: review.displayName,
      verifiedDownload: review.verifiedDownload,
      createdAt: review.createdAt
    }))
  };
};

export const getPluginDownloadAdminSummary = async () => {
  const [
    completedDownloads,
    requests,
    leads,
    optIns,
    byPlugin,
    byVersion,
    topSources,
    pendingReviews,
    averageRatings
  ] = await Promise.all([
    prisma.pluginDownload.count({ where: { status: "completed" } }),
    prisma.pluginDownload.count(),
    prisma.pluginLead.count(),
    prisma.pluginLead.count({ where: { marketingConsent: true } }),
    prisma.pluginDownload.groupBy({
      by: ["pluginId"],
      where: { status: "completed" },
      _count: { pluginId: true }
    }),
    prisma.pluginDownload.groupBy({
      by: ["version"],
      where: { status: "completed" },
      _count: { version: true }
    }),
    prisma.pluginDownload.groupBy({
      by: ["source"],
      _count: { source: true },
      orderBy: { _count: { source: "desc" } },
      take: 8
    }),
    prisma.pluginReview.findMany({
      where: { status: "pending" },
      include: { plugin: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.pluginReview.groupBy({
      by: ["pluginId"],
      where: { status: "approved" },
      _avg: { rating: true },
      _count: { rating: true }
    })
  ]);
  const products = await prisma.pluginProduct.findMany();
  const productNameById = new Map(products.map((product) => [product.id, product.name]));

  return {
    completedDownloads,
    downloadRequests: requests,
    leadsCaptured: leads,
    marketingOptInRate: leads ? Number(((optIns / leads) * 100).toFixed(1)) : 0,
    completionRate: requests ? Number(((completedDownloads / requests) * 100).toFixed(1)) : 0,
    downloadsByPlugin: byPlugin.map((item) => ({
      plugin: productNameById.get(item.pluginId) ?? item.pluginId,
      count: item._count.pluginId
    })),
    downloadsByVersion: byVersion.map((item) => ({
      version: item.version,
      count: item._count.version
    })),
    topSources: topSources.map((item) => ({
      source: item.source ?? "direct",
      count: item._count.source
    })),
    pendingReviews: pendingReviews.map((review) => ({
      id: review.id,
      plugin: review.plugin.name,
      rating: review.rating,
      title: review.title,
      body: review.body,
      displayName: review.displayName,
      verifiedDownload: review.verifiedDownload,
      createdAt: review.createdAt
    })),
    averageRatings: averageRatings.map((item) => ({
      plugin: productNameById.get(item.pluginId) ?? item.pluginId,
      averageRating: Number((item._avg.rating ?? 0).toFixed(1)),
      reviewCount: item._count.rating
    }))
  };
};

export const getPluginLeadsAdmin = async () =>
  prisma.pluginLead.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 200
  });

export const getPluginDownloadsAdmin = async () =>
  prisma.pluginDownload.findMany({
    include: {
      plugin: true,
      lead: true
    },
    orderBy: {
      requestedAt: "desc"
    },
    take: 200
  });

export const getPluginReviewsAdmin = async () =>
  prisma.pluginReview.findMany({
    include: {
      plugin: true,
      lead: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 200
  });

export const updatePluginReviewStatus = async (id: string, status: "approved" | "rejected") =>
  prisma.pluginReview.update({
    where: {
      id
    },
    data: {
      status,
      approvedAt: status === "approved" ? new Date() : null
    }
  });

export const deletePluginReview = async (id: string) =>
  prisma.pluginReview.delete({
    where: {
      id
    }
  });
