export type AuditImageRole = "unknown" | "main" | "gallery" | "variation" | "category" | "thumbnail";

export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";

export type AuditActionType =
  | "manual_review"
  | "queue_processing"
  | "preserve_background_replace"
  | "standard_background_replace"
  | "seo_update"
  | "compress_image"
  | "replace_main_image"
  | "add_gallery_image"
  | "regenerate_thumbnail"
  | "fix_alt_text";

export type AuditIssueType =
  | "missing_main_image"
  | "product_has_single_image"
  | "missing_alt_text"
  | "weak_alt_text"
  | "generic_filename"
  | "duplicate_filename"
  | "oversized_file"
  | "huge_dimensions"
  | "missing_webp"
  | "cluttered_background"
  | "inconsistent_background"
  | "low_contrast"
  | "poor_centering"
  | "too_small_in_frame"
  | "too_tightly_cropped"
  | "low_resolution"
  | "likely_blurry"
  | "over_dark"
  | "over_bright"
  | "watermark_or_text_overlay"
  | "inconsistent_aspect_ratio"
  | "inconsistent_product_scale"
  | "inconsistent_padding"
  | "google_readiness_warning"
  | "preserve_pixel_drift_warning"
  | "low_foreground_confidence"
  | "failed_integrity_check"
  | "processing_failed";

export type AuditScoringItem = {
  id?: string;
  product_id: string;
  product_name?: string | null;
  product_sku?: string | null;
  product_url?: string | null;
  image_id?: string | null;
  image_url?: string | null;
  image_role?: AuditImageRole | string | null;
  category_ids?: string[] | null;
  category_names?: string[] | null;
  filename?: string | null;
  file_extension?: string | null;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  file_size_bytes?: number | bigint | null;
  alt_text?: string | null;
  image_title?: string | null;
  caption?: string | null;
  aspect_ratio?: number | null;
  background_style?: string | null;
  detected_product_bbox?: unknown;
  product_area_ratio?: number | null;
  brightness_score?: number | null;
  contrast_score?: number | null;
  sharpness_score?: number | null;
  clutter_score?: number | null;
  promotional_overlay?: boolean | null;
  watermark_or_text_overlay?: boolean | null;
  product_focused?: boolean | null;
  preserve_pixel_drift_warning?: boolean | null;
  low_foreground_confidence?: boolean | null;
  failed_integrity_check?: boolean | null;
  processing_failed?: boolean | null;
  image_available?: boolean | null;
  has_variation_image?: boolean | null;
  variation_image_expected?: boolean | null;
  product_status?: string | null;
  stock_status?: string | null;
  product_price?: number | null;
  product_revenue?: number | null;
  product_sales_count?: number | null;
  product_updated_at?: string | Date | null;
};

export type ScoreResult = {
  score: number;
  details: Record<string, number | string | null>;
};

export type RoiEstimate = {
  estimated_manual_minutes_low: number;
  estimated_manual_minutes_high: number;
  hourly_rate_used: number;
  estimated_cost_saved_low: number;
  estimated_cost_saved_high: number;
};

export type AuditMetrics = RoiEstimate & {
  product_image_health_score: number;
  seo_score: number;
  image_quality_score: number;
  catalogue_consistency_score: number;
  performance_score: number;
  completeness_score: number;
  google_shopping_readiness_score: number;
  missing_alt_text_count: number;
  weak_alt_text_count: number;
  generic_alt_text_count: number;
  alt_text_mentions_product_count: number;
  alt_text_mentions_category_count: number;
  missing_image_title_count: number;
  generic_filename_count: number;
  duplicate_filename_count: number;
  seo_ready_images_count: number;
  cluttered_background_count: number;
  low_contrast_count: number;
  poor_centering_count: number;
  product_too_small_count: number;
  product_too_large_or_cropped_count: number;
  low_resolution_count: number;
  likely_blurry_count: number;
  over_dark_count: number;
  over_bright_count: number;
  watermark_or_text_overlay_count: number;
  clean_product_focus_count: number;
  inconsistent_background_count: number;
  inconsistent_aspect_ratio_count: number;
  inconsistent_product_scale_count: number;
  inconsistent_padding_count: number;
  inconsistent_lighting_count: number;
  dominant_aspect_ratio: string | null;
  dominant_background_style: string | null;
  total_original_bytes: number;
  total_original_mb: number;
  average_image_bytes: number;
  largest_image_bytes: number;
  oversized_image_count: number;
  huge_dimension_image_count: number;
  missing_webp_count: number;
  estimated_optimised_bytes: number;
  estimated_optimised_mb: number;
  estimated_reduction_percent_low: number;
  estimated_reduction_percent_high: number;
  google_ready_images_count: number;
  google_warning_images_count: number;
  images_with_promotional_overlay_count: number;
  images_with_non_product_focused_main_image_count: number;
  images_with_light_background_count: number;
  images_with_clean_background_count: number;
  images_processed: number;
  images_approved: number;
  images_rejected: number;
  images_failed: number;
  average_processing_time_ms: number;
  preserve_mode_count: number;
  flexible_mode_count: number;
  product_pixel_drift_warning_count: number;
  low_foreground_confidence_count: number;
  failed_integrity_check_count: number;
  credits_used: number;
  failed_safety_checks_not_charged: number;
  assessed_visual_metrics: {
    background_style: boolean;
    product_area_ratio: boolean;
    product_bbox: boolean;
    brightness: boolean;
    contrast: boolean;
    sharpness: boolean;
    clutter: boolean;
  };
};

export type AuditIssue = {
  item_id?: string;
  product_id?: string;
  image_id?: string | null;
  image_role?: string | null;
  category_names?: string[];
  issue_type: AuditIssueType;
  severity: AuditSeverity;
  title: string;
  description: string;
  recommended_action: string;
  action_type?: AuditActionType;
  confidence_score?: number;
  metadata?: Record<string, unknown>;
};

export type AuditInsight = {
  insight_type: string;
  severity: AuditSeverity;
  title: string;
  body: string;
  metric_key?: string;
  metric_value?: number;
  suggested_action?: string;
  action_type?: AuditActionType;
  action_filter?: Record<string, unknown>;
  display_order: number;
};

export type AuditCategoryScore = {
  category_id?: string | null;
  category_name: string;
  products_scanned: number;
  images_scanned: number;
  health_score: number;
  seo_score: number;
  quality_score: number;
  consistency_score: number;
  performance_score: number;
  priority: Exclude<AuditSeverity, "info">;
  issue_count: number;
  critical_issue_count: number;
  high_issue_count: number;
  medium_issue_count: number;
  low_issue_count: number;
  top_issue_type?: AuditIssueType | null;
  recommendation?: string | null;
};

export type AuditRecommendation = {
  title: string;
  description: string;
  priority: Exclude<AuditSeverity, "info">;
  action_type: AuditActionType;
  estimated_images_affected: number;
  estimated_minutes_saved_low: number;
  estimated_minutes_saved_high: number;
  action_filter?: Record<string, unknown>;
  display_order: number;
};

export type RecommendedFirstImage = {
  item_id?: string;
  product_id: string;
  product_name?: string | null;
  product_sku?: string | null;
  product_url?: string | null;
  image_id?: string | null;
  image_url?: string | null;
  image_role?: string | null;
  category_names?: string[];
  issue_count: number;
  issue_ids?: string[];
  highest_severity: AuditSeverity;
  priority_score: number;
  reasons: string[];
  estimated_impact: string;
  recommended_action?: string | null;
  selection_rank: number;
};

type ForecastScoreKey =
  | "product_image_health_score"
  | "seo_score"
  | "image_quality_score"
  | "catalogue_consistency_score"
  | "performance_score"
  | "completeness_score"
  | "google_shopping_readiness_score";

export type FixImpactForecast = {
  baseline: {
    product_image_health_score: number;
    seo_score: number;
    image_quality_score: number;
    catalogue_consistency_score: number;
    performance_score: number;
    completeness_score: number;
    google_shopping_readiness_score: number;
  };
  estimated: {
    product_image_health_score: number;
    seo_score: number;
    image_quality_score: number;
    catalogue_consistency_score: number;
    performance_score: number;
    completeness_score: number;
    google_shopping_readiness_score: number;
  };
  deltas: {
    product_image_health_score: number;
    seo_score: number;
    image_quality_score: number;
    catalogue_consistency_score: number;
    performance_score: number;
    completeness_score: number;
    google_shopping_readiness_score: number;
  };
  estimated_manual_minutes_low: number;
  estimated_manual_minutes_high: number;
  estimated_manual_hours_low: number;
  estimated_manual_hours_high: number;
  selected_issue_types: AuditIssueType[];
  assumptions: string[];
  recommendation_impacts: Array<{
    title: string;
    action_type: AuditActionType;
    priority: Exclude<AuditSeverity, "info">;
    estimated_images_affected: number;
    issue_types: AuditIssueType[];
    score_impacts: Partial<Record<ForecastScoreKey, number>>;
  }>;
};

const modernExtensions = new Set(["webp", "avif"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "avif"]);
const genericAltValues = new Set(["image", "product", "photo", "picture", "screenshot", "blank"]);
const backgroundCleanupIssues = new Set<AuditIssueType>([
  "cluttered_background",
  "inconsistent_background",
  "watermark_or_text_overlay"
]);
const fileOptimisationIssues = new Set<AuditIssueType>(["oversized_file", "huge_dimensions", "missing_webp"]);
const cropReviewIssues = new Set<AuditIssueType>([
  "poor_centering",
  "too_small_in_frame",
  "too_tightly_cropped",
  "inconsistent_aspect_ratio",
  "inconsistent_product_scale",
  "inconsistent_padding"
]);

export const clampScore = (score: number): number => Math.max(0, Math.min(100, Number(score.toFixed(2))));

const cap = (value: number, max: number): number => Math.min(value, max);

const scoreFromPenalty = (penalty: number): number => clampScore(100 - penalty);

const toNumber = (value: number | bigint | null | undefined): number => {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const imageRole = (item: AuditScoringItem): AuditImageRole => {
  const role = item.image_role ?? "unknown";
  return ["main", "gallery", "variation", "category", "thumbnail", "unknown"].includes(role) ? role as AuditImageRole : "unknown";
};

const filenameFromItem = (item: AuditScoringItem): string => {
  if (item.filename?.trim()) {
    return item.filename.trim();
  }

  if (item.image_url) {
    try {
      const parsed = new URL(item.image_url);
      return decodeURIComponent(parsed.pathname.split("/").pop() ?? "");
    } catch {
      return item.image_url.split("/").pop() ?? "";
    }
  }

  return "";
};

const extensionFromItem = (item: AuditScoringItem): string => {
  const explicit = item.file_extension?.toLowerCase().replace(/^\./, "");
  if (explicit) {
    return explicit;
  }

  const filename = filenameFromItem(item).toLowerCase();
  return filename.match(/\.([a-z0-9]+)(?:\?|#|$)/)?.[1] ?? "";
};

const usefulTokens = (value: string | null | undefined): string[] => (
  value?.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3) ?? []
);

const productOrCategoryTokens = (item: AuditScoringItem): string[] => [
  ...usefulTokens(item.product_name),
  ...(item.category_names ?? []).flatMap(usefulTokens)
].filter((token) => !genericAltValues.has(token));

export const isWeakAltText = (item: AuditScoringItem): boolean => {
  const alt = item.alt_text?.trim() ?? "";
  const normalized = alt.toLowerCase();

  if (!alt) {
    return false;
  }

  if (
    genericAltValues.has(normalized) ||
    /^img[_-]?\d+$/i.test(normalized) ||
    /^dsc[_-]?\d+$/i.test(normalized) ||
    alt.replace(/[^a-z0-9]/gi, "").length < 5
  ) {
    return true;
  }

  const sku = item.product_sku?.trim().toLowerCase();
  const productName = item.product_name?.trim().toLowerCase();
  if (sku && normalized === sku && productName !== sku) {
    return true;
  }

  const tokens = productOrCategoryTokens(item);
  return tokens.length > 0 && !tokens.some((token) => normalized.includes(token));
};

export const isGenericFilename = (item: AuditScoringItem): boolean => {
  const filename = filenameFromItem(item).toLowerCase();
  const base = filename.replace(/\.[a-z0-9]+$/, "");

  if (!base) {
    return true;
  }

  if (/^(img|dsc|image|screenshot|product|photo|picture|blank)[-_ ]?\d*$/i.test(base)) {
    return true;
  }

  if (/^\d+$/.test(base)) {
    return true;
  }

  const tokens = productOrCategoryTokens(item);
  if (tokens.length === 0) {
    return false;
  }

  return !tokens.some((token) => base.includes(token));
};

const filenameKey = (item: AuditScoringItem): string => filenameFromItem(item).toLowerCase();

const duplicateFilenameKeys = (items: AuditScoringItem[]): Set<string> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = filenameKey(item);
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
};

const isOversized = (item: AuditScoringItem): boolean => toNumber(item.file_size_bytes) > 500 * 1024;

const isVeryOversized = (item: AuditScoringItem): boolean => toNumber(item.file_size_bytes) > 1024 * 1024;

const largestDimension = (item: AuditScoringItem): number => Math.max(item.width ?? 0, item.height ?? 0);

const isHugeDimension = (item: AuditScoringItem): boolean => largestDimension(item) > 2000;

const isLowResolution = (item: AuditScoringItem): boolean => {
  if (!item.width || !item.height) {
    return false;
  }
  return item.width < 800 || item.height < 800;
};

const isTinyImage = (item: AuditScoringItem): boolean => {
  if (!item.width || !item.height) {
    return false;
  }
  return item.width < 400 || item.height < 400;
};

const aspectRatio = (item: AuditScoringItem): number | null => {
  if (typeof item.aspect_ratio === "number" && Number.isFinite(item.aspect_ratio) && item.aspect_ratio > 0) {
    return item.aspect_ratio;
  }
  if (!item.width || !item.height || item.height <= 0) {
    return null;
  }
  return item.width / item.height;
};

export const bucketAspectRatio = (item: AuditScoringItem): string => {
  const ratio = aspectRatio(item);
  if (!ratio) {
    return "unknown";
  }
  if (Math.abs(ratio - 1) <= 0.06) {
    return "square";
  }
  if (Math.abs(ratio - 0.8) <= 0.06) {
    return "4:5 portrait";
  }
  if (Math.abs(ratio - 0.75) <= 0.05) {
    return "3:4 portrait";
  }
  if (ratio >= 1.2) {
    return "landscape";
  }
  return "other";
};

const dominant = (values: string[]): string | null => {
  const counts = new Map<string, number>();
  for (const value of values.filter((candidate) => candidate && candidate !== "unknown")) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const productGroups = (items: AuditScoringItem[]): Map<string, AuditScoringItem[]> => {
  const groups = new Map<string, AuditScoringItem[]>();
  for (const item of items) {
    groups.set(item.product_id, [...(groups.get(item.product_id) ?? []), item]);
  }
  return groups;
};

const hasKnownLightBackground = (style: string | null | undefined): boolean => {
  const normalized = style?.toLowerCase() ?? "";
  return normalized.includes("light") || normalized.includes("white") || normalized.includes("clean") || normalized.includes("studio");
};

const hasKnownCleanBackground = (style: string | null | undefined): boolean => {
  const normalized = style?.toLowerCase() ?? "";
  return normalized.includes("clean") || normalized.includes("studio") || normalized.includes("white");
};

const hasKnownClutteredBackground = (style: string | null | undefined): boolean => {
  const normalized = style?.toLowerCase() ?? "";
  return normalized.includes("clutter") || normalized.includes("busy") || normalized.includes("lifestyle") || normalized.includes("textured");
};

const hasKnownPromotionalOverlay = (item: AuditScoringItem): boolean => (
  item.promotional_overlay === true ||
  item.watermark_or_text_overlay === true ||
  (item.background_style?.toLowerCase().includes("watermark") ?? false) ||
  (item.background_style?.toLowerCase().includes("text overlay") ?? false)
);

const imageKey = (item: AuditScoringItem): string => item.id ?? `${item.product_id}:${item.image_id ?? item.image_url ?? filenameFromItem(item)}`;

export const scoreSeo = (items: AuditScoringItem[]): ScoreResult => {
  const duplicateKeys = duplicateFilenameKeys(items);
  const missingMainAlt = items.filter((item) => imageRole(item) === "main" && !item.alt_text?.trim()).length;
  const missingOtherAlt = items.filter((item) => imageRole(item) !== "main" && !item.alt_text?.trim()).length;
  const weakAlt = items.filter(isWeakAltText).length;
  const genericFilename = items.filter(isGenericFilename).length;
  const duplicateFilename = items.filter((item) => duplicateKeys.has(filenameKey(item))).length;
  const oversized = items.filter(isOversized).length;

  const penalty =
    cap(missingMainAlt * 8, 35) +
    cap(missingOtherAlt * 2, 15) +
    cap(weakAlt * 4, 20) +
    cap(genericFilename * 2, 15) +
    cap(duplicateFilename * 2, 10) +
    cap(oversized, 10);

  return {
    score: scoreFromPenalty(penalty),
    details: {
      missing_main_alt: missingMainAlt,
      missing_gallery_or_variation_alt: missingOtherAlt,
      weak_alt: weakAlt,
      generic_filename: genericFilename,
      duplicate_filename: duplicateFilename,
      oversized
    }
  };
};

export const scorePerformance = (items: AuditScoringItem[]): ScoreResult => {
  const totalBytes = items.reduce((sum, item) => sum + toNumber(item.file_size_bytes), 0);
  const over500kb = items.filter(isOversized).length;
  const over1mb = items.filter(isVeryOversized).length;
  const hugeDimensions = items.filter(isHugeDimension).length;
  const missingModernFormat = items.filter((item) => {
    const extension = extensionFromItem(item);
    return imageExtensions.has(extension) && !modernExtensions.has(extension);
  }).length;
  const totalCatalogueMb = totalBytes / 1024 / 1024;

  const penalty =
    cap(over500kb * 2, 20) +
    cap(over1mb * 4, 25) +
    cap(hugeDimensions * 4, 20) +
    cap(missingModernFormat * 1.5, 20) +
    cap(Math.max(0, totalCatalogueMb - 100) * 0.15, 15);

  return {
    score: scoreFromPenalty(penalty),
    details: {
      over_500kb: over500kb,
      over_1mb: over1mb,
      huge_dimensions: hugeDimensions,
      missing_modern_format: missingModernFormat,
      total_catalogue_mb: Number(totalCatalogueMb.toFixed(2))
    }
  };
};

export const scoreCompleteness = (items: AuditScoringItem[]): ScoreResult => {
  const groups = productGroups(items);
  const productCount = groups.size;
  let missingMain = 0;
  let singleImage = 0;
  let missingVariationImage = 0;

  for (const group of groups.values()) {
    if (!group.some((item) => imageRole(item) === "main")) {
      missingMain += 1;
    }
    if (group.length <= 1) {
      singleImage += 1;
    }
    if (group.some((item) => item.variation_image_expected === true && item.has_variation_image === false)) {
      missingVariationImage += 1;
    }
  }

  const penalty =
    productCount === 0 ? 100 :
      cap((missingMain / productCount) * 60, 60) +
      cap((singleImage / productCount) * 25, 25) +
      cap((missingVariationImage / productCount) * 15, 15);

  return {
    score: scoreFromPenalty(penalty),
    details: {
      products_scanned: productCount,
      products_without_main_image: missingMain,
      products_with_single_image: singleImage,
      variation_products_missing_variation_image: missingVariationImage
    }
  };
};

export const scoreConsistency = (items: AuditScoringItem[]): ScoreResult => {
  const mainImages = items.filter((item) => imageRole(item) === "main");
  const mainBuckets = mainImages.map(bucketAspectRatio);
  const dominantAspect = dominant(mainBuckets);
  const inconsistentMainAspect = dominantAspect
    ? mainBuckets.filter((bucket) => bucket !== "unknown" && bucket !== dominantAspect).length
    : 0;
  const assessedBackgrounds = items.filter((item) => Boolean(item.background_style?.trim()));
  const dominantBackground = dominant(assessedBackgrounds.map((item) => item.background_style?.trim().toLowerCase() ?? ""));
  const inconsistentBackground = dominantBackground
    ? assessedBackgrounds.filter((item) => item.background_style?.trim().toLowerCase() !== dominantBackground).length
    : 0;

  const denominator = Math.max(1, mainImages.filter((item) => bucketAspectRatio(item) !== "unknown").length);
  const penalty =
    cap((inconsistentMainAspect / denominator) * 55, 55) +
    cap(inconsistentBackground * 4, 20);

  return {
    score: scoreFromPenalty(penalty),
    details: {
      dominant_aspect_ratio: dominantAspect,
      inconsistent_main_aspect_ratio_count: inconsistentMainAspect,
      dominant_background_style: dominantBackground,
      inconsistent_background_count: inconsistentBackground,
      background_style_assessed_count: assessedBackgrounds.length
    }
  };
};

export const scoreImageQuality = (items: AuditScoringItem[]): ScoreResult => {
  const lowResolution = items.filter(isLowResolution).length;
  const tinyImages = items.filter(isTinyImage).length;
  const tooSmall = items.filter((item) => typeof item.product_area_ratio === "number" && item.product_area_ratio < 0.35).length;
  const tooTight = items.filter((item) => typeof item.product_area_ratio === "number" && item.product_area_ratio > 0.92).length;
  const blurry = items.filter((item) => typeof item.sharpness_score === "number" && item.sharpness_score < 25).length;
  const overDark = items.filter((item) => typeof item.brightness_score === "number" && item.brightness_score < 25).length;
  const overBright = items.filter((item) => typeof item.brightness_score === "number" && item.brightness_score > 90).length;
  const lowContrast = items.filter((item) => typeof item.contrast_score === "number" && item.contrast_score < 20).length;
  const cluttered = items.filter((item) => typeof item.clutter_score === "number" && item.clutter_score > 70).length;

  const penalty =
    cap(lowResolution * 5, 30) +
    cap(tinyImages * 8, 25) +
    cap(tooSmall * 6, 24) +
    cap(tooTight * 6, 24) +
    cap(blurry * 6, 24) +
    cap((overDark + overBright + lowContrast) * 3, 24) +
    cap(cluttered * 4, 20);

  return {
    score: scoreFromPenalty(penalty),
    details: {
      low_resolution_count: lowResolution,
      suspiciously_tiny_image_count: tinyImages,
      product_too_small_count: tooSmall,
      product_too_large_or_cropped_count: tooTight,
      likely_blurry_count: blurry,
      over_dark_count: overDark,
      over_bright_count: overBright,
      low_contrast_count: lowContrast,
      cluttered_background_count: cluttered,
      visual_scores_not_assessed_count: items.filter((item) => (
        item.product_area_ratio == null &&
        item.sharpness_score == null &&
        item.brightness_score == null &&
        item.contrast_score == null &&
        item.clutter_score == null
      )).length
    }
  };
};

export const scoreGoogleShoppingReadiness = (items: AuditScoringItem[]): ScoreResult => {
  const groups = productGroups(items);
  let warnings = 0;
  let readyMainImages = 0;
  let assessedMainImages = 0;

  for (const group of groups.values()) {
    const main = group.find((item) => imageRole(item) === "main");
    if (!main) {
      warnings += 1;
      continue;
    }

    assessedMainImages += 1;
    const sufficientDimensions = Boolean(main.width && main.height && main.width >= 800 && main.height >= 800);
    const reasonableFileSize = toNumber(main.file_size_bytes) === 0 || toNumber(main.file_size_bytes) <= 2 * 1024 * 1024;
    const overlayOk = !hasKnownPromotionalOverlay(main);
    const backgroundOk = !main.background_style || hasKnownCleanBackground(main.background_style) || hasKnownLightBackground(main.background_style);
    const cropOk = main.product_area_ratio == null || (main.product_area_ratio >= 0.35 && main.product_area_ratio <= 0.9);
    const productFocusedOk = main.product_focused !== false;

    if (sufficientDimensions && reasonableFileSize && overlayOk && backgroundOk && cropOk && productFocusedOk) {
      readyMainImages += 1;
    } else {
      warnings += 1;
    }
  }

  return {
    score: groups.size > 0 ? clampScore((readyMainImages / groups.size) * 100) : 0,
    details: {
      google_ready_images_count: readyMainImages,
      google_warning_images_count: warnings,
      assessed_main_images: assessedMainImages
    }
  };
};

export const calculateRoiEstimate = (
  issues: AuditIssue[],
  items: AuditScoringItem[],
  hourlyRate = 40
): RoiEstimate => {
  const itemKeys = new Set(items.map(imageKey));
  const perImage = new Map<string, { low: number; high: number }>();

  const addMinutes = (key: string, low: number, high: number) => {
    const existing = perImage.get(key) ?? { low: 0, high: 0 };
    perImage.set(key, {
      low: Math.min(8, existing.low + low),
      high: Math.min(15, existing.high + high)
    });
  };

  for (const issue of issues) {
    const key = issue.item_id ?? issue.product_id ?? "catalogue";
    if (itemKeys.size > 0 && key === "catalogue") {
      continue;
    }

    if (issue.issue_type === "missing_alt_text" || issue.issue_type === "weak_alt_text") {
      addMinutes(key, 0.75, 1.5);
    } else if (issue.issue_type === "generic_filename" || issue.issue_type === "duplicate_filename") {
      addMinutes(key, 0.5, 1);
    } else if (backgroundCleanupIssues.has(issue.issue_type)) {
      addMinutes(key, 4, 8);
    } else if (fileOptimisationIssues.has(issue.issue_type)) {
      addMinutes(key, 1, 2);
    } else if (cropReviewIssues.has(issue.issue_type)) {
      addMinutes(key, 2, 4);
    } else {
      addMinutes(key, 1, 2);
    }
  }

  const estimated_manual_minutes_low = Math.round([...perImage.values()].reduce((sum, value) => sum + value.low, 0));
  const estimated_manual_minutes_high = Math.round([...perImage.values()].reduce((sum, value) => sum + value.high, 0));

  return {
    estimated_manual_minutes_low,
    estimated_manual_minutes_high,
    hourly_rate_used: hourlyRate,
    estimated_cost_saved_low: Number(((estimated_manual_minutes_low / 60) * hourlyRate).toFixed(2)),
    estimated_cost_saved_high: Number(((estimated_manual_minutes_high / 60) * hourlyRate).toFixed(2))
  };
};

export const generateIssues = (items: AuditScoringItem[], metrics?: AuditMetrics): AuditIssue[] => {
  const issues: AuditIssue[] = [];
  const duplicates = duplicateFilenameKeys(items);
  const consistency = scoreConsistency(items);
  const dominantAspect = consistency.details.dominant_aspect_ratio;

  for (const [productId, group] of productGroups(items)) {
    if (!group.some((item) => imageRole(item) === "main")) {
      issues.push({
        product_id: productId,
        issue_type: "missing_main_image",
        severity: "critical",
        title: "Product has no main image",
        description: "This product does not have a main product image in the scan data.",
        recommended_action: "Add or assign a clear main product image before optimising gallery imagery.",
        action_type: "replace_main_image",
        confidence_score: 99
      });
    }
    if (group.length === 1) {
      issues.push({
        item_id: group[0].id,
        product_id: productId,
        image_id: group[0].image_id ?? null,
        image_role: imageRole(group[0]),
        category_names: group[0].category_names ?? [],
        issue_type: "product_has_single_image",
        severity: "medium",
        title: "Product only has one image",
        description: "Products with only one image give shoppers less visual confidence.",
        recommended_action: "Add supporting gallery images where available.",
        action_type: "add_gallery_image",
        confidence_score: 95
      });
    }
  }

  for (const item of items) {
    const role = imageRole(item);
    const main = role === "main";
    const itemId = imageKey(item);
    const common = {
      item_id: item.id ?? itemId,
      product_id: item.product_id,
      image_id: item.image_id ?? null,
      image_role: role,
      category_names: item.category_names ?? []
    };

    if (item.image_available === false) {
      issues.push({
        ...common,
        issue_type: "missing_main_image",
        severity: main ? "critical" : "high",
        title: "Image appears broken or unavailable",
        description: "The scan indicates this product image may be unavailable.",
        recommended_action: "Replace or re-upload this image.",
        action_type: "replace_main_image",
        confidence_score: 95
      });
    }

    if (!item.alt_text?.trim()) {
      issues.push({
        ...common,
        issue_type: "missing_alt_text",
        severity: main ? "high" : "medium",
        title: main ? "Main image missing alt text" : "Image missing alt text",
        description: "This image does not have alt text, which weakens accessibility and image SEO.",
        recommended_action: "Add descriptive alt text that mentions the product and useful buyer-facing detail.",
        action_type: "fix_alt_text",
        confidence_score: 98
      });
    } else if (isWeakAltText(item)) {
      issues.push({
        ...common,
        issue_type: "weak_alt_text",
        severity: main ? "medium" : "low",
        title: "Weak or generic alt text",
        description: "This image has alt text, but it appears too generic or not product-specific.",
        recommended_action: "Rewrite the alt text so it clearly describes the product image.",
        action_type: "fix_alt_text",
        confidence_score: 86
      });
    }

    if (isGenericFilename(item)) {
      issues.push({
        ...common,
        issue_type: "generic_filename",
        severity: "medium",
        title: "Generic image filename",
        description: "The image filename does not appear to contain useful product or category words.",
        recommended_action: "Use descriptive product-specific filenames for future uploads.",
        action_type: "seo_update",
        confidence_score: 80
      });
    }

    if (duplicates.has(filenameKey(item))) {
      issues.push({
        ...common,
        issue_type: "duplicate_filename",
        severity: "low",
        title: "Duplicate image filename",
        description: "This filename appears more than once in the scan.",
        recommended_action: "Review duplicate filenames to avoid catalogue confusion.",
        action_type: "seo_update",
        confidence_score: 88
      });
    }

    if (isVeryOversized(item)) {
      issues.push({
        ...common,
        issue_type: "oversized_file",
        severity: main ? "high" : "medium",
        title: "Oversized image file",
        description: "This image is larger than 1 MB and may slow browsing.",
        recommended_action: "Optimise or resize the image before serving it on product pages.",
        action_type: "compress_image",
        confidence_score: 92,
        metadata: { file_size_bytes: toNumber(item.file_size_bytes) }
      });
    } else if (isOversized(item)) {
      issues.push({
        ...common,
        issue_type: "oversized_file",
        severity: main ? "medium" : "low",
        title: "Image file could be lighter",
        description: "This image is larger than 500 KB and may benefit from optimisation.",
        recommended_action: "Optimise the image to reduce storefront weight.",
        action_type: "compress_image",
        confidence_score: 84,
        metadata: { file_size_bytes: toNumber(item.file_size_bytes) }
      });
    }

    if (isHugeDimension(item)) {
      issues.push({
        ...common,
        issue_type: "huge_dimensions",
        severity: main ? "high" : "medium",
        title: "Image dimensions are very large",
        description: "The image has a dimension above 2000 px and may be larger than needed.",
        recommended_action: "Resize the image to a practical ecommerce display size.",
        action_type: "compress_image",
        confidence_score: 90,
        metadata: { width: item.width, height: item.height }
      });
    }

    const extension = extensionFromItem(item);
    if (imageExtensions.has(extension) && !modernExtensions.has(extension)) {
      issues.push({
        ...common,
        issue_type: "missing_webp",
        severity: "medium",
        title: "Modern image format opportunity",
        description: "This image is not using WebP or AVIF.",
        recommended_action: "Consider serving an optimised WebP or AVIF version for faster browsing.",
        action_type: "compress_image",
        confidence_score: 76
      });
    }

    if (isLowResolution(item)) {
      issues.push({
        ...common,
        issue_type: "low_resolution",
        severity: main ? "high" : "medium",
        title: "Low resolution image",
        description: "The image dimensions may be too small for a sharp ecommerce product image.",
        recommended_action: "Replace this with a higher-resolution source image where possible.",
        action_type: main ? "replace_main_image" : "manual_review",
        confidence_score: 90,
        metadata: { width: item.width, height: item.height }
      });
    }

    if (dominantAspect && main && bucketAspectRatio(item) !== "unknown" && bucketAspectRatio(item) !== dominantAspect) {
      issues.push({
        ...common,
        issue_type: "inconsistent_aspect_ratio",
        severity: "high",
        title: "Main image aspect ratio is inconsistent",
        description: `This main image uses a ${bucketAspectRatio(item)} ratio, while the dominant main image ratio is ${dominantAspect}.`,
        recommended_action: "Review the crop or canvas so main product images feel consistent.",
        action_type: "manual_review",
        confidence_score: 88
      });
    }

    if (typeof item.product_area_ratio === "number" && item.product_area_ratio < 0.35) {
      issues.push({
        ...common,
        issue_type: "too_small_in_frame",
        severity: main ? "high" : "medium",
        title: "Product appears too small in frame",
        description: "The measured product area ratio suggests the product may occupy too little of the image.",
        recommended_action: "Review crop and padding so the product fills the frame more professionally.",
        action_type: "manual_review",
        confidence_score: 82
      });
    }

    if (typeof item.product_area_ratio === "number" && item.product_area_ratio > 0.92) {
      issues.push({
        ...common,
        issue_type: "too_tightly_cropped",
        severity: main ? "high" : "medium",
        title: "Product may be cropped too tightly",
        description: "The measured product area ratio suggests the product may be too close to the image edge.",
        recommended_action: "Review the crop and add controlled padding if needed.",
        action_type: "manual_review",
        confidence_score: 82
      });
    }

    if (typeof item.sharpness_score === "number" && item.sharpness_score < 25) {
      issues.push({ ...common, issue_type: "likely_blurry", severity: main ? "high" : "medium", title: "Image may be blurry", description: "The sharpness score is below the audit threshold.", recommended_action: "Review or replace the source image.", action_type: "manual_review", confidence_score: 78 });
    }
    if (typeof item.brightness_score === "number" && item.brightness_score < 25) {
      issues.push({ ...common, issue_type: "over_dark", severity: main ? "medium" : "low", title: "Image may be too dark", description: "The brightness score is below the audit threshold.", recommended_action: "Review exposure and product visibility.", action_type: "manual_review", confidence_score: 74 });
    }
    if (typeof item.brightness_score === "number" && item.brightness_score > 90) {
      issues.push({ ...common, issue_type: "over_bright", severity: main ? "medium" : "low", title: "Image may be too bright", description: "The brightness score is above the audit threshold.", recommended_action: "Review exposure and highlight detail.", action_type: "manual_review", confidence_score: 74 });
    }
    if (typeof item.contrast_score === "number" && item.contrast_score < 20) {
      issues.push({ ...common, issue_type: "low_contrast", severity: main ? "medium" : "low", title: "Image may have low contrast", description: "The contrast score is below the audit threshold.", recommended_action: "Review product visibility against the background.", action_type: "manual_review", confidence_score: 74 });
    }
    if (typeof item.clutter_score === "number" && item.clutter_score > 70) {
      issues.push({ ...common, issue_type: "cluttered_background", severity: main ? "high" : "medium", title: "Background may be cluttered", description: "The clutter score suggests the product image background may distract from the product.", recommended_action: "Use a clean ecommerce background.", action_type: "preserve_background_replace", confidence_score: 78 });
    }

    if (hasKnownClutteredBackground(item.background_style)) {
      issues.push({ ...common, issue_type: "cluttered_background", severity: main ? "high" : "medium", title: "Cluttered background style", description: "The background style is marked as cluttered or busy.", recommended_action: "Replace with a clean product-focused background.", action_type: "preserve_background_replace", confidence_score: 86 });
    }
    if (hasKnownPromotionalOverlay(item)) {
      issues.push({ ...common, issue_type: "watermark_or_text_overlay", severity: main ? "high" : "medium", title: "Promotional text or watermark detected", description: "The image is marked as having promotional text, watermark, or overlay.", recommended_action: "Use a clean image without overlays for main product imagery.", action_type: "manual_review", confidence_score: 88 });
    }
    if (item.product_focused === false) {
      issues.push({ ...common, issue_type: "google_readiness_warning", severity: main ? "high" : "medium", title: "Product focus warning", description: "The image is marked as not clearly product-focused.", recommended_action: "Use a product-focused main image for shopping feeds.", action_type: "manual_review", confidence_score: 84 });
    }
    if (item.preserve_pixel_drift_warning === true) {
      issues.push({ ...common, issue_type: "preserve_pixel_drift_warning", severity: "high", title: "Product preservation warning", description: "The processing audit reported possible product pixel drift.", recommended_action: "Review this image before applying any processed result.", action_type: "manual_review", confidence_score: 90 });
    }
    if (item.low_foreground_confidence === true) {
      issues.push({ ...common, issue_type: "low_foreground_confidence", severity: "medium", title: "Low foreground confidence", description: "The processing audit reported low foreground confidence.", recommended_action: "Review the product cutout before approval.", action_type: "manual_review", confidence_score: 86 });
    }
    if (item.failed_integrity_check === true) {
      issues.push({ ...common, issue_type: "failed_integrity_check", severity: "critical", title: "Image failed integrity checks", description: "The image processing audit reported a failed integrity check.", recommended_action: "Do not apply this processed image without manual review.", action_type: "manual_review", confidence_score: 96 });
    }
    if (item.processing_failed === true) {
      issues.push({ ...common, issue_type: "processing_failed", severity: "critical", title: "Image processing failed", description: "A previous image processing attempt failed.", recommended_action: "Review the failure before retrying.", action_type: "manual_review", confidence_score: 94 });
    }
  }

  if (metrics?.google_shopping_readiness_score != null && metrics.google_shopping_readiness_score < 65) {
    const mainItems = items.filter((item) => imageRole(item) === "main");
    for (const item of mainItems.slice(0, 10)) {
      issues.push({
        item_id: item.id ?? imageKey(item),
        product_id: item.product_id,
        image_id: item.image_id ?? null,
        image_role: imageRole(item),
        category_names: item.category_names ?? [],
        issue_type: "google_readiness_warning",
        severity: "high",
        title: "Product feed readiness warning",
        description: "This main image should be reviewed as part of improving product feed readiness.",
        recommended_action: "Check dimensions, background cleanliness, overlays, file size, and product focus.",
        action_type: "manual_review",
        confidence_score: 70
      });
    }
  }

  return issues;
};

export const calculateAuditMetrics = (items: AuditScoringItem[]): AuditMetrics => {
  const seo = scoreSeo(items);
  const performance = scorePerformance(items);
  const completeness = scoreCompleteness(items);
  const consistency = scoreConsistency(items);
  const quality = scoreImageQuality(items);
  const google = scoreGoogleShoppingReadiness(items);
  const preliminary = {
    product_image_health_score: 0,
    seo_score: seo.score,
    image_quality_score: quality.score,
    catalogue_consistency_score: consistency.score,
    performance_score: performance.score,
    completeness_score: completeness.score,
    google_shopping_readiness_score: google.score
  } as AuditMetrics;
  const issues = generateIssues(items, preliminary);
  const roi = calculateRoiEstimate(issues, items);
  const duplicateKeys = duplicateFilenameKeys(items);
  const totalBytes = items.reduce((sum, item) => sum + toNumber(item.file_size_bytes), 0);
  const missingAlt = items.filter((item) => !item.alt_text?.trim()).length;
  const weakAlt = items.filter(isWeakAltText).length;
  const genericFilename = items.filter(isGenericFilename).length;
  const duplicateFilename = items.filter((item) => duplicateKeys.has(filenameKey(item))).length;
  const extensions = items.map(extensionFromItem);
  const assessedBackgrounds = items.filter((item) => Boolean(item.background_style?.trim()));

  const product_image_health_score = items.length === 0
    ? 0
    : clampScore(
      seo.score * 0.25 +
      quality.score * 0.25 +
      consistency.score * 0.2 +
      performance.score * 0.2 +
      completeness.score * 0.1
    );

  return {
    product_image_health_score,
    seo_score: seo.score,
    image_quality_score: quality.score,
    catalogue_consistency_score: consistency.score,
    performance_score: performance.score,
    completeness_score: completeness.score,
    google_shopping_readiness_score: google.score,
    missing_alt_text_count: missingAlt,
    weak_alt_text_count: weakAlt,
    generic_alt_text_count: weakAlt,
    alt_text_mentions_product_count: items.filter((item) => item.alt_text && usefulTokens(item.product_name).some((token) => item.alt_text?.toLowerCase().includes(token))).length,
    alt_text_mentions_category_count: items.filter((item) => item.alt_text && (item.category_names ?? []).some((category) => usefulTokens(category).some((token) => item.alt_text?.toLowerCase().includes(token)))).length,
    missing_image_title_count: items.filter((item) => !item.image_title?.trim()).length,
    generic_filename_count: genericFilename,
    duplicate_filename_count: duplicateFilename,
    seo_ready_images_count: Math.max(0, items.length - missingAlt - weakAlt - genericFilename),
    cluttered_background_count: issues.filter((issue) => issue.issue_type === "cluttered_background").length,
    low_contrast_count: issues.filter((issue) => issue.issue_type === "low_contrast").length,
    poor_centering_count: issues.filter((issue) => issue.issue_type === "poor_centering").length,
    product_too_small_count: issues.filter((issue) => issue.issue_type === "too_small_in_frame").length,
    product_too_large_or_cropped_count: issues.filter((issue) => issue.issue_type === "too_tightly_cropped").length,
    low_resolution_count: issues.filter((issue) => issue.issue_type === "low_resolution").length,
    likely_blurry_count: issues.filter((issue) => issue.issue_type === "likely_blurry").length,
    over_dark_count: issues.filter((issue) => issue.issue_type === "over_dark").length,
    over_bright_count: issues.filter((issue) => issue.issue_type === "over_bright").length,
    watermark_or_text_overlay_count: issues.filter((issue) => issue.issue_type === "watermark_or_text_overlay").length,
    clean_product_focus_count: items.filter((item) => item.product_focused !== false).length,
    inconsistent_background_count: Number(consistency.details.inconsistent_background_count ?? 0),
    inconsistent_aspect_ratio_count: issues.filter((issue) => issue.issue_type === "inconsistent_aspect_ratio").length,
    inconsistent_product_scale_count: issues.filter((issue) => issue.issue_type === "inconsistent_product_scale").length,
    inconsistent_padding_count: issues.filter((issue) => issue.issue_type === "inconsistent_padding").length,
    inconsistent_lighting_count: 0,
    dominant_aspect_ratio: consistency.details.dominant_aspect_ratio as string | null,
    dominant_background_style: consistency.details.dominant_background_style as string | null,
    total_original_bytes: totalBytes,
    total_original_mb: Number((totalBytes / 1024 / 1024).toFixed(2)),
    average_image_bytes: items.length ? Math.round(totalBytes / items.length) : 0,
    largest_image_bytes: Math.max(0, ...items.map((item) => toNumber(item.file_size_bytes))),
    oversized_image_count: issues.filter((issue) => issue.issue_type === "oversized_file").length,
    huge_dimension_image_count: issues.filter((issue) => issue.issue_type === "huge_dimensions").length,
    missing_webp_count: extensions.filter((extension) => imageExtensions.has(extension) && !modernExtensions.has(extension)).length,
    estimated_optimised_bytes: Math.round(totalBytes * 0.68),
    estimated_optimised_mb: Number(((totalBytes * 0.68) / 1024 / 1024).toFixed(2)),
    estimated_reduction_percent_low: 18,
    estimated_reduction_percent_high: 45,
    google_ready_images_count: Number(google.details.google_ready_images_count ?? 0),
    google_warning_images_count: Number(google.details.google_warning_images_count ?? 0),
    images_with_promotional_overlay_count: items.filter(hasKnownPromotionalOverlay).length,
    images_with_non_product_focused_main_image_count: items.filter((item) => imageRole(item) === "main" && item.product_focused === false).length,
    images_with_light_background_count: assessedBackgrounds.filter((item) => hasKnownLightBackground(item.background_style)).length,
    images_with_clean_background_count: assessedBackgrounds.filter((item) => hasKnownCleanBackground(item.background_style)).length,
    images_processed: 0,
    images_approved: 0,
    images_rejected: 0,
    images_failed: items.filter((item) => item.processing_failed === true).length,
    average_processing_time_ms: 0,
    preserve_mode_count: 0,
    flexible_mode_count: 0,
    product_pixel_drift_warning_count: items.filter((item) => item.preserve_pixel_drift_warning === true).length,
    low_foreground_confidence_count: items.filter((item) => item.low_foreground_confidence === true).length,
    failed_integrity_check_count: items.filter((item) => item.failed_integrity_check === true).length,
    credits_used: 0,
    failed_safety_checks_not_charged: items.filter((item) => item.failed_integrity_check === true || item.processing_failed === true).length,
    ...roi,
    assessed_visual_metrics: {
      background_style: assessedBackgrounds.length > 0,
      product_area_ratio: items.some((item) => typeof item.product_area_ratio === "number"),
      product_bbox: items.some((item) => item.detected_product_bbox != null),
      brightness: items.some((item) => typeof item.brightness_score === "number"),
      contrast: items.some((item) => typeof item.contrast_score === "number"),
      sharpness: items.some((item) => typeof item.sharpness_score === "number"),
      clutter: items.some((item) => typeof item.clutter_score === "number")
    }
  };
};

export const generateCategoryScores = (
  items: AuditScoringItem[],
  issues: AuditIssue[]
): AuditCategoryScore[] => {
  const categories = new Map<string, { categoryId: string | null; categoryName: string; items: AuditScoringItem[] }>();

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

  return [...categories.values()].map((category) => {
    const itemIds = new Set(category.items.map(imageKey));
    const categoryIssues = issues.filter((issue) => issue.item_id && itemIds.has(issue.item_id));
    const metrics = calculateAuditMetrics(category.items);
    const top_issue_type = dominant(categoryIssues.map((issue) => issue.issue_type)) as AuditIssueType | null;
    const critical = categoryIssues.filter((issue) => issue.severity === "critical").length;
    const high = categoryIssues.filter((issue) => issue.severity === "high").length;
    const medium = categoryIssues.filter((issue) => issue.severity === "medium").length;
    const low = categoryIssues.filter((issue) => issue.severity === "low").length;

    const priority: Exclude<AuditSeverity, "info"> = critical > 0 ? "critical" : high > 0 ? "high" : medium > 0 ? "medium" : "low";

    return {
      category_id: category.categoryId,
      category_name: category.categoryName,
      products_scanned: productGroups(category.items).size,
      images_scanned: category.items.length,
      health_score: metrics.product_image_health_score,
      seo_score: metrics.seo_score,
      quality_score: metrics.image_quality_score,
      consistency_score: metrics.catalogue_consistency_score,
      performance_score: metrics.performance_score,
      priority,
      issue_count: categoryIssues.length,
      critical_issue_count: critical,
      high_issue_count: high,
      medium_issue_count: medium,
      low_issue_count: low,
      top_issue_type,
      recommendation: top_issue_type ? "Prioritise the most common image issue in this category." : "Maintain current image standards."
    };
  }).sort((a, b) => b.issue_count - a.issue_count);
};

export const generateInsights = (
  metrics: AuditMetrics,
  issues: AuditIssue[],
  categoryScores: AuditCategoryScore[]
): AuditInsight[] => {
  const insights: AuditInsight[] = [];
  let order = 1;
  const add = (insight: Omit<AuditInsight, "display_order">) => insights.push({ ...insight, display_order: order++ });

  if (metrics.seo_score < 85 || metrics.missing_alt_text_count > 0 || metrics.weak_alt_text_count > 0) {
    add({
      insight_type: "seo",
      severity: metrics.seo_score < 60 ? "high" : "medium",
      title: "Image SEO can be improved",
      body: `${metrics.missing_alt_text_count} images are missing alt text and ${metrics.weak_alt_text_count} images have weak or generic alt text.`,
      metric_key: "seo_score",
      metric_value: metrics.seo_score,
      suggested_action: "Start with missing alt text on main product images.",
      action_type: "fix_alt_text",
      action_filter: { issue_type: ["missing_alt_text", "weak_alt_text"] }
    });
  }

  if (metrics.image_quality_score < 85) {
    add({
      insight_type: "quality",
      severity: metrics.image_quality_score < 65 ? "high" : "medium",
      title: "Some product images need quality review",
      body: "The quality estimate is based only on available deterministic metadata and measured visual scores. Unmeasured visual factors are marked not assessed.",
      metric_key: "image_quality_score",
      metric_value: metrics.image_quality_score,
      suggested_action: "Review low-resolution, blurry, dark, bright, or poorly framed images first.",
      action_type: "manual_review"
    });
  }

  if (metrics.catalogue_consistency_score < 85) {
    add({
      insight_type: "consistency",
      severity: metrics.catalogue_consistency_score < 65 ? "high" : "medium",
      title: "Main image presentation is inconsistent",
      body: metrics.dominant_aspect_ratio
        ? `The dominant main image ratio is ${metrics.dominant_aspect_ratio}, but some main images use a different ratio.`
        : "Main image aspect ratio consistency could not be confidently established.",
      metric_key: "catalogue_consistency_score",
      metric_value: metrics.catalogue_consistency_score,
      suggested_action: "Standardise main product image canvas ratios before bulk presentation work.",
      action_type: "manual_review",
      action_filter: { issue_type: "inconsistent_aspect_ratio" }
    });
  }

  if (metrics.performance_score < 85 || metrics.oversized_image_count > 0 || metrics.missing_webp_count > 0) {
    add({
      insight_type: "performance",
      severity: metrics.performance_score < 65 ? "high" : "medium",
      title: "Image performance has optimisation opportunities",
      body: `${metrics.oversized_image_count} images are oversized and ${metrics.missing_webp_count} images are modern-format opportunities.`,
      metric_key: "performance_score",
      metric_value: metrics.performance_score,
      suggested_action: "Optimise large files and serve modern image formats where possible.",
      action_type: "compress_image"
    });
  }

  if (metrics.completeness_score < 90) {
    add({
      insight_type: "completeness",
      severity: metrics.completeness_score < 70 ? "high" : "medium",
      title: "Some products need more complete imagery",
      body: "Products without a main image or with only one image can reduce shopper confidence.",
      metric_key: "completeness_score",
      metric_value: metrics.completeness_score,
      suggested_action: "Review products missing main images and products with a single image.",
      action_type: "manual_review"
    });
  }

  if (metrics.estimated_manual_minutes_high > 0) {
    add({
      insight_type: "roi",
      severity: "info",
      title: "Manual image work has measurable time cost",
      body: `The detected issues represent an estimated ${metrics.estimated_manual_minutes_low}-${metrics.estimated_manual_minutes_high} minutes of manual review or cleanup work.`,
      metric_key: "estimated_cost_saved_high",
      metric_value: metrics.estimated_cost_saved_high,
      suggested_action: "Use recommendations to prioritise the highest-impact fixes first.",
      action_type: "manual_review"
    });
  }

  const priorityCategory = categoryScores.find((category) => category.priority === "critical" || category.priority === "high");
  if (priorityCategory) {
    add({
      insight_type: "category",
      severity: priorityCategory.priority === "critical" ? "high" : "medium",
      title: `${priorityCategory.category_name} needs attention`,
      body: `This category has ${priorityCategory.issue_count} detected image issues and should be reviewed early.`,
      metric_key: "category_issue_count",
      metric_value: priorityCategory.issue_count,
      suggested_action: priorityCategory.recommendation ?? "Review this category's product images.",
      action_type: "manual_review",
      action_filter: { category: priorityCategory.category_name }
    });
  }

  const criticalOrHigh = issues.filter((issue) => issue.severity === "critical" || issue.severity === "high").length;
  if (criticalOrHigh > 0) {
    add({
      insight_type: "priority",
      severity: criticalOrHigh > 10 ? "high" : "medium",
      title: "Prioritise main product image issues",
      body: `${criticalOrHigh} critical or high severity issues were found. These are the safest first targets for product-image cleanup.`,
      metric_key: "high_priority_issue_count",
      metric_value: criticalOrHigh,
      suggested_action: "Review high-priority main product images before lower-risk gallery metadata work.",
      action_type: "manual_review"
    });
  }

  if (insights.length === 0) {
    add({
      insight_type: "priority",
      severity: "info",
      title: "Catalogue image health looks strong",
      body: "No major deterministic image health problems were detected in this scan.",
      metric_key: "product_image_health_score",
      metric_value: metrics.product_image_health_score,
      suggested_action: "Keep using the same image standards for new products.",
      action_type: "manual_review"
    });
  }

  return insights;
};

export const generateRecommendations = (
  metrics: AuditMetrics,
  issues: AuditIssue[],
  categoryScores: AuditCategoryScore[]
): AuditRecommendation[] => {
  const recommendations: AuditRecommendation[] = [];
  let order = 1;
  const affected = (types: AuditIssueType[]): number => new Set(
    issues.filter((issue) => types.includes(issue.issue_type)).map((issue) => issue.item_id ?? issue.product_id)
  ).size;
  const add = (recommendation: Omit<AuditRecommendation, "display_order">) => recommendations.push({ ...recommendation, display_order: order++ });

  if (affected(["missing_alt_text", "weak_alt_text"]) > 0) {
    add({
      title: "Fix missing alt text",
      description: "Improve accessibility and product image SEO by adding specific alt text to missing or weak entries.",
      priority: metrics.missing_alt_text_count > 10 ? "high" : "medium",
      action_type: "fix_alt_text",
      estimated_images_affected: affected(["missing_alt_text", "weak_alt_text"]),
      estimated_minutes_saved_low: Math.round(affected(["missing_alt_text", "weak_alt_text"]) * 0.75),
      estimated_minutes_saved_high: Math.round(affected(["missing_alt_text", "weak_alt_text"]) * 1.5),
      action_filter: { issue_type: ["missing_alt_text", "weak_alt_text"] }
    });
  }

  if (affected(["oversized_file", "huge_dimensions", "missing_webp"]) > 0) {
    add({
      title: "Optimise oversized images",
      description: "Reduce image weight and modernise formats to improve product browsing performance.",
      priority: metrics.performance_score < 70 ? "high" : "medium",
      action_type: "compress_image",
      estimated_images_affected: affected(["oversized_file", "huge_dimensions", "missing_webp"]),
      estimated_minutes_saved_low: affected(["oversized_file", "huge_dimensions", "missing_webp"]),
      estimated_minutes_saved_high: affected(["oversized_file", "huge_dimensions", "missing_webp"]) * 2,
      action_filter: { issue_type: ["oversized_file", "huge_dimensions", "missing_webp"] }
    });
  }

  if (affected(["inconsistent_aspect_ratio"]) > 0) {
    add({
      title: "Standardise main image aspect ratios",
      description: "Make product grids look more polished by reviewing main images that do not match the dominant catalogue ratio.",
      priority: "high",
      action_type: "manual_review",
      estimated_images_affected: affected(["inconsistent_aspect_ratio"]),
      estimated_minutes_saved_low: affected(["inconsistent_aspect_ratio"]) * 2,
      estimated_minutes_saved_high: affected(["inconsistent_aspect_ratio"]) * 4,
      action_filter: { issue_type: "inconsistent_aspect_ratio" }
    });
  }

  const brandStyleIssueTypes: AuditIssueType[] = [
    "inconsistent_background",
    "cluttered_background",
    "inconsistent_aspect_ratio",
    "inconsistent_product_scale",
    "inconsistent_padding",
    "poor_centering",
    "too_small_in_frame",
    "too_tightly_cropped"
  ];
  const brandStyleAffected = affected(brandStyleIssueTypes);
  if (brandStyleAffected > 0 || metrics.catalogue_consistency_score < 85) {
    add({
      title: "Standardise images to your selected brand style",
      description: "Use a consistent background, aspect ratio, padding and shadow preset for product families. This is based on deterministic consistency signals where available.",
      priority: metrics.catalogue_consistency_score < 65 ? "high" : "medium",
      action_type: "standard_background_replace",
      estimated_images_affected: brandStyleAffected,
      estimated_minutes_saved_low: brandStyleAffected * 2,
      estimated_minutes_saved_high: brandStyleAffected * 4,
      action_filter: { issue_type: brandStyleIssueTypes }
    });
  }

  if (affected(["missing_main_image"]) > 0) {
    add({
      title: "Review products missing main images",
      description: "Products without main images are a critical catalogue presentation issue.",
      priority: "critical",
      action_type: "replace_main_image",
      estimated_images_affected: affected(["missing_main_image"]),
      estimated_minutes_saved_low: affected(["missing_main_image"]),
      estimated_minutes_saved_high: affected(["missing_main_image"]) * 2,
      action_filter: { issue_type: "missing_main_image" }
    });
  }

  if (metrics.google_shopping_readiness_score < 85) {
    add({
      title: "Improve product feed readiness",
      description: "Review main images with readiness warnings. This is an estimate, not a guarantee of marketplace compliance.",
      priority: metrics.google_shopping_readiness_score < 60 ? "high" : "medium",
      action_type: "manual_review",
      estimated_images_affected: metrics.google_warning_images_count,
      estimated_minutes_saved_low: metrics.google_warning_images_count,
      estimated_minutes_saved_high: metrics.google_warning_images_count * 2,
      action_filter: { issue_type: "google_readiness_warning" }
    });
  }

  const highPriorityMain = issues.filter((issue) => issue.image_role === "main" && (issue.severity === "critical" || issue.severity === "high")).length;
  if (highPriorityMain > 0) {
    add({
      title: "Review highest-priority main product images",
      description: "Start with critical and high-severity issues on main product images before lower-risk gallery work.",
      priority: "high",
      action_type: "manual_review",
      estimated_images_affected: highPriorityMain,
      estimated_minutes_saved_low: highPriorityMain,
      estimated_minutes_saved_high: highPriorityMain * 2,
      action_filter: { image_role: "main", severity: ["critical", "high"] }
    });
  }

  const priorityCategory = categoryScores.find((category) => category.priority === "critical" || category.priority === "high");
  if (priorityCategory) {
    add({
      title: `Prioritise ${priorityCategory.category_name}`,
      description: "This category has one of the strongest combinations of issue count and severity.",
      priority: priorityCategory.priority,
      action_type: "manual_review",
      estimated_images_affected: priorityCategory.images_scanned,
      estimated_minutes_saved_low: Math.min(priorityCategory.issue_count, priorityCategory.images_scanned),
      estimated_minutes_saved_high: Math.min(priorityCategory.issue_count * 2, priorityCategory.images_scanned * 4),
      action_filter: { category: priorityCategory.category_name }
    });
  }

  if (recommendations.length === 0) {
    add({
      title: "Maintain current image standards",
      description: "The deterministic audit did not find a high-priority improvement batch.",
      priority: "low",
      action_type: "manual_review",
      estimated_images_affected: 0,
      estimated_minutes_saved_low: 0,
      estimated_minutes_saved_high: 0
    });
  }

  return recommendations;
};

const severityWeight = (severity?: string | null): number => {
  if (severity === "critical") return 100;
  if (severity === "high") return 72;
  if (severity === "medium") return 36;
  if (severity === "low") return 14;
  return 4;
};

const issueWeight = (issueType: AuditIssueType): number => {
  const weights: Partial<Record<AuditIssueType, number>> = {
    missing_main_image: 80,
    failed_integrity_check: 72,
    processing_failed: 62,
    missing_alt_text: 48,
    google_readiness_warning: 46,
    oversized_file: 42,
    huge_dimensions: 40,
    inconsistent_aspect_ratio: 38,
    too_tightly_cropped: 36,
    too_small_in_frame: 34,
    weak_alt_text: 30,
    generic_filename: 24,
    duplicate_filename: 20,
    missing_webp: 22,
    cluttered_background: 34,
    inconsistent_background: 30,
    watermark_or_text_overlay: 44,
    poor_centering: 26,
    inconsistent_product_scale: 26,
    inconsistent_padding: 22,
    low_resolution: 34,
    likely_blurry: 32,
    low_contrast: 22,
    over_dark: 20,
    over_bright: 20,
    preserve_pixel_drift_warning: 58,
    low_foreground_confidence: 34,
    product_has_single_image: 18
  };
  return weights[issueType] ?? 12;
};

const issueLabel = (issueType: AuditIssueType): string => issueType.replaceAll("_", " ");

const severityRank = (severity: AuditSeverity): number => {
  if (severity === "critical") return 1;
  if (severity === "high") return 2;
  if (severity === "medium") return 3;
  if (severity === "low") return 4;
  return 5;
};

const categoryPriorityWeight = (
  item: AuditScoringItem,
  categoryScores: AuditCategoryScore[]
): number => {
  const names = new Set((item.category_names ?? []).map((name) => name.toLowerCase()));
  const matched = categoryScores.filter((category) => names.has(category.category_name.toLowerCase()));
  if (!matched.length) return 0;
  return Math.max(...matched.map((category) => {
    const priority = category.priority === "critical" ? 34 : category.priority === "high" ? 24 : category.priority === "medium" ? 12 : 4;
    const weakScoreBoost = Math.max(0, 75 - category.health_score) * 0.4;
    return priority + weakScoreBoost;
  }));
};

const categoryReason = (
  item: AuditScoringItem,
  categoryScores: AuditCategoryScore[]
): string | null => {
  const names = new Set((item.category_names ?? []).map((name) => name.toLowerCase()));
  const matched = categoryScores
    .filter((category) => names.has(category.category_name.toLowerCase()))
    .sort((a, b) => {
      if (severityRank(a.priority) !== severityRank(b.priority)) return severityRank(a.priority) - severityRank(b.priority);
      return a.health_score - b.health_score;
    })[0];
  return matched && (matched.priority === "critical" || matched.priority === "high" || matched.health_score < 70)
    ? `Part of weak category: ${matched.category_name}`
    : null;
};

const issueTypesFromRecommendation = (recommendation: AuditRecommendation): AuditIssueType[] => {
  const raw = recommendation.action_filter?.issue_type;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.filter((value): value is AuditIssueType => typeof value === "string");
};

const impactFromIssues = (issues: AuditIssue[]): string => {
  const types = new Set(issues.map((issue) => issue.issue_type));
  if (types.has("missing_main_image")) return "Critical presentation fix";
  if (types.has("missing_alt_text") || types.has("weak_alt_text")) return "Estimated SEO score lift";
  if (types.has("oversized_file") || types.has("huge_dimensions") || types.has("missing_webp")) return "Estimated performance lift";
  if (types.has("inconsistent_aspect_ratio") || types.has("poor_centering") || types.has("too_small_in_frame") || types.has("too_tightly_cropped")) return "Estimated consistency and presentation lift";
  if (types.has("google_readiness_warning") || types.has("watermark_or_text_overlay")) return "Product-feed readiness review";
  if (types.has("cluttered_background") || types.has("inconsistent_background")) return "Cleaner catalogue presentation";
  return "Manual review priority";
};

export const rankRecommendedFirstImages = (
  items: AuditScoringItem[],
  issues: AuditIssue[],
  categoryScores: AuditCategoryScore[] = [],
  limit = 50
): RecommendedFirstImage[] => {
  const issueByItem = new Map<string, AuditIssue[]>();
  const issueByProduct = new Map<string, AuditIssue[]>();
  for (const issue of issues) {
    if (issue.item_id) {
      issueByItem.set(issue.item_id, [...(issueByItem.get(issue.item_id) ?? []), issue]);
    }
    if (issue.product_id) {
      issueByProduct.set(issue.product_id, [...(issueByProduct.get(issue.product_id) ?? []), issue]);
    }
  }

  const ranked = items
    .map<RecommendedFirstImage | null>((item) => {
      const id = imageKey(item);
      const matchedIssues = [
        ...(issueByItem.get(item.id ?? id) ?? []),
        ...(issueByProduct.get(item.product_id) ?? []).filter((issue) => !issue.item_id)
      ];
      const uniqueIssueKeys = new Set<string>();
      const itemIssues = matchedIssues.filter((issue) => {
        const key = `${issue.item_id ?? "product"}:${issue.issue_type}:${issue.severity}`;
        if (uniqueIssueKeys.has(key)) return false;
        uniqueIssueKeys.add(key);
        return true;
      });
      if (!itemIssues.length) return null;

      const role = imageRole(item);
      const roleScore = role === "main" ? 120 : role === "variation" ? 76 : role === "gallery" ? 48 : role === "category" || role === "thumbnail" ? 36 : 24;
      const highestSeverity = itemIssues
        .map((issue) => issue.severity)
        .sort((a, b) => severityRank(a) - severityRank(b))[0] ?? "info";
      const issueScore = itemIssues.reduce((sum, issue) => sum + issueWeight(issue.issue_type) + severityWeight(issue.severity) * 0.25, 0);
      const weakCategoryScore = categoryPriorityWeight(item, categoryScores);
      const salesScore = Math.min(50, toNumber(item.product_sales_count) * 1.5);
      const revenueScore = Math.min(60, toNumber(item.product_revenue) / 100);
      const priceScore = Math.min(28, toNumber(item.product_price) / 10);
      const activeScore = item.product_status && ["publish", "active"].includes(item.product_status.toLowerCase()) ? 14 : 0;
      const stockScore = item.stock_status && ["instock", "in_stock", "in stock"].includes(item.stock_status.toLowerCase()) ? 14 : 0;
      const updatedAt = item.product_updated_at ? new Date(item.product_updated_at).getTime() : 0;
      const recentScore = updatedAt && Number.isFinite(updatedAt) && Date.now() - updatedAt < 1000 * 60 * 60 * 24 * 90 ? 10 : 0;
      const priorityScore = Math.round(roleScore + issueScore + weakCategoryScore + salesScore + revenueScore + priceScore + activeScore + stockScore + recentScore);
      const reasons = [
        role === "main" ? "Main product image" : role === "variation" ? "Variation image" : role === "gallery" ? "Gallery image" : "Product image",
        `${highestSeverity} severity issue`,
        ...[...new Set(itemIssues.map((issue) => issue.issue_type))].slice(0, 4).map((type) => issueLabel(type)),
        categoryReason(item, categoryScores),
        salesScore > 0 || revenueScore > 0 ? "Sales or revenue signal available" : null,
        priceScore > 0 ? "Higher priced product signal" : null,
        stockScore > 0 ? "In-stock product" : null,
        recentScore > 0 ? "Recently updated product" : null
      ].filter((reason): reason is string => Boolean(reason));

      return {
        item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_url: item.product_url,
        image_id: item.image_id ?? null,
        image_url: item.image_url ?? null,
        image_role: role,
        category_names: item.category_names ?? [],
        issue_count: itemIssues.length,
        issue_ids: itemIssues.map((issue) => issue.metadata?.issue_id).filter((id): id is string => typeof id === "string"),
        highest_severity: highestSeverity,
        priority_score: priorityScore,
        reasons,
        estimated_impact: impactFromIssues(itemIssues),
        recommended_action: itemIssues[0]?.recommended_action ?? null,
        selection_rank: 0
      } satisfies RecommendedFirstImage;
    })
    .filter((item): item is RecommendedFirstImage => Boolean(item))
    .sort((a, b) => {
      if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
      if (severityRank(a.highest_severity) !== severityRank(b.highest_severity)) return severityRank(a.highest_severity) - severityRank(b.highest_severity);
      return b.issue_count - a.issue_count;
    })
    .slice(0, Math.max(1, limit))
    .map((item, index) => ({ ...item, selection_rank: index + 1 }));

  return ranked;
};

const issueSetFromRecommendations = (recommendations: AuditRecommendation[]): Set<AuditIssueType> => {
  const issueTypes = new Set<AuditIssueType>();
  for (const recommendation of recommendations) {
    for (const type of issueTypesFromRecommendation(recommendation)) {
      issueTypes.add(type);
    }
  }
  if (!issueTypes.size) {
    [
      "missing_alt_text",
      "weak_alt_text",
      "generic_filename",
      "duplicate_filename",
      "oversized_file",
      "huge_dimensions",
      "missing_webp",
      "inconsistent_aspect_ratio",
      "inconsistent_background",
      "too_small_in_frame",
      "too_tightly_cropped",
      "poor_centering",
      "google_readiness_warning",
      "watermark_or_text_overlay",
      "missing_main_image"
    ].forEach((type) => issueTypes.add(type as AuditIssueType));
  }
  return issueTypes;
};

const scoreImpactForTypes = (
  issues: AuditIssue[],
  issueTypes: Set<AuditIssueType>
): Partial<Record<ForecastScoreKey, number>> => {
  const count = (types: AuditIssueType[]): number => issues.filter((issue) => issueTypes.has(issue.issue_type) && types.includes(issue.issue_type)).length;
  return {
    seo_score: Math.min(36, count(["missing_alt_text", "weak_alt_text"]) * 3 + count(["generic_filename", "duplicate_filename"]) * 1.2),
    performance_score: Math.min(30, count(["oversized_file", "huge_dimensions", "missing_webp"]) * 2.2),
    catalogue_consistency_score: Math.min(28, count(["inconsistent_aspect_ratio", "inconsistent_background", "inconsistent_product_scale", "inconsistent_padding", "poor_centering"]) * 2.4),
    image_quality_score: Math.min(22, count(["cluttered_background", "low_resolution", "likely_blurry", "low_contrast", "over_dark", "over_bright", "too_small_in_frame", "too_tightly_cropped"]) * 1.8),
    completeness_score: Math.min(18, count(["missing_main_image", "product_has_single_image"]) * 4),
    google_shopping_readiness_score: Math.min(28, count(["google_readiness_warning", "watermark_or_text_overlay", "too_tightly_cropped", "low_resolution"]) * 2.5)
  };
};

export const calculateFixImpactForecast = (
  metrics: AuditMetrics,
  issues: AuditIssue[],
  recommendations: AuditRecommendation[] = []
): FixImpactForecast => {
  const selectedIssueTypes = issueSetFromRecommendations(recommendations);
  const selectedIssues = issues.filter((issue) => selectedIssueTypes.has(issue.issue_type));
  const impact = scoreImpactForTypes(issues, selectedIssueTypes);
  const estimated = {
    seo_score: clampScore(metrics.seo_score + (impact.seo_score ?? 0)),
    image_quality_score: clampScore(metrics.image_quality_score + (impact.image_quality_score ?? 0)),
    catalogue_consistency_score: clampScore(metrics.catalogue_consistency_score + (impact.catalogue_consistency_score ?? 0)),
    performance_score: clampScore(metrics.performance_score + (impact.performance_score ?? 0)),
    completeness_score: clampScore(metrics.completeness_score + (impact.completeness_score ?? 0)),
    google_shopping_readiness_score: clampScore(metrics.google_shopping_readiness_score + (impact.google_shopping_readiness_score ?? 0)),
    product_image_health_score: 0
  };
  estimated.product_image_health_score = clampScore(
    estimated.seo_score * 0.25 +
    estimated.image_quality_score * 0.25 +
    estimated.catalogue_consistency_score * 0.2 +
    estimated.performance_score * 0.2 +
    estimated.completeness_score * 0.1
  );
  const baseline = {
    product_image_health_score: metrics.product_image_health_score,
    seo_score: metrics.seo_score,
    image_quality_score: metrics.image_quality_score,
    catalogue_consistency_score: metrics.catalogue_consistency_score,
    performance_score: metrics.performance_score,
    completeness_score: metrics.completeness_score,
    google_shopping_readiness_score: metrics.google_shopping_readiness_score
  };
  const roi = calculateRoiEstimate(selectedIssues, []);
  const recommendation_impacts = recommendations.map((recommendation) => {
    const issueTypes = issueTypesFromRecommendation(recommendation);
    return {
      title: recommendation.title,
      action_type: recommendation.action_type,
      priority: recommendation.priority,
      estimated_images_affected: recommendation.estimated_images_affected,
      issue_types: issueTypes,
      score_impacts: scoreImpactForTypes(issues, new Set(issueTypes))
    };
  });

  return {
    baseline,
    estimated,
    deltas: {
      product_image_health_score: clampScore(estimated.product_image_health_score - baseline.product_image_health_score),
      seo_score: clampScore(estimated.seo_score - baseline.seo_score),
      image_quality_score: clampScore(estimated.image_quality_score - baseline.image_quality_score),
      catalogue_consistency_score: clampScore(estimated.catalogue_consistency_score - baseline.catalogue_consistency_score),
      performance_score: clampScore(estimated.performance_score - baseline.performance_score),
      completeness_score: clampScore(estimated.completeness_score - baseline.completeness_score),
      google_shopping_readiness_score: clampScore(estimated.google_shopping_readiness_score - baseline.google_shopping_readiness_score)
    },
    estimated_manual_minutes_low: roi.estimated_manual_minutes_low,
    estimated_manual_minutes_high: roi.estimated_manual_minutes_high,
    estimated_manual_hours_low: Number((roi.estimated_manual_minutes_low / 60).toFixed(1)),
    estimated_manual_hours_high: Number((roi.estimated_manual_minutes_high / 60).toFixed(1)),
    selected_issue_types: [...selectedIssueTypes],
    assumptions: [
      "Estimated score lift is conservative and based on issue types that selected recommendations are expected to resolve.",
      "This forecast does not promise SEO ranking improvement, conversion lift, or product-feed approval.",
      "Sales, revenue, price, stock and recency are used only when WooCommerce data is available; otherwise ranking falls back to severity, image role and category priority."
    ],
    recommendation_impacts
  };
};
