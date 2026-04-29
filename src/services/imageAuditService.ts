import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import type { ImageStudioAuthContext } from "../middleware/imageStudioAuth";
import type { ImageAuditActionType, ImageAuditItemInput, ImageAuditSeverity } from "../types/imageAudit";
import {
  calculateAuditMetrics,
  generateCategoryScores,
  generateInsights as generateAuditInsights,
  generateIssues as generateAuditIssues,
  generateRecommendations as generateAuditRecommendations,
  type AuditCategoryScore,
  type AuditIssue,
  type AuditMetrics,
  type AuditRecommendation,
  type AuditScoringItem
} from "./imageAuditScoringEngine";

type AuditScanRow = {
  id: string;
  store_id: string;
  user_id: string | null;
  source: string;
  status: string;
  products_scanned: number;
  images_scanned: number;
  main_images_scanned: number;
  gallery_images_scanned: number;
  variation_images_scanned: number;
  categories_scanned: number;
  products_without_main_image: number;
  products_with_single_image: number;
  scan_started_at: Date | null;
  scan_completed_at: Date | null;
  scan_duration_ms: number | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

type AuditItemRow = {
  id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  product_url: string | null;
  image_id: string | null;
  image_url: string;
  image_role: string;
  category_ids: string[] | null;
  category_names: string[] | null;
  filename: string | null;
  file_extension: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: bigint | number | null;
  alt_text: string | null;
  image_title: string | null;
  caption: string | null;
};

type ScoreBundle = {
  productImageHealthScore: number;
  seoScore: number;
  imageQualityScore: number;
  catalogueConsistencyScore: number;
  performanceScore: number;
  completenessScore: number;
  googleShoppingReadinessScore: number;
};

type IssueDraft = {
  itemId?: string;
  productId?: string;
  imageId?: string | null;
  issueType: string;
  severity: ImageAuditSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  actionType?: ImageAuditActionType;
  confidenceScore?: number;
  metadata?: Record<string, unknown>;
};

type InsightDraft = {
  insightType: string;
  severity: ImageAuditSeverity;
  title: string;
  body: string;
  metricKey?: string;
  metricValue?: number;
  suggestedAction?: string;
  actionType?: ImageAuditActionType;
  actionFilter?: Record<string, unknown>;
  displayOrder: number;
};

type RecommendationDraft = {
  title: string;
  description: string;
  priority: Exclude<ImageAuditSeverity, "info">;
  actionType: ImageAuditActionType;
  estimatedImagesAffected: number;
  estimatedMinutesSavedLow: number;
  estimatedMinutesSavedHigh: number;
  actionFilter?: Record<string, unknown>;
  displayOrder: number;
};

const toScoringItem = (item: AuditItemRow): AuditScoringItem => ({
  id: item.id,
  product_id: item.product_id,
  product_name: item.product_name,
  product_sku: item.product_sku,
  product_url: item.product_url,
  image_id: item.image_id,
  image_url: item.image_url,
  image_role: item.image_role,
  category_ids: item.category_ids ?? [],
  category_names: item.category_names ?? [],
  filename: item.filename,
  file_extension: item.file_extension,
  mime_type: item.mime_type,
  width: item.width,
  height: item.height,
  file_size_bytes: item.file_size_bytes,
  alt_text: item.alt_text,
  image_title: item.image_title,
  caption: item.caption
});

const toScoreBundle = (metrics: AuditMetrics): ScoreBundle => ({
  productImageHealthScore: metrics.product_image_health_score,
  seoScore: metrics.seo_score,
  imageQualityScore: metrics.image_quality_score,
  catalogueConsistencyScore: metrics.catalogue_consistency_score,
  performanceScore: metrics.performance_score,
  completenessScore: metrics.completeness_score,
  googleShoppingReadinessScore: metrics.google_shopping_readiness_score
});

const toIssueDraft = (issue: AuditIssue): IssueDraft => ({
  itemId: issue.item_id,
  productId: issue.product_id,
  imageId: issue.image_id,
  issueType: issue.issue_type,
  severity: issue.severity,
  title: issue.title,
  description: issue.description,
  recommendedAction: issue.recommended_action,
  actionType: issue.action_type,
  confidenceScore: issue.confidence_score,
  metadata: issue.metadata
});

const toInsightDraft = (
  insight: ReturnType<typeof generateAuditInsights>[number]
): InsightDraft => ({
  insightType: insight.insight_type,
  severity: insight.severity,
  title: insight.title,
  body: insight.body,
  metricKey: insight.metric_key,
  metricValue: insight.metric_value,
  suggestedAction: insight.suggested_action,
  actionType: insight.action_type,
  actionFilter: insight.action_filter,
  displayOrder: insight.display_order
});

const toRecommendationDraft = (recommendation: AuditRecommendation): RecommendationDraft => ({
  title: recommendation.title,
  description: recommendation.description,
  priority: recommendation.priority,
  actionType: recommendation.action_type,
  estimatedImagesAffected: recommendation.estimated_images_affected,
  estimatedMinutesSavedLow: recommendation.estimated_minutes_saved_low,
  estimatedMinutesSavedHigh: recommendation.estimated_minutes_saved_high,
  actionFilter: recommendation.action_filter,
  displayOrder: recommendation.display_order
});

const maxStringLengths: Record<string, number> = {
  product_id: 128,
  product_name: 300,
  product_sku: 120,
  product_url: 1000,
  image_id: 128,
  image_url: 1600,
  image_role: 40,
  filename: 255,
  file_extension: 32,
  mime_type: 120,
  alt_text: 500,
  image_title: 300,
  caption: 1000
};

const allowedImageRoles = new Set(["unknown", "main", "gallery", "variation", "category", "thumbnail"]);
const genericAltWords = new Set(["image", "photo", "product", "picture", "img", "thumbnail"]);

export class ImageAuditError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

const trimText = (value: unknown, field: string, required = false): string | undefined => {
  if (typeof value !== "string") {
    if (required) {
      throw new ImageAuditError(`${field} is required`, 400);
    }
    return undefined;
  }

  const trimmed = value.trim().replace(/\u0000/g, "");
  if (!trimmed) {
    if (required) {
      throw new ImageAuditError(`${field} is required`, 400);
    }
    return undefined;
  }

  return trimmed.slice(0, maxStringLengths[field] ?? 500);
};

const toSafeInteger = (value: unknown, max = 2_147_483_647): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const integer = Math.trunc(value);
  if (integer < 0) {
    return undefined;
  }

  return Math.min(integer, max);
};

const toTextArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/\u0000/g, "").slice(0, 160))
    .filter(Boolean)
    .slice(0, 30);
};

const sqlTextArray = (values: string[]): Prisma.Sql => {
  if (values.length === 0) {
    return Prisma.sql`ARRAY[]::TEXT[]`;
  }

  return Prisma.sql`ARRAY[${Prisma.join(values)}]::TEXT[]`;
};

const jsonValue = (value: Record<string, unknown> | undefined): Prisma.InputJsonValue => (
  (value ?? {}) as Prisma.InputJsonObject
);

const clampScore = (score: number): number => Math.max(0, Math.min(100, Number(score.toFixed(2))));

const percentScore = (good: number, total: number): number => total > 0 ? clampScore((good / total) * 100) : 0;

const normalizeExtension = (item: AuditItemRow): string => {
  const explicit = item.file_extension?.toLowerCase().replace(/^\./, "");
  if (explicit) {
    return explicit;
  }

  const filename = item.filename ?? item.image_url;
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
  return match?.[1] ?? "";
};

const normalizeFilename = (item: AuditItemRow): string => {
  if (item.filename?.trim()) {
    return item.filename.trim();
  }

  try {
    const url = new URL(item.image_url);
    return decodeURIComponent(url.pathname.split("/").pop() ?? "");
  } catch {
    return item.image_url.split("/").pop() ?? "";
  }
};

const isGenericFilename = (item: AuditItemRow): boolean => {
  const filename = normalizeFilename(item).toLowerCase().replace(/\.[a-z0-9]+$/, "");
  return /^(image|img|photo|picture|product|woocommerce-placeholder|dsc|screenshot)[-_ ]?\d*$/i.test(filename);
};

const isWeakAltText = (altText: string | null, productName: string | null): boolean => {
  const alt = altText?.trim().toLowerCase() ?? "";
  if (!alt) {
    return false;
  }

  if (alt.length < 8 || genericAltWords.has(alt)) {
    return true;
  }

  const productTokens = (productName ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);

  return productTokens.length > 0 && !productTokens.some((token) => alt.includes(token));
};

const fileSizeNumber = (value: bigint | number | null): number => {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return typeof value === "number" ? value : 0;
};

const isLowResolution = (item: AuditItemRow): boolean => {
  if (!item.width || !item.height) {
    return false;
  }

  return item.width < 800 || item.height < 800;
};

const isHugeDimension = (item: AuditItemRow): boolean => {
  if (!item.width || !item.height) {
    return false;
  }

  return item.width > 3000 || item.height > 3000;
};

const aspectRatio = (item: AuditItemRow): number | null => {
  if (!item.width || !item.height || item.height <= 0) {
    return null;
  }

  return Number((item.width / item.height).toFixed(4));
};

const ratioBucket = (ratio: number | null): string => {
  if (!ratio) {
    return "unknown";
  }
  if (ratio > 1.2) {
    return "landscape";
  }
  if (ratio < 0.82) {
    return "portrait";
  }
  return "square";
};

const getDominant = (values: string[]): string | null => {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const serializeRecord = (row: Record<string, unknown> | null): Record<string, unknown> | null => {
  if (!row) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "bigint" ? Number(value) : value instanceof Date ? value.toISOString() : value
    ])
  );
};

const requireUuid = (value: string): string => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ImageAuditError("Invalid scan_id", 400);
  }

  return value;
};

export const sanitizeAuditItemInput = (item: unknown): ImageAuditItemInput => {
  if (typeof item !== "object" || item === null) {
    throw new ImageAuditError("Each item must be an object", 400);
  }

  const input = item as Record<string, unknown>;
  const imageRole = trimText(input.image_role, "image_role") ?? "unknown";

  return {
    product_id: trimText(input.product_id, "product_id", true) ?? "",
    product_name: trimText(input.product_name, "product_name"),
    product_sku: trimText(input.product_sku, "product_sku"),
    product_url: trimText(input.product_url, "product_url"),
    image_id: trimText(input.image_id, "image_id"),
    image_url: trimText(input.image_url, "image_url", true) ?? "",
    image_role: allowedImageRoles.has(imageRole) ? imageRole : "unknown",
    category_ids: toTextArray(input.category_ids),
    category_names: toTextArray(input.category_names),
    filename: trimText(input.filename, "filename"),
    file_extension: trimText(input.file_extension, "file_extension")?.replace(/^\./, "").toLowerCase(),
    mime_type: trimText(input.mime_type, "mime_type")?.toLowerCase(),
    width: toSafeInteger(input.width),
    height: toSafeInteger(input.height),
    file_size_bytes: toSafeInteger(input.file_size_bytes, Number.MAX_SAFE_INTEGER),
    alt_text: trimText(input.alt_text, "alt_text"),
    image_title: trimText(input.image_title, "image_title"),
    caption: trimText(input.caption, "caption")
  };
};

export const assertStoreAccess = async (
  auth: ImageStudioAuthContext,
  storeId: string
): Promise<void> => {
  if (auth.authType === "site_token") {
    if (auth.siteId !== storeId) {
      throw new ImageAuditError("Store access denied", 403);
    }
    return;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "connected_sites"
    WHERE "id" = ${storeId}
      AND "user_id" = ${auth.userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new ImageAuditError("Store access denied", 403);
  }
};

export const getAuthorizedScan = async (
  auth: ImageStudioAuthContext,
  scanId: string
): Promise<AuditScanRow> => {
  const id = requireUuid(scanId);
  const rows = await prisma.$queryRaw<AuditScanRow[]>`
    SELECT *
    FROM "image_audit_scans"
    WHERE "id" = ${id}::uuid
    LIMIT 1
  `;
  const scan = rows[0];

  if (!scan) {
    throw new ImageAuditError("Audit scan not found", 404);
  }

  await assertStoreAccess(auth, scan.store_id);
  return scan;
};

export const startAuditScan = async (
  auth: ImageStudioAuthContext,
  input: { storeId: string; source?: string; scanOptions?: unknown }
): Promise<{ scan_id: string; status: string }> => {
  await assertStoreAccess(auth, input.storeId);

  const source = trimText(input.source, "source") ?? "woocommerce";
  const rows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    INSERT INTO "image_audit_scans" (
      "store_id",
      "user_id",
      "source",
      "status",
      "scan_started_at",
      "created_at",
      "updated_at"
    )
    VALUES (
      ${input.storeId},
      ${auth.userId},
      ${source.slice(0, 80)},
      'running',
      now(),
      now(),
      now()
    )
    RETURNING "id"::text, "status"
  `;

  return {
    scan_id: rows[0].id,
    status: rows[0].status
  };
};

const findExistingItemId = async (scanId: string, storeId: string, item: ImageAuditItemInput): Promise<string | null> => {
  const rows = item.image_id
    ? await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"::text
      FROM "image_audit_items"
      WHERE "scan_id" = ${scanId}::uuid
        AND "store_id" = ${storeId}
        AND "product_id" = ${item.product_id}
        AND "image_id" = ${item.image_id}
      LIMIT 1
    `
    : await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"::text
      FROM "image_audit_items"
      WHERE "scan_id" = ${scanId}::uuid
        AND "store_id" = ${storeId}
        AND "product_id" = ${item.product_id}
        AND "image_url" = ${item.image_url}
        AND "image_role" = ${item.image_role ?? "unknown"}
      LIMIT 1
    `;

  return rows[0]?.id ?? null;
};

export const addAuditItems = async (
  auth: ImageStudioAuthContext,
  scanId: string,
  rawItems: unknown
): Promise<{ inserted_count: number; total_count: number }> => {
  const scan = await getAuthorizedScan(auth, scanId);

  if (scan.status !== "running" && scan.status !== "pending") {
    throw new ImageAuditError("Audit scan is not accepting items", 409);
  }

  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) {
    throw new ImageAuditError("items must contain 1 to 100 entries", 400);
  }

  const items = rawItems.map(sanitizeAuditItemInput);
  let inserted = 0;

  for (const item of items) {
    const existingId = await findExistingItemId(scan.id, scan.store_id, item);
    const categoryIds = sqlTextArray(item.category_ids ?? []);
    const categoryNames = sqlTextArray(item.category_names ?? []);

    if (existingId) {
      await prisma.$executeRaw`
        UPDATE "image_audit_items"
        SET
          "product_name" = ${item.product_name ?? null},
          "product_sku" = ${item.product_sku ?? null},
          "product_url" = ${item.product_url ?? null},
          "category_ids" = ${categoryIds},
          "category_names" = ${categoryNames},
          "filename" = ${item.filename ?? null},
          "file_extension" = ${item.file_extension ?? null},
          "mime_type" = ${item.mime_type ?? null},
          "width" = ${item.width ?? null},
          "height" = ${item.height ?? null},
          "file_size_bytes" = ${item.file_size_bytes ?? null},
          "alt_text" = ${item.alt_text ?? null},
          "image_title" = ${item.image_title ?? null},
          "caption" = ${item.caption ?? null},
          "updated_at" = now()
        WHERE "id" = ${existingId}::uuid
          AND "store_id" = ${scan.store_id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "image_audit_items" (
          "scan_id",
          "store_id",
          "product_id",
          "product_name",
          "product_sku",
          "product_url",
          "image_id",
          "image_url",
          "image_role",
          "category_ids",
          "category_names",
          "filename",
          "file_extension",
          "mime_type",
          "width",
          "height",
          "file_size_bytes",
          "alt_text",
          "image_title",
          "caption",
          "created_at",
          "updated_at"
        )
        VALUES (
          ${scan.id}::uuid,
          ${scan.store_id},
          ${item.product_id},
          ${item.product_name ?? null},
          ${item.product_sku ?? null},
          ${item.product_url ?? null},
          ${item.image_id ?? null},
          ${item.image_url},
          ${item.image_role ?? "unknown"},
          ${categoryIds},
          ${categoryNames},
          ${item.filename ?? null},
          ${item.file_extension ?? null},
          ${item.mime_type ?? null},
          ${item.width ?? null},
          ${item.height ?? null},
          ${item.file_size_bytes ?? null},
          ${item.alt_text ?? null},
          ${item.image_title ?? null},
          ${item.caption ?? null},
          now(),
          now()
        )
      `;
      inserted += 1;
    }
  }

  const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "image_audit_items"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
  `;

  return {
    inserted_count: inserted,
    total_count: Number(totalRows[0]?.count ?? 0)
  };
};

const buildItemIssues = (item: AuditItemRow): IssueDraft[] => {
  const issues: IssueDraft[] = [];
  const extension = normalizeExtension(item);
  const size = fileSizeNumber(item.file_size_bytes);

  if (!item.alt_text?.trim()) {
    issues.push({
      itemId: item.id,
      productId: item.product_id,
      imageId: item.image_id,
      issueType: "missing_alt_text",
      severity: "medium",
      title: "Missing alt text",
      description: "This product image does not have alt text, which weakens accessibility and image SEO.",
      recommendedAction: "Add descriptive alt text that mentions the product name and useful buyer-facing attributes.",
      actionType: "fix_alt_text",
      confidenceScore: 98
    });
  } else if (isWeakAltText(item.alt_text, item.product_name)) {
    issues.push({
      itemId: item.id,
      productId: item.product_id,
      imageId: item.image_id,
      issueType: "weak_alt_text",
      severity: "low",
      title: "Weak alt text",
      description: "This image has alt text, but it appears generic or does not clearly describe the product.",
      recommendedAction: "Rewrite the alt text so it is specific to the product and useful for shoppers.",
      actionType: "fix_alt_text",
      confidenceScore: 82
    });
  }

  if (!item.image_title?.trim()) {
    issues.push({
      itemId: item.id,
      productId: item.product_id,
      imageId: item.image_id,
      issueType: "missing_image_title",
      severity: "low",
      title: "Missing image title",
      description: "This image is missing a useful media title.",
      recommendedAction: "Add a clear image title aligned with the product name.",
      actionType: "seo_update",
      confidenceScore: 92
    });
  }

  if (isGenericFilename(item)) {
    issues.push({
      itemId: item.id,
      productId: item.product_id,
      imageId: item.image_id,
      issueType: "generic_filename",
      severity: "low",
      title: "Generic image filename",
      description: "The image filename appears generic, which makes catalogue management and image SEO weaker.",
      recommendedAction: "Use a descriptive, product-specific image filename for future uploads.",
      actionType: "seo_update",
      confidenceScore: 78
    });
  }

  if (isLowResolution(item)) {
    issues.push({
      itemId: item.id,
      productId: item.product_id,
      imageId: item.image_id,
      issueType: "low_resolution",
      severity: item.image_role === "main" ? "high" : "medium",
      title: "Low resolution image",
      description: "The image dimensions may be too small for a crisp ecommerce product image.",
      recommendedAction: "Replace the image with a higher-resolution source where possible.",
      actionType: "replace_main_image",
      confidenceScore: 88,
      metadata: {
        width: item.width,
        height: item.height
      }
    });
  }

  if (size > 1_500_000 || isHugeDimension(item)) {
    issues.push({
      itemId: item.id,
      productId: item.product_id,
      imageId: item.image_id,
      issueType: "oversized_image",
      severity: size > 3_000_000 || isHugeDimension(item) ? "medium" : "low",
      title: "Oversized image",
      description: "This image is likely heavier than needed for product browsing performance.",
      recommendedAction: "Optimise or convert the image to a modern format before serving it to shoppers.",
      actionType: "compress_image",
      confidenceScore: 86,
      metadata: {
        file_size_bytes: size,
        width: item.width,
        height: item.height
      }
    });
  }

  if (extension && !["webp", "avif"].includes(extension)) {
    issues.push({
      itemId: item.id,
      productId: item.product_id,
      imageId: item.image_id,
      issueType: "missing_webp",
      severity: "info",
      title: "Modern image format opportunity",
      description: "This image does not appear to use a modern web image format.",
      recommendedAction: "Consider serving an optimised WebP or AVIF variant for faster storefront performance.",
      actionType: "compress_image",
      confidenceScore: 74
    });
  }

  return issues;
};

const severityRank: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

const getHighestSeverity = (issues: IssueDraft[]): string | null => {
  return issues.sort((a, b) => severityRank[b.severity] - severityRank[a.severity])[0]?.severity ?? null;
};

const calculateScores = (items: AuditItemRow[], issues: IssueDraft[]): ScoreBundle => {
  const total = items.length;
  const issueTypeCount = (type: string): number => issues.filter((issue) => issue.issueType === type).length;
  const severityPenalty = issues.reduce((sum, issue) => sum + (severityRank[issue.severity] ?? 1), 0);
  const missingAlt = issueTypeCount("missing_alt_text");
  const weakAlt = issueTypeCount("weak_alt_text");
  const missingTitle = issueTypeCount("missing_image_title");
  const genericFilename = issueTypeCount("generic_filename");
  const lowResolution = issueTypeCount("low_resolution");
  const oversized = issueTypeCount("oversized_image");
  const missingWebp = issueTypeCount("missing_webp");
  const aspectBuckets = items.map((item) => ratioBucket(aspectRatio(item)));
  const dominantAspect = getDominant(aspectBuckets);
  const consistentAspectCount = dominantAspect
    ? aspectBuckets.filter((bucket) => bucket === dominantAspect || bucket === "unknown").length
    : 0;
  const products = new Map<string, AuditItemRow[]>();

  for (const item of items) {
    products.set(item.product_id, [...(products.get(item.product_id) ?? []), item]);
  }

  const productsWithMain = [...products.values()].filter((productItems) => productItems.some((item) => item.image_role === "main")).length;
  const productsWithMultipleImages = [...products.values()].filter((productItems) => productItems.length > 1).length;

  const seoScore = clampScore(100 - ((missingAlt * 18 + weakAlt * 8 + missingTitle * 6 + genericFilename * 6) / Math.max(1, total)));
  const imageQualityScore = clampScore(100 - ((lowResolution * 20 + oversized * 5) / Math.max(1, total)));
  const performanceScore = clampScore(100 - ((oversized * 15 + missingWebp * 4) / Math.max(1, total)));
  const catalogueConsistencyScore = percentScore(consistentAspectCount, total);
  const completenessScore = clampScore(
    (percentScore(productsWithMain, Math.max(1, products.size)) * 0.7) +
    (percentScore(productsWithMultipleImages, Math.max(1, products.size)) * 0.3)
  );
  const googleShoppingReadinessScore = clampScore(
    100 - ((missingAlt * 14 + lowResolution * 18 + oversized * 6 + genericFilename * 4) / Math.max(1, total))
  );
  const productImageHealthScore = clampScore(
    (seoScore * 0.22) +
    (imageQualityScore * 0.22) +
    (catalogueConsistencyScore * 0.16) +
    (performanceScore * 0.16) +
    (completenessScore * 0.14) +
    (googleShoppingReadinessScore * 0.1) -
    Math.min(12, severityPenalty / Math.max(1, total))
  );

  return {
    productImageHealthScore,
    seoScore,
    imageQualityScore,
    catalogueConsistencyScore,
    performanceScore,
    completenessScore,
    googleShoppingReadinessScore
  };
};

const buildInsights = (items: AuditItemRow[], issues: IssueDraft[], scores: ScoreBundle): InsightDraft[] => {
  const total = items.length;
  const count = (type: string): number => issues.filter((issue) => issue.issueType === type).length;
  const insights: InsightDraft[] = [];
  let displayOrder = 1;

  if (scores.productImageHealthScore < 70) {
    insights.push({
      insightType: "overall_health",
      severity: scores.productImageHealthScore < 50 ? "high" : "medium",
      title: "Product image health needs attention",
      body: `The catalogue image health score is ${scores.productImageHealthScore}, so image quality, SEO, and consistency improvements are likely to lift product presentation.`,
      metricKey: "product_image_health_score",
      metricValue: scores.productImageHealthScore,
      suggestedAction: "Start with the highest-severity image issues and main product images.",
      actionType: "manual_review",
      displayOrder: displayOrder++
    });
  }

  if (count("missing_alt_text") > 0) {
    insights.push({
      insightType: "seo",
      severity: count("missing_alt_text") / total > 0.35 ? "high" : "medium",
      title: "Alt text gaps are limiting image SEO",
      body: `${count("missing_alt_text")} scanned images are missing alt text.`,
      metricKey: "missing_alt_text_count",
      metricValue: count("missing_alt_text"),
      suggestedAction: "Add product-specific alt text to main product and gallery images.",
      actionType: "fix_alt_text",
      actionFilter: { issue_type: "missing_alt_text" },
      displayOrder: displayOrder++
    });
  }

  if (count("low_resolution") > 0) {
    insights.push({
      insightType: "quality",
      severity: count("low_resolution") / total > 0.2 ? "high" : "medium",
      title: "Some product images may look soft or undersized",
      body: `${count("low_resolution")} images appear below recommended ecommerce dimensions.`,
      metricKey: "low_resolution_count",
      metricValue: count("low_resolution"),
      suggestedAction: "Prioritise higher-resolution replacements for main product images.",
      actionType: "replace_main_image",
      actionFilter: { issue_type: "low_resolution" },
      displayOrder: displayOrder++
    });
  }

  if (count("oversized_image") > 0) {
    insights.push({
      insightType: "performance",
      severity: "medium",
      title: "Image weight can be reduced",
      body: `${count("oversized_image")} images are likely larger than needed for product browsing.`,
      metricKey: "oversized_image_count",
      metricValue: count("oversized_image"),
      suggestedAction: "Optimise large originals and serve modern storefront variants.",
      actionType: "compress_image",
      actionFilter: { issue_type: "oversized_image" },
      displayOrder: displayOrder++
    });
  }

  if (insights.length === 0) {
    insights.push({
      insightType: "overall_health",
      severity: "info",
      title: "Product images are in good shape",
      body: "No major metadata, size, or consistency problems were detected in this scan.",
      metricKey: "product_image_health_score",
      metricValue: scores.productImageHealthScore,
      suggestedAction: "Review low-priority opportunities when updating products.",
      actionType: "manual_review",
      displayOrder
    });
  }

  return insights;
};

const buildRecommendations = (items: AuditItemRow[], issues: IssueDraft[]): RecommendationDraft[] => {
  const count = (type: string): number => issues.filter((issue) => issue.issueType === type).length;
  const recommendations: RecommendationDraft[] = [];
  let displayOrder = 1;

  if (count("missing_alt_text") + count("weak_alt_text") > 0) {
    const affected = count("missing_alt_text") + count("weak_alt_text");
    recommendations.push({
      title: "Improve product image alt text",
      description: "Fix missing and weak alt text so product images are more useful for accessibility and search.",
      priority: affected / Math.max(1, items.length) > 0.3 ? "high" : "medium",
      actionType: "fix_alt_text",
      estimatedImagesAffected: affected,
      estimatedMinutesSavedLow: affected * 2,
      estimatedMinutesSavedHigh: affected * 4,
      actionFilter: { issue_type: ["missing_alt_text", "weak_alt_text"] },
      displayOrder: displayOrder++
    });
  }

  if (count("low_resolution") > 0) {
    recommendations.push({
      title: "Review low-resolution product images",
      description: "Replace or regenerate images that may not look crisp enough for ecommerce product pages.",
      priority: "high",
      actionType: "replace_main_image",
      estimatedImagesAffected: count("low_resolution"),
      estimatedMinutesSavedLow: count("low_resolution") * 3,
      estimatedMinutesSavedHigh: count("low_resolution") * 8,
      actionFilter: { issue_type: "low_resolution" },
      displayOrder: displayOrder++
    });
  }

  if (count("oversized_image") + count("missing_webp") > 0) {
    const affected = new Set(
      issues
        .filter((issue) => issue.issueType === "oversized_image" || issue.issueType === "missing_webp")
        .map((issue) => issue.itemId)
    ).size;
    recommendations.push({
      title: "Optimise heavy catalogue images",
      description: "Reduce image weight and modernise formats to improve browsing speed.",
      priority: "medium",
      actionType: "compress_image",
      estimatedImagesAffected: affected,
      estimatedMinutesSavedLow: affected * 2,
      estimatedMinutesSavedHigh: affected * 5,
      actionFilter: { issue_type: ["oversized_image", "missing_webp"] },
      displayOrder: displayOrder++
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Maintain image quality standards",
      description: "Continue using descriptive metadata, clean product imagery, and appropriate image sizes for new uploads.",
      priority: "low",
      actionType: "manual_review",
      estimatedImagesAffected: 0,
      estimatedMinutesSavedLow: 0,
      estimatedMinutesSavedHigh: 0,
      displayOrder
    });
  }

  return recommendations;
};

const scoreAndPersistItems = async (scan: AuditScanRow, items: AuditItemRow[], issues: IssueDraft[]): Promise<void> => {
  for (const item of items) {
    const itemIssues = issues.filter((issue) => issue.itemId === item.id);
    const itemSeoScore = clampScore(100 - (
      itemIssues.filter((issue) => ["missing_alt_text", "weak_alt_text", "missing_image_title", "generic_filename"].includes(issue.issueType)).length * 22
    ));
    const itemQualityScore = clampScore(100 - (
      itemIssues.filter((issue) => ["low_resolution"].includes(issue.issueType)).length * 45
    ));
    const itemPerformanceScore = clampScore(100 - (
      itemIssues.filter((issue) => ["oversized_image", "missing_webp"].includes(issue.issueType)).length * 18
    ));
    const ratio = aspectRatio(item);

    await prisma.$executeRaw`
      UPDATE "image_audit_items"
      SET
        "aspect_ratio" = ${ratio},
        "quality_score" = ${itemQualityScore},
        "seo_score" = ${itemSeoScore},
        "consistency_score" = ${ratio ? 100 : null},
        "performance_score" = ${itemPerformanceScore},
        "google_readiness_score" = ${clampScore((itemSeoScore * 0.45) + (itemQualityScore * 0.35) + (itemPerformanceScore * 0.2))},
        "issue_count" = ${itemIssues.length},
        "highest_severity" = ${getHighestSeverity(itemIssues)},
        "recommended_action" = ${itemIssues[0]?.recommendedAction ?? null},
        "updated_at" = now()
      WHERE "id" = ${item.id}::uuid
        AND "scan_id" = ${scan.id}::uuid
        AND "store_id" = ${scan.store_id}
    `;
  }
};

const insertIssues = async (scan: AuditScanRow, issues: IssueDraft[]): Promise<void> => {
  for (const issue of issues) {
    await prisma.$executeRaw`
      INSERT INTO "image_audit_issues" (
        "scan_id",
        "store_id",
        "audit_item_id",
        "product_id",
        "image_id",
        "issue_type",
        "severity",
        "title",
        "description",
        "recommended_action",
        "action_type",
        "confidence_score",
        "metadata",
        "status",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${scan.id}::uuid,
        ${scan.store_id},
        ${issue.itemId ?? null}::uuid,
        ${issue.productId ?? null},
        ${issue.imageId ?? null},
        ${issue.issueType},
        ${issue.severity},
        ${issue.title},
        ${issue.description},
        ${issue.recommendedAction},
        ${issue.actionType ?? null},
        ${issue.confidenceScore ?? null},
        ${jsonValue(issue.metadata)}::jsonb,
        'open',
        now(),
        now()
      )
    `;
  }
};

const insertInsights = async (scan: AuditScanRow, insights: InsightDraft[]): Promise<void> => {
  for (const insight of insights) {
    await prisma.$executeRaw`
      INSERT INTO "image_audit_insights" (
        "scan_id",
        "store_id",
        "insight_type",
        "severity",
        "title",
        "body",
        "metric_key",
        "metric_value",
        "suggested_action",
        "action_type",
        "action_filter",
        "display_order",
        "created_at"
      )
      VALUES (
        ${scan.id}::uuid,
        ${scan.store_id},
        ${insight.insightType},
        ${insight.severity},
        ${insight.title},
        ${insight.body},
        ${insight.metricKey ?? null},
        ${insight.metricValue ?? null},
        ${insight.suggestedAction ?? null},
        ${insight.actionType ?? null},
        ${jsonValue(insight.actionFilter)}::jsonb,
        ${insight.displayOrder},
        now()
      )
    `;
  }
};

const insertRecommendations = async (scan: AuditScanRow, recommendations: RecommendationDraft[]): Promise<void> => {
  for (const recommendation of recommendations) {
    await prisma.$executeRaw`
      INSERT INTO "image_audit_recommendations" (
        "scan_id",
        "store_id",
        "title",
        "description",
        "priority",
        "action_type",
        "estimated_images_affected",
        "estimated_minutes_saved_low",
        "estimated_minutes_saved_high",
        "action_filter",
        "status",
        "display_order",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${scan.id}::uuid,
        ${scan.store_id},
        ${recommendation.title},
        ${recommendation.description},
        ${recommendation.priority},
        ${recommendation.actionType},
        ${recommendation.estimatedImagesAffected},
        ${recommendation.estimatedMinutesSavedLow},
        ${recommendation.estimatedMinutesSavedHigh},
        ${jsonValue(recommendation.actionFilter)}::jsonb,
        'available',
        ${recommendation.displayOrder},
        now(),
        now()
      )
    `;
  }
};

const insertCategoryScores = async (
  scan: AuditScanRow,
  items: AuditItemRow[],
  issues: IssueDraft[]
): Promise<void> => {
  const categories = new Map<string, { categoryId: string | null; categoryName: string; items: AuditItemRow[] }>();

  for (const item of items) {
    const names = item.category_names?.length ? item.category_names : ["Uncategorised"];
    names.forEach((categoryName, index) => {
      const categoryId = item.category_ids?.[index] ?? null;
      const key = `${categoryId ?? ""}:${categoryName}`;
      const existing = categories.get(key) ?? { categoryId, categoryName, items: [] };
      existing.items.push(item);
      categories.set(key, existing);
    });
  }

  for (const category of categories.values()) {
    const itemIds = new Set(category.items.map((item) => item.id));
    const categoryIssues = issues.filter((issue) => issue.itemId && itemIds.has(issue.itemId));
    const critical = categoryIssues.filter((issue) => issue.severity === "critical").length;
    const high = categoryIssues.filter((issue) => issue.severity === "high").length;
    const medium = categoryIssues.filter((issue) => issue.severity === "medium").length;
    const low = categoryIssues.filter((issue) => issue.severity === "low").length;
    const categoryScores = calculateScores(category.items, categoryIssues);
    const topIssueType = getDominant(categoryIssues.map((issue) => issue.issueType));
    const priority = critical > 0 ? "critical" : high > 0 ? "high" : medium > 0 ? "medium" : "low";

    await prisma.$executeRaw`
      INSERT INTO "image_audit_category_scores" (
        "scan_id",
        "store_id",
        "category_id",
        "category_name",
        "products_scanned",
        "images_scanned",
        "health_score",
        "seo_score",
        "quality_score",
        "consistency_score",
        "performance_score",
        "priority",
        "issue_count",
        "critical_issue_count",
        "high_issue_count",
        "medium_issue_count",
        "low_issue_count",
        "top_issue_type",
        "recommendation",
        "created_at"
      )
      VALUES (
        ${scan.id}::uuid,
        ${scan.store_id},
        ${category.categoryId},
        ${category.categoryName},
        ${new Set(category.items.map((item) => item.product_id)).size},
        ${category.items.length},
        ${categoryScores.productImageHealthScore},
        ${categoryScores.seoScore},
        ${categoryScores.imageQualityScore},
        ${categoryScores.catalogueConsistencyScore},
        ${categoryScores.performanceScore},
        ${priority},
        ${categoryIssues.length},
        ${critical},
        ${high},
        ${medium},
        ${low},
        ${topIssueType},
        ${topIssueType ? "Review the most common image issues in this category." : null},
        now()
      )
    `;
  }
};

const insertEngineCategoryScores = async (
  scan: AuditScanRow,
  categoryScores: AuditCategoryScore[]
): Promise<void> => {
  for (const category of categoryScores) {
    await prisma.$executeRaw`
      INSERT INTO "image_audit_category_scores" (
        "scan_id",
        "store_id",
        "category_id",
        "category_name",
        "products_scanned",
        "images_scanned",
        "health_score",
        "seo_score",
        "quality_score",
        "consistency_score",
        "performance_score",
        "priority",
        "issue_count",
        "critical_issue_count",
        "high_issue_count",
        "medium_issue_count",
        "low_issue_count",
        "top_issue_type",
        "recommendation",
        "created_at"
      )
      VALUES (
        ${scan.id}::uuid,
        ${scan.store_id},
        ${category.category_id ?? null},
        ${category.category_name},
        ${category.products_scanned},
        ${category.images_scanned},
        ${category.health_score},
        ${category.seo_score},
        ${category.quality_score},
        ${category.consistency_score},
        ${category.performance_score},
        ${category.priority},
        ${category.issue_count},
        ${category.critical_issue_count},
        ${category.high_issue_count},
        ${category.medium_issue_count},
        ${category.low_issue_count},
        ${category.top_issue_type ?? null},
        ${category.recommendation ?? null},
        now()
      )
    `;
  }
};

const insertMetrics = async (
  scan: AuditScanRow,
  items: AuditItemRow[],
  issues: IssueDraft[],
  scores: ScoreBundle
): Promise<void> => {
  const count = (type: string): number => issues.filter((issue) => issue.issueType === type).length;
  const totalBytes = items.reduce((sum, item) => sum + fileSizeNumber(item.file_size_bytes), 0);
  const largestImageBytes = Math.max(0, ...items.map((item) => fileSizeNumber(item.file_size_bytes)));
  const extensions = items.map(normalizeExtension);
  const aspectBuckets = items.map((item) => ratioBucket(aspectRatio(item)));
  const googleReadyImages = items.filter((item) => {
    const itemIssues = issues.filter((issue) => issue.itemId === item.id);
    return !itemIssues.some((issue) => ["missing_alt_text", "low_resolution", "oversized_image"].includes(issue.issueType));
  }).length;

  await prisma.$executeRaw`
    INSERT INTO "image_audit_scan_metrics" (
      "scan_id",
      "store_id",
      "product_image_health_score",
      "seo_score",
      "image_quality_score",
      "catalogue_consistency_score",
      "performance_score",
      "completeness_score",
      "google_shopping_readiness_score",
      "missing_alt_text_count",
      "weak_alt_text_count",
      "generic_alt_text_count",
      "alt_text_mentions_product_count",
      "alt_text_mentions_category_count",
      "missing_image_title_count",
      "generic_filename_count",
      "duplicate_filename_count",
      "seo_ready_images_count",
      "low_resolution_count",
      "oversized_image_count",
      "huge_dimension_image_count",
      "missing_webp_count",
      "total_original_bytes",
      "total_original_mb",
      "average_image_bytes",
      "largest_image_bytes",
      "estimated_optimised_bytes",
      "estimated_optimised_mb",
      "estimated_reduction_percent_low",
      "estimated_reduction_percent_high",
      "google_ready_images_count",
      "google_warning_images_count",
      "images_with_light_background_count",
      "images_with_clean_background_count",
      "estimated_manual_minutes_low",
      "estimated_manual_minutes_high",
      "estimated_cost_saved_low",
      "estimated_cost_saved_high",
      "credits_used",
      "failed_safety_checks_not_charged",
      "dominant_aspect_ratio",
      "dominant_background_style",
      "created_at",
      "updated_at"
    )
    VALUES (
      ${scan.id}::uuid,
      ${scan.store_id},
      ${scores.productImageHealthScore},
      ${scores.seoScore},
      ${scores.imageQualityScore},
      ${scores.catalogueConsistencyScore},
      ${scores.performanceScore},
      ${scores.completenessScore},
      ${scores.googleShoppingReadinessScore},
      ${count("missing_alt_text")},
      ${count("weak_alt_text")},
      ${count("weak_alt_text")},
      ${Math.max(0, items.length - count("missing_alt_text") - count("weak_alt_text"))},
      ${0},
      ${count("missing_image_title")},
      ${count("generic_filename")},
      ${0},
      ${items.length - count("missing_alt_text") - count("weak_alt_text") - count("generic_filename")},
      ${count("low_resolution")},
      ${count("oversized_image")},
      ${items.filter(isHugeDimension).length},
      ${extensions.filter((extension) => extension && !["webp", "avif"].includes(extension)).length},
      ${totalBytes},
      ${Number((totalBytes / 1024 / 1024).toFixed(2))},
      ${items.length ? Math.round(totalBytes / items.length) : 0},
      ${largestImageBytes},
      ${Math.round(totalBytes * 0.68)},
      ${Number(((totalBytes * 0.68) / 1024 / 1024).toFixed(2))},
      ${18},
      ${45},
      ${googleReadyImages},
      ${items.length - googleReadyImages},
      ${0},
      ${0},
      ${issues.length * 2},
      ${issues.length * 5},
      ${issues.length * 2 * 40 / 60},
      ${issues.length * 5 * 40 / 60},
      ${0},
      ${0},
      ${getDominant(aspectBuckets)},
      ${null},
      now(),
      now()
    )
  `;
};

export const completeAuditScan = async (
  auth: ImageStudioAuthContext,
  scanId: string
): Promise<Record<string, unknown>> => {
  const scan = await getAuthorizedScan(auth, scanId);
  const items = await prisma.$queryRaw<AuditItemRow[]>`
    SELECT *
    FROM "image_audit_items"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
    ORDER BY "created_at" ASC
  `;

  if (items.length === 0) {
    await prisma.$executeRaw`
      UPDATE "image_audit_scans"
      SET
        "status" = 'failed',
        "error_message" = 'No audit items were submitted for this scan.',
        "scan_completed_at" = now(),
        "scan_duration_ms" = CASE
          WHEN "scan_started_at" IS NULL THEN NULL
          ELSE GREATEST(0, EXTRACT(EPOCH FROM (now() - "scan_started_at")) * 1000)::integer
        END,
        "updated_at" = now()
      WHERE "id" = ${scan.id}::uuid
    `;
    throw new ImageAuditError("No audit items were submitted for this scan.", 422);
  }

  const scoringItems = items.map(toScoringItem);
  const metrics = calculateAuditMetrics(scoringItems);
  const auditIssues = generateAuditIssues(scoringItems, metrics);
  const categoryScores = generateCategoryScores(scoringItems, auditIssues);
  const issues = auditIssues.map(toIssueDraft);
  const scores = toScoreBundle(metrics);
  const insights = generateAuditInsights(metrics, auditIssues, categoryScores).map(toInsightDraft);
  const recommendations = generateAuditRecommendations(metrics, auditIssues, categoryScores).map(toRecommendationDraft);
  const products = new Map<string, AuditItemRow[]>();
  const categories = new Set<string>();

  for (const item of items) {
    products.set(item.product_id, [...(products.get(item.product_id) ?? []), item]);
    (item.category_ids ?? []).forEach((categoryId) => categories.add(categoryId));
    (item.category_names ?? []).forEach((categoryName) => categories.add(categoryName));
  }

  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "image_audit_scan_metrics" WHERE "scan_id" = ${scan.id}::uuid`,
    prisma.$executeRaw`DELETE FROM "image_audit_issues" WHERE "scan_id" = ${scan.id}::uuid`,
    prisma.$executeRaw`DELETE FROM "image_audit_insights" WHERE "scan_id" = ${scan.id}::uuid`,
    prisma.$executeRaw`DELETE FROM "image_audit_category_scores" WHERE "scan_id" = ${scan.id}::uuid`,
    prisma.$executeRaw`DELETE FROM "image_audit_recommendations" WHERE "scan_id" = ${scan.id}::uuid`
  ]);

  await scoreAndPersistItems(scan, items, issues);
  await insertIssues(scan, issues);
  await insertInsights(scan, insights);
  await insertEngineCategoryScores(scan, categoryScores);
  await insertRecommendations(scan, recommendations);
  await insertMetrics(scan, items, issues, scores);

  const productsWithoutMain = [...products.values()].filter((productItems) => !productItems.some((item) => item.image_role === "main")).length;
  const productsWithSingleImage = [...products.values()].filter((productItems) => productItems.length === 1).length;

  await prisma.$executeRaw`
    UPDATE "image_audit_scans"
    SET
      "status" = 'completed',
      "products_scanned" = ${products.size},
      "images_scanned" = ${items.length},
      "main_images_scanned" = ${items.filter((item) => item.image_role === "main").length},
      "gallery_images_scanned" = ${items.filter((item) => item.image_role === "gallery").length},
      "variation_images_scanned" = ${items.filter((item) => item.image_role === "variation").length},
      "categories_scanned" = ${categories.size},
      "products_without_main_image" = ${productsWithoutMain},
      "products_with_single_image" = ${productsWithSingleImage},
      "scan_completed_at" = now(),
      "scan_duration_ms" = CASE
        WHEN "scan_started_at" IS NULL THEN NULL
        ELSE GREATEST(0, EXTRACT(EPOCH FROM (now() - "scan_started_at")) * 1000)::integer
      END,
      "error_message" = NULL,
      "updated_at" = now()
    WHERE "id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
  `;

  return getAuditReport(auth, scan.id, { topOnly: true });
};

export const getLatestAuditReport = async (
  auth: ImageStudioAuthContext,
  storeId: string
): Promise<Record<string, unknown>> => {
  await assertStoreAccess(auth, storeId);

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text
    FROM "image_audit_scans"
    WHERE "store_id" = ${storeId}
      AND "status" = 'completed'
    ORDER BY "created_at" DESC
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new ImageAuditError("No completed audit scan found for this store", 404);
  }

  return getAuditReport(auth, rows[0].id, { topOnly: true });
};

const getIssueSummary = async (scan: AuditScanRow): Promise<Record<string, unknown>> => {
  const rows = await prisma.$queryRaw<Array<{ severity: string; issue_type: string; count: bigint }>>`
    SELECT "severity", "issue_type", COUNT(*)::bigint AS "count"
    FROM "image_audit_issues"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
      AND "status" <> 'ignored'
    GROUP BY "severity", "issue_type"
  `;

  const bySeverity: Record<string, number> = {};
  const byIssueType: Record<string, number> = {};

  for (const row of rows) {
    const count = Number(row.count);
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + count;
    byIssueType[row.issue_type] = (byIssueType[row.issue_type] ?? 0) + count;
  }

  return {
    total: rows.reduce((sum, row) => sum + Number(row.count), 0),
    by_severity: bySeverity,
    by_issue_type: byIssueType
  };
};

export const getAuditReport = async (
  auth: ImageStudioAuthContext,
  scanId: string,
  options: { topOnly?: boolean } = {}
): Promise<Record<string, unknown>> => {
  const scan = await getAuthorizedScan(auth, scanId);
  const metricRows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT *
    FROM "image_audit_scan_metrics"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
    ORDER BY "created_at" DESC
    LIMIT 1
  `;
  const insightLimit = options.topOnly ? 5 : 100;
  const recommendationLimit = options.topOnly ? 5 : 100;
  const insights = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT *
    FROM "image_audit_insights"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
    ORDER BY "display_order" ASC, "created_at" ASC
    LIMIT ${insightLimit}
  `;
  const recommendations = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT *
    FROM "image_audit_recommendations"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
    ORDER BY
      CASE "priority"
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      "display_order" ASC
    LIMIT ${recommendationLimit}
  `;
  const categoryScores = options.topOnly ? [] : await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT *
    FROM "image_audit_category_scores"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
    ORDER BY
      CASE "priority"
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      "issue_count" DESC
  `;
  const topItems = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      "id"::text,
      "product_id",
      "product_name",
      "product_sku",
      "image_id",
      "image_url",
      "image_role",
      "issue_count",
      "highest_severity",
      "recommended_action",
      "seo_score",
      "quality_score",
      "performance_score",
      "google_readiness_score"
    FROM "image_audit_items"
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
      AND "issue_count" > 0
    ORDER BY
      CASE "highest_severity"
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      "issue_count" DESC
    LIMIT 20
  `;

  return {
    scan: serializeRecord(scan),
    metrics: serializeRecord(metricRows[0] ?? null),
    [options.topOnly ? "top_insights" : "insights"]: insights.map(serializeRecord),
    [options.topOnly ? "top_recommendations" : "recommendations"]: recommendations.map(serializeRecord),
    ...(options.topOnly ? {} : { category_scores: categoryScores.map(serializeRecord) }),
    issue_summary: await getIssueSummary(scan),
    top_items_needing_attention: topItems.map(serializeRecord)
  };
};

const buildIssueFilters = (
  scan: AuditScanRow,
  query: Record<string, unknown>
): { where: Prisma.Sql; joins: Prisma.Sql } => {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`i."scan_id" = ${scan.id}::uuid`,
    Prisma.sql`i."store_id" = ${scan.store_id}`
  ];
  const joins: Prisma.Sql[] = [];

  for (const [key, column] of [
    ["severity", "severity"],
    ["issue_type", "issue_type"],
    ["status", "status"],
    ["product_id", "product_id"]
  ] as const) {
    const value = trimText(query[key], key);
    if (value) {
      conditions.push(Prisma.sql`i.${Prisma.raw(`"${column}"`)} = ${value}`);
    }
  }

  const category = trimText(query.category, "category");
  const imageRole = trimText(query.image_role, "image_role");
  if (category || imageRole) {
    joins.push(Prisma.sql`LEFT JOIN "image_audit_items" item ON item."id" = i."audit_item_id"`);
  }
  if (category) {
    conditions.push(Prisma.sql`(${category} = ANY(item."category_ids") OR ${category} = ANY(item."category_names"))`);
  }
  if (imageRole) {
    conditions.push(Prisma.sql`item."image_role" = ${imageRole}`);
  }

  return {
    where: Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`,
    joins: joins.length > 0 ? Prisma.sql`${Prisma.join(joins, " ")}` : Prisma.empty
  };
};

export const listAuditIssues = async (
  auth: ImageStudioAuthContext,
  scanId: string,
  query: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const scan = await getAuthorizedScan(auth, scanId);
  const limit = Math.min(toSafeInteger(Number(query.limit), 100) ?? 50, 100);
  const offset = toSafeInteger(Number(query.offset), 100_000) ?? 0;
  const filters = buildIssueFilters(scan, query);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT i.*
    FROM "image_audit_issues" i
    ${filters.joins}
    ${filters.where}
    ORDER BY
      CASE i."severity"
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      i."created_at" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT i."id")::bigint AS "count"
    FROM "image_audit_issues" i
    ${filters.joins}
    ${filters.where}
  `;

  return {
    items: rows.map(serializeRecord),
    total_count: Number(countRows[0]?.count ?? 0),
    limit,
    offset
  };
};

const buildItemFilters = (
  scan: AuditScanRow,
  query: Record<string, unknown>
): { where: Prisma.Sql; joins: Prisma.Sql } => {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`item."scan_id" = ${scan.id}::uuid`,
    Prisma.sql`item."store_id" = ${scan.store_id}`
  ];
  const joins: Prisma.Sql[] = [];

  const severity = trimText(query.severity, "severity");
  const issueType = trimText(query.issue_type, "issue_type");
  if (severity || issueType) {
    joins.push(Prisma.sql`INNER JOIN "image_audit_issues" issue ON issue."audit_item_id" = item."id"`);
  }
  if (severity) {
    conditions.push(Prisma.sql`issue."severity" = ${severity}`);
  }
  if (issueType) {
    conditions.push(Prisma.sql`issue."issue_type" = ${issueType}`);
  }

  const category = trimText(query.category, "category");
  if (category) {
    conditions.push(Prisma.sql`(${category} = ANY(item."category_ids") OR ${category} = ANY(item."category_names"))`);
  }

  const imageRole = trimText(query.image_role, "image_role");
  if (imageRole) {
    conditions.push(Prisma.sql`item."image_role" = ${imageRole}`);
  }

  const productId = trimText(query.product_id, "product_id");
  if (productId) {
    conditions.push(Prisma.sql`item."product_id" = ${productId}`);
  }

  for (const [queryKey, column, operator] of [
    ["min_score", "quality_score", ">="],
    ["max_score", "quality_score", "<="],
    ["min_seo_score", "seo_score", ">="],
    ["max_seo_score", "seo_score", "<="],
    ["min_google_readiness_score", "google_readiness_score", ">="],
    ["max_google_readiness_score", "google_readiness_score", "<="]
  ] as const) {
    const value = Number(query[queryKey]);
    if (Number.isFinite(value)) {
      conditions.push(Prisma.sql`item.${Prisma.raw(`"${column}"`)} ${Prisma.raw(operator)} ${value}`);
    }
  }

  return {
    where: Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`,
    joins: joins.length > 0 ? Prisma.sql`${Prisma.join(joins, " ")}` : Prisma.empty
  };
};

export const listAuditItems = async (
  auth: ImageStudioAuthContext,
  scanId: string,
  query: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const scan = await getAuthorizedScan(auth, scanId);
  const limit = Math.min(toSafeInteger(Number(query.limit), 100) ?? 50, 100);
  const offset = toSafeInteger(Number(query.offset), 100_000) ?? 0;
  const filters = buildItemFilters(scan, query);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT DISTINCT item.*
    FROM "image_audit_items" item
    ${filters.joins}
    ${filters.where}
    ORDER BY
      CASE item."highest_severity"
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      item."issue_count" DESC,
      item."created_at" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT item."id")::bigint AS "count"
    FROM "image_audit_items" item
    ${filters.joins}
    ${filters.where}
  `;

  return {
    items: rows.map(serializeRecord),
    total_count: Number(countRows[0]?.count ?? 0),
    limit,
    offset
  };
};

export const ignoreAuditIssues = async (
  auth: ImageStudioAuthContext,
  scanId: string,
  issueIds: unknown
): Promise<{ updated_count: number }> => {
  const scan = await getAuthorizedScan(auth, scanId);
  if (!Array.isArray(issueIds) || issueIds.length < 1 || issueIds.length > 100) {
    throw new ImageAuditError("issue_ids must contain 1 to 100 IDs", 400);
  }
  const ids = issueIds.map((id) => requireUuid(String(id)));
  const result = await prisma.$executeRaw`
    UPDATE "image_audit_issues"
    SET
      "status" = 'ignored',
      "resolved_at" = now(),
      "updated_at" = now()
    WHERE "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
      AND "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
  `;

  return {
    updated_count: result
  };
};

export const queueAuditIssues = async (
  auth: ImageStudioAuthContext,
  scanId: string,
  issueIds: unknown
): Promise<Record<string, unknown>> => {
  await getAuthorizedScan(auth, scanId);
  if (!Array.isArray(issueIds) || issueIds.length < 1 || issueIds.length > 100) {
    throw new ImageAuditError("issue_ids must contain 1 to 100 IDs", 400);
  }
  issueIds.forEach((id) => requireUuid(String(id)));

  // TODO: Connect this to the existing image processing queue once report actions
  // are mapped to concrete WooCommerce product image job payloads.
  return {
    status: "not_implemented",
    queued_count: 0,
    message: "Queue integration for audit issues is not implemented yet."
  };
};

export const queueAuditRecommendation = async (
  auth: ImageStudioAuthContext,
  scanId: string,
  recommendationId: unknown
): Promise<Record<string, unknown>> => {
  const scan = await getAuthorizedScan(auth, scanId);
  const id = trimText(recommendationId, "recommendation_id", true);
  requireUuid(id ?? "");
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"::text
    FROM "image_audit_recommendations"
    WHERE "id" = ${id}::uuid
      AND "scan_id" = ${scan.id}::uuid
      AND "store_id" = ${scan.store_id}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new ImageAuditError("Recommendation not found for this scan", 404);
  }

  // TODO: Connect this to the existing image processing queue once recommendation
  // filters can be converted into concrete local WooCommerce job selections.
  return {
    status: "not_implemented",
    queued_count: 0,
    recommendation_id: id,
    message: "Queue integration for audit recommendations is not implemented yet."
  };
};
