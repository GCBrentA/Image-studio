import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";

export const pluginEventTypes = [
  "plugin_connected",
  "connection_tested",
  "settings_saved",
  "scan_started",
  "scan_completed",
  "queue_created",
  "image_queued",
  "processing_started",
  "processing_completed",
  "processing_failed",
  "preview_failed",
  "image_approved",
  "image_rejected",
  "seo_generated",
  "credits_low",
  "buy_credits_clicked",
  "credit_checkout_started",
  "credit_checkout_completed",
  "subscription_checkout_started",
  "subscription_checkout_completed",
  "billing_portal_opened",
  "plugin_version_seen"
] as const;

export type PluginEventType = (typeof pluginEventTypes)[number];

const pluginEventTypeSet = new Set<string>(pluginEventTypes);
const maxMetadataBytes = 4096;
const blockedMetadataKeys = new Set([
  "api_token",
  "token",
  "authorization",
  "password",
  "secret",
  "stripe_secret_key",
  "supabase_service_role_key",
  "signed_url",
  "processed_url",
  "image_url"
]);

const sanitizeScalar = (value: unknown): Prisma.JsonValue | undefined => {
  if (typeof value === "string") {
    return value.slice(0, 300);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean" || value === null) {
    return value;
  }

  return undefined;
};

const sanitizeMetadata = (value: unknown, depth = 0): Prisma.JsonValue => {
  if (depth > 3) {
    return {};
  }

  const scalar = sanitizeScalar(value);
  if (scalar !== undefined) {
    return scalar;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    const output: Prisma.JsonObject = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      const normalizedKey = key.trim().toLowerCase();
      if (!normalizedKey || blockedMetadataKeys.has(normalizedKey) || normalizedKey.includes("token") || normalizedKey.includes("secret")) {
        continue;
      }
      output[normalizedKey.replace(/[^a-z0-9_:-]/g, "_").slice(0, 80)] = sanitizeMetadata(item, depth + 1);
    }
    return output;
  }

  return {};
};

const trimMetadataSize = (metadata: Prisma.JsonValue): Prisma.JsonValue => {
  const serialized = JSON.stringify(metadata);
  if (Buffer.byteLength(serialized, "utf8") <= maxMetadataBytes) {
    return metadata;
  }

  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return {
      truncated: true,
      keys: Object.keys(metadata as Record<string, unknown>).slice(0, 20)
    };
  }

  return {
    truncated: true
  };
};

export const recordPluginEvent = async (input: {
  userId: string;
  siteId: string;
  canonicalDomain: string | null;
  eventType: string;
  pluginVersion?: string;
  wordpressVersion?: string;
  woocommerceVersion?: string;
  phpVersion?: string;
  creditsRemaining?: number | null;
  metadata?: unknown;
}) => {
  if (!pluginEventTypeSet.has(input.eventType)) {
    throw new HttpError(400, "Unsupported plugin event type");
  }

  const [user, site] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        billing_plan: true,
        credits_remaining: true
      }
    }),
    prisma.connectedSite.findUnique({
      where: {
        id: input.siteId
      },
      select: {
        id: true,
        canonical_domain: true
      }
    })
  ]);

  if (!user || !site) {
    throw new HttpError(401, "Invalid site token");
  }

  const metadata = trimMetadataSize(sanitizeMetadata(input.metadata ?? {}));

  return prisma.pluginEvent.create({
    data: {
      account_id: input.userId,
      store_id: input.siteId,
      canonical_domain: input.canonicalDomain ?? site.canonical_domain,
      event_type: input.eventType,
      plugin_version: input.pluginVersion?.slice(0, 80),
      wordpress_version: input.wordpressVersion?.slice(0, 80),
      woocommerce_version: input.woocommerceVersion?.slice(0, 80),
      php_version: input.phpVersion?.slice(0, 80),
      plan: user.billing_plan ?? null,
      credits_remaining: Number.isInteger(input.creditsRemaining)
        ? input.creditsRemaining
        : user.credits_remaining,
      metadata: metadata === null ? Prisma.JsonNull : metadata
    },
    select: {
      id: true
    }
  });
};
