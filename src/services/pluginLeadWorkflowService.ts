import { createHash } from "crypto";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import type { Response } from "express";
import { env } from "../config/env";
import { sendGa4ServerEvent } from "../lib/analytics/server";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/httpError";
import { sendPluginDownloadEmail, type EmailSendResult } from "./emailService";
import { trackSiteAnalyticsEvent } from "./siteAnalyticsService";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxText = 2000;
const downloadRoot = path.resolve(process.cwd(), "public", "site", "downloads");

const pluginAliases: Record<string, string> = {
  "optivra-image-studio": "optivra-image-studio",
  "optivra-image-studio-for-woocommerce": "optivra-image-studio",
  optivra_image_studio: "optivra-image-studio",
  "optivra-gateway-rules": "optivra-gateway-rules",
  "payment-gateway-rules-for-woocommerce": "optivra-gateway-rules",
  payment_gateway_rules: "optivra-gateway-rules"
};

type PluginReleaseRow = {
  id: string;
  plugin_slug: string;
  plugin_name: string;
  version: string;
  file_url: string;
  file_size_bytes: bigint | number | null;
  checksum_sha256: string | null;
  release_notes: string | null;
  minimum_wp_version: string | null;
  minimum_wc_version: string | null;
  requires_php_version: string | null;
};

type LeadRow = {
  id: string;
  email_normalized: string;
  plugin_slug: string;
  unsubscribe_token: string;
  consent_product_updates: boolean;
  consent_marketing: boolean;
  consent_feedback: boolean;
  unsubscribed_at: Date | string | null;
};

type DownloadEventRow = {
  id: string;
  lead_id: string | null;
  plugin_release_id: string | null;
  plugin_slug: string;
  plugin_version: string;
  file_url: string;
  plugin_name: string;
  download_status: string;
};

export type PluginDownloadRequestInput = {
  email?: unknown;
  name?: unknown;
  store_url?: unknown;
  storeUrl?: unknown;
  company?: unknown;
  country?: unknown;
  plugin_slug?: unknown;
  pluginSlug?: unknown;
  version?: unknown;
  consent_product_updates?: unknown;
  consentProductUpdates?: unknown;
  consent_marketing?: unknown;
  consentMarketing?: unknown;
  consent_feedback?: unknown;
  consentFeedback?: unknown;
  source_page?: unknown;
  sourcePage?: unknown;
  referrer?: unknown;
  utm_source?: unknown;
  utmSource?: unknown;
  utm_medium?: unknown;
  utmMedium?: unknown;
  utm_campaign?: unknown;
  utmCampaign?: unknown;
  utm_content?: unknown;
  utmContent?: unknown;
  utm_term?: unknown;
  utmTerm?: unknown;
};

export type PluginFeedbackInput = {
  email?: unknown;
  token?: unknown;
  plugin_slug?: unknown;
  pluginSlug?: unknown;
  plugin_version?: unknown;
  pluginVersion?: unknown;
  rating?: unknown;
  feedback_type?: unknown;
  feedbackType?: unknown;
  message?: unknown;
  permission_to_use_testimonial?: unknown;
  permissionToUseTestimonial?: unknown;
  public_display_name?: unknown;
  publicDisplayName?: unknown;
};

const cleanString = (value: unknown, maxLength = 255): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
};

const cleanBool = (value: unknown, defaultValue: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true;
    if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false;
  }
  return defaultValue;
};

const normalizeEmail = (email: unknown): string => {
  const normalized = cleanString(email, 320)?.toLowerCase() ?? "";
  if (!emailPattern.test(normalized)) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  return normalized;
};

const normalizePluginSlug = (slug: unknown): string => {
  const cleaned = cleanString(slug, 120)?.toLowerCase() ?? "";
  const normalized = pluginAliases[cleaned];
  if (!normalized) {
    throw new HttpError(400, "Unknown plugin selected.");
  }
  return normalized;
};

const hashValue = (value?: string): string | null =>
  value ? createHash("sha256").update(`${env.apiTokenSalt || "optivra"}:${value}`).digest("hex") : null;

const publicRelease = (release: PluginReleaseRow) => ({
  plugin_slug: release.plugin_slug,
  plugin_name: release.plugin_name,
  version: release.version,
  file_size_bytes: Number(release.file_size_bytes ?? 0),
  release_notes: release.release_notes,
  minimum_wp_version: release.minimum_wp_version,
  minimum_wc_version: release.minimum_wc_version,
  requires_php_version: release.requires_php_version
});

const absoluteAppUrl = (relativePath: string): string => {
  const base = (env.publicBaseUrl || env.appUrl || "https://www.optivra.app").replace(/\/+$/, "");
  return `${base}/${relativePath.replace(/^\/+/, "")}`;
};

const requireRelease = async (pluginSlug: string, version?: string | null): Promise<PluginReleaseRow> => {
  const rows = await prisma.$queryRawUnsafe<PluginReleaseRow[]>(
    `
      select *
      from public.plugin_releases
      where plugin_slug = $1
        and is_active = true
        and is_public = true
        and ($2::text is null or version = $2::text)
      order by created_at desc
      limit 1
    `,
    pluginSlug,
    version || null
  );

  if (!rows[0]) {
    throw new HttpError(404, "Plugin release not found.");
  }

  return rows[0];
};

const safeDownloadPath = (fileUrl: string): string => {
  const relativePath = fileUrl.startsWith("/downloads/")
    ? path.join("public", "site", fileUrl.replace(/^\//, ""))
    : fileUrl;
  const resolved = path.resolve(process.cwd(), relativePath);
  if (!resolved.startsWith(`${downloadRoot}${path.sep}`)) {
    throw new HttpError(500, "Plugin download file is outside the allowed directory.");
  }
  if (!existsSync(resolved)) {
    throw new HttpError(404, "Plugin download file is not available.");
  }
  return resolved;
};

const recordEmailEvent = async (
  lead: Pick<LeadRow, "id" | "email_normalized" | "plugin_slug">,
  emailType: "download_link" | "setup_help" | "feedback_request" | "rating_request" | "update_notice" | "marketing",
  status: "queued" | "sent" | "failed" | "skipped",
  summary?: string,
  provider?: "smtp" | "resend" | "postmark" | "brevo" | null,
  providerMessageId?: string
) => {
  await prisma.$executeRawUnsafe(
    `
      insert into public.plugin_email_events
        (lead_id, plugin_slug, email_normalized, email_type, provider, provider_message_id, status, skip_reason, sent_at)
      values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, case when $7 = 'sent' then now() else null end)
    `,
    lead.id,
    lead.plugin_slug,
    lead.email_normalized,
    emailType,
    provider ?? null,
    providerMessageId ?? null,
    status,
    summary ?? null
  );
};

const recordDownloadEmailResult = async (lead: LeadRow, result: EmailSendResult): Promise<void> => {
  try {
    await recordEmailEvent(
      lead,
      "download_link",
      result.status,
      result.summary,
      result.provider,
      result.providerMessageId
    );
  } catch (error) {
    console.warn("Could not record plugin download email event.", {
      status: result.status,
      provider: result.provider,
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

export const listPublicPluginReleases = async (pluginSlugInput?: unknown) => {
  const pluginSlug = pluginSlugInput ? normalizePluginSlug(pluginSlugInput) : null;
  const rows = await prisma.$queryRawUnsafe<PluginReleaseRow[]>(
    `
      select distinct on (plugin_slug)
        id,
        plugin_slug,
        plugin_name,
        version,
        file_url,
        file_size_bytes,
        checksum_sha256,
        release_notes,
        minimum_wp_version,
        minimum_wc_version,
        requires_php_version
      from public.plugin_releases
      where is_active = true
        and is_public = true
        and ($1::text is null or plugin_slug = $1::text)
      order by plugin_slug, created_at desc
    `,
    pluginSlug
  );

  return rows.map(publicRelease);
};

export const createPluginDownloadLeadRequest = async (
  input: PluginDownloadRequestInput,
  requestMeta: { ip?: string; userAgent?: string }
) => {
  const email = normalizeEmail(input.email);
  const pluginSlug = normalizePluginSlug(input.plugin_slug ?? input.pluginSlug);
  const version = cleanString(input.version, 80);
  const release = await requireRelease(pluginSlug, version);
  const consentProductUpdates = cleanBool(input.consent_product_updates ?? input.consentProductUpdates, true);
  const consentMarketing = cleanBool(input.consent_marketing ?? input.consentMarketing, false);
  const consentFeedback = cleanBool(input.consent_feedback ?? input.consentFeedback, true);
  const consentedAt = consentProductUpdates || consentMarketing || consentFeedback ? new Date() : null;
  const ipHash = hashValue(requestMeta.ip);
  const userAgent = cleanString(requestMeta.userAgent, 500);
  const sourcePage = cleanString(input.source_page ?? input.sourcePage, 500);
  const referrer = cleanString(input.referrer, 500);
  const utmSource = cleanString(input.utm_source ?? input.utmSource, 120);
  const utmMedium = cleanString(input.utm_medium ?? input.utmMedium, 120);
  const utmCampaign = cleanString(input.utm_campaign ?? input.utmCampaign, 160);
  const utmContent = cleanString(input.utm_content ?? input.utmContent, 160);
  const utmTerm = cleanString(input.utm_term ?? input.utmTerm, 160);

  const leads = await prisma.$queryRawUnsafe<LeadRow[]>(
    `
      insert into public.plugin_download_leads (
        email,
        email_normalized,
        name,
        store_url,
        company,
        country,
        plugin_slug,
        first_downloaded_version,
        latest_downloaded_version,
        first_downloaded_at,
        last_downloaded_at,
        download_count,
        consent_product_updates,
        consent_marketing,
        consent_feedback,
        consent_source,
        consented_at,
        lifecycle_status,
        metadata
      )
      values (
        $1, $1, $2, $3, $4, $5, $6, $7, $7, now(), now(), 1,
        $8, $9, $10, $11, $12::timestamptz, 'downloaded', '{}'::jsonb
      )
      on conflict (email_normalized, plugin_slug) do update set
        email = excluded.email,
        name = coalesce(excluded.name, public.plugin_download_leads.name),
        store_url = coalesce(excluded.store_url, public.plugin_download_leads.store_url),
        company = coalesce(excluded.company, public.plugin_download_leads.company),
        country = coalesce(excluded.country, public.plugin_download_leads.country),
        latest_downloaded_version = excluded.latest_downloaded_version,
        last_downloaded_at = now(),
        download_count = public.plugin_download_leads.download_count + 1,
        consent_product_updates = excluded.consent_product_updates,
        consent_marketing = excluded.consent_marketing,
        consent_feedback = excluded.consent_feedback,
        consent_source = excluded.consent_source,
        consented_at = coalesce(excluded.consented_at, public.plugin_download_leads.consented_at),
        lifecycle_status = case
          when public.plugin_download_leads.lifecycle_status = 'unsubscribed' then 'unsubscribed'
          else public.plugin_download_leads.lifecycle_status
        end,
        updated_at = now()
      returning id, email_normalized, plugin_slug, unsubscribe_token, consent_product_updates, consent_marketing, consent_feedback, unsubscribed_at
    `,
    email,
    cleanString(input.name, 120),
    cleanString(input.store_url ?? input.storeUrl, 500),
    cleanString(input.company, 160),
    cleanString(input.country, 80),
    pluginSlug,
    release.version,
    consentProductUpdates,
    consentMarketing,
    consentFeedback,
    sourcePage || "download_modal",
    consentedAt
  );
  const lead = leads[0];
  if (!lead) {
    throw new HttpError(500, "Could not create plugin download lead.");
  }

  const eventRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      insert into public.plugin_download_events (
        lead_id,
        plugin_release_id,
        plugin_slug,
        plugin_version,
        email_normalized,
        source_page,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        ip_hash,
        user_agent,
        download_status
      )
      values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'started')
      returning id
    `,
    lead.id,
    release.id,
    pluginSlug,
    release.version,
    email,
    sourcePage,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    ipHash,
    userAgent
  );
  const eventId = eventRows[0]?.id;
  if (!eventId) {
    throw new HttpError(500, "Could not create plugin download event.");
  }

  const downloadUrl = `/api/plugins/download/${eventId}`;
  const setupGuideUrl = pluginSlug === "optivra-image-studio"
    ? "/docs/optivra-image-studio#installing"
    : "/docs/payment-gateway-rules-for-woocommerce#installation";
  const emailResult = await sendPluginDownloadEmail({
    toEmail: email,
    pluginName: release.plugin_name,
    version: release.version,
    downloadUrl: absoluteAppUrl(downloadUrl)
  });
  await recordDownloadEmailResult(lead, emailResult);

  const params = {
    plugin_slug: pluginSlug,
    plugin_version: release.version,
    download_type: "zip",
    gated: true,
    result: "started",
    funnel_stage: "conversion"
  };
  await Promise.allSettled([
    trackSiteAnalyticsEvent({ eventName: "plugin_download_started", eventSource: "server", params }),
    sendGa4ServerEvent({ eventName: "plugin_download_started", params })
  ]);

  return {
    ok: true,
    event_id: eventId,
    plugin_slug: pluginSlug,
    plugin_name: release.plugin_name,
    version: release.version,
    download_url: downloadUrl,
    setup_guide_url: setupGuideUrl,
    email_status: emailResult.status,
    email_queued: emailResult.status === "sent"
  };
};

export const completePluginDownloadEvent = async (eventIdInput: unknown) => {
  const eventId = cleanString(eventIdInput, 80);
  if (!eventId) throw new HttpError(400, "Download event is required.");

  const rows = await prisma.$queryRawUnsafe<DownloadEventRow[]>(
    `
      update public.plugin_download_events
      set download_status = 'completed'
      where id = $1::uuid
      returning id, lead_id, plugin_release_id, plugin_slug, plugin_version, '' as file_url, '' as plugin_name, download_status
    `,
    eventId
  );
  if (!rows[0]) throw new HttpError(404, "Download event not found.");

  const params = {
    plugin_slug: rows[0].plugin_slug,
    plugin_version: rows[0].plugin_version,
    download_type: "zip",
    gated: true,
    result: "success",
    funnel_stage: "conversion"
  };
  await Promise.allSettled([
    trackSiteAnalyticsEvent({ eventName: "server_plugin_download_completed", eventSource: "server", params }),
    sendGa4ServerEvent({ eventName: "server_plugin_download_completed", params })
  ]);

  return { ok: true, event_id: rows[0].id, status: "completed" };
};

export const streamPluginLeadDownload = async (eventIdInput: unknown, response: Response): Promise<void> => {
  const eventId = cleanString(eventIdInput, 80);
  if (!eventId) throw new HttpError(404, "Download link not found.");

  const rows = await prisma.$queryRawUnsafe<DownloadEventRow[]>(
    `
      select
        e.id,
        e.lead_id,
        e.plugin_release_id,
        e.plugin_slug,
        e.plugin_version,
        e.download_status,
        r.file_url,
        r.plugin_name
      from public.plugin_download_events e
      join public.plugin_releases r on r.id = e.plugin_release_id
      where e.id = $1::uuid
        and r.is_active = true
        and r.is_public = true
      limit 1
    `,
    eventId
  );
  const event = rows[0];
  if (!event) throw new HttpError(404, "Download link not found.");

  const filePath = safeDownloadPath(event.file_url);
  const fileStats = statSync(filePath);
  const fileName = path.basename(filePath);

  response.setHeader("Content-Type", "application/zip");
  response.setHeader("Content-Length", fileStats.size);
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.setHeader("X-Content-Type-Options", "nosniff");

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    prisma.$executeRawUnsafe(
      `update public.plugin_download_events set download_status = 'failed' where id = $1::uuid`,
      event.id
    ).catch(() => undefined);
    response.end();
  });
  response.on("finish", () => {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      completePluginDownloadEvent(event.id).catch(() => undefined);
    }
  });
  stream.pipe(response);
};

export const createPluginFeedback = async (input: PluginFeedbackInput) => {
  const token = cleanString(input.token, 120);
  const email = token ? null : normalizeEmail(input.email);
  const pluginSlugInput = input.plugin_slug ?? input.pluginSlug;
  let pluginSlug = pluginSlugInput ? normalizePluginSlug(pluginSlugInput) : "";
  const pluginVersion = cleanString(input.plugin_version ?? input.pluginVersion, 80);
  const ratingValue = input.rating === undefined || input.rating === null || input.rating === ""
    ? null
    : Number(input.rating);
  if (ratingValue !== null && (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5)) {
    throw new HttpError(400, "Rating must be between 1 and 5.");
  }
  const feedbackType = cleanString(input.feedback_type ?? input.feedbackType, 80) ?? "general";
  const allowedTypes = new Set(["general", "install_issue", "feature_request", "bug", "rating", "testimonial"]);
  if (!allowedTypes.has(feedbackType)) {
    throw new HttpError(400, "Feedback type is not supported.");
  }

  let lead: LeadRow | null = null;
  if (token) {
    const rows = await prisma.$queryRawUnsafe<LeadRow[]>(
      `select id, email_normalized, plugin_slug, unsubscribe_token, consent_product_updates, consent_marketing, consent_feedback, unsubscribed_at from public.plugin_download_leads where unsubscribe_token = $1 limit 1`,
      token
    );
    lead = rows[0] ?? null;
    pluginSlug = lead?.plugin_slug ?? pluginSlug;
  } else if (email) {
    if (!pluginSlug) throw new HttpError(400, "Plugin is required.");
    const rows = await prisma.$queryRawUnsafe<LeadRow[]>(
      `select id, email_normalized, plugin_slug, unsubscribe_token, consent_product_updates, consent_marketing, consent_feedback, unsubscribed_at from public.plugin_download_leads where email_normalized = $1 and plugin_slug = $2 limit 1`,
      email,
      pluginSlug
    );
    lead = rows[0] ?? null;
  }

  const emailNormalized = lead?.email_normalized ?? email;
  if (!emailNormalized) throw new HttpError(400, "Email or feedback token is required.");
  if (!pluginSlug) throw new HttpError(400, "Plugin is required.");

  await prisma.$executeRawUnsafe(
    `
      insert into public.plugin_feedback (
        lead_id,
        plugin_slug,
        plugin_version,
        email_normalized,
        rating,
        feedback_type,
        message,
        permission_to_use_testimonial,
        public_display_name,
        status
      )
      values ($1::uuid, $2, $3, $4, $5::integer, $6, $7, $8, $9, 'new')
    `,
    lead?.id ?? null,
    pluginSlug,
    pluginVersion,
    emailNormalized,
    ratingValue,
    feedbackType,
    cleanString(input.message, maxText),
    cleanBool(input.permission_to_use_testimonial ?? input.permissionToUseTestimonial, false),
    cleanString(input.public_display_name ?? input.publicDisplayName, 120)
  );

  trackSiteAnalyticsEvent({
    eventName: "plugin_feedback_submit",
    eventSource: "server",
    params: {
      plugin_slug: pluginSlug,
      plugin_version: pluginVersion,
      rating: ratingValue,
      feedback_type: feedbackType,
      funnel_stage: "retention"
    }
  }).catch(() => undefined);

  return {
    ok: true,
    show_public_review_cta: ratingValue !== null && ratingValue >= 4,
    public_review_url: ratingValue !== null && ratingValue >= 4
      ? pluginSlug === "optivra-gateway-rules"
        ? "https://wordpress.org/support/plugin/payment-gateway-rules-for-woocommerce/reviews/#new-post"
        : "https://wordpress.org/support/plugin/optivra-image-studio-for-woocommerce/reviews/#new-post"
      : null,
    message: ratingValue !== null && ratingValue <= 3
      ? "Thanks. Your feedback is private and helps us improve support and setup."
      : "Thanks for helping improve Optivra."
  };
};

export const getUnsubscribeLead = async (tokenInput: unknown) => {
  const token = cleanString(tokenInput, 120);
  if (!token) throw new HttpError(400, "Unsubscribe token is required.");
  const rows = await prisma.$queryRawUnsafe<LeadRow[]>(
    `
      select id, email_normalized, plugin_slug, unsubscribe_token, consent_product_updates, consent_marketing, consent_feedback, unsubscribed_at
      from public.plugin_download_leads
      where unsubscribe_token = $1
      limit 1
    `,
    token
  );
  const lead = rows[0];
  if (!lead) throw new HttpError(404, "Unsubscribe link not found.");
  return {
    ok: true,
    email: lead.email_normalized.replace(/^(.).+(@.+)$/, "$1***$2"),
    plugin_slug: lead.plugin_slug,
    consent_marketing: lead.consent_marketing,
    consent_feedback: lead.consent_feedback,
    unsubscribed: Boolean(lead.unsubscribed_at)
  };
};

export const unsubscribePluginLead = async (input: { token?: unknown; scope?: unknown; reason?: unknown }) => {
  const token = cleanString(input.token, 120);
  if (!token) throw new HttpError(400, "Unsubscribe token is required.");
  const scope = cleanString(input.scope, 80) ?? "all_marketing";
  if (!["all_marketing", "plugin_marketing", "feedback_requests"].includes(scope)) {
    throw new HttpError(400, "Unsubscribe scope is not supported.");
  }
  const rows = await prisma.$queryRawUnsafe<LeadRow[]>(
    `
      update public.plugin_download_leads
      set
        consent_marketing = case when $2 in ('all_marketing', 'plugin_marketing') then false else consent_marketing end,
        consent_feedback = case when $2 in ('all_marketing', 'feedback_requests') then false else consent_feedback end,
        unsubscribed_at = case when $2 = 'all_marketing' then now() else unsubscribed_at end,
        lifecycle_status = case when $2 = 'all_marketing' then 'unsubscribed' else lifecycle_status end,
        updated_at = now()
      where unsubscribe_token = $1
      returning id, email_normalized, plugin_slug, unsubscribe_token, consent_product_updates, consent_marketing, consent_feedback, unsubscribed_at
    `,
    token,
    scope
  );
  const lead = rows[0];
  if (!lead) throw new HttpError(404, "Unsubscribe link not found.");
  await prisma.$executeRawUnsafe(
    `
      insert into public.plugin_unsubscribes (lead_id, email_normalized, plugin_slug, unsubscribe_scope, reason)
      values ($1::uuid, $2, $3, $4, $5)
    `,
    lead.id,
    lead.email_normalized,
    lead.plugin_slug,
    scope,
    cleanString(input.reason, 500)
  );
  return { ok: true, message: "Your email preferences have been updated." };
};

export const getPluginDownloadWorkflowSummary = async () => {
  const [totals, byPlugin, byVersion, byUtm, feedback] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ downloads: bigint; completed: bigint; unique_downloaders: bigint }>>(
      `
        select
          count(*)::bigint as downloads,
          count(*) filter (where download_status = 'completed')::bigint as completed,
          count(distinct email_normalized)::bigint as unique_downloaders
        from public.plugin_download_events
      `
    ),
    prisma.$queryRawUnsafe<Array<{ plugin_slug: string; count: bigint }>>(
      `select plugin_slug, count(*)::bigint as count from public.plugin_download_events group by plugin_slug order by count desc`
    ),
    prisma.$queryRawUnsafe<Array<{ plugin_slug: string; plugin_version: string; count: bigint }>>(
      `select plugin_slug, plugin_version, count(*)::bigint as count from public.plugin_download_events group by plugin_slug, plugin_version order by count desc`
    ),
    prisma.$queryRawUnsafe<Array<{ source: string | null; campaign: string | null; count: bigint }>>(
      `select utm_source as source, utm_campaign as campaign, count(*)::bigint as count from public.plugin_download_events group by utm_source, utm_campaign order by count desc limit 20`
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint; average_rating: number | null }>>(
      `select count(*)::bigint as count, avg(rating)::numeric(5,2) as average_rating from public.plugin_feedback`
    )
  ]);

  return {
    totals: {
      downloads: Number(totals[0]?.downloads ?? 0),
      completed: Number(totals[0]?.completed ?? 0),
      unique_downloaders: Number(totals[0]?.unique_downloaders ?? 0),
      feedback_count: Number(feedback[0]?.count ?? 0),
      average_rating: Number(feedback[0]?.average_rating ?? 0)
    },
    downloads_by_plugin: byPlugin.map((row) => ({ plugin_slug: row.plugin_slug, count: Number(row.count) })),
    downloads_by_version: byVersion.map((row) => ({ plugin_slug: row.plugin_slug, plugin_version: row.plugin_version, count: Number(row.count) })),
    downloads_by_utm: byUtm.map((row) => ({ source: row.source ?? "direct", campaign: row.campaign ?? "", count: Number(row.count) }))
  };
};

export const getPluginDownloadWorkflowEvents = async () =>
  prisma.$queryRawUnsafe(
    `
      select
        e.id,
        e.plugin_slug,
        e.plugin_version,
        e.email_normalized,
        e.source_page,
        e.utm_source,
        e.utm_campaign,
        e.download_status,
        e.created_at,
        l.download_count,
        l.lifecycle_status,
        l.consent_product_updates,
        l.consent_marketing,
        l.consent_feedback
      from public.plugin_download_events e
      left join public.plugin_download_leads l on l.id = e.lead_id
      order by e.created_at desc
      limit 250
    `
  );

export const getPluginFeedbackAdmin = async () =>
  prisma.$queryRawUnsafe(
    `
      select
        f.id,
        f.plugin_slug,
        f.plugin_version,
        f.email_normalized,
        f.rating,
        f.feedback_type,
        f.message,
        f.permission_to_use_testimonial,
        f.public_display_name,
        f.status,
        f.created_at
      from public.plugin_feedback f
      order by f.created_at desc
      limit 250
    `
  );
