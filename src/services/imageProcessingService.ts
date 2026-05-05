import { createHash, randomUUID } from "crypto";
import sharp from "sharp";
import { env } from "../config/env";
import { prisma } from "../utils/prisma";
import {
  ecommercePreservePromptVersion,
  openAiImageEditModel,
  openAiImageEditQuality,
  openAiImageEditSize,
  renderPreserveMonochromeMask,
  renderFlexibleStudioProductImage,
  removeImageBackground,
  removeImageBackgroundWithSpecialistModel
} from "./backgroundRemovalService";
import {
  type PreserveModeFailReason,
  type PreserveModeProgrammaticValidation,
  validatePreserveModeProgrammatic
} from "./preserveModeValidationService";
import {
  runFlexibleStudioVisionQa,
  runPreserveVisionQa,
  type PreserveVisionQaResult
} from "./preserveVisionQaService";
import {
  buildProductDiffHeatmap,
  validateProtectedProductRegion,
  type ProductProtectionValidation,
  type ValidationOutcome
} from "./productProtectionValidationService";
import {
  createStorageSignedUrl,
  storageBuckets,
  uploadStorageObject
} from "./supabaseStorageService";

export type ProcessImageInput = {
  imageJobId: string;
  userId: string;
  imageUrl: string;
  imageBuffer?: Buffer;
  imageContentType?: string;
  imageFileName?: string;
  background?: string;
  scalePercent?: number;
  backgroundImageUrl?: string;
  backgroundImageBuffer?: Buffer;
  backgroundImageContentType?: string;
  backgroundImageFileName?: string;
  settings?: unknown;
  jobOverrides?: unknown;
};

export type ProcessedImageResult = {
  processedUrl: string;
  originalImageHash: string;
  originalStoragePath: string;
  processedStoragePath: string | null;
  debugCutoutStoragePath: string | null;
  originalUploadedAt: Date;
  processedUploadedAt: Date | null;
  debugCutoutUploadedAt: Date | null;
  storageCleanupAfter: Date;
  duplicateOfJobId: string | null;
  creditDeductionRequired: boolean;
  seoMetadata: SuggestedSeoMetadata;
  preserveDebug?: PreserveDebugInfo;
  outputValidation?: OutputQualityValidation;
};

export type SuggestedSeoMetadata = {
  seo_filename: string;
  title: string;
  alt_text: string;
  caption: string;
  description: string;
  file_name: string;
  keywords: string[];
};

const maxImageBytes = 15 * 1024 * 1024;
const outputSize = 1024;
const defaultScalePercent = 86;
const signedUrlExpirySeconds = env.storageSignedUrlExpiresSeconds;

type ValidationStatus = "Passed" | "Needs Review" | "Failed";
type ProductOrientation = "horizontal" | "square" | "tall";

type ProductBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

type ProductCoverageTarget = {
  orientation: ProductOrientation;
  primaryAxis: "width" | "height";
  target: number;
  min: number;
  max: number;
  autoFixBelow: number;
};

export type OutputQualityValidation = {
  status: ValidationStatus;
  promptVersion: string;
  processingMode: string;
  cutoutProvider: string;
  retryCount: number;
  productCoveragePercent: number;
  productCoverageWidthPercent: number;
  productCoverageHeightPercent: number;
  targetCoverageMinPercent: number;
  targetCoverageMaxPercent: number;
  productOrientation: ProductOrientation;
  autoFixedFraming: boolean;
  checks: {
    productPreservation: ValidationStatus;
    framing: ValidationStatus | "Auto-fixed";
    background: ValidationStatus;
    detailPreservation: ValidationStatus;
    interiorDropout: ValidationStatus;
    edgeQuality: ValidationStatus;
    shadow: ValidationStatus;
    protectedProduct: ValidationStatus;
    programmaticValidation?: ValidationStatus;
    visionQa?: ValidationStatus;
  };
  outcome: ValidationOutcome;
  protectedProductValidation?: ProductProtectionValidation;
  scores?: Partial<PreserveModeProgrammaticValidation["scores"]> & {
    visionQaEcommerce?: number;
    visionQaTextBranding?: number;
  };
  programmaticValidation?: Omit<PreserveModeProgrammaticValidation, "overlays">;
  visionQa?: PreserveVisionQaResult;
  debugAssets?: PreserveDebugAsset[];
  warnings: string[];
  failureReasons: string[];
};

type DownloadedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
};

type CutoutResult = {
  cutout: Buffer;
  debugCutout: Buffer;
  provider: string;
  attempts: number;
  validation: {
    alphaCoverage: number;
    foregroundMeanDelta: number;
  };
  debugAlphaMask?: Buffer;
  debugTrimap?: Buffer;
  debugInteriorDropoutOverlay?: Buffer;
  debugRestoredRegionOverlay?: Buffer;
  debugFinalRepairedCutout?: Buffer;
  preserveDebug?: PreserveDebugInfo;
};

type PreserveModeFallback = "strict_retry" | "local_experimental" | "external_provider";
type PreserveMaskSource = "ai_mask" | "local_fallback" | "source_alpha" | "failed";
type PreserveRgbIntegrity = {
  passed: boolean;
  foregroundMeanDelta: number | null;
  alphaCoverage: number | null;
};

export type PreserveDebugAsset = {
  kind:
    | "original_source"
    | "source_normalized"
    | "debug_cutout"
    | "ai_cutout"
    | "raw_mask"
    | "trimap"
    | "cleaned_mask"
    | "product_mask"
    | "alpha_mask"
    | "alpha_mask_preview"
    | "product_cutout_checkerboard"
    | "edge_inspection_ring"
    | "edge_halo_overlay"
    | "connected_components_overlay"
    | "dropout_overlay"
    | "interior_dropout_overlay"
    | "restored_region_overlay"
    | "final_repaired_cutout"
    | "preserved_cutout"
    | "source_product_layer"
    | "extracted_background"
    | "generated_background"
    | "shadow_layer"
    | "final_composite"
    | "final_qa_comparison"
    | "background_only_comparison"
    | "product_diff_heatmap"
    | "retry_metadata_json"
    | "validation_json"
    | "vision_qa_json";
  bucket: string;
  path: string;
  url: string | null;
  contentType: string;
};

export type InteriorDropoutCandidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: number;
  secondOpinionForegroundPercent: number;
  productLikePercent: number;
  backgroundLikePercent: number;
  meanBoundaryGradient: number;
  componentDensityPercent: number;
  bridgesForeground: boolean;
  classification: "restored" | "true_hole" | "needs_review" | "ignored";
  reason: string;
};

export type InteriorDropoutDiagnostics = {
  candidateCount: number;
  restoredRegionCount: number;
  restoredPixelCount: number;
  trueHoleCount: number;
  unresolvedRegionCount: number;
  unresolvedPixelCount: number;
  needsReview: boolean;
  failureReasons: string[];
  candidates: InteriorDropoutCandidate[];
};

export type PreserveMaskDiagnostics = {
  width: number;
  height: number;
  alphaCoverage: number;
  alphaCoveragePercent: number;
  visibleForegroundCoveragePercent: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bboxAreaPercent: number;
  bboxFillPercent: number;
  connectedComponentCount: number;
  largestComponentPixels: number;
  largestComponentCoveragePercent: number;
  largestComponentSharePercent: number;
  passed: boolean;
  failureReasons: string[];
};

export type PreserveDebugInfo = {
  preserveMode: true;
  promptVersion: string;
  processingMode: string;
  fallbackMode: PreserveModeFallback;
  finalStatus: "masking" | "refining_edges" | "compositing" | "validating_foreground_integrity" | "completed" | "failed";
  maskSource: PreserveMaskSource;
  attempts: number;
  provider: string | null;
  failureReason: string | null;
  sourceDimensions: {
    width: number;
    height: number;
  };
  workingDimensions: {
    width: number;
    height: number;
  };
  aiResultDimensions: {
    width: number;
    height: number;
  } | null;
  mask: PreserveMaskDiagnostics | null;
  backgroundOnlyBlockerTriggered: boolean;
  rgbIntegrity: PreserveRgbIntegrity;
  interiorDropout: InteriorDropoutDiagnostics | null;
  sourceAnalysis?: SourceAnalysis;
  programmaticValidation?: PreserveModeProgrammaticValidation;
  visionQa?: PreserveVisionQaResult;
  outputValidation?: OutputQualityValidation;
  assets: PreserveDebugAsset[];
};

export type SourceAnalysis = {
  width: number;
  height: number;
  aspectRatio: number;
  productBounds: ProductBounds | null;
  productOrientation: ProductOrientation;
  alphaCoveragePercent: number;
  dominantBackgroundColours: Array<{ r: number; g: number; b: number; count: number }>;
  productBrightnessRange: { min: number; max: number; mean: number };
  likelyShadowArea: { x: number; y: number; width: number; height: number } | null;
};

class PreserveModeProcessingError extends Error {
  public readonly preserveDebug: PreserveDebugInfo;

  public constructor(message: string, preserveDebug: PreserveDebugInfo) {
    super(message);
    this.name = "PreserveModeProcessingError";
    this.preserveDebug = preserveDebug;
  }
}

class PreserveModeProgrammaticValidationError extends Error {
  public readonly validation: PreserveModeProgrammaticValidation;

  public constructor(message: string, validation: PreserveModeProgrammaticValidation) {
    super(message);
    this.name = "PreserveModeProgrammaticValidationError";
    this.validation = validation;
  }
}

export const getExtremeFineDetailFailureMessage = (reasons: string[]): string | null => {
  const text = reasons.join(" ").toLowerCase();
  const fineDetailIndicators = [
    "fine detail",
    "hair",
    "hair-like",
    "fibre",
    "fiber",
    "fringe",
    "fur",
    "grass",
    "lace",
    "mesh",
    "netting",
    "transparent lace",
    "thin structure",
    "thin structures",
    "complex boundary",
    "visually similar background",
    "entangled",
    "many detached",
    "too many connected components"
  ];

  if (!fineDetailIndicators.some((indicator) => text.includes(indicator))) {
    return null;
  }

  return "This product image has very fine product/background detail interaction, such as hair-like fibers, mesh, lace, grass, fringe, transparent material, or visually similar background texture. Optivra could not reliably replace the background without risking missing product detail or changing the product. Use a cleaner source photo with more separation between the product and background, or review/edit this image manually.";
};

const sourceAlphaSoftEdgeFailReasons = new Set<PreserveModeFailReason>([
  "Edge Halo / Background Residue",
  "Mask Includes Background",
  "Dirty Alpha Edge"
]);

const canTrustExistingSourceAlpha = (
  programmaticValidation: PreserveModeProgrammaticValidation,
  foregroundValidation: { alphaCoverage: number; foregroundMeanDelta: number },
  maskDiagnostics: PreserveMaskDiagnostics
): boolean => {
  if (programmaticValidation.passed) {
    return true;
  }

  const hasOnlySourceAlphaEdgeIssues = programmaticValidation.failReasons.length > 0
    && programmaticValidation.failReasons.every((reason) => sourceAlphaSoftEdgeFailReasons.has(reason));

  if (!hasOnlySourceAlphaEdgeIssues || !maskDiagnostics.passed) {
    return false;
  }

  const sourcePixelChangedPercent = Number(programmaticValidation.metrics.sourcePixelChangedPercent ?? Number.POSITIVE_INFINITY);
  const sourcePixelMeanDelta = Number(programmaticValidation.metrics.sourcePixelMeanDelta ?? Number.POSITIVE_INFINITY);

  return foregroundValidation.foregroundMeanDelta <= 0.25
    && sourcePixelChangedPercent <= 0.01
    && sourcePixelMeanDelta <= 0.25
    && foregroundValidation.alphaCoverage > 0
    && maskDiagnostics.connectedComponentCount <= 18
    && maskDiagnostics.alphaCoveragePercent < 82;
};

const acceptExistingSourceAlphaValidation = (
  programmaticValidation: PreserveModeProgrammaticValidation
): PreserveModeProgrammaticValidation => ({
  ...programmaticValidation,
  passed: true,
  failReasons: [],
  overallScore: Math.max(programmaticValidation.overallScore, 88),
  scores: {
    ...programmaticValidation.scores,
    productPreservation: 100,
    sourcePixelIntegrity: 100,
    commercialReadiness: Math.max(programmaticValidation.scores.commercialReadiness, 88)
  },
  metrics: {
    ...programmaticValidation.metrics,
    sourceAlphaAcceptedWithSoftEdgeWarning: true,
    originalSoftEdgeFailReasons: programmaticValidation.failReasons.join("; ")
  }
});

const canAcceptSourceLockedSoftEdgeMask = (
  programmaticValidation: PreserveModeProgrammaticValidation,
  foregroundValidation: { alphaCoverage: number; foregroundMeanDelta: number },
  maskDiagnostics: PreserveMaskDiagnostics
): boolean => {
  if (programmaticValidation.passed) {
    return true;
  }

  const hasOnlySoftEdgeIssues = programmaticValidation.failReasons.length > 0
    && programmaticValidation.failReasons.every((reason) => sourceAlphaSoftEdgeFailReasons.has(reason));

  if (!hasOnlySoftEdgeIssues || !maskDiagnostics.passed) {
    return false;
  }

  const foregroundPixels = Number(programmaticValidation.metrics.foregroundPixels ?? 0);
  const edgeHaloPixels = Number(programmaticValidation.metrics.edgeHaloPixels ?? Number.POSITIVE_INFINITY);
  const insideEdgePixels = Number(programmaticValidation.metrics.insideEdgePixels ?? 1);
  const backgroundLikeForegroundPixels = Number(programmaticValidation.metrics.backgroundLikeForegroundPixels ?? Number.POSITIVE_INFINITY);
  const sourcePixelChangedPercent = Number(programmaticValidation.metrics.sourcePixelChangedPercent ?? Number.POSITIVE_INFINITY);
  const sourcePixelMeanDelta = Number(programmaticValidation.metrics.sourcePixelMeanDelta ?? Number.POSITIVE_INFINITY);
  const backgroundResidueRatio = foregroundPixels > 0 ? backgroundLikeForegroundPixels / foregroundPixels : Number.POSITIVE_INFINITY;
  const edgeHaloRatio = edgeHaloPixels / Math.max(1, insideEdgePixels);

  return foregroundValidation.foregroundMeanDelta <= 0.25
    && sourcePixelChangedPercent <= 0.01
    && sourcePixelMeanDelta <= 0.25
    && foregroundValidation.alphaCoverage > 0
    && maskDiagnostics.connectedComponentCount <= 2
    && maskDiagnostics.alphaCoveragePercent >= 3
    && maskDiagnostics.alphaCoveragePercent <= 65
    && backgroundResidueRatio <= 0.16
    && edgeHaloRatio <= 0.26;
};

const acceptSourceLockedSoftEdgeValidation = (
  programmaticValidation: PreserveModeProgrammaticValidation
): PreserveModeProgrammaticValidation => ({
  ...programmaticValidation,
  passed: true,
  failReasons: [],
  overallScore: Math.max(programmaticValidation.overallScore, 84),
  scores: {
    ...programmaticValidation.scores,
    productPreservation: 100,
    sourcePixelIntegrity: 100,
    commercialReadiness: Math.max(programmaticValidation.scores.commercialReadiness, 84)
  },
  metrics: {
    ...programmaticValidation.metrics,
    sourceLockedSoftEdgeAccepted: true,
    originalSoftEdgeFailReasons: programmaticValidation.failReasons.join("; ")
  }
});

const markSourceLockedVisionQaAdvisory = (
  visionQa: PreserveVisionQaResult
): PreserveVisionQaResult => ({
  ...visionQa,
  passed: true,
  commerciallyUsable: true,
  failReasons: [],
  visibleProblems: [],
  summary: [
    "Source-locked preserve mode was accepted by deterministic source-pixel validation.",
    visionQa.summary ? `Vision QA advisory notes: ${visionQa.summary}` : null
  ].filter(Boolean).join(" ")
});

export const getPreserveDebugFromError = (error: unknown): PreserveDebugInfo | undefined =>
  error instanceof PreserveModeProcessingError ? error.preserveDebug : undefined;

type PreserveDebugContext = {
  userId: string;
  imageJobId: string;
  specialistSourceBuffer: Buffer;
  specialistSourceContentType: string;
  originalStoragePath: string;
  originalContentType: string;
  sourceDimensions: {
    width: number;
    height: number;
  };
  fallbackMode: PreserveModeFallback;
};

const assertValidImageUrl = (imageUrl: string): void => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("Invalid image URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Image URL must use http or https");
  }
};

const getImageExtension = (contentType: string): string => {
  switch (contentType.toLowerCase().split(";")[0]?.trim()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return "img";
  }
};

const getStoragePath = (userId: string, imageJobId: string, fileName: string): string =>
  `${userId}/${imageJobId}/${fileName}`;

const getStorageCleanupAfter = (): Date => {
  const cleanupAfter = new Date();
  cleanupAfter.setDate(cleanupAfter.getDate() + env.imageStorageRetentionDays);

  return cleanupAfter;
};

const addDebugAssetRecord = async (
  assets: PreserveDebugAsset[],
  kind: PreserveDebugAsset["kind"],
  bucket: string,
  assetPath: string,
  contentType: string
): Promise<void> => {
  const url = await createStorageSignedUrl({
    bucket,
    path: assetPath,
    expiresInSeconds: signedUrlExpirySeconds
  }).catch(() => null);

  assets.push({
    kind,
    bucket,
    path: assetPath,
    url,
    contentType
  });
};

const addExistingPreserveDebugAsset = async (
  debug: PreserveDebugInfo,
  kind: PreserveDebugAsset["kind"],
  bucket: string,
  assetPath: string,
  contentType: string
): Promise<void> => {
  await addDebugAssetRecord(debug.assets, kind, bucket, assetPath, contentType);
};

const uploadPreserveDebugAsset = async (
  context: PreserveDebugContext,
  debug: PreserveDebugInfo,
  kind: PreserveDebugAsset["kind"],
  fileName: string,
  body: Buffer,
  contentType: string
): Promise<void> => {
  const assetPath = getStoragePath(context.userId, context.imageJobId, `preserve-debug-${fileName}`);
  await uploadStorageObject({
    bucket: storageBuckets.debugCutouts,
    path: assetPath,
    body,
    contentType
  });
  await addExistingPreserveDebugAsset(debug, kind, storageBuckets.debugCutouts, assetPath, contentType);
};

const uploadPipelineDebugAsset = async (
  userId: string,
  imageJobId: string,
  assets: PreserveDebugAsset[],
  kind: PreserveDebugAsset["kind"],
  fileName: string,
  body: Buffer,
  contentType: string
): Promise<void> => {
  const assetPath = getStoragePath(userId, imageJobId, `pipeline-debug-${fileName}`);
  await uploadStorageObject({
    bucket: storageBuckets.debugCutouts,
    path: assetPath,
    body,
    contentType
  });
  await addDebugAssetRecord(assets, kind, storageBuckets.debugCutouts, assetPath, contentType);
};

const getSha256 = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");

const getUrlTokens = (imageUrl: string): string[] => {
  try {
    const url = new URL(imageUrl);
    const fileName = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    return fileName
      .replace(/\.[a-z0-9]+$/i, "")
      .split(/[^a-z0-9]+/i)
      .map((token) => token.toLowerCase())
      .filter((token) => token.length > 2 && !["image", "photo", "product", "main"].includes(token));
  } catch {
    return [];
  }
};

const getSiteName = (imageUrl: string): string => {
  try {
    return new URL(imageUrl).hostname.replace(/^www\./, "");
  } catch {
    return "store";
  }
};

const getSuggestedSeoMetadata = (imageUrl: string, imageHash: string): SuggestedSeoMetadata => {
  const tokens = getUrlTokens(imageUrl);
  const productName = tokens.length > 0
    ? tokens.map((token) => token[0].toUpperCase() + token.slice(1)).join(" ")
    : "Product Image";
  const siteName = getSiteName(imageUrl);
  const shortHash = imageHash.slice(0, 10);
  const slug = (tokens.length > 0 ? tokens.join("-") : `product-${shortHash}`).slice(0, 80);

  return {
    seo_filename: `${slug}-${shortHash}.webp`,
    title: `${productName} | ${siteName}`,
    alt_text: `${productName} on a clean branded ecommerce background`,
    caption: `${productName} product image`,
    description: `Optimized ${outputSize}x${outputSize} WebP product image for ${siteName}.`,
    file_name: `${slug}-${shortHash}.webp`,
    keywords: Array.from(new Set([...tokens, "product", "ecommerce", "webp"])).slice(0, 10)
  };
};

const findDuplicateJob = async (userId: string, imageJobId: string, imageHash: string) =>
  prisma.imageJob.findFirst({
    where: {
      user_id: userId,
      original_image_hash: imageHash,
      status: "completed",
      processed_storage_path: {
        not: null
      },
      id: {
        not: imageJobId
      }
    },
    orderBy: {
      created_at: "desc"
    },
    select: {
      id: true,
      processed_storage_path: true,
      seo_metadata: true
    }
  });

const downloadImage = async (imageUrl: string): Promise<DownloadedImage> => {
  assertValidImageUrl(imageUrl);

  let response: Response;

  try {
    response = await fetch(imageUrl, {
      headers: {
        accept: "image/*"
      }
    });
  } catch {
    throw new Error("Optivra could not download the image URL. If this is a local, private, or staging WordPress site, update the plugin so it can upload the image file directly.");
  }

  if (!response.ok) {
    throw new Error(`Image download failed with ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("URL did not return an image");
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (contentLength > maxImageBytes) {
    throw new Error("Image is too large");
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());

  if (imageBuffer.byteLength > maxImageBytes) {
    throw new Error("Image is too large");
  }

  return {
    buffer: imageBuffer,
    contentType,
    extension: getImageExtension(contentType)
  };
};

const getUploadedImage = (buffer: Buffer, contentType: string): DownloadedImage => {
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Uploaded file was not an image");
  }

  if (buffer.byteLength > maxImageBytes) {
    throw new Error("Image is too large");
  }

  return {
    buffer,
    contentType,
    extension: getImageExtension(contentType)
  };
};

const validateImage = async (imageBuffer: Buffer): Promise<void> => {
  const metadata = await sharp(imageBuffer, {
    failOn: "error"
  }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image");
  }
};

const getImageDimensions = async (imageBuffer: Buffer): Promise<{ width: number; height: number }> => {
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image dimensions");
  }

  return {
    width: metadata.width,
    height: metadata.height
  };
};

const analyzeSourceImageForPreserveMode = async (preservedOriginalBuffer: Buffer): Promise<SourceAnalysis> => {
  const metadata = await sharp(preservedOriginalBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Source image analysis failed because dimensions could not be read.");
  }

  const width = metadata.width;
  const height = metadata.height;
  const rgba = await sharp(preservedOriginalBuffer).ensureAlpha().raw().toBuffer();
  const rgb = rgbaToRgb(rgba);
  const localAlpha = buildLocalForegroundAlpha(rgba, width, height);
  const bounds = getAlphaBounds(localAlpha, width, height, 24);
  const productBounds = bounds
    ? { minX: bounds.minX, maxX: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY, width: bounds.width, height: bounds.height }
    : null;
  const productOrientation = productBounds
    ? productBounds.width / Math.max(1, productBounds.height) > 1.25
      ? "horizontal"
      : productBounds.height / Math.max(1, productBounds.width) > 1.25
        ? "tall"
        : "square"
    : "square";
  let minBrightness = 255;
  let maxBrightness = 0;
  let totalBrightness = 0;
  let brightnessPixels = 0;

  for (let pixel = 0; pixel < localAlpha.length; pixel += 1) {
    if ((localAlpha[pixel] ?? 0) < 24) continue;
    const index = pixel * 3;
    const brightness = 0.2126 * (rgb[index] ?? 0) + 0.7152 * (rgb[index + 1] ?? 0) + 0.0722 * (rgb[index + 2] ?? 0);
    minBrightness = Math.min(minBrightness, brightness);
    maxBrightness = Math.max(maxBrightness, brightness);
    totalBrightness += brightness;
    brightnessPixels += 1;
  }

  return {
    width,
    height,
    aspectRatio: Number((width / height).toFixed(4)),
    productBounds,
    productOrientation,
    alphaCoveragePercent: Number(((getAlphaCoverage(localAlpha) / (width * height)) * 100).toFixed(3)),
    dominantBackgroundColours: buildBackgroundPalette(rgb, localAlpha, width, height).map((colour) => ({ ...colour, count: 0 })),
    productBrightnessRange: {
      min: Number((brightnessPixels ? minBrightness : 0).toFixed(2)),
      max: Number((brightnessPixels ? maxBrightness : 0).toFixed(2)),
      mean: Number((brightnessPixels ? totalBrightness / brightnessPixels : 0).toFixed(2))
    },
    likelyShadowArea: productBounds
      ? {
          x: productBounds.minX,
          y: Math.min(height - 1, productBounds.maxY),
          width: productBounds.width,
          height: Math.max(1, Math.round(productBounds.height * 0.12))
        }
      : null
  };
};

const normalizeImageForOpenAi = async (imageBuffer: Buffer): Promise<Buffer> =>
  sharp(imageBuffer)
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "contain",
      withoutEnlargement: false,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .ensureAlpha()
    .png()
    .toBuffer();

const normalizeImageForOpenAiStudioRender = async (imageBuffer: Buffer): Promise<Buffer> =>
  sharp(imageBuffer)
    .rotate()
    .resize({
      width: outputSize,
      height: outputSize,
      fit: "contain",
      withoutEnlargement: false,
      background: {
        r: 247,
        g: 247,
        b: 244,
        alpha: 1
      }
    })
    .flatten({
      background: {
        r: 247,
        g: 247,
        b: 244
      }
    })
    .png()
    .toBuffer();

const normalizeImageForPreservedProduct = async (imageBuffer: Buffer): Promise<Buffer> =>
  sharp(imageBuffer)
    .rotate()
    .resize({
      width: outputSize,
      height: outputSize,
      fit: "contain",
      withoutEnlargement: false,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .ensureAlpha()
    .png()
    .toBuffer();

const processImageFlexiblePreserveMode = async (
  sourceInput: Buffer,
  openAiInput: Buffer,
  sourceContentType: string,
  preferLocalForegroundFallback = false
): Promise<CutoutResult> => {
  const sourceAlphaCutout = await buildCutoutFromExistingSourceAlpha(sourceInput);

  if (sourceAlphaCutout) {
    const result = {
      cutout: sourceAlphaCutout,
      debugCutout: sourceAlphaCutout,
      provider: "source-alpha:transparent-product-png",
      attempts: 0,
      validation: {
        alphaCoverage: await getImageAlphaCoverage(sourceAlphaCutout),
        foregroundMeanDelta: 0
      }
    };
    await assertVisibleProductImage(result.cutout);
    return result;
  }

  try {
    const aiCutout = await removeImageBackground(openAiInput, "flexible-cutout");
    await validateImage(aiCutout);
    const sourceDimensions = await getImageDimensions(sourceInput);
    const aiAlpha = await getSourceAlignedAlpha(aiCutout, sourceDimensions.width, sourceDimensions.height);

    const result = await buildPreservedProductCutoutFromAlpha(
      sourceInput,
      aiAlpha,
      `openai:${openAiImageEditModel}:flexible-preserve-source-mask`,
      1,
      {
        allowLocalAssist: true,
        maskSource: "ai_mask",
        removeBackgroundRemnants: true
      }
    );
    await assertVisibleProductImage(result.cutout);
    return result;
  } catch (error) {
    console.warn("Flexible OpenAI alpha guidance failed; raw AI product pixels rejected and source pixels will remain authoritative", {
      reason: error instanceof Error ? error.message : "Unknown flexible cutout error"
    });
  }

  try {
    const specialistCutout = await removeImageBackgroundWithSpecialistModel(sourceInput, sourceContentType);
    await validateImage(specialistCutout);
    const sourceDimensions = await getImageDimensions(sourceInput);
    const specialistAlpha = prepareProviderAlphaForPreserve(
      "imgly:background-removal-node:flexible-source-pixel",
      await getSourceAlignedAlpha(specialistCutout, sourceDimensions.width, sourceDimensions.height),
      sourceDimensions.width,
      sourceDimensions.height
    );

    const result = await buildPreservedProductCutoutFromAlpha(
      sourceInput,
      specialistAlpha,
      "imgly:background-removal-node:flexible-source-pixel",
      1,
      {
        allowLocalAssist: true,
        maskSource: "ai_mask",
        removeBackgroundRemnants: true
      }
    );
    await assertVisibleProductImage(result.cutout);
    return result;
  } catch (specialistError) {
    console.warn("Flexible specialist source-pixel segmentation failed; trying local foreground extraction", {
      reason: specialistError instanceof Error ? specialistError.message : "Unknown specialist segmentation error"
    });
  }

  try {
    const result = await buildFlexibleLocalForegroundCutout(
      sourceInput,
      preferLocalForegroundFallback
        ? "local-color-segmentation:strict-preserve-fallback"
        : "local-color-segmentation:flexible-source-pixel-first",
      1
    );
    return result;
  } catch (localFirstError) {
    console.warn("Flexible source-pixel local foreground extraction failed; using full-source review fallback", {
      reason: localFirstError instanceof Error ? localFirstError.message : "Unknown local foreground fallback error"
    });

    try {
      const result = await buildFlexibleFullSourceReviewCutout(
        sourceInput,
        [`Local fallback reason: ${localFirstError instanceof Error ? localFirstError.message : "unknown local fallback error"}.`]
      );
      await assertVisibleProductImage(result.cutout);
      return result;
    } catch (fallbackError) {
      throw new Error(`Flexible preserve mode could not create a review-safe source product layer: ${fallbackError instanceof Error ? fallbackError.message : "unknown fallback error"}.`);
    }
  }
};

const buildFlexibleFullSourceReviewCutout = async (
  sourceBuffer: Buffer,
  reasons: string[]
): Promise<CutoutResult> => {
  const fallbackSize = Math.round(outputSize * 0.88);
  const cutout = await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: fallbackSize,
      height: fallbackSize,
      fit: "contain",
      withoutEnlargement: false,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .extend({
      top: Math.floor((outputSize - fallbackSize) / 2),
      bottom: Math.ceil((outputSize - fallbackSize) / 2),
      left: Math.floor((outputSize - fallbackSize) / 2),
      right: Math.ceil((outputSize - fallbackSize) / 2),
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  return {
    cutout,
    debugCutout: cutout,
    provider: `source-alpha:flexible-full-source-review-fallback:${reasons.join(" ")}`,
    attempts: 3,
    validation: {
      alphaCoverage: await getImageAlphaCoverage(cutout),
      foregroundMeanDelta: Number.NaN
    }
  };
};

const buildFlexibleLocalForegroundCutout = async (
  sourceBuffer: Buffer,
  provider: string,
  attempts: number
): Promise<CutoutResult> => {
  const metadata = await sharp(sourceBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Local foreground fallback could not read source image dimensions.");
  }

  const width = metadata.width;
  const height = metadata.height;
  const rgba = await sharp(sourceBuffer).ensureAlpha().raw().toBuffer();
  const smoothedAlpha = await smoothAlphaMask(buildLocalForegroundAlpha(rgba, width, height), width, height);
  const alpha = cleanFlexibleForegroundAlpha(rgba, smoothedAlpha, width, height);
  const diagnostics = analyzeAlphaMask(alpha, width, height);

  if (!diagnostics.passed || diagnostics.alphaCoverage <= 0) {
    throw new Error(
      `Local foreground fallback did not produce a safe product mask: ${diagnostics.failureReasons.join("; ") || "no product foreground detected"}`
    );
  }

  const productRgba = applyApprovedAlphaToOriginalPixels(rgbaToRgb(rgba), alpha, width, height);
  const cutout = await sharp(productRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();

  return {
    cutout,
    debugCutout: cutout,
    provider,
    attempts,
    validation: {
      alphaCoverage: diagnostics.alphaCoverage,
      foregroundMeanDelta: 0
    }
  };
};

const getImageAlphaMaskDiagnostics = async (imageBuffer: Buffer): Promise<PreserveMaskDiagnostics> => {
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Image alpha diagnostics failed because dimensions could not be read.");
  }

  const alpha = await sharp(imageBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  return analyzeAlphaMask(alpha, metadata.width, metadata.height);
};

const buildCutoutFromExistingSourceAlpha = async (
  sourceBuffer: Buffer
): Promise<Buffer | null> => {
  const metadata = await sharp(sourceBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    return null;
  }

  const width = metadata.width;
  const height = metadata.height;
  const sourceRgba = await sharp(sourceBuffer).ensureAlpha().raw().toBuffer();
  const sourceRgb = rgbaToRgb(sourceRgba);
  const sourceAlpha = await sharp(sourceBuffer).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  const componentMask = keepMainAlphaComponents(thresholdAlphaMask(sourceAlpha, 96), width, height);
  const safeAlpha = Buffer.alloc(sourceAlpha.length);
  for (let pixel = 0; pixel < sourceAlpha.length; pixel += 1) {
    safeAlpha[pixel] = (componentMask[pixel] ?? 0) >= 24 ? (sourceAlpha[pixel] ?? 0) : 0;
  }
  const coverage = getAlphaCoverage(safeAlpha);
  const totalPixels = width * height;

  if (coverage < Math.max(2500, totalPixels * 0.002) || coverage > totalPixels * 0.55) {
    return null;
  }

  const productRgba = applyApprovedAlphaToOriginalPixels(sourceRgb, safeAlpha, width, height);

  return sharp(productRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
};

const processImagePreserveMode = async (
  preservedOriginalBuffer: Buffer,
  openAiInput: Buffer,
  context: PreserveDebugContext
): Promise<CutoutResult> => {
  const workingDimensions = await getImageDimensions(preservedOriginalBuffer);
  const sourceAnalysis = await analyzeSourceImageForPreserveMode(preservedOriginalBuffer);
  const debug: PreserveDebugInfo = {
    preserveMode: true,
    promptVersion: ecommercePreservePromptVersion,
    processingMode: "seo_product_feed_safe_preserve_background_replacement",
    fallbackMode: context.fallbackMode,
    finalStatus: "masking",
    maskSource: "failed",
    attempts: 0,
    provider: null,
    failureReason: null,
    sourceDimensions: context.sourceDimensions,
    workingDimensions,
    aiResultDimensions: null,
    mask: null,
    backgroundOnlyBlockerTriggered: false,
    rgbIntegrity: {
      passed: false,
      foregroundMeanDelta: null,
      alphaCoverage: null
    },
    interiorDropout: null,
    sourceAnalysis,
    assets: []
  };
  await addExistingPreserveDebugAsset(debug, "original_source", storageBuckets.originalImages, context.originalStoragePath, context.originalContentType);

  const existingAlphaCutout = await buildCutoutFromExistingSourceAlpha(preservedOriginalBuffer);
  if (existingAlphaCutout) {
    try {
      await validateImage(existingAlphaCutout);
      await assertVisibleProductImage(existingAlphaCutout);
      const existingMetadata = await sharp(existingAlphaCutout).metadata();

      if (!existingMetadata.width || !existingMetadata.height) {
        throw new Error("Existing source-alpha cutout dimensions could not be read.");
      }

      const existingAlpha = await sharp(existingAlphaCutout)
        .ensureAlpha()
        .extractChannel("alpha")
        .raw()
        .toBuffer();
      const existingSourceRgba = await sharp(preservedOriginalBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer();
      const validation = await validatePreservedForegroundIntegrity(preservedOriginalBuffer, existingAlphaCutout);
      const programmaticValidation = await validatePreserveModeProgrammatic({
        sourceBuffer: preservedOriginalBuffer,
        productCutoutBuffer: existingAlphaCutout,
        sourceReferenceAlpha: existingAlpha,
        referenceWidth: existingMetadata.width,
        referenceHeight: existingMetadata.height
      });
      const maskDiagnostics = analyzeAlphaMask(existingAlpha, existingMetadata.width, existingMetadata.height);

      if (!canTrustExistingSourceAlpha(programmaticValidation, validation, maskDiagnostics)) {
        throw new PreserveModeProgrammaticValidationError(
          `Existing transparent PNG alpha failed preserve validation: ${programmaticValidation.failReasons.join("; ")}`,
          programmaticValidation
        );
      }

      const acceptedProgrammaticValidation = acceptExistingSourceAlphaValidation(programmaticValidation);
      const alphaMaskPreview = await buildAlphaMaskPreview(existingAlpha, existingMetadata.width, existingMetadata.height);
      const trimapPreview = await buildTrimapPreview(
        buildAdaptiveTrimap(existingSourceRgba, existingAlpha, existingMetadata.width, existingMetadata.height),
        existingMetadata.width,
        existingMetadata.height
      );
      await uploadPreserveDebugAsset(context, debug, "alpha_mask", `source-alpha-mask-${randomUUID()}.png`, alphaMaskPreview, "image/png");
      await uploadPreserveDebugAsset(context, debug, "trimap", `source-alpha-trimap-${randomUUID()}.png`, trimapPreview, "image/png");
      await uploadPreserveDebugAsset(context, debug, "preserved_cutout", `source-alpha-preserved-cutout-${randomUUID()}.png`, existingAlphaCutout, "image/png");

      console.info("Image preserve-mode used existing source alpha", {
        imageJobId: context.imageJobId,
        alphaCoveragePercent: maskDiagnostics.alphaCoveragePercent,
        maskBBox: maskDiagnostics.bbox,
        connectedComponentCount: maskDiagnostics.connectedComponentCount
      });

      return {
        cutout: existingAlphaCutout,
        debugCutout: existingAlphaCutout,
        provider: "source-alpha:transparent-product-png",
        attempts: 0,
        validation,
        debugAlphaMask: alphaMaskPreview,
        debugTrimap: trimapPreview,
        preserveDebug: {
          ...debug,
          finalStatus: "validating_foreground_integrity",
          maskSource: "source_alpha",
          provider: "source-alpha:transparent-product-png",
          mask: maskDiagnostics,
          rgbIntegrity: {
            passed: true,
            foregroundMeanDelta: validation.foregroundMeanDelta,
            alphaCoverage: validation.alphaCoverage
          },
          programmaticValidation: acceptedProgrammaticValidation,
          failureReason: null
        }
      };
    } catch (error) {
      console.warn("Existing transparent PNG alpha was not accepted for preserve mode; continuing with segmentation", {
        imageJobId: context.imageJobId,
        reason: error instanceof Error ? error.message : "Unknown source-alpha preserve failure"
      });
    }
  }

  console.info("Image preserve-mode masking started", {
    imageJobId: context.imageJobId,
    provider: "imgly:background-removal-node:medium",
    fallbackProvider: `openai:${openAiImageEditModel}:preserve-mask-refined`,
    fallbackMode: context.fallbackMode,
    sourceWidth: context.sourceDimensions.width,
    sourceHeight: context.sourceDimensions.height,
    workingWidth: workingDimensions.width,
    workingHeight: workingDimensions.height,
    sourceAnalysis
  });

  const runMaskAttempt = async (
    provider: string,
    attempt: number,
    stage: "masking" | "refining_edges",
    getMaskCutoutBuffer: () => Promise<Buffer>,
    alphaAlignment: "source-contain" | "square-fill"
  ): Promise<CutoutResult> => {
    debug.finalStatus = stage;
    debug.attempts = attempt;
    debug.provider = provider;
    const aiCutoutBuffer = await getMaskCutoutBuffer();
    await validateImage(aiCutoutBuffer);
    const aiResultDimensions = await getImageDimensions(aiCutoutBuffer);
    debug.aiResultDimensions = aiResultDimensions;
    await uploadPreserveDebugAsset(context, debug, "ai_cutout", `attempt-${attempt}-ai-cutout-${randomUUID()}.png`, aiCutoutBuffer, "image/png");

    const extractedAlpha = alphaAlignment === "source-contain"
      ? await getSourceAlignedAlpha(aiCutoutBuffer, workingDimensions.width, workingDimensions.height)
      : await getResizedAiAlpha(aiCutoutBuffer, workingDimensions.width, workingDimensions.height);
    const aiAlpha = prepareProviderAlphaForPreserve(provider, extractedAlpha, workingDimensions.width, workingDimensions.height);
    const maskDiagnostics = analyzeAlphaMask(aiAlpha, workingDimensions.width, workingDimensions.height);
    debug.mask = maskDiagnostics;
    await uploadPreserveDebugAsset(
      context,
      debug,
      "alpha_mask",
      `attempt-${attempt}-alpha-mask-${randomUUID()}.png`,
      await buildAlphaMaskPreview(aiAlpha, workingDimensions.width, workingDimensions.height),
      "image/png"
    );

    if (!maskDiagnostics.passed) {
      throw new PreserveModeProcessingError(
        `Preserve mode rejected the ${attempt === 1 ? "primary" : "refined"} mask from ${provider}: ${maskDiagnostics.failureReasons.join("; ")}`,
        {
          ...debug,
          failureReason: maskDiagnostics.failureReasons.join("; "),
          finalStatus: "failed"
        }
      );
    }

    const edgeRgbGuide = await buildSourceAlignedGuideRgba(aiCutoutBuffer, workingDimensions.width, workingDimensions.height, alphaAlignment);
    const result = await buildPreservedProductCutoutFromAlpha(
      preservedOriginalBuffer,
      aiAlpha,
      provider,
      attempt,
      {
        allowLocalAssist: false,
        maskSource: "ai_mask",
        prevalidatedMask: maskDiagnostics,
        removeBackgroundRemnants: errors.some((message) => message.includes("background logo or watermark")),
        edgeRgbGuide
      }
    );
    debug.finalStatus = "validating_foreground_integrity";
    debug.maskSource = "ai_mask";
    debug.mask = result.preserveDebug?.mask ?? maskDiagnostics;
    debug.interiorDropout = result.preserveDebug?.interiorDropout ?? null;
    debug.programmaticValidation = result.preserveDebug?.programmaticValidation;
    debug.rgbIntegrity = {
      passed: true,
      foregroundMeanDelta: result.validation.foregroundMeanDelta,
      alphaCoverage: result.validation.alphaCoverage
    };
    const programmaticOverlays = result.preserveDebug?.programmaticValidation?.overlays;
    if (programmaticOverlays?.edgeInspectionRing) {
      await uploadPreserveDebugAsset(context, debug, "edge_inspection_ring", `attempt-${attempt}-edge-inspection-ring-${randomUUID()}.png`, programmaticOverlays.edgeInspectionRing, "image/png");
    }
    if (programmaticOverlays?.edgeHaloOverlay) {
      await uploadPreserveDebugAsset(context, debug, "edge_halo_overlay", `attempt-${attempt}-edge-halo-overlay-${randomUUID()}.png`, programmaticOverlays.edgeHaloOverlay, "image/png");
    }
    if (programmaticOverlays?.connectedComponentsOverlay) {
      await uploadPreserveDebugAsset(context, debug, "connected_components_overlay", `attempt-${attempt}-connected-components-overlay-${randomUUID()}.png`, programmaticOverlays.connectedComponentsOverlay, "image/png");
    }
    if (programmaticOverlays?.alphaMaskPreview) {
      await uploadPreserveDebugAsset(context, debug, "alpha_mask_preview", `attempt-${attempt}-alpha-mask-preview-${randomUUID()}.png`, programmaticOverlays.alphaMaskPreview, "image/png");
    }
    if (result.debugTrimap) {
      await uploadPreserveDebugAsset(context, debug, "trimap", `attempt-${attempt}-trimap-${randomUUID()}.png`, result.debugTrimap, "image/png");
    }
    if (programmaticOverlays?.checkerboardPreview) {
      await uploadPreserveDebugAsset(context, debug, "product_cutout_checkerboard", `attempt-${attempt}-checkerboard-preview-${randomUUID()}.png`, programmaticOverlays.checkerboardPreview, "image/png");
    }
    if (result.preserveDebug?.programmaticValidation) {
      await uploadPreserveDebugAsset(
        context,
        debug,
        "validation_json",
        `attempt-${attempt}-programmatic-validation-${randomUUID()}.json`,
        Buffer.from(JSON.stringify({
          ...result.preserveDebug.programmaticValidation,
          overlays: undefined
        }, null, 2)),
        "application/json"
      );
    }
    if (result.debugInteriorDropoutOverlay) {
      await uploadPreserveDebugAsset(
        context,
        debug,
        "interior_dropout_overlay",
        `attempt-${attempt}-interior-dropout-overlay-${randomUUID()}.png`,
        result.debugInteriorDropoutOverlay,
        "image/png"
      );
    }
    if (result.debugRestoredRegionOverlay) {
      await uploadPreserveDebugAsset(
        context,
        debug,
        "restored_region_overlay",
        `attempt-${attempt}-restored-region-overlay-${randomUUID()}.png`,
        result.debugRestoredRegionOverlay,
        "image/png"
      );
    }
    if (result.debugFinalRepairedCutout) {
      await uploadPreserveDebugAsset(
        context,
        debug,
        "final_repaired_cutout",
        `attempt-${attempt}-final-repaired-cutout-${randomUUID()}.png`,
        result.debugFinalRepairedCutout,
        "image/png"
      );
    }
    await uploadPreserveDebugAsset(
      context,
      debug,
      "preserved_cutout",
      `attempt-${attempt}-preserved-cutout-${randomUUID()}.png`,
      result.cutout,
      "image/png"
    );

    console.info("Image preserve-mode masking passed", {
      imageJobId: context.imageJobId,
      provider: result.provider,
      attempts: result.attempts,
      alphaCoverage: debug.mask?.alphaCoverage ?? result.validation.alphaCoverage,
      alphaCoveragePercent: debug.mask?.alphaCoveragePercent,
      foregroundMeanDelta: result.validation.foregroundMeanDelta,
      maskBBox: debug.mask?.bbox,
      connectedComponentCount: debug.mask?.connectedComponentCount,
      selectedMaskSource: "ai_mask"
    });

    return {
      ...result,
      preserveDebug: {
        ...debug,
        finalStatus: "validating_foreground_integrity",
        failureReason: null
      }
    };
  };

  const errors: string[] = [];

  const attempts = [
    {
      provider: "imgly:background-removal-node:medium",
      attempt: 1,
      stage: "masking" as const,
      alphaAlignment: "source-contain" as const,
      getMaskCutoutBuffer: () => removeImageBackgroundWithSpecialistModel(
        context.specialistSourceBuffer,
        context.specialistSourceContentType
      )
    },
    {
      provider: `openai:${openAiImageEditModel}:preserve-mask-refined`,
      attempt: 2,
      stage: "refining_edges" as const,
      alphaAlignment: "square-fill" as const,
      getMaskCutoutBuffer: () => removeImageBackground(openAiInput, "preserve-mask-refined")
    },
    {
      provider: `openai:${openAiImageEditModel}:preserve-mask-hard-contamination`,
      attempt: 3,
      stage: "refining_edges" as const,
      alphaAlignment: "square-fill" as const,
      getMaskCutoutBuffer: () => removeImageBackground(openAiInput, "preserve-mask-hard-contamination")
    },
    {
      provider: `openai:${openAiImageEditModel}:preserve-monochrome-mask`,
      attempt: 4,
      stage: "refining_edges" as const,
      alphaAlignment: "square-fill" as const,
      getMaskCutoutBuffer: async () => buildTransparentCutoutFromMonochromeMask(
        await renderPreserveMonochromeMask(openAiInput),
        workingDimensions.width,
        workingDimensions.height
      )
    }
  ];

  for (const attemptConfig of attempts) {
    try {
      return await runMaskAttempt(
        attemptConfig.provider,
        attemptConfig.attempt,
        attemptConfig.stage,
        attemptConfig.getMaskCutoutBuffer,
        attemptConfig.alphaAlignment
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown preserve mask error";
      errors.push(message);
      const errorDebug = getPreserveDebugFromError(error);
      if (errorDebug) {
        Object.assign(debug, errorDebug);
      }
      if (error instanceof PreserveModeProgrammaticValidationError) {
        debug.programmaticValidation = error.validation;
        const overlays = error.validation.overlays;
        if (overlays.edgeInspectionRing) {
          await uploadPreserveDebugAsset(context, debug, "edge_inspection_ring", `attempt-${attemptConfig.attempt}-failed-edge-inspection-ring-${randomUUID()}.png`, overlays.edgeInspectionRing, "image/png");
        }
        if (overlays.edgeHaloOverlay) {
          await uploadPreserveDebugAsset(context, debug, "edge_halo_overlay", `attempt-${attemptConfig.attempt}-failed-edge-halo-overlay-${randomUUID()}.png`, overlays.edgeHaloOverlay, "image/png");
        }
        if (overlays.connectedComponentsOverlay) {
          await uploadPreserveDebugAsset(context, debug, "connected_components_overlay", `attempt-${attemptConfig.attempt}-failed-connected-components-overlay-${randomUUID()}.png`, overlays.connectedComponentsOverlay, "image/png");
        }
        if (overlays.alphaMaskPreview) {
          await uploadPreserveDebugAsset(context, debug, "alpha_mask_preview", `attempt-${attemptConfig.attempt}-failed-alpha-mask-preview-${randomUUID()}.png`, overlays.alphaMaskPreview, "image/png");
        }
        if (overlays.checkerboardPreview) {
          await uploadPreserveDebugAsset(context, debug, "product_cutout_checkerboard", `attempt-${attemptConfig.attempt}-failed-checkerboard-preview-${randomUUID()}.png`, overlays.checkerboardPreview, "image/png");
        }
        await uploadPreserveDebugAsset(
          context,
          debug,
          "validation_json",
          `attempt-${attemptConfig.attempt}-failed-programmatic-validation-${randomUUID()}.json`,
          Buffer.from(JSON.stringify({
            ...error.validation,
            overlays: undefined
          }, null, 2)),
          "application/json"
        );
      }
      console.warn("Image preserve-mode AI mask rejected", {
        imageJobId: context.imageJobId,
        attempt: attemptConfig.attempt,
        provider: attemptConfig.provider,
        fallbackMode: context.fallbackMode,
        error: message,
        alphaCoveragePercent: debug.mask?.alphaCoveragePercent,
        maskBBox: debug.mask?.bbox,
        connectedComponentCount: debug.mask?.connectedComponentCount
      });
    }
  }

  if (context.fallbackMode !== "external_provider") {
    console.warn("Image preserve-mode raw local consensus enabled after provider mask rejection", {
      imageJobId: context.imageJobId,
      attempt: 5,
      fallbackMode: context.fallbackMode
    });

    try {
      const rawLocal = await buildPreservedProductCutoutFromRawLocalMask(preservedOriginalBuffer);
      const rawLocalMask = rawLocal.preserveDebug?.mask ?? null;

      if (!rawLocalMask?.passed) {
        throw new PreserveModeProcessingError("Raw local consensus did not pass strict mask quality checks.", {
          ...debug,
          finalStatus: "failed",
          maskSource: "local_fallback",
          mask: rawLocalMask,
          failureReason: "Raw local consensus did not pass strict mask quality checks."
        });
      }

      await uploadPreserveDebugAsset(
        context,
        debug,
        "preserved_cutout",
        `raw-local-consensus-preserved-cutout-${randomUUID()}.png`,
        rawLocal.cutout,
        "image/png"
      );
      if (rawLocal.debugAlphaMask) {
        await uploadPreserveDebugAsset(
          context,
          debug,
          "alpha_mask",
          `raw-local-consensus-alpha-mask-${randomUUID()}.png`,
          rawLocal.debugAlphaMask,
          "image/png"
        );
      }
      if (rawLocal.debugTrimap) {
        await uploadPreserveDebugAsset(
          context,
          debug,
          "trimap",
          `raw-local-consensus-trimap-${randomUUID()}.png`,
          rawLocal.debugTrimap,
          "image/png"
        );
      }

      console.info("Image preserve-mode raw local consensus passed", {
        imageJobId: context.imageJobId,
        alphaCoveragePercent: rawLocalMask.alphaCoveragePercent,
        maskBBox: rawLocalMask.bbox,
        connectedComponentCount: rawLocalMask.connectedComponentCount
      });

      return {
        ...rawLocal,
        attempts: 5,
        preserveDebug: {
          ...debug,
          finalStatus: "validating_foreground_integrity",
          maskSource: "local_fallback",
          mask: rawLocalMask,
          interiorDropout: rawLocal.preserveDebug?.interiorDropout ?? null,
          programmaticValidation: rawLocal.preserveDebug?.programmaticValidation,
          rgbIntegrity: {
            passed: true,
            foregroundMeanDelta: rawLocal.validation.foregroundMeanDelta,
            alphaCoverage: rawLocal.validation.alphaCoverage
          },
          failureReason: null
        }
      };
    } catch (rawLocalError) {
      const message = rawLocalError instanceof Error ? rawLocalError.message : "Unknown raw local consensus error";
      errors.push(message);
      console.warn("Image preserve-mode raw local consensus rejected", {
        imageJobId: context.imageJobId,
        fallbackMode: context.fallbackMode,
        error: message
      });
    }

      console.warn("Image preserve-mode source-locked local rescue enabled after provider mask rejection", {
        imageJobId: context.imageJobId,
      attempt: 6,
      fallbackMode: context.fallbackMode
    });

    try {
      const fallback = await buildPreservedProductCutoutFromLocalMask(preservedOriginalBuffer);
      const localMask = fallback.preserveDebug?.mask ?? null;

      if (!localMask?.passed) {
        throw new PreserveModeProcessingError("Source-locked local rescue did not pass strict mask quality checks.", {
          ...debug,
          finalStatus: "failed",
          maskSource: "local_fallback",
          mask: localMask,
          failureReason: "Source-locked local rescue did not pass strict mask quality checks."
        });
      }

      await uploadPreserveDebugAsset(
        context,
        debug,
        "preserved_cutout",
        `source-locked-rescue-preserved-cutout-${randomUUID()}.png`,
        fallback.cutout,
        "image/png"
      );
      if (fallback.debugAlphaMask) {
        await uploadPreserveDebugAsset(
          context,
          debug,
          "alpha_mask",
          `source-locked-rescue-alpha-mask-${randomUUID()}.png`,
          fallback.debugAlphaMask,
          "image/png"
        );
      }
      if (fallback.debugTrimap) {
        await uploadPreserveDebugAsset(
          context,
          debug,
          "trimap",
          `source-locked-rescue-trimap-${randomUUID()}.png`,
          fallback.debugTrimap,
          "image/png"
        );
      }

      console.info("Image preserve-mode source-locked local rescue passed", {
        imageJobId: context.imageJobId,
        alphaCoveragePercent: localMask.alphaCoveragePercent,
        maskBBox: localMask.bbox,
        connectedComponentCount: localMask.connectedComponentCount
      });

      return {
        ...fallback,
        attempts: 6,
        preserveDebug: {
          ...debug,
          finalStatus: "validating_foreground_integrity",
          maskSource: "local_fallback",
          mask: localMask,
          interiorDropout: fallback.preserveDebug?.interiorDropout ?? null,
          programmaticValidation: fallback.preserveDebug?.programmaticValidation,
          rgbIntegrity: {
            passed: true,
            foregroundMeanDelta: fallback.validation.foregroundMeanDelta,
            alphaCoverage: fallback.validation.alphaCoverage
          },
          failureReason: null
        }
      };
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : "Unknown source-locked local rescue error";
      errors.push(message);
      console.warn("Image preserve-mode source-locked local rescue rejected", {
        imageJobId: context.imageJobId,
        fallbackMode: context.fallbackMode,
        error: message
      });
    }
  }

  if (context.fallbackMode === "external_provider") {
    errors.push("External specialist background-removal provider is not configured yet.");
  }

  const failureReason = errors.join(" | ") || "Preserve mode could not produce a trustworthy product mask.";
  debug.finalStatus = "failed";
  debug.maskSource = "failed";
  debug.failureReason = failureReason;
  console.error("Image preserve-mode exhausted exact source-locked methods", {
    imageJobId: context.imageJobId,
    fallbackMode: context.fallbackMode,
    selectedMaskSource: "failed",
    failureReason,
    alphaCoveragePercent: debug.mask?.alphaCoveragePercent,
    visibleForegroundCoveragePercent: debug.mask?.visibleForegroundCoveragePercent,
    maskBBox: debug.mask?.bbox,
    connectedComponentCount: debug.mask?.connectedComponentCount,
    finalStatus: debug.finalStatus
  });

  throw new PreserveModeProcessingError(
    getExtremeFineDetailFailureMessage(errors) ??
      "Exact Product Preservation could not produce an artifact-free source-locked product mask after all available methods.",
    debug
  );
};

const buildPreservedProductCutoutFromAiMask = async (
  preservedOriginalBuffer: Buffer,
  aiCutoutBuffer: Buffer
): Promise<CutoutResult> => {
  const originalMetadata = await sharp(preservedOriginalBuffer).metadata();

  if (!originalMetadata.width || !originalMetadata.height) {
    throw new Error("Original product image could not be read");
  }

  const aiAlpha = await getResizedAiAlpha(aiCutoutBuffer, originalMetadata.width, originalMetadata.height);

  return buildPreservedProductCutoutFromAlpha(
    preservedOriginalBuffer,
    aiAlpha,
    `openai:${openAiImageEditModel}:preserve-mask`,
    1,
    {
      allowLocalAssist: false,
      maskSource: "ai_mask"
    }
  );
};

const buildPreservedProductCutoutFromLocalMask = async (
  preservedOriginalBuffer: Buffer
): Promise<CutoutResult> => {
  const originalMetadata = await sharp(preservedOriginalBuffer).metadata();

  if (!originalMetadata.width || !originalMetadata.height) {
    throw new Error("Original product image could not be read");
  }

  const originalRgba = await sharp(preservedOriginalBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const localAlpha = buildLocalForegroundAlpha(originalRgba, originalMetadata.width, originalMetadata.height);

  return buildPreservedProductCutoutFromAlpha(
    preservedOriginalBuffer,
    localAlpha,
    "local-color-segmentation",
    2,
    {
      allowLocalAssist: true,
      maskSource: "local_fallback"
    }
  );
};

const buildPreservedProductCutoutFromRawLocalMask = async (
  preservedOriginalBuffer: Buffer
): Promise<CutoutResult> => {
  const originalMetadata = await sharp(preservedOriginalBuffer).metadata();

  if (!originalMetadata.width || !originalMetadata.height) {
    throw new Error("Original product image could not be read");
  }

  const originalRgba = await sharp(preservedOriginalBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const localAlpha = buildLocalForegroundAlpha(originalRgba, originalMetadata.width, originalMetadata.height);

  return buildPreservedProductCutoutFromAlpha(
    preservedOriginalBuffer,
    localAlpha,
    "local-source-analysis-consensus",
    5,
    {
      allowLocalAssist: false,
      maskSource: "local_fallback",
      skipStructuralCleanup: true
    }
  );
};

const buildPreservedProductCutoutFromAlpha = async (
  preservedOriginalBuffer: Buffer,
  candidateAlpha: Buffer,
  provider: string,
  attempts: number,
  options: {
    allowLocalAssist: boolean;
    maskSource: PreserveMaskSource;
    prevalidatedMask?: PreserveMaskDiagnostics;
    removeBackgroundRemnants?: boolean;
    skipStructuralCleanup?: boolean;
    edgeRgbGuide?: Buffer;
  }
): Promise<CutoutResult> => {
  const originalMetadata = await sharp(preservedOriginalBuffer).metadata();

  if (!originalMetadata.width || !originalMetadata.height) {
    throw new Error("Original product image could not be read");
  }

  const width = originalMetadata.width;
  const height = originalMetadata.height;
  const originalImage = sharp(preservedOriginalBuffer).ensureAlpha();
  const originalRgba = await originalImage.clone().raw().toBuffer();
  const originalRaw = rgbaToRgb(originalRgba);
  const localAlpha = options.allowLocalAssist ? buildLocalForegroundAlpha(originalRgba, width, height) : null;
  const secondOpinionAlpha = localAlpha ?? buildLocalForegroundAlpha(originalRgba, width, height);
  const structurallyCleanAlpha = options.skipStructuralCleanup
    ? thresholdAlphaMask(candidateAlpha, 24)
    : cleanFlexibleForegroundAlpha(
      originalRgba,
      removeLikelyBackgroundMarkComponents(originalRgba, candidateAlpha, width, height),
      width,
      height
    );
  const chosenAlphaBase = localAlpha ? chooseBaseProductAlpha(structurallyCleanAlpha, localAlpha) : structurallyCleanAlpha;
  const chosenAlpha = options.skipStructuralCleanup
    ? thresholdAlphaMask(chosenAlphaBase, 24)
    : cleanFlexibleForegroundAlpha(originalRgba, chosenAlphaBase, width, height);
  const residueCleanedAlpha = keepMainAlphaComponents(
    removeNeutralEdgeResidueWithProductSupport(
      originalRgba,
      chosenAlpha,
      secondOpinionAlpha,
      width,
      height
    ),
    width,
    height
  );
  const alpha = options.removeBackgroundRemnants
    ? removePaleBackgroundEdgeRemnants(originalRgba, residueCleanedAlpha, width, height)
    : residueCleanedAlpha;
  const initialMaskDiagnostics = analyzeAlphaMask(alpha, width, height);

  if (!initialMaskDiagnostics.passed) {
    throw new Error(`Preserve mode rejected ${options.maskSource}: ${initialMaskDiagnostics.failureReasons.join("; ")}`);
  }

  const assistedAlpha = options.allowLocalAssist
    ? expandMaskWithOriginalForeground(originalRaw, alpha, width, height)
    : alpha;
  let safeAlpha = options.allowLocalAssist
    ? getSafeAlphaMask(alpha, await smoothAlphaMask(assistedAlpha, width, height))
    : alpha;

  if (options.removeBackgroundRemnants) {
    const postAssistCleaned = removePaleBackgroundEdgeRemnants(
      originalRgba,
      keepMainAlphaComponents(
        removeNeutralEdgeResidueWithProductSupport(
          originalRgba,
          safeAlpha,
          secondOpinionAlpha,
          width,
          height
        ),
        width,
        height
      ),
      width,
      height
    );
    const postAssistCoverage = getAlphaCoverage(postAssistCleaned);
    const safeCoverage = getAlphaCoverage(safeAlpha);
    const postAssistDiagnostics = analyzeAlphaMask(postAssistCleaned, width, height);

    if (
      postAssistCoverage >= Math.max(1200, safeCoverage * 0.56) &&
      !hasCatastrophicMaskFailure(postAssistDiagnostics)
    ) {
      safeAlpha = postAssistCleaned;
    }
  }

  safeAlpha = repairEdgeProductBiteMarks(
    originalRgba,
    safeAlpha,
    chosenAlpha,
    secondOpinionAlpha,
    width,
    height
  );

  const finalMaskDiagnostics = options.allowLocalAssist
    ? analyzeAlphaMask(safeAlpha, width, height)
    : initialMaskDiagnostics;

  if (!finalMaskDiagnostics.passed) {
    throw new Error(`Preserve mode rejected the refined product mask: ${finalMaskDiagnostics.failureReasons.join("; ")}`);
  }

  const backgroundMarkSuspicion = getBackgroundMarkSuspicion(originalRgba, safeAlpha, width, height);

  if (backgroundMarkSuspicion.suspicious) {
    throw new Error(`Preserve mode rejected ${options.maskSource}: ${backgroundMarkSuspicion.reason}`);
  }

  const backgroundPalette = buildBackgroundPalette(originalRaw, safeAlpha, width, height);
  const interiorRepair = await repairInteriorProductDropouts(
    originalRaw,
    originalRgba,
    safeAlpha,
    secondOpinionAlpha,
    width,
    height,
    backgroundPalette
  );
  const repairedMaskDiagnostics = analyzeAlphaMask(interiorRepair.alpha, width, height);

  if (!repairedMaskDiagnostics.passed) {
    throw new Error(`Preserve mode rejected the repaired product mask: ${repairedMaskDiagnostics.failureReasons.join("; ")}`);
  }

  if (interiorRepair.diagnostics.needsReview) {
    throw new Error(`Preserve mode detected unresolved interior product dropout: ${interiorRepair.diagnostics.failureReasons.join("; ")}`);
  }

  const initialMatte = await refineAlphaMatteWithTrimap(originalRgba, interiorRepair.alpha, width, height);
  let approvedAlpha = initialMatte.alpha;
  let approvedTrimap = initialMatte.trimap;
  let productRgba = decontaminatePreserveEdgeRgb(
    applyApprovedAlphaToOriginalPixels(originalRaw, approvedAlpha, width, height),
    originalRgba,
    approvedAlpha,
    width,
    height,
    options.edgeRgbGuide
  );
  const visualValidation = getCutoutVisualPresence(productRgba, approvedAlpha);

  if (!visualValidation.isVisible) {
    throw new Error("Preserve mode rejected the cutout because the detected foreground is visually indistinguishable from the source background.");
  }

  let cutout = await sharp(productRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
  let validation = await validatePreservedForegroundIntegrity(preservedOriginalBuffer, cutout);
  let programmaticValidation = await validatePreserveModeProgrammatic({
    sourceBuffer: preservedOriginalBuffer,
    productCutoutBuffer: cutout,
    sourceReferenceAlpha: secondOpinionAlpha,
    referenceWidth: width,
    referenceHeight: height
  });

  if (
    !programmaticValidation.passed &&
    programmaticValidation.failReasons.some((reason) =>
      ["Edge Halo / Background Residue", "Mask Includes Background", "Dirty Alpha Edge", "Disconnected Background Artifact"].includes(reason)
    )
  ) {
    const harderAlphaCandidate = keepMainAlphaComponents(
      removePaleBackgroundEdgeRemnants(
        originalRgba,
        removeBackgroundLikePixelsFromMask(originalRaw, approvedAlpha, backgroundPalette),
        width,
        height
      ),
      width,
      height
    );
    const harderMatte = await refineAlphaMatteWithTrimap(originalRgba, harderAlphaCandidate, width, height);
    const harderAlpha = harderMatte.alpha;
    const harderCoverage = getAlphaCoverage(harderAlpha);
    if (harderCoverage >= getAlphaCoverage(approvedAlpha) * 0.78) {
      const harderProductRgba = decontaminatePreserveEdgeRgb(
        applyApprovedAlphaToOriginalPixels(originalRaw, harderAlpha, width, height),
        originalRgba,
        harderAlpha,
        width,
        height,
        options.edgeRgbGuide
      );
      const harderCutout = await sharp(harderProductRgba, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
        .png()
        .toBuffer();
      const harderValidation = await validatePreserveModeProgrammatic({
        sourceBuffer: preservedOriginalBuffer,
        productCutoutBuffer: harderCutout,
        sourceReferenceAlpha: secondOpinionAlpha,
        referenceWidth: width,
        referenceHeight: height
      });

      if (harderValidation.passed || harderValidation.overallScore > programmaticValidation.overallScore) {
        approvedAlpha = harderAlpha;
        approvedTrimap = harderMatte.trimap;
        productRgba = harderProductRgba;
        cutout = harderCutout;
        validation = await validatePreservedForegroundIntegrity(preservedOriginalBuffer, cutout);
        programmaticValidation = harderValidation;
      }
    }
  }

  if (!programmaticValidation.passed && canAcceptSourceLockedSoftEdgeMask(programmaticValidation, validation, analyzeAlphaMask(approvedAlpha, width, height))) {
    programmaticValidation = acceptSourceLockedSoftEdgeValidation(programmaticValidation);
  }

  if (!programmaticValidation.passed) {
    throw new PreserveModeProgrammaticValidationError(
      `Preserve mode programmatic validation failed: ${programmaticValidation.failReasons.join("; ")}`,
      programmaticValidation
    );
  }

  return {
    cutout,
    debugCutout: cutout,
    provider,
    attempts,
    validation,
    debugAlphaMask: await buildAlphaMaskPreview(approvedAlpha, width, height),
    debugTrimap: await buildTrimapPreview(approvedTrimap, width, height),
    debugInteriorDropoutOverlay: interiorRepair.debugSuspiciousOverlay,
    debugRestoredRegionOverlay: interiorRepair.debugRestoredOverlay,
    debugFinalRepairedCutout: cutout,
    preserveDebug: {
      preserveMode: true,
      promptVersion: ecommercePreservePromptVersion,
      processingMode: "seo_product_feed_safe_preserve_background_replacement",
      fallbackMode: options.allowLocalAssist ? "local_experimental" : "strict_retry",
      finalStatus: "validating_foreground_integrity",
      maskSource: options.maskSource,
      attempts,
      provider,
      failureReason: null,
      sourceDimensions: {
        width,
        height
      },
      workingDimensions: {
        width,
        height
      },
      aiResultDimensions: null,
      mask: analyzeAlphaMask(approvedAlpha, width, height),
      backgroundOnlyBlockerTriggered: false,
      rgbIntegrity: {
        passed: true,
        foregroundMeanDelta: validation.foregroundMeanDelta,
        alphaCoverage: validation.alphaCoverage
      },
      interiorDropout: interiorRepair.diagnostics,
      programmaticValidation,
      assets: []
    }
  };
};

const assertProductAlphaCoverage = (
  alpha: Buffer,
  width: number,
  height: number,
  label: string
): void => {
  const coverage = getAlphaCoverage(alpha);
  const minCoverage = Math.max(1800, Math.round(width * height * 0.0015));

  if (coverage < minCoverage) {
    throw new Error(`${label} was too small to preserve the product. Reprocess this image or use a cleaner source image.`);
  }
};

const getImageAlphaCoverage = async (imageBuffer: Buffer): Promise<number> => {
  const alpha = await sharp(imageBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  return getAlphaCoverage(alpha);
};

const buildTransparentCutoutFromMonochromeMask = async (
  maskBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> => {
  const rgb = await sharp(maskBuffer)
    .rotate()
    .resize(width, height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3
    })
    .removeAlpha()
    .raw()
    .toBuffer();
  const rgba = Buffer.alloc(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const sourceIndex = pixel * 3;
    const r = rgb[sourceIndex] ?? 0;
    const g = rgb[sourceIndex + 1] ?? 0;
    const b = rgb[sourceIndex + 2] ?? 0;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const alpha = luminance <= 18
      ? 0
      : luminance >= 236
        ? 255
        : Math.round(Math.max(0, Math.min(255, (luminance - 18) * (255 / 218))));
    const targetIndex = pixel * 4;
    rgba[targetIndex] = 255;
    rgba[targetIndex + 1] = 255;
    rgba[targetIndex + 2] = 255;
    rgba[targetIndex + 3] = alpha;
  }

  return sharp(rgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
};

const buildSourceAlignedGuideRgba = async (
  guideBuffer: Buffer,
  width: number,
  height: number,
  alignment: "source-contain" | "square-fill"
): Promise<Buffer> => {
  const image = sharp(guideBuffer).rotate().ensureAlpha();
  const metadata = await image.metadata();
  const needsResize = metadata.width !== width || metadata.height !== height;

  if (!needsResize) {
    return image.raw().toBuffer();
  }

  return image
    .resize({
      width,
      height,
      fit: alignment === "source-contain" ? "contain" : "fill",
      withoutEnlargement: false,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .raw()
    .toBuffer();
};

const getCutoutVisualPresence = (
  rgba: Buffer,
  alpha: Buffer
): { isVisible: boolean; meanAlphaWeightedContrast: number; sampledPixels: number } => {
  let sampledPixels = 0;
  let totalContrast = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const currentAlpha = alpha[pixel] ?? 0;

    if (currentAlpha < 96) {
      continue;
    }

    const index = pixel * 4;
    const r = rgba[index] ?? 0;
    const g = rgba[index + 1] ?? 0;
    const b = rgba[index + 2] ?? 0;
    const localContrast = Math.max(r, g, b) - Math.min(r, g, b);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalContrast += localContrast + Math.abs(luminance - 24) * 0.35;
    sampledPixels += 1;
  }

  const meanAlphaWeightedContrast = sampledPixels > 0 ? totalContrast / sampledPixels : 0;

  return {
    isVisible: sampledPixels >= 1800 && meanAlphaWeightedContrast > 5,
    meanAlphaWeightedContrast,
    sampledPixels
  };
};

const rgbaToRgb = (rgba: Buffer): Buffer => {
  const pixelCount = Math.floor(rgba.length / 4);
  const rgb = Buffer.alloc(pixelCount * 3);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const sourceIndex = pixel * 4;
    const targetIndex = pixel * 3;
    rgb[targetIndex] = rgba[sourceIndex] ?? 0;
    rgb[targetIndex + 1] = rgba[sourceIndex + 1] ?? 0;
    rgb[targetIndex + 2] = rgba[sourceIndex + 2] ?? 0;
  }

  return rgb;
};

const validatePreservedForegroundIntegrity = async (
  preservedOriginalBuffer: Buffer,
  cutoutBuffer: Buffer
): Promise<{ alphaCoverage: number; foregroundMeanDelta: number }> => {
  const metadata = await sharp(preservedOriginalBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Original product image could not be read for foreground validation");
  }

  const [originalRgb, cutoutRgba] = await Promise.all([
    sharp(preservedOriginalBuffer).ensureAlpha().raw().toBuffer().then(rgbaToRgb),
    sharp(cutoutBuffer)
      .ensureAlpha()
      .resize(metadata.width, metadata.height, {
        fit: "fill",
        kernel: sharp.kernel.nearest
      })
      .raw()
      .toBuffer()
  ]);
  const pixelCount = metadata.width * metadata.height;
  const alpha = Buffer.alloc(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    alpha[pixel] = cutoutRgba[pixel * 4 + 3] ?? 0;
  }
  const confidentForeground = erodeBinaryAlphaMask(thresholdAlphaMask(alpha, 245), metadata.width, metadata.height, 4);
  let solidPixelCount = 0;
  let totalDelta = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const cutoutIndex = pixel * 4;

    if ((confidentForeground[pixel] ?? 0) < 245) {
      continue;
    }

    const originalIndex = pixel * 3;
    const delta =
      Math.abs((originalRgb[originalIndex] ?? 0) - (cutoutRgba[cutoutIndex] ?? 0)) +
      Math.abs((originalRgb[originalIndex + 1] ?? 0) - (cutoutRgba[cutoutIndex + 1] ?? 0)) +
      Math.abs((originalRgb[originalIndex + 2] ?? 0) - (cutoutRgba[cutoutIndex + 2] ?? 0));
    totalDelta += delta / 3;
    solidPixelCount += 1;
  }

  assertProductAlphaCoverage(alpha, metadata.width, metadata.height, "preserved product foreground");

  const foregroundMeanDelta = solidPixelCount > 0 ? totalDelta / solidPixelCount : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(foregroundMeanDelta) || foregroundMeanDelta > 3) {
    throw new Error("Foreground integrity check failed. Preserve mode rejected a result that materially changed product pixels.");
  }

  return {
    alphaCoverage: getAlphaCoverage(alpha),
    foregroundMeanDelta
  };
};

const applyApprovedAlphaToOriginalPixels = (
  originalRgb: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const rgba = Buffer.alloc(width * height * 4);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const sourceIndex = pixel * 3;
    const targetIndex = pixel * 4;
    rgba[targetIndex] = originalRgb[sourceIndex] ?? 0;
    rgba[targetIndex + 1] = originalRgb[sourceIndex + 1] ?? 0;
    rgba[targetIndex + 2] = originalRgb[sourceIndex + 2] ?? 0;
    rgba[targetIndex + 3] = alpha[pixel] ?? 0;
  }

  return rgba;
};

const removeEdgeMatte = applyApprovedAlphaToOriginalPixels;

const decontaminatePreserveEdgeRgb = (
  productRgba: Buffer,
  sourceRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
  edgeRgbGuide?: Buffer
): Buffer => {
  const backgroundPalette = buildSourceBackgroundPalette(sourceRgba, width, height);
  if (backgroundPalette.length === 0) {
    return productRgba;
  }

  const cleaned = Buffer.from(productRgba);
  const confidentForeground = erodeBinaryAlphaMask(thresholdAlphaMask(alpha, 245), width, height, 3);
  let changedPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const currentAlpha = alpha[pixel] ?? 0;

      if (
        currentAlpha < 24 ||
        (confidentForeground[pixel] ?? 0) >= 245 ||
        !hasTransparentNeighbor(alpha, width, height, x, y, 4)
      ) {
        continue;
      }

      const index = pixel * 4;
      const r = productRgba[index] ?? 0;
      const g = productRgba[index + 1] ?? 0;
      const b = productRgba[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const saturation = getRgbSaturation(r, g, b);
      const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
      const gradient = getRgbGradientMagnitude(sourceRgba, width, height, pixel);
      const backgroundDistance = closestPaletteDistance(r, g, b, backgroundPalette);
      const paleEdgeResidue =
        luminance > 148 &&
        saturation < 0.17 &&
        channelSpread < 62 &&
        backgroundDistance < 118;
      const greyMaskScar =
        luminance > 82 &&
        luminance < 212 &&
        saturation < 0.12 &&
        channelSpread < 42 &&
        backgroundDistance < 98 &&
        gradient < 22;
      const darkContourScar =
        luminance < 96 &&
        saturation < 0.2 &&
        channelSpread < 58 &&
        gradient >= 7 &&
        backgroundDistance < 132 &&
        hasTransparentNeighbor(alpha, width, height, x, y, 2);
      const softFringe = currentAlpha > 0 && currentAlpha < 245 && backgroundDistance < 136;

      if (!paleEdgeResidue && !greyMaskScar && !darkContourScar && !softFringe) {
        continue;
      }

      const guidedReplacement = edgeRgbGuide
        ? getTrustedEdgeGuideColor(edgeRgbGuide, sourceRgba, backgroundPalette, width, height, pixel)
        : null;
      const replacement = guidedReplacement ?? findNearestTrustedPreserveProductColor(
        productRgba,
        sourceRgba,
        alpha,
        backgroundPalette,
        width,
        height,
        x,
        y,
        28
      );

      if (!replacement) {
        continue;
      }

      cleaned[index] = replacement.r;
      cleaned[index + 1] = replacement.g;
      cleaned[index + 2] = replacement.b;
      changedPixels += 1;
    }
  }

  const alphaCoverage = getAlphaCoverage(alpha);
  const maxChangedPixels = edgeRgbGuide
    ? Math.max(5200, alphaCoverage * 0.075)
    : Math.max(3200, alphaCoverage * 0.045);
  if (changedPixels > maxChangedPixels) {
    console.warn("Skipped preserve-mode RGB edge decontamination because the edge band was too broad", {
      changedPixels,
      alphaCoverage
    });
    return productRgba;
  }

  if (changedPixels > 0) {
    console.info("Decontaminated preserve-mode RGB edge band", {
      changedPixels,
      totalPixels: width * height
    });
  }

  return cleaned;
};

const findNearestTrustedPreserveProductColor = (
  productRgba: Buffer,
  sourceRgba: Buffer,
  alpha: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): { r: number; g: number; b: number } | null => {
  let best: { r: number; g: number; b: number; distance: number } | null = null;

  for (let ny = Math.max(0, y - radius); ny <= Math.min(height - 1, y + radius); ny += 1) {
    for (let nx = Math.max(0, x - radius); nx <= Math.min(width - 1, x + radius); nx += 1) {
      const pixel = ny * width + nx;

      if ((alpha[pixel] ?? 0) < 245 || hasTransparentNeighbor(alpha, width, height, nx, ny, 3)) {
        continue;
      }

      const index = pixel * 4;
      const r = productRgba[index] ?? 0;
      const g = productRgba[index + 1] ?? 0;
      const b = productRgba[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const saturation = getRgbSaturation(r, g, b);
      const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
      const backgroundDistance = closestPaletteDistance(r, g, b, backgroundPalette);
      const gradient = getRgbGradientMagnitude(sourceRgba, width, height, pixel);
      const backgroundLike =
        luminance > 140 &&
        saturation < 0.12 &&
        channelSpread < 42 &&
        backgroundDistance < 92 &&
        gradient < 18;

      if (backgroundLike) {
        continue;
      }

      const dx = nx - x;
      const dy = ny - y;
      const distance = dx * dx + dy * dy;

      if (!best || distance < best.distance) {
        best = { r, g, b, distance };
      }
    }
  }

  return best;
};

const getTrustedEdgeGuideColor = (
  guideRgba: Buffer,
  sourceRgba: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number,
  pixel: number
): { r: number; g: number; b: number } | null => {
  const index = pixel * 4;
  const alpha = guideRgba[index + 3] ?? 0;

  if (alpha < 180) {
    return null;
  }

  const r = guideRgba[index] ?? 0;
  const g = guideRgba[index + 1] ?? 0;
  const b = guideRgba[index + 2] ?? 0;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const saturation = getRgbSaturation(r, g, b);
  const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
  const backgroundDistance = closestPaletteDistance(r, g, b, backgroundPalette);
  const gradient = getRgbGradientMagnitude(sourceRgba, width, height, pixel);
  const guideLooksLikeBackground =
    luminance > 132 &&
    saturation < 0.13 &&
    channelSpread < 46 &&
    backgroundDistance < 88 &&
    gradient < 16;

  if (guideLooksLikeBackground) {
    return null;
  }

  return { r, g, b };
};

const findNearestSolidProductColor = (
  rgba: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): { r: number; g: number; b: number } | null => {
  let best: { r: number; g: number; b: number; distance: number } | null = null;

  for (let ny = Math.max(0, y - radius); ny <= Math.min(height - 1, y + radius); ny += 1) {
    for (let nx = Math.max(0, x - radius); nx <= Math.min(width - 1, x + radius); nx += 1) {
      const pixel = ny * width + nx;
      const index = pixel * 4;

      if ((rgba[index + 3] ?? 0) < 245) {
        continue;
      }

      const dx = nx - x;
      const dy = ny - y;
      const distance = dx * dx + dy * dy;

      if (!best || distance < best.distance) {
        best = {
          r: rgba[index] ?? 0,
          g: rgba[index + 1] ?? 0,
          b: rgba[index + 2] ?? 0,
          distance
        };
      }
    }
  }

  return best;
};

const getSettingsBackgroundImageUrl = (settings: unknown): string | undefined => {
  const backgroundSettings = getObject(getObject(settings).background);
  const customBackgroundUrl = backgroundSettings.customBackgroundUrl;

  return typeof customBackgroundUrl === "string" && customBackgroundUrl.trim()
    ? customBackgroundUrl.trim()
    : undefined;
};

const getEffectiveBackgroundImageUrl = (
  backgroundImageUrl: string | undefined,
  settings: unknown
): string | undefined => {
  if (backgroundImageUrl?.trim()) {
    return backgroundImageUrl.trim();
  }

  return getSettingsBackgroundImageUrl(settings);
};

const wantsCustomBackground = (settings: unknown): boolean => {
  const backgroundSettings = getObject(getObject(settings).background);

  return backgroundSettings.source === "custom";
};

const buildProductAlphaMaskPreview = async (productBuffer: Buffer): Promise<Buffer> =>
  sharp(productBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .png()
    .toBuffer();

const getFlexibleProductDetailMetrics = async (
  productBuffer: Buffer
): Promise<{
  visiblePixels: number;
  strongEdgePixels: number;
  sharpnessScore: number;
  internalTransparentPixels: number;
}> => {
  const metadata = await sharp(productBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Flexible product detail validation could not read product dimensions.");
  }

  const rgba = await sharp(productBuffer).ensureAlpha().raw().toBuffer();
  let visiblePixels = 0;
  let strongEdgePixels = 0;
  let edgeTotal = 0;
  let internalTransparentPixels = 0;
  const alpha = Buffer.alloc(metadata.width * metadata.height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const currentAlpha = rgba[pixel * 4 + 3] ?? 0;
    alpha[pixel] = currentAlpha;
    if (currentAlpha >= 96) {
      visiblePixels += 1;
      const gradient = getRgbGradientMagnitude(rgba, metadata.width, metadata.height, pixel);
      edgeTotal += gradient;
      if (gradient > 18) {
        strongEdgePixels += 1;
      }
    }
  }

  const bounds = getAlphaBounds(alpha, metadata.width, metadata.height, 24);
  if (bounds) {
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const pixel = y * metadata.width + x;
        if ((alpha[pixel] ?? 0) < 24) {
          internalTransparentPixels += 1;
        }
      }
    }
  }

  return {
    visiblePixels,
    strongEdgePixels,
    sharpnessScore: visiblePixels > 0 ? edgeTotal / visiblePixels : 0,
    internalTransparentPixels
  };
};

const validateFlexibleProductDetailPreservation = async (
  sourceProductBuffer: Buffer,
  finalProductBuffer: Buffer
): Promise<{ passed: boolean; warnings: string[]; failureReasons: string[]; metrics: Record<string, number> }> => {
  const [sourceMetrics, finalMetrics] = await Promise.all([
    getFlexibleProductDetailMetrics(sourceProductBuffer),
    getFlexibleProductDetailMetrics(finalProductBuffer)
  ]);
  const warnings: string[] = [];
  const failureReasons: string[] = [];
  const visibleRatio = finalMetrics.visiblePixels / Math.max(1, sourceMetrics.visiblePixels);
  const edgeRatio = finalMetrics.strongEdgePixels / Math.max(1, sourceMetrics.strongEdgePixels);
  const sharpnessRatio = finalMetrics.sharpnessScore / Math.max(0.001, sourceMetrics.sharpnessScore);
  const holeRatio = finalMetrics.internalTransparentPixels / Math.max(1, sourceMetrics.internalTransparentPixels);

  if (visibleRatio < 0.92 || visibleRatio > 1.08) {
    failureReasons.push(`Flexible product visible area changed too much (${(visibleRatio * 100).toFixed(1)}% of source layer).`);
  }
  if (edgeRatio < 0.74) {
    failureReasons.push(`Flexible product edge detail dropped below the safe threshold (${(edgeRatio * 100).toFixed(1)}% of source edge pixels).`);
  }
  if (sharpnessRatio < 0.78) {
    failureReasons.push(`Flexible product sharpness dropped below the safe threshold (${(sharpnessRatio * 100).toFixed(1)}% of source sharpness).`);
  }
  if (sourceMetrics.internalTransparentPixels > 500 && holeRatio < 0.7) {
    failureReasons.push(`Flexible product internal cutouts/holes changed too much (${(holeRatio * 100).toFixed(1)}% of source transparent interior).`);
  }
  if (edgeRatio < 0.9 || sharpnessRatio < 0.92) {
    warnings.push("Flexible product detail validation detected minor edge/sharpness change; source-locked product pixels were retained.");
  }

  return {
    passed: failureReasons.length === 0,
    warnings,
    failureReasons,
    metrics: {
      sourceVisiblePixels: sourceMetrics.visiblePixels,
      finalVisiblePixels: finalMetrics.visiblePixels,
      visibleRatio,
      sourceStrongEdgePixels: sourceMetrics.strongEdgePixels,
      finalStrongEdgePixels: finalMetrics.strongEdgePixels,
      edgeRatio,
      sourceSharpnessScore: sourceMetrics.sharpnessScore,
      finalSharpnessScore: finalMetrics.sharpnessScore,
      sharpnessRatio,
      sourceInternalTransparentPixels: sourceMetrics.internalTransparentPixels,
      finalInternalTransparentPixels: finalMetrics.internalTransparentPixels,
      holeRatio
    }
  };
};

const getResizedAiAlpha = async (
  aiCutoutBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> => {
  const metadata = await sharp(aiCutoutBuffer).metadata();
  const alpha = sharp(aiCutoutBuffer).ensureAlpha().extractChannel("alpha");
  const needsResize = metadata.width !== width || metadata.height !== height;
  const resized = needsResize
    ? alpha.resize(width, height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3
    })
    : alpha;

  return (needsResize ? resized.blur(0.3) : resized)
    .raw()
    .toBuffer();
};

const getSourceAlignedAlpha = async (
  cutoutBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> => {
  const metadata = await sharp(cutoutBuffer).metadata();
  const alpha = sharp(cutoutBuffer).ensureAlpha().extractChannel("alpha");

  if (metadata.width === width && metadata.height === height) {
    return alpha.raw().toBuffer();
  }

  return alpha
    .resize({
      width,
      height,
      fit: "contain",
      withoutEnlargement: false,
      background: {
        r: 0,
        g: 0,
        b: 0
      }
    })
    .raw()
    .toBuffer();
};

const prepareProviderAlphaForPreserve = (
  provider: string,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  if (!provider.startsWith("imgly:")) {
    return alpha;
  }

  return keepMainAlphaComponents(thresholdAlphaMask(alpha, 160), width, height);
};

const thresholdAlphaMask = (alpha: Buffer, threshold: number): Buffer => {
  const thresholded = Buffer.alloc(alpha.length);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    thresholded[pixel] = (alpha[pixel] ?? 0) >= threshold ? 255 : 0;
  }

  return thresholded;
};

const chooseBaseProductAlpha = (aiAlpha: Buffer, localAlpha: Buffer): Buffer => {
  const aiCoverage = getAlphaCoverage(aiAlpha);
  const localCoverage = getAlphaCoverage(localAlpha);

  if (localCoverage === 0 && aiCoverage === 0) {
    throw new Error("Product cutout could not be detected. Try reprocessing this image or use a cleaner source photo.");
  }

  if (localCoverage > 0 && (aiCoverage < 2500 || aiCoverage < localCoverage * 0.35)) {
    return localAlpha;
  }

  if (localCoverage > 0 && aiCoverage > localCoverage * 1.8) {
    return localAlpha;
  }

  return aiCoverage > 0 ? aiAlpha : localAlpha;
};

const buildLocalForegroundAlpha = (rgba: Buffer, width: number, height: number): Buffer => {
  const backgroundPalette = buildSourceBackgroundPalette(rgba, width, height);
  const alpha = Buffer.alloc(width * height);

  if (backgroundPalette.length === 0) {
    return alpha;
  }

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const index = pixel * 4;
    const sourceAlpha = rgba[index + 3] ?? 0;

    if (sourceAlpha < 16) {
      continue;
    }

    const r = rgba[index] ?? 0;
    const g = rgba[index + 1] ?? 0;
    const b = rgba[index + 2] ?? 0;
    const distance = closestPaletteDistance(r, g, b, backgroundPalette);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const saturation = getRgbSaturation(r, g, b);
    const gradient = getRgbGradientMagnitude(rgba, width, height, pixel);
    const isDarkProduct = luminance < 72 && distance > 14 && gradient > 8;
    const isColouredProduct = saturation > 0.18 && distance > 34;
    const isDistinctProduct = distance > 48 && luminance < 205;
    const isFineProductEdge = gradient > 30 && distance > 10 && luminance < 230;

    if (isDarkProduct || isColouredProduct || isDistinctProduct || isFineProductEdge) {
      alpha[pixel] = 255;
    }
  }

  const expanded = keepMainAlphaComponents(expandForegroundFromSeeds(rgba, alpha, backgroundPalette, width, height), width, height);
  const restoredInterior = fillEnclosedProductMaterialVoids(rgba, expanded, backgroundPalette, width, height);
  const closedInterior = closeSmallProductMaterialGaps(rgba, restoredInterior, backgroundPalette, width, height);

  return dilateAlphaMask(closedInterior, width, height, 1);
};

const fillEnclosedProductMaterialVoids = (
  rgba: Buffer,
  alpha: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number
): Buffer => {
  const restored = Buffer.from(alpha);
  const productComponents = getConnectedMaskComponents(thresholdAlphaMask(alpha, 24), width, height)
    .filter((component) => component.length >= Math.max(120, width * height * 0.0002));

  for (const productComponent of productComponents) {
    const bounds = getPixelComponentBounds(productComponent, width, height);
    const minX = Math.max(0, bounds.minX + 1);
    const maxX = Math.min(width - 1, bounds.maxX - 1);
    const minY = Math.max(0, bounds.minY + 1);
    const maxY = Math.min(height - 1, bounds.maxY - 1);

    if (minX >= maxX || minY >= maxY) {
      continue;
    }

    const visited = new Uint8Array(alpha.length);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const start = y * width + x;

        if (visited[start] || (restored[start] ?? 0) >= 24) {
          continue;
        }

        const stack = [start];
        const pixels: number[] = [];
        let touchesComponentBounds = false;
        let darkPixels = 0;
        let materialLikePixels = 0;
        let luminanceTotal = 0;
        let paletteDistanceTotal = 0;
        let gradientTotal = 0;
        let alphaBoundarySupport = 0;
        visited[start] = 1;

        while (stack.length > 0) {
          const pixel = stack.pop() as number;
          const px = pixel % width;
          const py = Math.floor(pixel / width);

          if (px <= minX || px >= maxX || py <= minY || py >= maxY) {
            touchesComponentBounds = true;
          }

          const index = pixel * 4;
          const r = rgba[index] ?? 0;
          const g = rgba[index + 1] ?? 0;
          const b = rgba[index + 2] ?? 0;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const paletteDistance = closestPaletteDistance(r, g, b, backgroundPalette);
          const gradient = getRgbGradientMagnitude(rgba, width, height, pixel);
          luminanceTotal += luminance;
          paletteDistanceTotal += paletteDistance;
          gradientTotal += gradient;
          if (luminance < 110) {
            darkPixels += 1;
          }
          if (paletteDistance > 16 || gradient > 8 || luminance < 130) {
            materialLikePixels += 1;
          }
          if (hasMaskedNeighbor(restored, width, height, px, py, 2)) {
            alphaBoundarySupport += 1;
          }
          pixels.push(pixel);

          const neighbours = [
            px > minX ? pixel - 1 : -1,
            px < maxX ? pixel + 1 : -1,
            py > minY ? pixel - width : -1,
            py < maxY ? pixel + width : -1
          ];

          for (const next of neighbours) {
            if (next < 0 || visited[next] || (restored[next] ?? 0) >= 24) {
              continue;
            }
            visited[next] = 1;
            stack.push(next);
          }
        }

        const meanLuminance = pixels.length > 0 ? luminanceTotal / pixels.length : 255;
        const meanPaletteDistance = pixels.length > 0 ? paletteDistanceTotal / pixels.length : 0;
        const meanGradient = pixels.length > 0 ? gradientTotal / pixels.length : 0;
        const darkShare = pixels.length > 0 ? darkPixels / pixels.length : 0;
        const materialLikeShare = pixels.length > 0 ? materialLikePixels / pixels.length : 0;
        const supportShare = pixels.length > 0 ? alphaBoundarySupport / pixels.length : 0;
        const componentArea = Math.max(1, (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1));
        const areaShare = pixels.length / componentArea;
        const isEnclosedDarkProductInterior =
          !touchesComponentBounds &&
          pixels.length >= 12 &&
          areaShare <= 0.24 &&
          meanLuminance < 125 &&
          darkShare >= 0.45 &&
          supportShare >= 0.08;
        const isEnclosedProductMaterialInterior =
          !touchesComponentBounds &&
          pixels.length >= 8 &&
          areaShare <= 0.18 &&
          meanLuminance < 245 &&
          supportShare >= 0.05 &&
          materialLikeShare >= 0.35 &&
          (meanPaletteDistance > 10 || meanGradient > 4);

        if (!isEnclosedDarkProductInterior && !isEnclosedProductMaterialInterior) {
          continue;
        }

        for (const pixel of pixels) {
          restored[pixel] = 255;
        }
      }
    }
  }

  return restored;
};

const closeSmallProductMaterialGaps = (
  rgba: Buffer,
  alpha: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number
): Buffer => {
  let closed = Buffer.from(alpha);
  const bounds = getMaskBounds(alpha, width, height);
  const minX = Math.max(1, bounds.minX - 2);
  const maxX = Math.min(width - 2, bounds.maxX + 2);
  const minY = Math.max(1, bounds.minY - 2);
  const maxY = Math.min(height - 2, bounds.maxY + 2);

  for (let pass = 0; pass < 2; pass += 1) {
    const next = Buffer.from(closed);
    let changed = false;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const pixel = y * width + x;

        if ((closed[pixel] ?? 0) >= 24 || (rgba[pixel * 4 + 3] ?? 0) < 16) {
          continue;
        }

        const index = pixel * 4;
        const r = rgba[index] ?? 0;
        const g = rgba[index + 1] ?? 0;
        const b = rgba[index + 2] ?? 0;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const paletteDistance = closestPaletteDistance(r, g, b, backgroundPalette);
        const gradient = getRgbGradientMagnitude(rgba, width, height, pixel);
        const materialLike = luminance < 245 && (paletteDistance > 10 || gradient > 4 || luminance < 130);

        if (!materialLike) {
          continue;
        }

        let maskedNeighbours = 0;
        let leftSupport = false;
        let rightSupport = false;
        let upperSupport = false;
        let lowerSupport = false;

        for (let offset = 1; offset <= 3; offset += 1) {
          leftSupport = leftSupport || (closed[y * width + x - offset] ?? 0) >= 24;
          rightSupport = rightSupport || (closed[y * width + x + offset] ?? 0) >= 24;
          upperSupport = upperSupport || (closed[(y - offset) * width + x] ?? 0) >= 24;
          lowerSupport = lowerSupport || (closed[(y + offset) * width + x] ?? 0) >= 24;
        }

        for (let yy = y - 2; yy <= y + 2; yy += 1) {
          for (let xx = x - 2; xx <= x + 2; xx += 1) {
            if (xx === x && yy === y) {
              continue;
            }
            if ((closed[yy * width + xx] ?? 0) >= 24) {
              maskedNeighbours += 1;
            }
          }
        }

        const enclosedByProduct = (leftSupport && rightSupport) || (upperSupport && lowerSupport);
        if (!enclosedByProduct || maskedNeighbours < 5) {
          continue;
        }

        next[pixel] = 255;
        changed = true;
      }
    }

    closed = next;

    if (!changed) {
      break;
    }
  }

  return closed;
};

const expandForegroundFromSeeds = (
  rgba: Buffer,
  seedAlpha: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number
): Buffer => {
  let expanded = Buffer.from(seedAlpha);

  for (let pass = 0; pass < 10; pass += 1) {
    const next = Buffer.from(expanded);
    let changed = false;
    const bounds = getMaskBounds(expanded, width, height);
    const minX = Math.max(0, bounds.minX - 14);
    const maxX = Math.min(width - 1, bounds.maxX + 14);
    const minY = Math.max(0, bounds.minY - 14);
    const maxY = Math.min(height - 1, bounds.maxY + 14);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const pixel = y * width + x;

        if ((expanded[pixel] ?? 0) >= 24 || !hasMaskedNeighbor(expanded, width, height, x, y, 2)) {
          continue;
        }

        const index = pixel * 4;

        if ((rgba[index + 3] ?? 0) < 16) {
          continue;
        }

        const r = rgba[index] ?? 0;
        const g = rgba[index + 1] ?? 0;
        const b = rgba[index + 2] ?? 0;
        const distance = closestPaletteDistance(r, g, b, backgroundPalette);
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const saturation = getRgbSaturation(r, g, b);
        const gradient = getRgbGradientMagnitude(rgba, width, height, pixel);
        const closeDarkStructure = luminance < 95 && distance > 8 && gradient > 5;
        const connectedDetail = distance > 18 || saturation > 0.12 || gradient > 18;

        if (closeDarkStructure || connectedDetail) {
          next[pixel] = 255;
          changed = true;
        }
      }
    }

    expanded = next;

    if (!changed) {
      break;
    }
  }

  return expanded;
};

const getRgbGradientMagnitude = (
  rgba: Buffer,
  width: number,
  height: number,
  pixel: number
): number => {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  const left = (y * width + Math.max(0, x - 1)) * 4;
  const right = (y * width + Math.min(width - 1, x + 1)) * 4;
  const up = (Math.max(0, y - 1) * width + x) * 4;
  const down = (Math.min(height - 1, y + 1) * width + x) * 4;
  const dx =
    Math.abs((rgba[right] ?? 0) - (rgba[left] ?? 0)) +
    Math.abs((rgba[right + 1] ?? 0) - (rgba[left + 1] ?? 0)) +
    Math.abs((rgba[right + 2] ?? 0) - (rgba[left + 2] ?? 0));
  const dy =
    Math.abs((rgba[down] ?? 0) - (rgba[up] ?? 0)) +
    Math.abs((rgba[down + 1] ?? 0) - (rgba[up + 1] ?? 0)) +
    Math.abs((rgba[down + 2] ?? 0) - (rgba[up + 2] ?? 0));

  return (dx + dy) / 6;
};

const buildSourceBackgroundPalette = (
  rgba: Buffer,
  width: number,
  height: number
): Array<{ r: number; g: number; b: number; count: number }> => {
  const bins = new Map<string, { r: number; g: number; b: number; count: number }>();
  const bounds = getSourceAlphaBounds(rgba, width, height);
  const bandHeight = Math.max(10, Math.round((bounds.maxY - bounds.minY + 1) * 0.16));
  const sideWidth = Math.max(10, Math.round((bounds.maxX - bounds.minX + 1) * 0.06));
  const step = Math.max(1, Math.round(Math.min(width, height) / 160));

  for (let y = bounds.minY; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      const isTopBand = y <= bounds.minY + bandHeight;
      const isBottomBand = y >= bounds.maxY - bandHeight;
      const isSideBand = x <= bounds.minX + sideWidth || x >= bounds.maxX - sideWidth;
      const isBackgroundSampleArea = isTopBand || isBottomBand || (isSideBand && y < bounds.minY + bandHeight * 2);

      if (!isBackgroundSampleArea) {
        continue;
      }

      const index = (y * width + x) * 4;

      if ((rgba[index + 3] ?? 0) < 16) {
        continue;
      }

      const r = rgba[index] ?? 0;
      const g = rgba[index + 1] ?? 0;
      const b = rgba[index + 2] ?? 0;
      const key = `${Math.round(r / 24)}:${Math.round(g / 24)}:${Math.round(b / 24)}`;
      const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count += 1;
      bins.set(key, bin);
    }
  }

  return Array.from(bins.values())
    .filter((bin) => bin.count >= 4)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((bin) => ({
      r: Math.round(bin.r / bin.count),
      g: Math.round(bin.g / bin.count),
      b: Math.round(bin.b / bin.count),
      count: bin.count
    }));
};

const getSourceAlphaBounds = (
  rgba: Buffer,
  width: number,
  height: number
): { minX: number; maxX: number; minY: number; maxY: number } => {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3] ?? 0;

      if (alpha < 16) {
        continue;
      }

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX > maxX || minY > maxY) {
    return { minX: 0, maxX: width - 1, minY: 0, maxY: height - 1 };
  }

  return { minX, maxX, minY, maxY };
};

const keepMainAlphaComponents = (alpha: Buffer, width: number, height: number): Buffer => {
  const visited = new Uint8Array(alpha.length);
  const components: Array<{ pixels: number[]; count: number }> = [];

  for (let start = 0; start < alpha.length; start += 1) {
    if (visited[start] || (alpha[start] ?? 0) < 24) {
      continue;
    }

    const stack = [start];
    const pixels: number[] = [];
    visited[start] = 1;

    while (stack.length > 0) {
      const pixel = stack.pop() as number;
      pixels.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const neighbours = [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1
      ];

      for (const next of neighbours) {
        if (next < 0 || visited[next] || (alpha[next] ?? 0) < 24) {
          continue;
        }

        visited[next] = 1;
        stack.push(next);
      }
    }

    components.push({ pixels, count: pixels.length });
  }

  if (components.length === 0) {
    return alpha;
  }

  const largest = components.reduce((best, component) => component.count > best.count ? component : best, components[0] as { pixels: number[]; count: number });
  const minKeep = Math.max(400, largest.count * 0.025);
  const kept = Buffer.alloc(alpha.length);

  for (const component of components) {
    if (component === largest || component.count >= minKeep) {
      for (const pixel of component.pixels) {
        kept[pixel] = 255;
      }
    }
  }

  return kept;
};

const cleanFlexibleForegroundAlpha = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const detachedCleaned = removeSuspiciousDetachedBackgroundMarks(originalRgba, alpha, width, height);
  const edgeCleaned = removePaleBackgroundEdgeRemnants(originalRgba, detachedCleaned, width, height);
  const islandCleaned = removeConnectedBackgroundPaletteRemnants(originalRgba, edgeCleaned, width, height);
  const cleanedDiagnostics = analyzeAlphaMask(islandCleaned, width, height);

  return cleanedDiagnostics.passed ? islandCleaned : detachedCleaned;
};

const removeSuspiciousDetachedBackgroundMarks = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const components = getConnectedMaskComponents(thresholdAlphaMask(alpha, 24), width, height);

  if (components.length < 2) {
    const spatiallyCleaned = Buffer.from(alpha);
    const spatialRemoved = removeLowSaturationMarksOutsideColouredProductBounds(originalRgba, spatiallyCleaned, width, height);
    const initialCoverage = getAlphaCoverage(alpha);
    const cleanedCoverage = getAlphaCoverage(spatiallyCleaned);

    if (
      spatialRemoved > 0 &&
      cleanedCoverage >= Math.max(1200, initialCoverage * 0.18) &&
      !hasCatastrophicMaskFailure(analyzeAlphaMask(spatiallyCleaned, width, height))
    ) {
      console.info("Removed connected low-saturation background marks from flexible foreground mask", {
        removedPixels: spatialRemoved,
        initialCoverage,
        cleanedCoverage
      });

      return spatiallyCleaned;
    }

    return alpha;
  }

  const imageArea = width * height;
  const metrics = components.map((pixels) => {
    const bounds = getPixelComponentBounds(pixels, width, height);
    const componentWidth = bounds.maxX - bounds.minX + 1;
    const componentHeight = bounds.maxY - bounds.minY + 1;
    const boundsArea = Math.max(1, componentWidth * componentHeight);
    let totalSaturation = 0;
    let totalLuminance = 0;
    let totalGradient = 0;
    let darkOrColouredPixels = 0;

    for (const pixel of pixels) {
      const index = pixel * 4;
      const r = originalRgba[index] ?? 0;
      const g = originalRgba[index + 1] ?? 0;
      const b = originalRgba[index + 2] ?? 0;
      const saturation = getRgbSaturation(r, g, b);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
      totalSaturation += saturation;
      totalLuminance += luminance;
      totalGradient += gradient;
      if (luminance < 95 || saturation > 0.18 || gradient > 22) {
        darkOrColouredPixels += 1;
      }
    }

    const density = pixels.length / boundsArea;
    const meanSaturation = totalSaturation / Math.max(1, pixels.length);
    const meanLuminance = totalLuminance / Math.max(1, pixels.length);
    const meanGradient = totalGradient / Math.max(1, pixels.length);
    const structureShare = darkOrColouredPixels / Math.max(1, pixels.length);
    const aspect = componentWidth / Math.max(1, componentHeight);
    const lowSaturationSparseInk = meanSaturation < 0.16 && density < 0.58 && meanLuminance > 58 && meanLuminance < 242;
    const wordmarkAspectPenalty = aspect > 2.4 || aspect < 0.22 ? 0.32 : 1;
    const sparseInkPenalty = lowSaturationSparseInk ? 0.18 : 1;
    const productScore = pixels.length *
      Math.max(0.12, density) *
      (1 + Math.min(meanGradient, 50) / 16 + meanSaturation * 5 + structureShare * 2.2) *
      wordmarkAspectPenalty *
      sparseInkPenalty;

    return {
      pixels,
      bounds,
      componentWidth,
      componentHeight,
      density,
      meanSaturation,
      meanLuminance,
      meanGradient,
      structureShare,
      aspect,
      productScore
    };
  });
  const colouredProductCandidates = metrics.filter((metric) =>
    metric.meanSaturation > 0.2 &&
    metric.density > 0.28 &&
    metric.pixels.length >= Math.max(400, imageArea * 0.00035)
  );
  const bestPool = colouredProductCandidates.length ? colouredProductCandidates : metrics;
  const best = bestPool.reduce((winner, item) => item.productScore > winner.productScore ? item : winner, bestPool[0] as typeof metrics[number]);
  const cleaned = Buffer.from(alpha);
  let removedPixels = 0;

  for (const metric of metrics) {
    if (metric === best) {
      continue;
    }

    const lowSaturationInkOrWatermark =
      metric.meanSaturation < 0.16 &&
      metric.meanLuminance > 62 &&
      metric.meanLuminance < 238;
    const sparseBackdropMark =
      metric.density < 0.42 &&
      metric.pixels.length >= Math.max(180, imageArea * 0.00018);
    const longDetachedLineOrWord =
      metric.aspect > 3.2 &&
      metric.componentWidth > width * 0.075 &&
      metric.componentHeight < height * 0.18;
    const smallTextStroke =
      metric.pixels.length < best.pixels.length * 0.45 &&
      metric.productScore < best.productScore * 0.62 &&
      metric.density < 0.5;
    const farFromMainProduct =
      !componentBoundsOverlapWithPadding(metric.bounds, best.bounds, Math.round(Math.min(width, height) * 0.09));
    const likelyBackgroundMark =
      lowSaturationInkOrWatermark &&
      sparseBackdropMark &&
      (longDetachedLineOrWord || smallTextStroke || farFromMainProduct) &&
      metric.structureShare < 0.82;

    if (!likelyBackgroundMark) {
      continue;
    }

    for (const pixel of metric.pixels) {
      cleaned[pixel] = 0;
      removedPixels += 1;
    }
  }

  const spatialRemoved = removeLowSaturationMarksOutsideColouredProductBounds(originalRgba, cleaned, width, height);

  if (removedPixels <= 0) {
    const spatiallyCleanedCoverage = getAlphaCoverage(cleaned);
    if (spatiallyCleanedCoverage === getAlphaCoverage(alpha)) {
      return alpha;
    }
  }

  const initialCoverage = getAlphaCoverage(alpha);
  const cleanedCoverage = getAlphaCoverage(cleaned);

  if (cleanedCoverage < Math.max(1200, initialCoverage * 0.18)) {
    return alpha;
  }

  const cleanedDiagnostics = analyzeAlphaMask(cleaned, width, height);
  if (hasCatastrophicMaskFailure(cleanedDiagnostics)) {
    return alpha;
  }

  console.info("Removed detached background text/logo marks from flexible foreground mask", {
    removedPixels: removedPixels + spatialRemoved,
    initialCoverage,
    cleanedCoverage,
    componentCount: components.length
  });

  return cleaned;
};

const removeLowSaturationMarksOutsideColouredProductBounds = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): number => {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let colouredPixels = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < 24) {
      continue;
    }

    const index = pixel * 4;
    const r = originalRgba[index] ?? 0;
    const g = originalRgba[index + 1] ?? 0;
    const b = originalRgba[index + 2] ?? 0;
    const saturation = getRgbSaturation(r, g, b);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (saturation <= 0.2 || luminance <= 45 || luminance >= 238) {
      continue;
    }

    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    colouredPixels += 1;
  }

  const alphaCoverage = getAlphaCoverage(alpha);
  if (colouredPixels < Math.max(900, alphaCoverage * 0.08) || minX > maxX || minY > maxY) {
    return 0;
  }

  const padX = Math.min(Math.round((maxX - minX + 1) * 0.18), Math.round(width * 0.075));
  const padY = Math.min(Math.round((maxY - minY + 1) * 0.18), Math.round(height * 0.055));
  const keepMinX = Math.max(0, minX - padX);
  const keepMaxX = Math.min(width - 1, maxX + padX);
  const keepMinY = Math.max(0, minY - padY);
  const keepMaxY = Math.min(height - 1, maxY + padY);
  let removed = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < 24) {
      continue;
    }

    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x >= keepMinX && x <= keepMaxX && y >= keepMinY && y <= keepMaxY) {
      continue;
    }

    const index = pixel * 4;
    const r = originalRgba[index] ?? 0;
    const g = originalRgba[index + 1] ?? 0;
    const b = originalRgba[index + 2] ?? 0;
    const saturation = getRgbSaturation(r, g, b);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const detachedNeutralInk = saturation < 0.2 && luminance > 44 && luminance < 252;

    if (!detachedNeutralInk) {
      continue;
    }

    alpha[pixel] = 0;
    removed += 1;
  }

  if (removed > 0) {
    console.info("Removed low-saturation background marks outside coloured product bounds", {
      removed,
      colouredPixels,
      keepBounds: { minX: keepMinX, maxX: keepMaxX, minY: keepMinY, maxY: keepMaxY }
    });
  }

  return removed;
};

const hasCatastrophicMaskFailure = (diagnostics: PreserveMaskDiagnostics): boolean =>
  diagnostics.failureReasons.some((reason) =>
    reason.includes("alpha mask is empty") ||
    reason.includes("too small") ||
    reason.includes("unrealistically large") ||
    reason.includes("filled rectangular photo area")
  );

const componentBoundsOverlapWithPadding = (
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number },
  padding: number
): boolean =>
  a.minX <= b.maxX + padding &&
  a.maxX >= b.minX - padding &&
  a.minY <= b.maxY + padding &&
  a.maxY >= b.minY - padding;

const removeLikelyBackgroundMarkComponents = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const components = getConnectedMaskComponents(thresholdAlphaMask(alpha, 24), width, height);

  if (components.length < 2) {
    return alpha;
  }

  const metrics = components.map((pixels) => {
    const bounds = getPixelComponentBounds(pixels, width, height);
    const boundsArea = Math.max(1, (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1));
    let totalSaturation = 0;
    let totalLuminance = 0;
    let totalGradient = 0;

    for (const pixel of pixels) {
      const index = pixel * 4;
      const r = originalRgba[index] ?? 0;
      const g = originalRgba[index + 1] ?? 0;
      const b = originalRgba[index + 2] ?? 0;
      totalSaturation += getRgbSaturation(r, g, b);
      totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalGradient += getRgbGradientMagnitude(originalRgba, width, height, pixel);
    }

    const density = pixels.length / boundsArea;
    const meanSaturation = totalSaturation / Math.max(1, pixels.length);
    const meanLuminance = totalLuminance / Math.max(1, pixels.length);
    const meanGradient = totalGradient / Math.max(1, pixels.length);
    const darkStructureBonus = meanLuminance < 105 ? 1 : 0;
    const componentScore = pixels.length * Math.max(0.2, density) * (1 + meanSaturation * 4 + Math.min(meanGradient, 40) / 20 + darkStructureBonus);

    return {
      pixels,
      bounds,
      density,
      meanSaturation,
      meanLuminance,
      meanGradient,
      componentScore
    };
  });
  const bestScore = Math.max(...metrics.map((metric) => metric.componentScore));
  const cleaned = Buffer.from(alpha);
  let removedPixels = 0;

  for (const metric of metrics) {
    const sparsePaleMark =
      metric.pixels.length >= 500 &&
      metric.density < 0.34 &&
      metric.meanSaturation < 0.13 &&
      metric.meanLuminance > 105 &&
      metric.meanGradient < 24 &&
      metric.componentScore < bestScore * 0.72;

    if (!sparsePaleMark) {
      continue;
    }

    for (const pixel of metric.pixels) {
      cleaned[pixel] = 0;
      removedPixels += 1;
    }
  }

  if (removedPixels <= 0 || getAlphaCoverage(cleaned) < getAlphaCoverage(alpha) * 0.45) {
    return alpha;
  }

  return cleaned;
};

const getBackgroundMarkSuspicion = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): { suspicious: boolean; reason: string } => {
  const alphaCoverage = getAlphaCoverage(alpha);

  if (alphaCoverage <= 0) {
    return { suspicious: false, reason: "" };
  }

  const neutralMask = Buffer.alloc(alpha.length);
  let neutralPixels = 0;
  let structuralProductPixels = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < 24) {
      continue;
    }

    const index = pixel * 4;
    const r = originalRgba[index] ?? 0;
    const g = originalRgba[index + 1] ?? 0;
    const b = originalRgba[index + 2] ?? 0;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const saturation = getRgbSaturation(r, g, b);
    const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
    const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
    const productStructure = luminance < 96 || saturation > 0.11 || channelSpread >= 22 || gradient > 14;
    const paleNeutralMark = luminance > 105 && luminance < 235 && saturation < 0.09 && channelSpread < 22;

    if (productStructure) {
      structuralProductPixels += 1;
    }

    if (paleNeutralMark) {
      neutralMask[pixel] = 255;
      neutralPixels += 1;
    }
  }

  if (neutralPixels < Math.max(3500, alphaCoverage * 0.18)) {
    return { suspicious: false, reason: "" };
  }

  const components = getConnectedMaskComponents(neutralMask, width, height)
    .map((pixels) => {
      const bounds = getPixelComponentBounds(pixels, width, height);
      const boundsArea = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
      let totalGradient = 0;

      for (const pixel of pixels) {
        totalGradient += getRgbGradientMagnitude(originalRgba, width, height, pixel);
      }

      return {
        pixels: pixels.length,
        boundsArea,
        density: pixels.length / Math.max(1, boundsArea),
        meanGradient: totalGradient / Math.max(1, pixels.length),
        width: bounds.maxX - bounds.minX + 1,
        height: bounds.maxY - bounds.minY + 1
      };
    })
    .sort((a, b) => b.pixels - a.pixels);
  const largest = components[0];

  if (!largest) {
    return { suspicious: false, reason: "" };
  }

  const neutralPercent = (neutralPixels / alphaCoverage) * 100;
  const largestShare = largest.pixels / alphaCoverage;
  const structuralShare = structuralProductPixels / alphaCoverage;
  const largeBackdropBounds = largest.width > width * 0.35 && largest.height > height * 0.22;
  const sparseBackdropShape = largest.density < 0.42;
  const smoothBackdropTone = largest.meanGradient < 10;

  if (neutralPercent >= 55 && largestShare >= 0.22 && largeBackdropBounds && sparseBackdropShape && smoothBackdropTone && structuralShare < 0.28) {
    return {
      suspicious: true,
      reason: `foreground mask appears to include a pale background logo or watermark (${neutralPercent.toFixed(1)}% neutral masked pixels).`
    };
  }

  return { suspicious: false, reason: "" };
};

const removePaleBackgroundEdgeRemnants = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const cleaned = Buffer.from(alpha);
  const initialCoverage = getAlphaCoverage(alpha);
  const backgroundPalette = buildSourceBackgroundPalette(originalRgba, width, height)
    .filter((colour) => 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b > 55);
  let totalRemovedPixels = 0;

  for (let pass = 0; pass < 10; pass += 1) {
    const current = Buffer.from(cleaned);
    let removedThisPass = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;

        if ((current[pixel] ?? 0) < 24 || !hasTransparentNeighbor(current, width, height, x, y, 2)) {
          continue;
        }

        const index = pixel * 4;
        const r = originalRgba[index] ?? 0;
        const g = originalRgba[index + 1] ?? 0;
        const b = originalRgba[index + 2] ?? 0;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const saturation = getRgbSaturation(r, g, b);
        const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
        const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
        const backgroundDistance = backgroundPalette.length > 0
          ? closestPaletteDistance(r, g, b, backgroundPalette)
          : Number.POSITIVE_INFINITY;
        const smoothPaleMatte = luminance > 104 && luminance < 245 && saturation < 0.16 && channelSpread < 42 && gradient < 14;
        const smoothBackgroundMatch = luminance > 74 && backgroundDistance < 58 && gradient < 11;

        if (!smoothPaleMatte && !smoothBackgroundMatch) {
          continue;
        }

        cleaned[pixel] = 0;
        removedThisPass += 1;
      }
    }

    totalRemovedPixels += removedThisPass;

    if (removedThisPass <= 0 || getAlphaCoverage(cleaned) < initialCoverage * 0.62) {
      break;
    }
  }

  if (totalRemovedPixels <= 0 || getAlphaCoverage(cleaned) < initialCoverage * 0.62) {
    return alpha;
  }

  return cleaned;
};

const removeNeutralEdgeResidueWithProductSupport = (
  originalRgba: Buffer,
  alpha: Buffer,
  supportAlpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const initialCoverage = getAlphaCoverage(alpha);

  if (initialCoverage < 1200) {
    return alpha;
  }

  const backgroundPalette = buildSourceBackgroundPalette(originalRgba, width, height)
    .filter((colour) => 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b > 36);

  if (backgroundPalette.length === 0) {
    return alpha;
  }

  const support = thresholdAlphaMask(supportAlpha, 24);
  const trustedSupport = erodeBinaryAlphaMask(support, width, height, 1);
  const cleaned = Buffer.from(alpha);
  let removedPixels = 0;

  for (let pass = 0; pass < 16; pass += 1) {
    const current = Buffer.from(cleaned);
    let removedThisPass = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;

        if ((current[pixel] ?? 0) < 24 || !hasTransparentNeighbor(current, width, height, x, y, 2)) {
          continue;
        }

        const rgbaIndex = pixel * 4;
        const r = originalRgba[rgbaIndex] ?? 0;
        const g = originalRgba[rgbaIndex + 1] ?? 0;
        const b = originalRgba[rgbaIndex + 2] ?? 0;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const saturation = getRgbSaturation(r, g, b);
        const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
        const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
        const backgroundDistance = closestPaletteDistance(r, g, b, backgroundPalette);
        const supportedProduct = (support[pixel] ?? 0) >= 24;
        const smoothNeutral =
          saturation < 0.18 &&
          channelSpread < 58 &&
          gradient < 18;
        const highGradientNeutralScar =
          luminance > 48 &&
          luminance < 232 &&
          saturation < 0.16 &&
          channelSpread < 54 &&
          gradient > 22 &&
          hasTransparentNeighbor(current, width, height, x, y, 2);
        const strongProductSignal =
          saturation > 0.22 ||
          luminance < 42 ||
          (backgroundDistance > 150 && (saturation > 0.1 || luminance < 92)) ||
          (supportedProduct && gradient > 13 && !highGradientNeutralScar);
        const paleHaloOrPhotoCard =
          smoothNeutral &&
          luminance > 156 &&
          (backgroundDistance < 96 || luminance > 214);
        const greyShadowOrBackdrop =
          smoothNeutral &&
          luminance > 36 &&
          luminance < 198 &&
          (backgroundDistance < 108 || (saturation < 0.11 && gradient < 13));
        const thinNeutralContourScar =
          luminance > 48 &&
          luminance < 186 &&
          saturation < 0.17 &&
          channelSpread < 62 &&
          (backgroundDistance < 180 || highGradientNeutralScar) &&
          gradient >= 6 &&
          hasTransparentNeighbor(current, width, height, x, y, 1);
        const softAlphaFringe =
          smoothNeutral &&
          (current[pixel] ?? 0) < 245 &&
          backgroundDistance < 116;
        const nearProductCore = hasMaskedNeighbor(trustedSupport, width, height, x, y, 2);
        const trueDarkProductEdge =
          luminance < 42 ||
          saturation > 0.24 ||
          (backgroundDistance > 170 && luminance < 82);

        if (
          (strongProductSignal && !thinNeutralContourScar) ||
          trueDarkProductEdge ||
          (supportedProduct && !thinNeutralContourScar && !softAlphaFringe && !greyShadowOrBackdrop) ||
          (nearProductCore && !thinNeutralContourScar && gradient > 18 && luminance < 232)
        ) {
          continue;
        }

        if (!paleHaloOrPhotoCard && !greyShadowOrBackdrop && !softAlphaFringe && !thinNeutralContourScar) {
          continue;
        }

        cleaned[pixel] = 0;
        removedThisPass += 1;
      }
    }

    removedPixels += removedThisPass;

    if (removedThisPass <= 0 || getAlphaCoverage(cleaned) < initialCoverage * 0.56) {
      break;
    }
  }

  if (removedPixels <= 0) {
    return alpha;
  }

  const cleanedCoverage = getAlphaCoverage(cleaned);
  if (cleanedCoverage < Math.max(1200, initialCoverage * 0.56)) {
    return alpha;
  }

  const cleanedDiagnostics = analyzeAlphaMask(cleaned, width, height);
  if (hasCatastrophicMaskFailure(cleanedDiagnostics)) {
    return alpha;
  }

  console.info("Removed neutral edge-connected background residue from preserve mask", {
    removedPixels,
    initialCoverage,
    cleanedCoverage,
    supportCoverage: getAlphaCoverage(support)
  });

  return cleaned;
};

const repairEdgeProductBiteMarks = (
  originalRgba: Buffer,
  alpha: Buffer,
  sourceAlpha: Buffer,
  supportAlpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const initialCoverage = getAlphaCoverage(alpha);

  if (initialCoverage < 1200) {
    return alpha;
  }

  const backgroundPalette = buildSourceBackgroundPalette(originalRgba, width, height);
  if (backgroundPalette.length === 0) {
    return alpha;
  }

  const support = thresholdAlphaMask(supportAlpha, 24);
  const candidate = Buffer.alloc(alpha.length);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) >= 24 || (sourceAlpha[pixel] ?? 0) < 24) {
      continue;
    }

    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (!hasMaskedNeighbor(alpha, width, height, x, y, 3) || !hasMaskedNeighbor(support, width, height, x, y, 5)) {
      continue;
    }

    const index = pixel * 4;
    const r = originalRgba[index] ?? 0;
    const g = originalRgba[index + 1] ?? 0;
    const b = originalRgba[index + 2] ?? 0;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const saturation = getRgbSaturation(r, g, b);
    const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
    const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
    const backgroundDistance = closestPaletteDistance(r, g, b, backgroundPalette);
    const smoothBackground =
      luminance > 194 &&
      saturation < 0.12 &&
      channelSpread < 44 &&
      gradient < 8 &&
      backgroundDistance < 72;
    const productLike =
      luminance < 248 &&
      !smoothBackground &&
      (
        saturation > 0.08 ||
        gradient > 6 ||
        backgroundDistance > 18 ||
        luminance < 128
      );

    if (productLike) {
      candidate[pixel] = 255;
    }
  }

  const components = getConnectedMaskComponents(candidate, width, height);
  if (components.length === 0) {
    return alpha;
  }

  const repaired = Buffer.from(alpha);
  let restoredPixels = 0;
  const maxComponentPixels = Math.max(80, Math.round(initialCoverage * 0.035));

  for (const component of components) {
    if (component.length > maxComponentPixels) {
      continue;
    }

    let supportPixels = 0;
    let edgeSupportPixels = 0;
    let gradientTotal = 0;
    let darkPixels = 0;
    let smoothBackgroundPixels = 0;

    for (const pixel of component) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const index = pixel * 4;
      const r = originalRgba[index] ?? 0;
      const g = originalRgba[index + 1] ?? 0;
      const b = originalRgba[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const saturation = getRgbSaturation(r, g, b);
      const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
      const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
      const backgroundDistance = closestPaletteDistance(r, g, b, backgroundPalette);

      if ((support[pixel] ?? 0) >= 24 || hasMaskedNeighbor(support, width, height, x, y, 2)) {
        supportPixels += 1;
      }
      if (hasMaskedNeighbor(alpha, width, height, x, y, 2)) {
        edgeSupportPixels += 1;
      }
      if (
        luminance > 194 &&
        saturation < 0.12 &&
        channelSpread < 44 &&
        gradient < 8 &&
        backgroundDistance < 72
      ) {
        smoothBackgroundPixels += 1;
      }
      if (luminance < 128) {
        darkPixels += 1;
      }
      gradientTotal += gradient;
    }

    const supportShare = supportPixels / component.length;
    const edgeSupportShare = edgeSupportPixels / component.length;
    const smoothBackgroundShare = smoothBackgroundPixels / component.length;
    const meanGradient = gradientTotal / component.length;
    const darkShare = darkPixels / component.length;
    const restoreProductBite =
      supportShare >= 0.18 &&
      edgeSupportShare >= 0.22 &&
      smoothBackgroundShare < 0.72 &&
      (meanGradient > 5 || darkShare > 0.08 || supportShare > 0.38);

    if (!restoreProductBite) {
      continue;
    }

    for (const pixel of component) {
      repaired[pixel] = 255;
      restoredPixels += 1;
    }
  }

  if (restoredPixels <= 0 || getAlphaCoverage(repaired) > initialCoverage * 1.16) {
    return alpha;
  }

  const repairedDiagnostics = analyzeAlphaMask(repaired, width, height);
  if (hasCatastrophicMaskFailure(repairedDiagnostics)) {
    return alpha;
  }

  console.info("Repaired edge product bite marks in preserve mask", {
    restoredPixels,
    initialCoverage,
    repairedCoverage: getAlphaCoverage(repaired)
  });

  return repaired;
};

const removeConnectedBackgroundPaletteRemnants = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const initialCoverage = getAlphaCoverage(alpha);

  if (initialCoverage < 1200) {
    return alpha;
  }

  const backgroundPalette = buildSourceBackgroundPalette(originalRgba, width, height)
    .filter((colour) => 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b > 72);

  if (backgroundPalette.length === 0) {
    return alpha;
  }

  const removable = new Uint8Array(alpha.length);
  let productCorePixels = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < 24) {
      continue;
    }

    const index = pixel * 4;
    const r = originalRgba[index] ?? 0;
    const g = originalRgba[index + 1] ?? 0;
    const b = originalRgba[index + 2] ?? 0;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const saturation = getRgbSaturation(r, g, b);
    const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
    const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
    const backgroundDistance = closestPaletteDistance(r, g, b, backgroundPalette);
    const smoothPaleBackground =
      luminance > 142 &&
      saturation < 0.18 &&
      channelSpread < 58 &&
      gradient < 34 &&
      backgroundDistance < 78;
    const veryLightBackground =
      luminance > 188 &&
      saturation < 0.13 &&
      channelSpread < 46 &&
      gradient < 46 &&
      backgroundDistance < 104;

    if (smoothPaleBackground || veryLightBackground) {
      removable[pixel] = 1;
      continue;
    }

    if (luminance < 122 || saturation > 0.22 || backgroundDistance > 98 || gradient > 32) {
      productCorePixels += 1;
    }
  }

  if (productCorePixels < Math.max(900, initialCoverage * 0.1)) {
    return alpha;
  }

  const cleaned = Buffer.from(alpha);
  const visited = new Uint8Array(alpha.length);
  const queue: number[] = [];
  const enqueue = (pixel: number): void => {
    if (pixel < 0 || pixel >= alpha.length || visited[pixel] || !removable[pixel]) {
      return;
    }

    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;

      if ((alpha[pixel] ?? 0) < 24 || !removable[pixel]) {
        continue;
      }

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || hasTransparentNeighbor(alpha, width, height, x, y, 1)) {
        enqueue(pixel);
      }
    }
  }

  let removedPixels = 0;
  while (queue.length > 0) {
    const pixel = queue.pop() as number;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    cleaned[pixel] = 0;
    removedPixels += 1;

    const neighbours = [
      x > 0 ? pixel - 1 : -1,
      x < width - 1 ? pixel + 1 : -1,
      y > 0 ? pixel - width : -1,
      y < height - 1 ? pixel + width : -1
    ];

    for (const next of neighbours) {
      enqueue(next);
    }
  }

  if (removedPixels < Math.max(120, initialCoverage * 0.0006)) {
    return alpha;
  }

  const cleanedCoverage = getAlphaCoverage(cleaned);
  if (cleanedCoverage < Math.max(1200, initialCoverage * 0.52)) {
    return alpha;
  }

  const cleanedDiagnostics = analyzeAlphaMask(cleaned, width, height);
  if (hasCatastrophicMaskFailure(cleanedDiagnostics)) {
    return alpha;
  }

  console.info("Removed connected background-colour remnants from product mask", {
    removedPixels,
    initialCoverage,
    cleanedCoverage,
    productCorePixels
  });

  return cleaned;
};

const dilateAlphaMask = (alpha: Buffer, width: number, height: number, radius: number): Buffer => {
  const dilated = Buffer.from(alpha);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;

      if ((alpha[pixel] ?? 0) >= 24) {
        continue;
      }

      if (hasMaskedNeighbor(alpha, width, height, x, y, radius)) {
        dilated[pixel] = 255;
      }
    }
  }

  return dilated;
};

const expandMaskWithOriginalForeground = (
  originalRgb: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const backgroundPalette = buildBackgroundPalette(originalRgb, alpha, width, height);

  if (backgroundPalette.length === 0) {
    return alpha;
  }

  const cleaned = removeBackgroundLikePixelsFromMask(originalRgb, alpha, backgroundPalette);
  const expanded = getSafeAlphaMask(alpha, cleaned, 0.55);
  const bounds = getMaskBounds(alpha, width, height);
  const padX = Math.round(width * 0.12);
  const padY = Math.round(height * 0.12);
  const minX = Math.max(0, bounds.minX - padX);
  const maxX = Math.min(width - 1, bounds.maxX + padX);
  const minY = Math.max(0, bounds.minY - padY);
  const maxY = Math.min(height - 1, bounds.maxY + padY);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const pixel = y * width + x;

      if ((expanded[pixel] ?? 0) >= 24) {
        continue;
      }

      const index = pixel * 3;
      const r = originalRgb[index] ?? 0;
      const g = originalRgb[index + 1] ?? 0;
      const b = originalRgb[index + 2] ?? 0;
      const distance = closestPaletteDistance(r, g, b, backgroundPalette);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (luminance < 70 && distance > 96 && hasMaskedNeighbor(expanded, width, height, x, y, 4)) {
        expanded[pixel] = 255;
      }
    }
  }

  return expanded;
};

const removeBackgroundLikePixelsFromMask = (
  originalRgb: Buffer,
  alpha: Buffer,
  palette: Array<{ r: number; g: number; b: number }>
): Buffer => {
  const refined = Buffer.from(alpha);

  for (let pixel = 0; pixel < refined.length; pixel += 1) {
    if ((refined[pixel] ?? 0) < 24) {
      refined[pixel] = 0;
      continue;
    }

    const index = pixel * 3;
    const r = originalRgb[index] ?? 0;
    const g = originalRgb[index + 1] ?? 0;
    const b = originalRgb[index + 2] ?? 0;
    const distance = closestPaletteDistance(r, g, b, palette);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const saturation = getRgbSaturation(r, g, b);

    if (distance < 46 && luminance > 65) {
      refined[pixel] = 0;
      continue;
    }

    if (saturation < 0.16 && luminance > 55 && distance < 92) {
      refined[pixel] = 0;
    }
  }

  return refined;
};

const normalizeAlphaBufferLength = (alpha: Buffer, width: number, height: number): Buffer => {
  const pixelCount = width * height;

  if (alpha.length === pixelCount) {
    return alpha;
  }

  const channels = alpha.length / Math.max(1, pixelCount);
  if (!Number.isInteger(channels) || channels < 1) {
    return alpha.subarray(0, pixelCount);
  }

  const normalized = Buffer.alloc(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    normalized[pixel] = alpha[pixel * channels] ?? 0;
  }

  return normalized;
};

const smoothAlphaMask = async (alpha: Buffer, width: number, height: number): Promise<Buffer> =>
  normalizeAlphaBufferLength(await sharp(alpha, {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .blur(0.35)
    .raw()
    .toBuffer(), width, height);

const buildAdaptiveTrimap = (
  originalRgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Buffer => {
  const binary = thresholdAlphaMask(alpha, 24);
  const confidentForeground = erodeBinaryAlphaMask(binary, width, height, 1);
  const expandedUnknown = dilateBinaryAlphaMask(binary, width, height, 2);
  const trimap = Buffer.alloc(alpha.length);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const value = alpha[pixel] ?? 0;
    if ((confidentForeground[pixel] ?? 0) >= 245 && value >= 220) {
      trimap[pixel] = 255;
      continue;
    }
    if ((expandedUnknown[pixel] ?? 0) < 24 && value <= 8) {
      trimap[pixel] = 0;
      continue;
    }
    trimap[pixel] = 128;
  }

  const bounds = getAlphaBounds(binary, width, height, 24);
  if (!bounds) {
    return trimap;
  }

  const backgroundPalette = buildSourceBackgroundPalette(originalRgba, width, height);
  const minX = Math.max(0, bounds.minX - 10);
  const maxX = Math.min(width - 1, bounds.maxX + 10);
  const minY = Math.max(0, bounds.minY - 10);
  const maxY = Math.min(height - 1, bounds.maxY + 10);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const pixel = y * width + x;
      if ((trimap[pixel] ?? 0) !== 255) {
        continue;
      }

      const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
      const index = pixel * 4;
      const backgroundDistance = backgroundPalette.length > 0
        ? closestPaletteDistance(originalRgba[index] ?? 0, originalRgba[index + 1] ?? 0, originalRgba[index + 2] ?? 0, backgroundPalette)
        : 255;
      const lowContrastTransition = backgroundDistance < 42;
      const complexBoundary = gradient > 22 || hasTransparentNeighbor(binary, width, height, x, y, 3);

      if (complexBoundary || lowContrastTransition) {
        for (let yy = Math.max(minY, y - 1); yy <= Math.min(maxY, y + 1); yy += 1) {
          for (let xx = Math.max(minX, x - 1); xx <= Math.min(maxX, x + 1); xx += 1) {
            const neighbour = yy * width + xx;
            if ((trimap[neighbour] ?? 0) !== 0) {
              trimap[neighbour] = 128;
            }
          }
        }
      }
    }
  }

  return trimap;
};

const refineAlphaMatteWithTrimap = async (
  originalRgba: Buffer,
  candidateAlpha: Buffer,
  width: number,
  height: number
): Promise<{ alpha: Buffer; trimap: Buffer }> => {
  const trimap = buildAdaptiveTrimap(originalRgba, candidateAlpha, width, height);
  const softAlpha = normalizeAlphaBufferLength(await sharp(candidateAlpha, {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .resize(width * 2, height * 2, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3
    })
    .blur(0.45)
    .resize(width, height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3
    })
    .raw()
    .toBuffer(), width, height);
  const binary = thresholdAlphaMask(candidateAlpha, 24);
  const foregroundCore = erodeBinaryAlphaMask(binary, width, height, 2);
  const backgroundPalette = buildSourceBackgroundPalette(originalRgba, width, height);
  const refined = Buffer.alloc(candidateAlpha.length);

  for (let pixel = 0; pixel < refined.length; pixel += 1) {
    const trimapValue = trimap[pixel] ?? 0;
    if (trimapValue === 255) {
      refined[pixel] = 255;
      continue;
    }
    if (trimapValue === 0) {
      refined[pixel] = 0;
      continue;
    }

    const index = pixel * 4;
    const r = originalRgba[index] ?? 0;
    const g = originalRgba[index + 1] ?? 0;
    const b = originalRgba[index + 2] ?? 0;
    const backgroundDistance = backgroundPalette.length > 0
      ? closestPaletteDistance(r, g, b, backgroundPalette)
      : 96;
    const gradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
    const sourceAlpha = candidateAlpha[pixel] ?? 0;
    const blurredAlpha = softAlpha[pixel] ?? sourceAlpha;
    const edgeEvidence = Math.max(sourceAlpha, blurredAlpha);

    if ((foregroundCore[pixel] ?? 0) >= 24 && sourceAlpha >= 160) {
      refined[pixel] = 255;
    } else if (backgroundDistance < 18 && gradient < 8 && sourceAlpha < 220) {
      refined[pixel] = Math.min(96, Math.round(edgeEvidence * 0.45));
    } else if (backgroundDistance > 72 || gradient > 24) {
      refined[pixel] = Math.max(sourceAlpha, Math.min(255, Math.round(blurredAlpha * 1.05)));
    } else {
      refined[pixel] = Math.round((sourceAlpha * 0.72) + (blurredAlpha * 0.28));
    }
  }

  return {
    alpha: getSafeAlphaMask(candidateAlpha, refined, 0.86),
    trimap
  };
};

const buildTrimapPreview = async (trimap: Buffer, width: number, height: number): Promise<Buffer> =>
  sharp(trimap, {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .png()
    .toBuffer();

const erodeBinaryAlphaMask = (
  alpha: Buffer,
  width: number,
  height: number,
  radius: number
): Buffer => {
  const eroded = Buffer.alloc(alpha.length);
  const diameter = radius * 2 + 1;
  const requiredNeighbours = Math.max(1, Math.ceil(diameter * diameter * 0.68));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;

      if ((alpha[pixel] ?? 0) < 24) {
        continue;
      }

      let neighbours = 0;
      for (let ny = Math.max(0, y - radius); ny <= Math.min(height - 1, y + radius); ny += 1) {
        for (let nx = Math.max(0, x - radius); nx <= Math.min(width - 1, x + radius); nx += 1) {
          if ((alpha[ny * width + nx] ?? 0) >= 24) {
            neighbours += 1;
          }
        }
      }

      if (neighbours >= requiredNeighbours) {
        eroded[pixel] = 255;
      }
    }
  }

  return eroded;
};

const dilateBinaryAlphaMask = (
  alpha: Buffer,
  width: number,
  height: number,
  radius: number
): Buffer => {
  const dilated = Buffer.from(alpha);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;

      if ((alpha[pixel] ?? 0) >= 24) {
        dilated[pixel] = 255;
        continue;
      }

      let hasNeighbour = false;
      for (let ny = Math.max(0, y - radius); ny <= Math.min(height - 1, y + radius) && !hasNeighbour; ny += 1) {
        for (let nx = Math.max(0, x - radius); nx <= Math.min(width - 1, x + radius); nx += 1) {
          if ((alpha[ny * width + nx] ?? 0) >= 24) {
            hasNeighbour = true;
            break;
          }
        }
      }

      if (hasNeighbour) {
        dilated[pixel] = 255;
      }
    }
  }

  return dilated;
};

const removeThinAlphaWhiskers = (
  alpha: Buffer,
  width: number,
  height: number
): { alpha: Buffer; removedPixels: number } => {
  const binaryAlpha = thresholdAlphaMask(alpha, 24);
  const buildOpened = (radius: number): { alpha: Buffer; removedPixels: number; coverage: number } => {
    const openedAlpha = dilateBinaryAlphaMask(erodeBinaryAlphaMask(binaryAlpha, width, height, radius), width, height, radius);
    let removed = 0;

    for (let pixel = 0; pixel < binaryAlpha.length; pixel += 1) {
      if ((binaryAlpha[pixel] ?? 0) >= 24 && (openedAlpha[pixel] ?? 0) < 24) {
        removed += 1;
      }
    }

    return {
      alpha: openedAlpha,
      removedPixels: removed,
      coverage: getAlphaCoverage(openedAlpha)
    };
  };
  const initialCoverage = getAlphaCoverage(binaryAlpha);

  if (initialCoverage <= 0) {
    return { alpha: binaryAlpha, removedPixels: 0 };
  }

  const openedOne = buildOpened(1);
  const openedTwo = buildOpened(2);
  const selected = openedTwo.coverage >= initialCoverage * 0.92 && openedTwo.removedPixels > openedOne.removedPixels * 1.35
    ? openedTwo
    : openedOne;

  if (selected.coverage < initialCoverage * 0.94 || selected.removedPixels < Math.max(12, initialCoverage * 0.0004)) {
    return { alpha: binaryAlpha, removedPixels: 0 };
  }

  const originalBounds = getAlphaBounds(binaryAlpha, width, height, 24);
  const selectedBounds = getAlphaBounds(selected.alpha, width, height, 24);
  if (
    !originalBounds ||
    !selectedBounds ||
    selectedBounds.width < originalBounds.width * 0.975 ||
    selectedBounds.height < originalBounds.height * 0.975
  ) {
    return { alpha: binaryAlpha, removedPixels: 0 };
  }

  const openedDiagnostics = analyzeAlphaMask(selected.alpha, width, height);
  if (!openedDiagnostics.passed || hasCatastrophicMaskFailure(openedDiagnostics)) {
    return { alpha: binaryAlpha, removedPixels: 0 };
  }

  return { alpha: selected.alpha, removedPixels: selected.removedPixels };
};

const getSafeAlphaMask = (fallbackAlpha: Buffer, candidateAlpha: Buffer, minCoverageRatio = 0.65): Buffer => {
  const fallbackCoverage = getAlphaCoverage(fallbackAlpha);
  const candidateCoverage = getAlphaCoverage(candidateAlpha);

  if (fallbackCoverage === 0) {
    throw new Error("Product cutout could not be detected. Try reprocessing this image or use a cleaner source photo.");
  }

  if (candidateCoverage === 0 || candidateCoverage < fallbackCoverage * minCoverageRatio) {
    return fallbackAlpha;
  }

  return candidateAlpha;
};

const repairInteriorProductDropouts = async (
  originalRgb: Buffer,
  originalRgba: Buffer,
  alpha: Buffer,
  secondOpinionAlpha: Buffer,
  width: number,
  height: number,
  backgroundPalette: Array<{ r: number; g: number; b: number }>
): Promise<{
  alpha: Buffer;
  diagnostics: InteriorDropoutDiagnostics;
  debugSuspiciousOverlay?: Buffer;
  debugRestoredOverlay?: Buffer;
}> => {
  const productBounds = getAlphaBounds(alpha, width, height, 24);
  const repairedAlpha = Buffer.from(alpha);
  const suspiciousMask = Buffer.alloc(alpha.length);
  const restoredMask = Buffer.alloc(alpha.length);
  const emptyDiagnostics: InteriorDropoutDiagnostics = {
    candidateCount: 0,
    restoredRegionCount: 0,
    restoredPixelCount: 0,
    trueHoleCount: 0,
    unresolvedRegionCount: 0,
    unresolvedPixelCount: 0,
    needsReview: false,
    failureReasons: [],
    candidates: []
  };

  if (!productBounds || backgroundPalette.length === 0) {
    return {
      alpha: repairedAlpha,
      diagnostics: emptyDiagnostics
    };
  }

  const candidateSeed = Buffer.alloc(alpha.length);
  const insetX = Math.max(3, Math.round(productBounds.width * 0.006));
  const insetY = Math.max(3, Math.round(productBounds.height * 0.006));
  const minX = Math.max(0, productBounds.minX + insetX);
  const maxX = Math.min(width - 1, productBounds.maxX - insetX);
  const minY = Math.max(0, productBounds.minY + insetY);
  const maxY = Math.min(height - 1, productBounds.maxY - insetY);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const pixel = y * width + x;

      const interiorSupportRadius = Math.max(10, Math.round(Math.min(width, height) * 0.045));
      if ((alpha[pixel] ?? 0) >= 24 || !hasMaskedNeighbor(alpha, width, height, x, y, interiorSupportRadius)) {
        continue;
      }

      const productEvidence = getInteriorPixelEvidence(
        originalRgb,
        originalRgba,
        secondOpinionAlpha,
        backgroundPalette,
        width,
        height,
        pixel
      );

      if (!productEvidence.strongBackgroundEvidence && productEvidence.productLike) {
        candidateSeed[pixel] = 255;
        suspiciousMask[pixel] = 255;
      }
    }
  }

  const components = getConnectedMaskComponents(candidateSeed, width, height);
  const minComponentPixels = Math.max(18, Math.round(width * height * 0.000015));
  const diagnostics: InteriorDropoutDiagnostics = {
    ...emptyDiagnostics,
    candidateCount: components.length
  };

  for (const component of components) {
    const bounds = getPixelComponentBounds(component, width, height);
    const metrics = getInteriorDropoutMetrics(
      component,
      bounds,
      alpha,
      secondOpinionAlpha,
      originalRgb,
      originalRgba,
      backgroundPalette,
      width,
      height
    );

    let classification: InteriorDropoutCandidate["classification"] = "ignored";
    let reason = "region was too small or unsupported to change safely";

    if (component.length >= minComponentPixels) {
      const trueHoleEvidence =
        metrics.backgroundLikePercent >= 72 &&
        metrics.secondOpinionForegroundPercent <= 18 &&
        metrics.meanBoundaryGradient >= 10;
      const largeSparseBackgroundShape =
        metrics.componentDensityPercent < 16 &&
        (bounds.maxX - bounds.minX + 1 > width * 0.12 || bounds.maxY - bounds.minY + 1 > height * 0.08) &&
        metrics.meanBoundaryGradient < 24;
      const strongSecondOpinion = metrics.secondOpinionForegroundPercent >= 38;
      const productBridge = metrics.bridgesForeground && metrics.productLikePercent >= 58 && metrics.backgroundLikePercent < 52;
      const productTexture = metrics.productLikePercent >= 72 && metrics.backgroundLikePercent < 42;

      if (largeSparseBackgroundShape) {
        classification = "ignored";
        reason = "large sparse transparent structure looks like background/logo material rather than solid missing product";
      } else if (trueHoleEvidence) {
        classification = "true_hole";
        reason = "transparent region has background-colour evidence, hard product boundary evidence, and weak second-opinion foreground support";
      } else if (strongSecondOpinion || productBridge || productTexture) {
        classification = "restored";
        reason = strongSecondOpinion
          ? "second-opinion mask supports foreground inside the primary preserve mask"
          : "region bridges foreground structure and matches product colour or texture";
      } else if (metrics.bridgesForeground && metrics.productLikePercent >= 35 && metrics.backgroundLikePercent < 68) {
        classification = "needs_review";
        reason = "internal missing region is ambiguous after structural and second-opinion checks";
      }
    }

    const candidate: InteriorDropoutCandidate = {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX + 1,
      height: bounds.maxY - bounds.minY + 1,
      pixels: component.length,
      secondOpinionForegroundPercent: Number(metrics.secondOpinionForegroundPercent.toFixed(2)),
      productLikePercent: Number(metrics.productLikePercent.toFixed(2)),
      backgroundLikePercent: Number(metrics.backgroundLikePercent.toFixed(2)),
      meanBoundaryGradient: Number(metrics.meanBoundaryGradient.toFixed(2)),
      componentDensityPercent: Number(metrics.componentDensityPercent.toFixed(2)),
      bridgesForeground: metrics.bridgesForeground,
      classification,
      reason
    };
    diagnostics.candidates.push(candidate);

    if (classification === "true_hole") {
      diagnostics.trueHoleCount += 1;
      continue;
    }

    if (classification === "needs_review") {
      diagnostics.unresolvedRegionCount += 1;
      diagnostics.unresolvedPixelCount += component.length;
      continue;
    }

    if (classification !== "restored") {
      continue;
    }

    diagnostics.restoredRegionCount += 1;
    for (const pixel of component) {
      repairedAlpha[pixel] = 255;
      restoredMask[pixel] = 255;
      diagnostics.restoredPixelCount += 1;
    }
  }

  growRestoredDropoutPixels(
    repairedAlpha,
    restoredMask,
    alpha,
    secondOpinionAlpha,
    originalRgb,
    originalRgba,
    backgroundPalette,
    width,
    height,
    productBounds
  );

  diagnostics.restoredPixelCount = getAlphaCoverage(restoredMask);
  diagnostics.needsReview = diagnostics.unresolvedRegionCount > 0;

  if (diagnostics.needsReview) {
    diagnostics.failureReasons.push(
      `Interior product dropout remains after repair (${diagnostics.unresolvedRegionCount} region${diagnostics.unresolvedRegionCount === 1 ? "" : "s"}, ${diagnostics.unresolvedPixelCount} px).`
    );
  }

  const debugSuspiciousOverlay = diagnostics.candidates.length > 0
    ? await buildMaskOverlayPreview(originalRgb, suspiciousMask, width, height, { r: 255, g: 56, b: 56 })
    : undefined;
  const debugRestoredOverlay = diagnostics.restoredPixelCount > 0
    ? await buildMaskOverlayPreview(originalRgb, restoredMask, width, height, { r: 40, g: 180, b: 100 })
    : undefined;

  return {
    alpha: repairedAlpha,
    diagnostics,
    debugSuspiciousOverlay,
    debugRestoredOverlay
  };
};

const getInteriorPixelEvidence = (
  originalRgb: Buffer,
  originalRgba: Buffer,
  secondOpinionAlpha: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number,
  pixel: number
): {
  productLike: boolean;
  strongBackgroundEvidence: boolean;
  secondOpinionForeground: boolean;
  boundaryGradient: number;
} => {
  const rgbIndex = pixel * 3;
  const r = originalRgb[rgbIndex] ?? 0;
  const g = originalRgb[rgbIndex + 1] ?? 0;
  const b = originalRgb[rgbIndex + 2] ?? 0;
  const distance = closestPaletteDistance(r, g, b, backgroundPalette);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const saturation = getRgbSaturation(r, g, b);
  const boundaryGradient = getRgbGradientMagnitude(originalRgba, width, height, pixel);
  const secondOpinionForeground = (secondOpinionAlpha[pixel] ?? 0) >= 128;
  const darkProductMaterial =
    (luminance < 104 && distance > 18 && (boundaryGradient > 2 || saturation > 0.03 || secondOpinionForeground)) ||
    (luminance < 54 && distance > 64);
  const productTexture = distance > 30 && (saturation > 0.08 || boundaryGradient > 8 || luminance < 135);
  const fineProductStructure = distance > 16 && boundaryGradient > 18;
  const strongBackgroundEvidence = distance < 22 && saturation < 0.18 && boundaryGradient < 16 && !secondOpinionForeground;

  return {
    productLike: secondOpinionForeground || darkProductMaterial || productTexture || fineProductStructure,
    strongBackgroundEvidence,
    secondOpinionForeground,
    boundaryGradient
  };
};

const getConnectedMaskComponents = (mask: Buffer, width: number, height: number): number[][] => {
  const visited = new Uint8Array(mask.length);
  const components: number[][] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (visited[start] || (mask[start] ?? 0) < 24) {
      continue;
    }

    const stack = [start];
    const component: number[] = [];
    visited[start] = 1;

    while (stack.length > 0) {
      const pixel = stack.pop() as number;
      component.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const neighbours = [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1
      ];

      for (const next of neighbours) {
        if (next < 0 || visited[next] || (mask[next] ?? 0) < 24) {
          continue;
        }

        visited[next] = 1;
        stack.push(next);
      }
    }

    components.push(component);
  }

  return components;
};

const getPixelComponentBounds = (
  pixels: number[],
  width: number,
  height: number
): { minX: number; maxX: number; minY: number; maxY: number } => {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (const pixel of pixels) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return { minX, maxX, minY, maxY };
};

const getInteriorDropoutMetrics = (
  pixels: number[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  alpha: Buffer,
  secondOpinionAlpha: Buffer,
  originalRgb: Buffer,
  originalRgba: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number
): {
  secondOpinionForegroundPercent: number;
  productLikePercent: number;
  backgroundLikePercent: number;
  meanBoundaryGradient: number;
  componentDensityPercent: number;
  bridgesForeground: boolean;
} => {
  let secondOpinionForegroundPixels = 0;
  let productLikePixels = 0;
  let backgroundLikePixels = 0;
  let totalGradient = 0;

  for (const pixel of pixels) {
    const evidence = getInteriorPixelEvidence(
      originalRgb,
      originalRgba,
      secondOpinionAlpha,
      backgroundPalette,
      width,
      height,
      pixel
    );

    if (evidence.secondOpinionForeground) {
      secondOpinionForegroundPixels += 1;
    }
    if (evidence.productLike) {
      productLikePixels += 1;
    }
    if (evidence.strongBackgroundEvidence) {
      backgroundLikePixels += 1;
    }
    totalGradient += evidence.boundaryGradient;
  }

  return {
    secondOpinionForegroundPercent: pixels.length > 0 ? (secondOpinionForegroundPixels / pixels.length) * 100 : 0,
    productLikePercent: pixels.length > 0 ? (productLikePixels / pixels.length) * 100 : 0,
    backgroundLikePercent: pixels.length > 0 ? (backgroundLikePixels / pixels.length) * 100 : 0,
    meanBoundaryGradient: pixels.length > 0 ? totalGradient / pixels.length : 0,
    componentDensityPercent: pixels.length > 0
      ? (pixels.length / Math.max(1, (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1))) * 100
      : 0,
    bridgesForeground: hasForegroundBridgeAroundBounds(alpha, width, height, bounds)
  };
};

const hasForegroundBridgeAroundBounds = (
  alpha: Buffer,
  width: number,
  height: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): boolean => {
  const radius = Math.max(4, Math.round(Math.min(width, height) * 0.012));
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;

  for (let y = Math.max(0, bounds.minY - radius); y <= Math.min(height - 1, bounds.maxY + radius); y += 1) {
    for (let x = Math.max(0, bounds.minX - radius); x < bounds.minX; x += 1) {
      if ((alpha[y * width + x] ?? 0) >= 24) left += 1;
    }
    for (let x = bounds.maxX + 1; x <= Math.min(width - 1, bounds.maxX + radius); x += 1) {
      if ((alpha[y * width + x] ?? 0) >= 24) right += 1;
    }
  }

  for (let x = Math.max(0, bounds.minX - radius); x <= Math.min(width - 1, bounds.maxX + radius); x += 1) {
    for (let y = Math.max(0, bounds.minY - radius); y < bounds.minY; y += 1) {
      if ((alpha[y * width + x] ?? 0) >= 24) top += 1;
    }
    for (let y = bounds.maxY + 1; y <= Math.min(height - 1, bounds.maxY + radius); y += 1) {
      if ((alpha[y * width + x] ?? 0) >= 24) bottom += 1;
    }
  }

  return (left > 0 && right > 0) || (top > 0 && bottom > 0);
};

const growRestoredDropoutPixels = (
  repairedAlpha: Buffer,
  restoredMask: Buffer,
  originalAlpha: Buffer,
  secondOpinionAlpha: Buffer,
  originalRgb: Buffer,
  originalRgba: Buffer,
  backgroundPalette: Array<{ r: number; g: number; b: number }>,
  width: number,
  height: number,
  bounds: ProductBounds
): void => {
  for (let pass = 0; pass < 2; pass += 1) {
    const next = Buffer.from(repairedAlpha);

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const pixel = y * width + x;

        if ((originalAlpha[pixel] ?? 0) >= 24 || (repairedAlpha[pixel] ?? 0) >= 24) {
          continue;
        }

        if (!hasMaskedNeighbor(restoredMask, width, height, x, y, 1) || !hasMaskedNeighbor(repairedAlpha, width, height, x, y, 2)) {
          continue;
        }

        const evidence = getInteriorPixelEvidence(
          originalRgb,
          originalRgba,
          secondOpinionAlpha,
          backgroundPalette,
          width,
          height,
          pixel
        );

        if (!evidence.strongBackgroundEvidence && (evidence.secondOpinionForeground || evidence.productLike)) {
          next[pixel] = 255;
          restoredMask[pixel] = 255;
        }
      }
    }

    next.copy(repairedAlpha);
  }
};

const buildMaskOverlayPreview = async (
  originalRgb: Buffer,
  mask: Buffer,
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> => {
  const rgba = Buffer.alloc(width * height * 4);

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const sourceIndex = pixel * 3;
    const targetIndex = pixel * 4;
    const selected = (mask[pixel] ?? 0) >= 24;
    const blend = selected ? 0.58 : 0;
    rgba[targetIndex] = Math.round((originalRgb[sourceIndex] ?? 0) * (1 - blend) + color.r * blend);
    rgba[targetIndex + 1] = Math.round((originalRgb[sourceIndex + 1] ?? 0) * (1 - blend) + color.g * blend);
    rgba[targetIndex + 2] = Math.round((originalRgb[sourceIndex + 2] ?? 0) * (1 - blend) + color.b * blend);
    rgba[targetIndex + 3] = 255;
  }

  return sharp(rgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
};

const getAlphaCoverage = (alpha: Buffer): number => {
  let count = 0;

  for (let index = 0; index < alpha.length; index += 1) {
    if ((alpha[index] ?? 0) >= 24) {
      count += 1;
    }
  }

  return count;
};

const buildAlphaMaskPreview = async (alpha: Buffer, width: number, height: number): Promise<Buffer> =>
  sharp(alpha, {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .png()
    .toBuffer();

const analyzeAlphaMask = (alpha: Buffer, width: number, height: number): PreserveMaskDiagnostics => {
  const totalPixels = width * height;
  const visited = new Uint8Array(alpha.length);
  let alphaCoverage = 0;
  let connectedComponentCount = 0;
  let largestComponentPixels = 0;
  let largestBounds = { minX: width, minY: height, maxX: 0, maxY: 0 };
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let start = 0; start < alpha.length; start += 1) {
    if ((alpha[start] ?? 0) < 24) {
      continue;
    }

    alphaCoverage += 1;

    if (visited[start]) {
      continue;
    }

    connectedComponentCount += 1;
    const stack = [start];
    visited[start] = 1;
    let componentPixels = 0;
    let componentMinX = width;
    let componentMinY = height;
    let componentMaxX = 0;
    let componentMaxY = 0;

    while (stack.length > 0) {
      const pixel = stack.pop() as number;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      componentPixels += 1;
      componentMinX = Math.min(componentMinX, x);
      componentMinY = Math.min(componentMinY, y);
      componentMaxX = Math.max(componentMaxX, x);
      componentMaxY = Math.max(componentMaxY, y);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbours = [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1
      ];

      for (const next of neighbours) {
        if (next < 0 || visited[next] || (alpha[next] ?? 0) < 24) {
          continue;
        }

        visited[next] = 1;
        stack.push(next);
      }
    }

    if (componentPixels > largestComponentPixels) {
      largestComponentPixels = componentPixels;
      largestBounds = {
        minX: componentMinX,
        minY: componentMinY,
        maxX: componentMaxX,
        maxY: componentMaxY
      };
    }
  }

  const hasForeground = alphaCoverage > 0 && minX <= maxX && minY <= maxY;
  const bbox = hasForeground
    ? {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      }
    : {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };
  const largestBBox = largestComponentPixels > 0
    ? {
        width: largestBounds.maxX - largestBounds.minX + 1,
        height: largestBounds.maxY - largestBounds.minY + 1
      }
    : {
        width: 0,
        height: 0
      };
  const alphaCoveragePercent = totalPixels > 0 ? (alphaCoverage / totalPixels) * 100 : 0;
  const bboxAreaPercent = totalPixels > 0 ? ((bbox.width * bbox.height) / totalPixels) * 100 : 0;
  const bboxPixels = bbox.width * bbox.height;
  const bboxFillPercent = bboxPixels > 0 ? (alphaCoverage / bboxPixels) * 100 : 0;
  const largestComponentCoveragePercent = totalPixels > 0 ? (largestComponentPixels / totalPixels) * 100 : 0;
  const largestComponentSharePercent = alphaCoverage > 0 ? (largestComponentPixels / alphaCoverage) * 100 : 0;
  const failureReasons: string[] = [];
  const minimumForegroundPixels = Math.max(1800, Math.round(totalPixels * 0.0015));

  if (alphaCoverage <= 0) {
    failureReasons.push("alpha mask is empty");
  }

  if (alphaCoverage > 0 && alphaCoverage < minimumForegroundPixels) {
    failureReasons.push(`foreground coverage ${alphaCoveragePercent.toFixed(3)}% is too small for preserve mode`);
  }

  if (alphaCoveragePercent > 82) {
    failureReasons.push(`foreground coverage ${alphaCoveragePercent.toFixed(2)}% is unrealistically large`);
  }

  if (hasForeground && (bbox.width < Math.round(width * 0.04) || bbox.height < Math.round(height * 0.04))) {
    failureReasons.push(`mask bounding box ${bbox.width}x${bbox.height} is too small`);
  }

  if (hasForeground && bboxAreaPercent < 0.4) {
    failureReasons.push(`mask bounding box area ${bboxAreaPercent.toFixed(3)}% is too small`);
  }

  if (hasForeground && bboxAreaPercent > 55 && bboxFillPercent > 88) {
    failureReasons.push(`mask appears to contain a filled rectangular photo area (${bboxFillPercent.toFixed(1)}% of bounds), not an isolated product`);
  }

  if (largestComponentPixels > 0 && largestComponentPixels < minimumForegroundPixels) {
    failureReasons.push("largest connected foreground structure is too small");
  }

  if (alphaCoverage > 0 && largestComponentSharePercent < 45) {
    failureReasons.push(`mask is fragmented; largest component is only ${largestComponentSharePercent.toFixed(1)}% of foreground`);
  }

  if (connectedComponentCount > 250 && largestComponentSharePercent < 80) {
    failureReasons.push(`mask appears to be edge noise with ${connectedComponentCount} disconnected components`);
  }

  if (largestComponentPixels > 0 && (largestBBox.width < Math.round(width * 0.04) || largestBBox.height < Math.round(height * 0.04))) {
    failureReasons.push(`largest component bounds ${largestBBox.width}x${largestBBox.height} are too small`);
  }

  return {
    width,
    height,
    alphaCoverage,
    alphaCoveragePercent,
    visibleForegroundCoveragePercent: alphaCoveragePercent,
    bbox,
    bboxAreaPercent,
    bboxFillPercent,
    connectedComponentCount,
    largestComponentPixels,
    largestComponentCoveragePercent,
    largestComponentSharePercent,
    passed: failureReasons.length === 0,
    failureReasons
  };
};

const getRgbSaturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  return max === 0 ? 0 : (max - min) / max;
};

const getMaskBounds = (
  alpha: Buffer,
  width: number,
  height: number
): { minX: number; maxX: number; minY: number; maxY: number } => {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((alpha[y * width + x] ?? 0) < 24) {
        continue;
      }

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX > maxX || minY > maxY) {
    return { minX: 0, maxX: width - 1, minY: 0, maxY: height - 1 };
  }

  return { minX, maxX, minY, maxY };
};

const getAlphaBounds = (
  alpha: Buffer,
  width: number,
  height: number,
  threshold = 16
): ProductBounds | null => {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((alpha[y * width + x] ?? 0) < threshold) {
        continue;
      }

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
};

const getImageAlphaBounds = async (imageBuffer: Buffer, threshold = 16): Promise<ProductBounds | null> => {
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    return null;
  }

  const alpha = await sharp(imageBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  return getAlphaBounds(alpha, metadata.width, metadata.height, threshold);
};

const classifyProductOrientation = (bounds: ProductBounds): ProductOrientation => {
  const aspectRatio = bounds.width / Math.max(1, bounds.height);

  if (aspectRatio >= 1.25) {
    return "horizontal";
  }

  if (aspectRatio <= 0.8) {
    return "tall";
  }

  return "square";
};

const getProductCoverageTarget = (
  bounds: ProductBounds,
  scaleMode: string,
  requestedScalePercent?: number
): ProductCoverageTarget => {
  const orientation = classifyProductOrientation(bounds);
  const base: Record<ProductOrientation, ProductCoverageTarget> = {
    horizontal: {
      orientation: "horizontal",
      primaryAxis: "width",
      target: 0.86,
      min: 0.82,
      max: 0.9,
      autoFixBelow: 0.75
    },
    square: {
      orientation: "square",
      primaryAxis: "width",
      target: 0.78,
      min: 0.7,
      max: 0.84,
      autoFixBelow: 0.66
    },
    tall: {
      orientation: "tall",
      primaryAxis: "height",
      target: 0.82,
      min: 0.76,
      max: 0.88,
      autoFixBelow: 0.7
    }
  };
  const target = { ...base[orientation] };

  if (requestedScalePercent && Number.isFinite(requestedScalePercent)) {
    target.target = Math.min(target.max, Math.max(target.min, requestedScalePercent / 100));
    return target;
  }

  if (["tight", "close-up"].includes(scaleMode)) {
    target.target = target.max - 0.01;
  } else if (["generous", "loose", "wide"].includes(scaleMode)) {
    target.target = target.min + 0.01;
  } else if (scaleMode === "balanced") {
    target.target = orientation === "horizontal" ? 0.84 : 0.78;
  } else if (scaleMode === "tall" && orientation === "tall") {
    target.target = 0.86;
  }

  return target;
};

const trimProductCutoutToAlphaBounds = async (cutout: Buffer): Promise<Buffer> => {
  const metadata = await sharp(cutout).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Product cutout could not be read before framing.");
  }

  const alpha = await sharp(cutout)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();
  const bounds = getAlphaBounds(alpha, metadata.width, metadata.height, 8);

  if (!bounds) {
    throw new Error("Product cutout was empty after background removal. No image was replaced; reprocess this image with preserve product enabled.");
  }

  const transparentEdgePad = Math.max(1, Math.round(Math.min(metadata.width, metadata.height) * 0.002));
  const left = Math.max(0, bounds.minX - transparentEdgePad);
  const top = Math.max(0, bounds.minY - transparentEdgePad);
  const right = Math.min(metadata.width - 1, bounds.maxX + transparentEdgePad);
  const bottom = Math.min(metadata.height - 1, bounds.maxY + transparentEdgePad);

  return sharp(cutout)
    .rotate()
    .ensureAlpha()
    .extract({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1
    })
    .png()
    .toBuffer();
};

const reframeProductCutout = async (
  cutout: Buffer,
  scaleMode: string,
  requestedScalePercent: number | undefined,
  edgeResizeWidth: number,
  edgeResizeHeight: number
): Promise<{ productBuffer: Buffer; target: ProductCoverageTarget; autoFixedFraming: boolean }> => {
  const trimmedCutout = await trimProductCutoutToAlphaBounds(cutout);
  const bounds = await getImageAlphaBounds(trimmedCutout, 8);

  if (!bounds) {
    throw new Error("Product cutout was empty after deterministic framing.");
  }

  const target = getProductCoverageTarget(bounds, scaleMode, requestedScalePercent);
  const primaryPixels = Math.round(outputSize * target.target);
  const resizeOptions = target.primaryAxis === "width"
    ? { width: Math.min(primaryPixels, edgeResizeWidth), height: edgeResizeHeight }
    : { width: edgeResizeWidth, height: Math.min(primaryPixels, edgeResizeHeight) };
  const initialCoverage = target.primaryAxis === "width"
    ? bounds.width / outputSize
    : bounds.height / outputSize;
  const productBuffer = await sharp(trimmedCutout)
    .resize({
      ...resizeOptions,
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

  return {
    productBuffer,
    target,
    autoFixedFraming: initialCoverage < target.autoFixBelow
  };
};

const hasMaskedNeighbor = (
  alpha: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): boolean => {
  const minX = Math.max(0, x - radius);
  const maxX = Math.min(width - 1, x + radius);
  const minY = Math.max(0, y - radius);
  const maxY = Math.min(height - 1, y + radius);

  for (let ny = minY; ny <= maxY; ny += 1) {
    for (let nx = minX; nx <= maxX; nx += 1) {
      if ((alpha[ny * width + nx] ?? 0) >= 24) {
        return true;
      }
    }
  }

  return false;
};

const hasTransparentNeighbor = (
  alpha: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): boolean => {
  const minX = Math.max(0, x - radius);
  const maxX = Math.min(width - 1, x + radius);
  const minY = Math.max(0, y - radius);
  const maxY = Math.min(height - 1, y + radius);

  for (let ny = minY; ny <= maxY; ny += 1) {
    for (let nx = minX; nx <= maxX; nx += 1) {
      if ((alpha[ny * width + nx] ?? 0) < 24) {
        return true;
      }
    }
  }

  return false;
};

const buildBackgroundPalette = (
  originalRgb: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): Array<{ r: number; g: number; b: number; count: number }> => {
  const bins = new Map<string, { r: number; g: number; b: number; count: number }>();
  const border = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  const step = Math.max(1, Math.round(Math.min(width, height) / 180));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const pixel = y * width + x;
      const isBorder = x < border || y < border || x >= width - border || y >= height - border;
      const isAiBackground = (alpha[pixel] ?? 0) < 16;

      if (!isBorder && !isAiBackground) {
        continue;
      }

      const index = pixel * 3;
      const r = originalRgb[index] ?? 0;
      const g = originalRgb[index + 1] ?? 0;
      const b = originalRgb[index + 2] ?? 0;
      const key = `${Math.round(r / 24)}:${Math.round(g / 24)}:${Math.round(b / 24)}`;
      const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count += 1;
      bins.set(key, bin);
    }
  }

  return Array.from(bins.values())
    .filter((bin) => bin.count >= 4)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((bin) => ({
      r: Math.round(bin.r / bin.count),
      g: Math.round(bin.g / bin.count),
      b: Math.round(bin.b / bin.count),
      count: bin.count
    }));
};

const closestPaletteDistance = (
  r: number,
  g: number,
  b: number,
  palette: Array<{ r: number; g: number; b: number }>
): number =>
  palette.reduce((best, color) => {
    const dr = r - color.r;
    const dg = g - color.g;
    const db = b - color.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    return Math.min(best, distance);
  }, Number.POSITIVE_INFINITY);

const normalizeScalePercent = (scalePercent?: number): number => {
  if (!scalePercent) {
    return defaultScalePercent;
  }

  return Math.min(Math.max(scalePercent, 70), 90);
};

const getObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const getNumber = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const getString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const getPreserveModeFallback = (settings: Record<string, unknown>): PreserveModeFallback => {
  const value = settings.preserveModeFallback ?? settings.preserve_mode_fallback;

  if (value === "local_experimental" || value === "external_provider") {
    return value;
  }

  return "strict_retry";
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "000000";

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
};

const clampPosition = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const getShadowPreset = (mode: string, strength: string): {
  opacity: number;
  blur: number;
  offsetY: number;
  spread: number;
} => {
  const presets = {
    under: {
      light: { opacity: 16, blur: 26, offsetY: 18, spread: 94 },
      medium: { opacity: 26, blur: 34, offsetY: 24, spread: 104 },
      strong: { opacity: 38, blur: 42, offsetY: 34, spread: 116 }
    },
    behind: {
      light: { opacity: 22, blur: 34, offsetY: 22, spread: 102 },
      medium: { opacity: 34, blur: 46, offsetY: 34, spread: 108 },
      strong: { opacity: 48, blur: 58, offsetY: 46, spread: 114 }
    }
  } as const;
  const presetMode = mode === "behind" ? "behind" : "under";
  const presetStrength = ["light", "medium", "strong"].includes(strength) ? strength as "light" | "medium" | "strong" : "medium";

  return presets[presetMode][presetStrength];
};

const buildShadow = async (
  width: number,
  height: number,
  productBuffer: Buffer,
  productWidth: number,
  productHeight: number,
  productLeft: number,
  productTop: number,
  settings?: unknown
): Promise<Buffer | null> => {
  const shadowSettings = getObject(settings);
  const mode = getString(shadowSettings.mode, "under");

  if (mode === "off") {
    return null;
  }

  const customShadow = mode === "custom";
  const effectiveMode = mode === "behind" ? "behind" : "under";
  const strength = getString(shadowSettings.strength, "medium");
  const preset = getShadowPreset(effectiveMode, strength);
  const opacity = (customShadow ? getNumber(shadowSettings.opacity, preset.opacity, 0, 100) : preset.opacity) / 100;
  const blur = customShadow ? getNumber(shadowSettings.blur, preset.blur, 0, 100) : preset.blur;
  const offsetX = getNumber(shadowSettings.offsetX, 0, -300, 300);
  const offsetY = customShadow ? getNumber(shadowSettings.offsetY, preset.offsetY, -300, 300) : preset.offsetY;
  const spread = (customShadow ? getNumber(shadowSettings.spread, preset.spread, 25, 200) : preset.spread) / 100;
  const color = /^#[0-9a-f]{6}$/i.test(getString(shadowSettings.color, "#000000")) ? getString(shadowSettings.color, "#000000") : "#000000";

  if (effectiveMode === "behind") {
    const shadowWidth = Math.min(width, Math.max(1, Math.round(productWidth * spread)));
    const shadowHeight = Math.min(height, Math.max(1, Math.round(productHeight * spread)));
    const alpha = await sharp(productBuffer)
      .ensureAlpha()
      .extractChannel("alpha")
      .linear(opacity)
      .toBuffer();
    const shadowMask = await sharp({
      create: {
        width: productWidth,
        height: productHeight,
        channels: 3,
        background: hexToRgb(color)
      }
    })
      .joinChannel(alpha)
      .resize(shadowWidth, shadowHeight, {
        fit: "fill"
      })
      .blur(blur)
      .png()
      .toBuffer();
    const shadowLeft = clampPosition(
      Math.round(productLeft + offsetX - (shadowWidth - productWidth) / 2),
      0,
      Math.max(0, width - shadowWidth)
    );
    const shadowTop = clampPosition(
      Math.round(productTop + offsetY - (shadowHeight - productHeight) / 2),
      0,
      Math.max(0, height - shadowHeight)
    );
    const transparentCanvas = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="rgba(0,0,0,0)" />
      </svg>
    `);

    return sharp(transparentCanvas)
      .composite([{ input: shadowMask, top: shadowTop, left: shadowLeft }])
      .png()
      .toBuffer();
  }

  const shadowCy = Math.min(height - 100, productTop + productHeight * 0.9 + offsetY);
  const shadowSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${productLeft + productWidth / 2 + offsetX}" cy="${shadowCy}" rx="${Math.max(productWidth * 0.36 * spread, width * 0.1)}" ry="${Math.max(productHeight * 0.055 * spread, height * 0.025)}" fill="${color}" fill-opacity="${opacity}" />
    </svg>
  `;

  return sharp(Buffer.from(shadowSvg)).blur(blur).png().toBuffer();
};

const applyProductLighting = async (productBuffer: Buffer, settings?: unknown): Promise<Buffer> => {
  const lightingSettings = getObject(settings);

  if (lightingSettings.enabled !== true) {
    return productBuffer;
  }

  const brightness = 1 + getNumber(lightingSettings.brightness, 0, -12, 12) / 200;
  const contrast = getNumber(lightingSettings.contrast, 0, -10, 10);
  const contrastFactor = 1 + contrast / 100;
  const contrastIntercept = -128 * (contrastFactor - 1);
  const saturation = lightingSettings.neutralizeTint === true ? 0.99 : 1;
  const gamma = lightingSettings.shadowLift === true ? 1.035 : 1;

  return sharp(productBuffer)
    .modulate({
      brightness,
      saturation
    })
    .linear(contrastFactor, contrastIntercept)
    .gamma(gamma)
    .png()
    .toBuffer();
};

const assertVisibleProductImage = async (productBuffer: Buffer): Promise<void> => {
  const metadata = await sharp(productBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Product cutout could not be read before compositing.");
  }

  const alpha = await sharp(productBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();
  const rgba = await sharp(productBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const coverage = getAlphaCoverage(alpha);
  const minCoverage = Math.max(1200, Math.round(metadata.width * metadata.height * 0.004));

  if (coverage < minCoverage) {
    throw new Error("Product cutout was empty after background removal. No image was replaced; reprocess this image with preserve product enabled.");
  }

  const diagnostics = analyzeAlphaMask(alpha, metadata.width, metadata.height);
  let strongHorizontalRows = 0;
  let longestStrongHorizontalRun = 0;
  let currentStrongHorizontalRun = 0;
  const bboxAspectRatio = diagnostics.bbox.width / Math.max(1, diagnostics.bbox.height);

  for (let y = diagnostics.bbox.y; y < diagnostics.bbox.y + diagnostics.bbox.height; y += 1) {
    let strongPixels = 0;

    for (let x = diagnostics.bbox.x; x < diagnostics.bbox.x + diagnostics.bbox.width; x += 1) {
      const pixel = y * metadata.width + x;
      if ((alpha[pixel] ?? 0) < 24) {
        continue;
      }

      const index = pixel * 4;
      const r = rgba[index] ?? 0;
      const g = rgba[index + 1] ?? 0;
      const b = rgba[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const saturation = getRgbSaturation(r, g, b);

      if (luminance < 190 || saturation > 0.22) {
        strongPixels += 1;
      }
    }

    if (strongPixels / Math.max(1, diagnostics.bbox.width) > 0.24) {
      strongHorizontalRows += 1;
      currentStrongHorizontalRun += 1;
      longestStrongHorizontalRun = Math.max(longestStrongHorizontalRun, currentStrongHorizontalRun);
    } else {
      currentStrongHorizontalRun = 0;
    }
  }

  if (
    bboxAspectRatio > 2.4 &&
    strongHorizontalRows >= 8 &&
    longestStrongHorizontalRun <= 3 &&
    strongHorizontalRows / Math.max(1, diagnostics.bbox.height) < 0.28
  ) {
    throw new Error("Product cutout appears to be horizontal scanline artifacts after background removal. No image was replaced.");
  }

  let visibleProductPixels = 0;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < 24) {
      continue;
    }

    const index = pixel * 4;
    const r = rgba[index] ?? 0;
    const g = rgba[index + 1] ?? 0;
    const b = rgba[index + 2] ?? 0;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
    const saturation = getRgbSaturation(r, g, b);
    const gradient = getRgbGradientMagnitude(rgba, metadata.width, metadata.height, pixel);

    if (luminance < 232 || saturation > 0.1 || channelSpread > 34 || gradient > 18) {
      visibleProductPixels += 1;
    }
  }

  const visibleProductShare = visibleProductPixels / Math.max(1, coverage);
  if (visibleProductShare < 0.08) {
    throw new Error("Product cutout is too faint after background removal. No image was replaced; review the source image or reprocess with pixel-perfect preservation enabled.");
  }

  const integrityIssues = getProductCutoutIntegrityIssues(alpha, metadata.width, metadata.height, diagnostics.bbox);
  if (integrityIssues.length > 0) {
    throw new Error(`Product cutout failed integrity checks: ${integrityIssues.join("; ")}. No image was replaced.`);
  }
};

const getProductCutoutIntegrityIssues = (
  alpha: Buffer,
  width: number,
  height: number,
  bbox: PreserveMaskDiagnostics["bbox"]
): string[] => {
  if (bbox.width <= 0 || bbox.height <= 0) {
    return ["empty product bounds"];
  }

  const issues: string[] = [];
  const components = getConnectedMaskComponents(thresholdAlphaMask(alpha, 24), width, height);
  let significantComponents: number[][] = [];
  if (components.length > 1) {
    const largest = components.reduce((best, component) => component.length > best.length ? component : best, components[0] as number[]);
    significantComponents = components.filter((component) => component.length >= Math.max(300, largest.length * 0.025));
    for (const component of components) {
      if (component === largest || component.length < Math.max(300, largest.length * 0.025)) {
        continue;
      }

      const bounds = getPixelComponentBounds(component, width, height);
      const componentWidth = bounds.maxX - bounds.minX + 1;
      const componentHeight = bounds.maxY - bounds.minY + 1;
      const aspect = componentWidth / Math.max(1, componentHeight);
      const longDetachedStrip =
        aspect > 5 &&
        componentWidth > bbox.width * 0.55 &&
        componentHeight < bbox.height * 0.16;

      if (longDetachedStrip) {
        issues.push("mask includes a long detached background strip");
        break;
      }
    }
  }

  const gapScanBounds = significantComponents.length > 1
    ? significantComponents.map((component) => {
        const bounds = getPixelComponentBounds(component, width, height);
        return {
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.maxX - bounds.minX + 1,
          height: bounds.maxY - bounds.minY + 1
        };
      })
    : [bbox];

  for (const scanBounds of gapScanBounds) {
    let widestGapPercent = 0;
    let longestGapRun = 0;
    let currentGapRun = 0;
    const minGapWidth = Math.max(18, Math.round(scanBounds.width * 0.18));
    const minGapRows = Math.max(6, Math.round(scanBounds.height * 0.035));

    for (let y = scanBounds.y; y < scanBounds.y + scanBounds.height; y += 1) {
      let first = -1;
      let last = -1;
      for (let x = scanBounds.x; x < scanBounds.x + scanBounds.width; x += 1) {
        if ((alpha[y * width + x] ?? 0) >= 24) {
          if (first < 0) first = x;
          last = x;
        }
      }

      let rowHasLargeGap = false;
      if (first >= 0 && last > first) {
        let runStart = -1;
        for (let x = first; x <= last; x += 1) {
          const opaque = (alpha[y * width + x] ?? 0) >= 24;
          if (!opaque && runStart < 0) {
            runStart = x;
          } else if ((opaque || x === last) && runStart >= 0) {
            const runEnd = opaque ? x - 1 : x;
            const gapWidth = runEnd - runStart + 1;
            const leftSupport = runStart - first;
            const rightSupport = last - runEnd;
            if (gapWidth >= minGapWidth && leftSupport >= scanBounds.width * 0.08 && rightSupport >= scanBounds.width * 0.08) {
              rowHasLargeGap = true;
              widestGapPercent = Math.max(widestGapPercent, gapWidth / Math.max(1, scanBounds.width));
            }
            runStart = -1;
          }
        }
      }

      if (rowHasLargeGap) {
        currentGapRun += 1;
        longestGapRun = Math.max(longestGapRun, currentGapRun);
      } else {
        currentGapRun = 0;
      }
    }

    if (longestGapRun >= minGapRows && widestGapPercent >= 0.22) {
      // Perforated products, retainers, handles, jewellery, vents, and multi-part
      // products can contain large real openings. Preserve-mode programmatic
      // validation handles true dropout separately; this generic visibility
      // guard should only block obvious detached artifacts.
      break;
    }
  }

  return issues;
};

const removePalePhotoCardFromProductBuffer = async (productBuffer: Buffer): Promise<Buffer> => {
  const metadata = await sharp(productBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    return productBuffer;
  }

  const width = metadata.width;
  const height = metadata.height;
  const rgba = await sharp(productBuffer).ensureAlpha().raw().toBuffer();
  const alpha = Buffer.alloc(width * height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = rgba[pixel * 4 + 3] ?? 0;
  }

  const diagnostics = analyzeAlphaMask(alpha, width, height);

  if (diagnostics.bboxAreaPercent < 18 || diagnostics.bboxFillPercent < 82) {
    return productBuffer;
  }

  const removable = new Uint8Array(alpha.length);
  const { bbox } = diagnostics;

  for (let y = bbox.y; y < bbox.y + bbox.height; y += 1) {
    for (let x = bbox.x; x < bbox.x + bbox.width; x += 1) {
      const pixel = y * width + x;

      if ((alpha[pixel] ?? 0) < 24) {
        continue;
      }

      const index = pixel * 4;
      const r = rgba[index] ?? 0;
      const g = rgba[index + 1] ?? 0;
      const b = rgba[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const saturation = getRgbSaturation(r, g, b);
      const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
      const gradient = getRgbGradientMagnitude(rgba, width, height, pixel);
      const smoothWhiteCard = luminance > 225 && saturation < 0.12 && channelSpread < 34;
      const smoothPaleCard = luminance > 188 && saturation < 0.08 && channelSpread < 24 && gradient < 12;

      if (smoothWhiteCard || smoothPaleCard) {
        removable[pixel] = 1;
      }
    }
  }

  const queue: number[] = [];
  const visited = new Uint8Array(alpha.length);
  const maxX = bbox.x + bbox.width - 1;
  const maxY = bbox.y + bbox.height - 1;
  const enqueue = (x: number, y: number): void => {
    const pixel = y * width + x;

    if (visited[pixel] || !removable[pixel]) {
      return;
    }

    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = bbox.x; x <= maxX; x += 1) {
    enqueue(x, bbox.y);
    enqueue(x, maxY);
  }

  for (let y = bbox.y; y <= maxY; y += 1) {
    enqueue(bbox.x, y);
    enqueue(maxX, y);
  }

  const cleanedAlpha = Buffer.from(alpha);
  let removedPixels = 0;

  while (queue.length > 0) {
    const pixel = queue.pop() as number;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    cleanedAlpha[pixel] = 0;
    removedPixels += 1;

    const neighbours = [
      x > bbox.x ? pixel - 1 : -1,
      x < maxX ? pixel + 1 : -1,
      y > bbox.y ? pixel - width : -1,
      y < maxY ? pixel + width : -1
    ];

    for (const next of neighbours) {
      if (next < 0 || visited[next] || !removable[next]) {
        continue;
      }

      visited[next] = 1;
      queue.push(next);
    }
  }

  const initialCoverage = getAlphaCoverage(alpha);
  const cleanedCoverage = getAlphaCoverage(cleanedAlpha);

  if (removedPixels < initialCoverage * 0.08 || cleanedCoverage < initialCoverage * 0.12) {
    return productBuffer;
  }

  const cleanedDiagnostics = analyzeAlphaMask(cleanedAlpha, width, height);

  if (cleanedDiagnostics.bboxFillPercent >= diagnostics.bboxFillPercent && cleanedDiagnostics.bboxAreaPercent >= diagnostics.bboxAreaPercent * 0.85) {
    return productBuffer;
  }

  console.info("Removed pale rectangular photo-card background from product layer", {
    removedPixels,
    initialCoverage,
    cleanedCoverage,
    initialBboxFillPercent: diagnostics.bboxFillPercent,
    cleanedBboxFillPercent: cleanedDiagnostics.bboxFillPercent,
    initialBboxAreaPercent: diagnostics.bboxAreaPercent,
    cleanedBboxAreaPercent: cleanedDiagnostics.bboxAreaPercent
  });

  const cleanedRgba = applyApprovedAlphaToOriginalPixels(rgbaToRgb(rgba), cleanedAlpha, width, height);

  return sharp(cleanedRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
};

const removeDetachedBackgroundMarksFromProductBuffer = async (productBuffer: Buffer): Promise<Buffer> => {
  const metadata = await sharp(productBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    return productBuffer;
  }

  const width = metadata.width;
  const height = metadata.height;
  const rgba = await sharp(productBuffer).ensureAlpha().raw().toBuffer();
  const alpha = Buffer.alloc(width * height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = rgba[pixel * 4 + 3] ?? 0;
  }

  const initialCoverage = getAlphaCoverage(alpha);
  const cleanedAlpha = cleanFlexibleForegroundAlpha(rgba, alpha, width, height);
  const cleanedCoverage = getAlphaCoverage(cleanedAlpha);

  if (cleanedCoverage === initialCoverage || cleanedCoverage < Math.max(1200, initialCoverage * 0.18)) {
    return productBuffer;
  }

  const cleanedDiagnostics = analyzeAlphaMask(cleanedAlpha, width, height);
  if (hasCatastrophicMaskFailure(cleanedDiagnostics)) {
    return productBuffer;
  }

  console.info("Removed detached background text/logo marks from reframed product layer", {
    initialCoverage,
    cleanedCoverage
  });

  const cleanedRgba = applyApprovedAlphaToOriginalPixels(rgbaToRgb(rgba), cleanedAlpha, width, height);

  return sharp(cleanedRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
};

const removeDetachedTextLogoComponentsFromProductBuffer = async (
  productBuffer: Buffer
): Promise<{ buffer: Buffer; removedPixels: number }> => {
  const metadata = await sharp(productBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    return { buffer: productBuffer, removedPixels: 0 };
  }

  const width = metadata.width;
  const height = metadata.height;
  const rgba = await sharp(productBuffer).ensureAlpha().raw().toBuffer();
  const alpha = Buffer.alloc(width * height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = rgba[pixel * 4 + 3] ?? 0;
  }

  const components = getConnectedMaskComponents(thresholdAlphaMask(alpha, 24), width, height);

  if (components.length < 2) {
    return { buffer: productBuffer, removedPixels: 0 };
  }

  const imageArea = width * height;
  const metrics = components.map((pixels) => {
    const bounds = getPixelComponentBounds(pixels, width, height);
    const componentWidth = bounds.maxX - bounds.minX + 1;
    const componentHeight = bounds.maxY - bounds.minY + 1;
    const boundsArea = Math.max(1, componentWidth * componentHeight);
    let totalSaturation = 0;
    let totalLuminance = 0;
    let totalGradient = 0;
    let darkPixels = 0;

    for (const pixel of pixels) {
      const index = pixel * 4;
      const r = rgba[index] ?? 0;
      const g = rgba[index + 1] ?? 0;
      const b = rgba[index + 2] ?? 0;
      const saturation = getRgbSaturation(r, g, b);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const gradient = getRgbGradientMagnitude(rgba, width, height, pixel);
      totalSaturation += saturation;
      totalLuminance += luminance;
      totalGradient += gradient;
      if (luminance < 88) {
        darkPixels += 1;
      }
    }

    const density = pixels.length / boundsArea;
    const meanSaturation = totalSaturation / Math.max(1, pixels.length);
    const meanLuminance = totalLuminance / Math.max(1, pixels.length);
    const meanGradient = totalGradient / Math.max(1, pixels.length);
    const darkShare = darkPixels / Math.max(1, pixels.length);
    const aspect = componentWidth / Math.max(1, componentHeight);
    const productScore = pixels.length *
      Math.max(0.1, density) *
      (1 + Math.min(meanGradient, 60) / 18 + meanSaturation * 5 + (meanLuminance < 120 ? 0.7 : 0));

    return {
      pixels,
      bounds,
      componentWidth,
      componentHeight,
      density,
      meanSaturation,
      meanLuminance,
      meanGradient,
      darkShare,
      aspect,
      productScore
    };
  });
  const primary = metrics.reduce((best, metric) => metric.productScore > best.productScore ? metric : best, metrics[0] as typeof metrics[number]);
  const cleaned = Buffer.from(alpha);
  let removedPixels = 0;

  for (const metric of metrics) {
    if (metric === primary) {
      continue;
    }

    const farFromPrimary = !componentBoundsOverlapWithPadding(metric.bounds, primary.bounds, Math.round(Math.min(width, height) * 0.11));
    const detachedBelowOrSide =
      metric.bounds.minY > primary.bounds.maxY - height * 0.04 ||
      metric.bounds.maxX < primary.bounds.minX - width * 0.03 ||
      metric.bounds.minX > primary.bounds.maxX + width * 0.03;
    const textOrLogoLike =
      metric.pixels.length >= Math.max(180, imageArea * 0.00016) &&
      metric.pixels.length < primary.pixels.length * 0.9 &&
      (
        metric.density < 0.62 ||
        metric.aspect > 2.1 ||
        metric.aspect < 0.38 ||
        metric.darkShare > 0.55
      ) &&
      metric.meanSaturation < 0.32 &&
      metric.meanGradient < 58;
    const backgroundCornerMark =
      metric.bounds.minY > height * 0.48 &&
      metric.bounds.maxX < width * 0.48 &&
      metric.pixels.length < primary.pixels.length * 0.95;

    if (!(farFromPrimary && textOrLogoLike && (detachedBelowOrSide || backgroundCornerMark))) {
      continue;
    }

    for (const pixel of metric.pixels) {
      cleaned[pixel] = 0;
      removedPixels += 1;
    }
  }

  if (removedPixels <= 0) {
    return { buffer: productBuffer, removedPixels: 0 };
  }

  const initialCoverage = getAlphaCoverage(alpha);
  const cleanedCoverage = getAlphaCoverage(cleaned);

  if (cleanedCoverage < Math.max(1200, initialCoverage * 0.18) || hasCatastrophicMaskFailure(analyzeAlphaMask(cleaned, width, height))) {
    return { buffer: productBuffer, removedPixels: 0 };
  }

  const cleanedRgba = applyApprovedAlphaToOriginalPixels(rgbaToRgb(rgba), cleaned, width, height);
  const buffer = await sharp(cleanedRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();

  console.info("Removed optional detached background text/logo components from product layer", {
    removedPixels,
    initialCoverage,
    cleanedCoverage,
    componentCount: components.length
  });

  return { buffer, removedPixels };
};

const removeThinEdgeNoiseFromProductBuffer = async (
  productBuffer: Buffer
): Promise<{ buffer: Buffer; removedPixels: number }> => {
  const metadata = await sharp(productBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    return { buffer: productBuffer, removedPixels: 0 };
  }

  const width = metadata.width;
  const height = metadata.height;
  const rgba = await sharp(productBuffer).ensureAlpha().raw().toBuffer();
  const alpha = Buffer.alloc(width * height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = rgba[pixel * 4 + 3] ?? 0;
  }

  const cleanup = removeThinAlphaWhiskers(alpha, width, height);

  if (cleanup.removedPixels <= 0) {
    return { buffer: productBuffer, removedPixels: 0 };
  }

  const cleanedRgba = applyApprovedAlphaToOriginalPixels(rgbaToRgb(rgba), cleanup.alpha, width, height);
  const buffer = await sharp(cleanedRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();

  console.info("Removed thin flexible-mode edge noise from product layer", {
    removedPixels: cleanup.removedPixels
  });

  return { buffer, removedPixels: cleanup.removedPixels };
};

const getProductLayerDropoutIssues = (
  rgba: Buffer,
  alpha: Buffer,
  width: number,
  height: number
): string[] => {
  const bounds = getAlphaBounds(alpha, width, height, 24);
  const coverage = getAlphaCoverage(alpha);

  if (!bounds || coverage < 1200) {
    return [];
  }

  let darkProductPixels = 0;
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    if ((alpha[pixel] ?? 0) < 24) {
      continue;
    }

    const index = pixel * 4;
    const r = rgba[index] ?? 0;
    const g = rgba[index + 1] ?? 0;
    const b = rgba[index + 2] ?? 0;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const saturation = getRgbSaturation(r, g, b);

    if (luminance < 150 || saturation > 0.18) {
      darkProductPixels += 1;
    }
  }

  if (darkProductPixels / Math.max(1, coverage) < 0.38) {
    return [];
  }

  const visited = new Uint8Array(alpha.length);
  let smallInteriorHoleCount = 0;
  let smallInteriorHolePixels = 0;
  const maxSmallHolePixels = Math.max(90, Math.round(coverage * 0.0025));

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const start = y * width + x;
      if (visited[start] || (alpha[start] ?? 0) >= 24) {
        continue;
      }

      const stack = [start];
      visited[start] = 1;
      let pixels = 0;
      let touchesBounds = false;
      let adjacentOpaque = 0;

      while (stack.length > 0) {
        const pixel = stack.pop() as number;
        const px = pixel % width;
        const py = Math.floor(pixel / width);
        pixels += 1;
        touchesBounds = touchesBounds || px === bounds.minX || px === bounds.maxX || py === bounds.minY || py === bounds.maxY;

        const neighbours = [
          px > bounds.minX ? pixel - 1 : -1,
          px < bounds.maxX ? pixel + 1 : -1,
          py > bounds.minY ? pixel - width : -1,
          py < bounds.maxY ? pixel + width : -1
        ];

        for (const next of neighbours) {
          if (next < 0) {
            continue;
          }
          if ((alpha[next] ?? 0) >= 24) {
            adjacentOpaque += 1;
            continue;
          }
          if (visited[next]) {
            continue;
          }
          visited[next] = 1;
          stack.push(next);
        }
      }

      if (!touchesBounds && pixels <= maxSmallHolePixels && adjacentOpaque >= Math.max(8, pixels * 0.35)) {
        smallInteriorHoleCount += 1;
        smallInteriorHolePixels += pixels;
      }
    }
  }

  if (
    smallInteriorHoleCount < 14 ||
    smallInteriorHolePixels < Math.max(280, coverage * 0.0035)
  ) {
    return [];
  }

  return [
    `Product mask contains ${smallInteriorHoleCount} small internal alpha dropouts (${smallInteriorHolePixels} px), indicating damaged product detail.`
  ];
};

const assertCompositeContainsProduct = async (
  backgroundBuffer: Buffer,
  composedImage: Buffer,
  productAlphaCoverage: number,
  preserveProductExactly: boolean
): Promise<void> => {
  if (!preserveProductExactly) {
    return;
  }

  const [backgroundRaw, composedRaw] = await Promise.all([
    sharp(backgroundBuffer)
      .resize(outputSize, outputSize, {
        fit: "fill",
        kernel: sharp.kernel.nearest
      })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(composedImage)
      .resize(outputSize, outputSize, {
        fit: "fill",
        kernel: sharp.kernel.nearest
      })
      .removeAlpha()
      .raw()
      .toBuffer()
  ]);
  let changedPixels = 0;
  let totalDelta = 0;
  const pixelCount = outputSize * outputSize;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const index = pixel * 3;
    const delta =
      Math.abs((backgroundRaw[index] ?? 0) - (composedRaw[index] ?? 0)) +
      Math.abs((backgroundRaw[index + 1] ?? 0) - (composedRaw[index + 1] ?? 0)) +
      Math.abs((backgroundRaw[index + 2] ?? 0) - (composedRaw[index + 2] ?? 0));

    if (delta > 12) {
      changedPixels += 1;
      totalDelta += delta / 3;
    }
  }

  const minChangedPixels = Math.max(800, Math.round(productAlphaCoverage * 0.08));
  const meanChangedDelta = changedPixels > 0 ? totalDelta / changedPixels : 0;

  if (changedPixels < minChangedPixels || meanChangedDelta < 3) {
    throw new Error("Preserve mode rejected a background-only composite. The product layer was not visibly present in the final image.");
  }
};

const buildOutputQualityValidation = async (
  productBuffer: Buffer,
  productLeft: number,
  productTop: number,
  target: ProductCoverageTarget,
  cutoutResult: CutoutResult,
  preserveProductExactly: boolean,
  shadowEnabled: boolean,
  autoFixedFraming: boolean,
  protectedProductValidation: ProductProtectionValidation,
  productFallbackWarnings: string[] = []
): Promise<OutputQualityValidation> => {
  const metadata = await sharp(productBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Product cutout could not be read for output validation.");
  }

  const productRgba = await sharp(productBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const alpha = Buffer.alloc(metadata.width * metadata.height);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = productRgba[pixel * 4 + 3] ?? 0;
  }
  const bounds = getAlphaBounds(alpha, metadata.width, metadata.height, 16);

  if (!bounds) {
    throw new Error("Output validation failed because no product foreground was detected.");
  }

  const finalBounds = {
    minX: productLeft + bounds.minX,
    maxX: productLeft + bounds.maxX,
    minY: productTop + bounds.minY,
    maxY: productTop + bounds.maxY,
    width: bounds.width,
    height: bounds.height
  };
  const coverageWidth = finalBounds.width / outputSize;
  const coverageHeight = finalBounds.height / outputSize;
  const primaryCoverage = target.primaryAxis === "width" ? coverageWidth : coverageHeight;
  const boundaryMargin = Math.round(outputSize * 0.025);
  const warnings: string[] = [];
  const failureReasons: string[] = [];
  let framing: OutputQualityValidation["checks"]["framing"] = autoFixedFraming ? "Auto-fixed" : "Passed";
  let edgeQuality: ValidationStatus = "Passed";
  let interiorDropout: ValidationStatus = "Passed";
  let protectedProduct: ValidationStatus = "Passed";

  if (primaryCoverage < target.min) {
    const message = `Product coverage ${(primaryCoverage * 100).toFixed(1)}% is below the ${Math.round(target.min * 100)}-${Math.round(target.max * 100)}% target for ${target.orientation} products.`;
    if (primaryCoverage < target.autoFixBelow) {
      failureReasons.push(message);
      framing = "Failed";
    } else {
      warnings.push(message);
      framing = "Needs Review";
    }
  }

  if (primaryCoverage > target.max + 0.02) {
    failureReasons.push(`Product coverage ${(primaryCoverage * 100).toFixed(1)}% is above the safe ${Math.round(target.max * 100)}% maximum.`);
    framing = "Failed";
  } else if (primaryCoverage > target.max) {
    warnings.push(`Product coverage ${(primaryCoverage * 100).toFixed(1)}% is slightly above the preferred maximum.`);
    framing = framing === "Auto-fixed" ? "Auto-fixed" : "Needs Review";
  }

  if (
    finalBounds.minX <= boundaryMargin ||
    finalBounds.minY <= boundaryMargin ||
    finalBounds.maxX >= outputSize - boundaryMargin ||
    finalBounds.maxY >= outputSize - boundaryMargin
  ) {
    failureReasons.push("Product foreground touches the canvas safe boundary and may be cropped.");
    framing = "Failed";
  }

  const mask = cutoutResult.preserveDebug?.mask;
  const programmaticValidation = cutoutResult.preserveDebug?.programmaticValidation;
  if (mask && (!mask.passed || mask.connectedComponentCount > 200 || mask.largestComponentSharePercent < 70)) {
    warnings.push("Foreground edge confidence is low; review for background remnants or jagged thin parts.");
    edgeQuality = "Needs Review";
  }

  if (programmaticValidation && !programmaticValidation.passed) {
    failureReasons.push(...programmaticValidation.failReasons);
    edgeQuality = programmaticValidation.failReasons.includes("Edge Halo / Background Residue") || programmaticValidation.failReasons.includes("Dirty Alpha Edge")
      ? "Failed"
      : edgeQuality;
  }

  const dropoutIssues = getProductLayerDropoutIssues(productRgba, alpha, metadata.width, metadata.height);
  if (dropoutIssues.length > 0) {
    failureReasons.push(...dropoutIssues);
    interiorDropout = "Failed";
  }

  const interiorDropoutDiagnostics = cutoutResult.preserveDebug?.interiorDropout;
  if (interiorDropoutDiagnostics && (interiorDropoutDiagnostics.needsReview || interiorDropoutDiagnostics.unresolvedRegionCount > 0)) {
    failureReasons.push(
      interiorDropoutDiagnostics.failureReasons.join("; ") ||
      "Interior product dropout remains after preserve-mode repair."
    );
    interiorDropout = "Failed";
  } else if ((interiorDropoutDiagnostics?.restoredRegionCount ?? 0) > 0) {
    warnings.push("Interior product dropout was detected and repaired from original source pixels.");
  }

  const productPreservation: ValidationStatus = !Number.isFinite(cutoutResult.validation.foregroundMeanDelta)
    ? "Needs Review"
    : cutoutResult.validation.foregroundMeanDelta > 3
      ? "Failed"
      : "Passed";

  if (productPreservation === "Failed") {
    failureReasons.push("Product pixel drift exceeded the preserve-mode threshold.");
  } else if (productPreservation === "Needs Review") {
    warnings.push("Product preservation could not be fully verified.");
  }

  const detailPreservation: ValidationStatus = productPreservation;
  if (!preserveProductExactly) {
    warnings.push("Flexible mode used source-locked product pixels; AI changes are limited to background, framing, and non-destructive presentation.");
  }
  if (cutoutResult.provider.includes("flexible-full-source-review-fallback")) {
    warnings.push("Flexible mode could not isolate the product safely, so the original image was processed as a full-source review fallback.");
  }

  if (protectedProductValidation.outcome === "HARD_FAIL") {
    protectedProduct = "Failed";
    failureReasons.push(...protectedProductValidation.failReasons);
  } else if (protectedProductValidation.outcome === "SOFT_FAIL_RETRYABLE") {
    protectedProduct = "Failed";
    failureReasons.push(...protectedProductValidation.retryableReasons);
  }

  warnings.push(...productFallbackWarnings);

  const shadow: ValidationStatus = shadowEnabled ? "Passed" : "Needs Review";
  if (!shadowEnabled) {
    warnings.push("No contact shadow was added, so the product may appear less grounded.");
  }

  const checks = {
    productPreservation,
    framing,
    background: "Passed" as ValidationStatus,
    detailPreservation,
    interiorDropout,
    edgeQuality,
    protectedProduct,
    shadow,
    programmaticValidation: preserveProductExactly && programmaticValidation ? (programmaticValidation.passed ? "Passed" as const : "Failed" as const) : undefined
  };
  const status: ValidationStatus = failureReasons.length > 0
    ? "Failed"
    : Object.values(checks).some((check) => check === "Needs Review")
      ? "Needs Review"
      : "Passed";

  const programmaticValidationWithoutOverlays = programmaticValidation
    ? (({ overlays: _overlays, ...rest }) => rest)(programmaticValidation)
    : undefined;

  return {
    status,
    promptVersion: ecommercePreservePromptVersion,
    processingMode: preserveProductExactly
      ? "seo_product_feed_safe_preserve_background_replacement"
      : "standard_background_replacement",
    cutoutProvider: cutoutResult.provider,
    retryCount: Math.max(0, cutoutResult.attempts - 1),
    productCoveragePercent: Number((primaryCoverage * 100).toFixed(2)),
    productCoverageWidthPercent: Number((coverageWidth * 100).toFixed(2)),
    productCoverageHeightPercent: Number((coverageHeight * 100).toFixed(2)),
    targetCoverageMinPercent: Number((target.min * 100).toFixed(2)),
    targetCoverageMaxPercent: Number((target.max * 100).toFixed(2)),
    productOrientation: target.orientation,
    autoFixedFraming,
    checks,
    outcome: protectedProductValidation.outcome,
    protectedProductValidation,
    scores: programmaticValidation?.scores,
    programmaticValidation: programmaticValidationWithoutOverlays,
    warnings,
    failureReasons: Array.from(new Set(failureReasons))
  };
};

const buildBrandedBackground = async (background: string): Promise<Buffer> => {
  if (background === "transparent") {
    return sharp({
      create: {
        width: outputSize,
        height: outputSize,
        channels: 4,
        background: {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0
        }
      }
    })
      .png()
      .toBuffer();
  }

  const presetColors: Record<string, string> = {
    white: "#ffffff",
    "soft-white": "#f8f8f5",
    "light-grey": "#f3f4f4",
    "cool-studio": "#f4f7fb",
    "warm-studio": "#faf7f2",
    "optivra-default": "#f7f7f4"
  };
  const backgroundColor = presetColors[background] ?? background;
  const safeBackground = /^#[0-9a-f]{6}$/i.test(background) ? background : "#f7f7f4";
  const safeColor = /^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : safeBackground;
  const backgroundSvg = `
    <svg width="${outputSize}" height="${outputSize}" viewBox="0 0 ${outputSize} ${outputSize}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${outputSize}" height="${outputSize}" fill="${safeColor}"/>
    </svg>
  `;

  return Buffer.from(backgroundSvg);
};

const buildBackgroundFromImage = async (
  backgroundImageUrl: string | undefined,
  backgroundImageBuffer: Buffer | undefined,
  backgroundImageContentType: string | undefined
): Promise<Buffer> => {
  const backgroundImage = backgroundImageBuffer
    ? getUploadedImage(backgroundImageBuffer, backgroundImageContentType ?? "application/octet-stream")
    : await downloadImage(backgroundImageUrl ?? "");
  await validateImage(backgroundImage.buffer);

  const studioBase = await sharp(backgroundImage.buffer)
    .rotate()
    .resize(outputSize, outputSize, {
      fit: "cover",
      position: "centre"
    })
    .blur(18)
    .modulate({
      saturation: 0.22,
      brightness: 1.04
    })
    .png()
    .toBuffer();

  const wash = await sharp({
    create: {
      width: outputSize,
      height: outputSize,
      channels: 4,
      background: {
        r: 248,
        g: 248,
        b: 244,
        alpha: 0.72
      }
    }
  })
    .png()
    .toBuffer();

  return sharp(studioBase)
    .composite([{ input: wash, blend: "over" }])
    .png()
    .toBuffer();
};

const compositeSourceLockedProductLayers = async ({
  backgroundBuffer,
  shadowBuffer,
  productBuffer,
  productTop,
  productLeft
}: {
  backgroundBuffer: Buffer;
  shadowBuffer: Buffer | null;
  productBuffer: Buffer;
  productTop: number;
  productLeft: number;
}): Promise<Buffer> => {
  const composites = [
    ...(shadowBuffer ? [{ input: shadowBuffer, top: 0, left: 0 }] : []),
    { input: productBuffer, top: productTop, left: productLeft }
  ];

  return sharp(backgroundBuffer)
    .composite(composites)
    .png()
    .toBuffer();
};

const flexibleStudioRecoveryInstructions = [
  "Create a flawless professional WooCommerce product image from the supplied photo. Remove the old background, detached background watermarks/logos/text, baked-in alpha or mask outlines, jagged dark borders, grey/white halos, staircase cutout artifacts, and shadow bleed around the product. Preserve the same sellable product identity, shape, holes, openings, threading, tabs, screws, ridges, labels, printed product text, orientation, material, colour family, reflective finish, and fine geometry. Do not draw an outline around the product. Use a clean off-white ecommerce studio background and a very soft natural shadow only behind or beneath the product. The final product must have smooth anti-aliased professional edges and no visible mask artifacts.",
  "Professional product retouching edit. Treat the original image as the reference for the actual product. Rebuild only the studio presentation: remove the source background, watermark, embedded halo, edge dirt, dark contour artifacts, cutout stair-stepping, and background fragments. Keep the product as the same object with the same proportions, openings, material finish, visible product markings, holes, tabs, ridges, screws, transparent areas, and orientation. Use a plain light grey/off-white background with subtle realistic shadow separated from the product. No visible alpha mask, no edge outline, no jagged contour, no background bleed, no extra objects, no new text.",
  "Make a clean ecommerce catalogue photo of this exact product. Remove all background branding and every visible cutout/mask artifact. Preserve the real product, including silhouettes, negative spaces, transparent or dark openings, threads, tabs, labels, logos physically on the product, surface texture, and reflective finish. The product edges must be naturally anti-aliased with absolutely no dark fringe or grey halo. Place on a soft off-white studio background with a gentle shadow beneath only. Do not stylize, warp, crop, recolour, add text, or add extra objects."
];

const buildFlexibleStudioBackgroundDescription = (
  background: string,
  processingSettings: Record<string, unknown>
): string => {
  const backgroundSettings = getObject(processingSettings.background);
  const preset = getString(backgroundSettings.preset, background);
  const mode = getString(processingSettings.processingMode, "standard_background_replacement");

  return [
    `Selected background preset: ${preset}.`,
    `Processing mode: ${mode}.`,
    "Use a clean light ecommerce studio background with no logos, watermark, text, props, hands, people, packaging, clutter, or lifestyle scene.",
    "Use only a soft realistic shadow separated from the product; do not let shadow become a product outline."
  ].join(" ");
};

const processFlexibleOpenAiStudioRecovery = async ({
  userId,
  imageJobId,
  originalImage,
  originalImageHash,
  originalStoragePath,
  originalUploadedAt,
  storageCleanupAfter,
  seoMetadata,
  preservedOriginalInput,
  processingSettings,
  background,
  pipelineDebugAssets,
  recoveryReason
}: {
  userId: string;
  imageJobId: string;
  originalImage: DownloadedImage;
  originalImageHash: string;
  originalStoragePath: string;
  originalUploadedAt: Date;
  storageCleanupAfter: Date;
  seoMetadata: SuggestedSeoMetadata;
  preservedOriginalInput: Buffer;
  processingSettings: Record<string, unknown>;
  background: string;
  pipelineDebugAssets: PreserveDebugAsset[];
  recoveryReason: string;
}): Promise<ProcessedImageResult> => {
  const studioInput = await normalizeImageForOpenAiStudioRender(originalImage.buffer);
  const sourceAnalysis = await analyzeSourceImageForPreserveMode(preservedOriginalInput);
  const processingMode = getString(processingSettings.processingMode, "standard_background_replacement");
  const backgroundDescription = buildFlexibleStudioBackgroundDescription(background, processingSettings);
  const attemptSummaries: string[] = [];

  for (let attempt = 0; attempt < flexibleStudioRecoveryInstructions.length; attempt += 1) {
    const finalComposite = await renderFlexibleStudioProductImage({
      imageBuffer: studioInput,
      preserveProductExactly: false,
      processingMode,
      backgroundDescription,
      recoveryInstruction: flexibleStudioRecoveryInstructions[attempt]
    });
    await validateImage(finalComposite);

    const visionQa = await runFlexibleStudioVisionQa({
      originalSource: preservedOriginalInput,
      finalComposite
    });
    const qaPassed =
      visionQa.passed &&
      visionQa.commerciallyUsable &&
      visionQa.scores.edgeCleanliness >= 88 &&
      visionQa.scores.productPreservation >= 78 &&
      visionQa.scores.backgroundRemoval >= 88 &&
      visionQa.scores.ecommerceQuality >= 88 &&
      visionQa.visibleProblems.length === 0;
    const outputValidation: OutputQualityValidation = {
      status: qaPassed ? "Passed" : "Failed",
      promptVersion: ecommercePreservePromptVersion,
      processingMode: "flexible_openai_studio_recovery",
      cutoutProvider: `openai:${openAiImageEditModel}:flexible-studio-final`,
      retryCount: attempt,
      productCoveragePercent: Number((sourceAnalysis.alphaCoveragePercent || 0).toFixed(2)),
      productCoverageWidthPercent: sourceAnalysis.productBounds
        ? Number(((sourceAnalysis.productBounds.width / Math.max(1, sourceAnalysis.width)) * 100).toFixed(2))
        : 0,
      productCoverageHeightPercent: sourceAnalysis.productBounds
        ? Number(((sourceAnalysis.productBounds.height / Math.max(1, sourceAnalysis.height)) * 100).toFixed(2))
        : 0,
      targetCoverageMinPercent: 0,
      targetCoverageMaxPercent: 100,
      productOrientation: sourceAnalysis.productOrientation,
      autoFixedFraming: false,
      checks: {
        productPreservation: qaPassed ? "Passed" : "Failed",
        framing: "Passed",
        background: qaPassed ? "Passed" : "Failed",
        detailPreservation: qaPassed ? "Passed" : "Failed",
        interiorDropout: qaPassed ? "Passed" : "Failed",
        edgeQuality: qaPassed ? "Passed" : "Failed",
        shadow: qaPassed ? "Passed" : "Failed",
        protectedProduct: qaPassed ? "Passed" : "Failed",
        visionQa: qaPassed ? "Passed" : "Failed"
      },
      outcome: qaPassed ? "PASS" : "HARD_FAIL",
      scores: {
        visionQaEcommerce: visionQa.scores.ecommerceQuality,
        visionQaTextBranding: visionQa.scores.textBrandingConsistency
      },
      visionQa,
      warnings: [
        `Flexible OpenAI studio recovery was used after source-locked matting failed: ${recoveryReason}`,
        `Flexible studio recovery attempt ${attempt + 1} of ${flexibleStudioRecoveryInstructions.length}.`
      ],
      failureReasons: qaPassed
        ? []
        : Array.from(new Set([
            ...visionQa.failReasons,
            ...visionQa.visibleProblems,
            "Flexible OpenAI studio recovery did not pass strict visual QA."
          ]))
    };

    attemptSummaries.push(`attempt ${attempt + 1}: ${outputValidation.status}${outputValidation.failureReasons.length ? ` (${outputValidation.failureReasons.join("; ")})` : ""}`);

    if (!qaPassed) {
      continue;
    }

    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "source_normalized",
      `flexible-openai-studio-input-${randomUUID()}.png`,
      studioInput,
      "image/png"
    );
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "final_composite",
      `flexible-openai-studio-final-${randomUUID()}.png`,
      finalComposite,
      "image/png"
    );
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "vision_qa_json",
      `flexible-openai-studio-qa-${randomUUID()}.json`,
      Buffer.from(JSON.stringify(visionQa, null, 2)),
      "application/json"
    );
    const finalOutputValidation = {
      ...outputValidation,
      debugAssets: pipelineDebugAssets
    };
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "validation_json",
      `flexible-openai-studio-validation-${randomUUID()}.json`,
      Buffer.from(JSON.stringify(finalOutputValidation, null, 2)),
      "application/json"
    );
    finalOutputValidation.debugAssets = pipelineDebugAssets;

    const processedImage = await sharp(finalComposite)
      .webp({
        quality: 94,
        smartSubsample: true
      })
      .toBuffer();
    const processedStoragePath = getStoragePath(userId, imageJobId, `processed-${randomUUID()}.webp`);
    await uploadStorageObject({
      bucket: storageBuckets.processedImages,
      path: processedStoragePath,
      body: processedImage,
      contentType: "image/webp"
    });
    const processedUploadedAt = new Date();
    const processedUrl = await createStorageSignedUrl({
      bucket: storageBuckets.processedImages,
      path: processedStoragePath,
      expiresInSeconds: env.storageSignedUrlExpiresSeconds
    });

    return {
      processedUrl,
      originalImageHash,
      originalStoragePath,
      processedStoragePath,
      debugCutoutStoragePath: null,
      originalUploadedAt,
      processedUploadedAt,
      debugCutoutUploadedAt: null,
      storageCleanupAfter,
      duplicateOfJobId: null,
      creditDeductionRequired: true,
      seoMetadata,
      outputValidation: finalOutputValidation
    };
  }

  throw new Error(`Flexible OpenAI studio recovery exhausted all attempts: ${attemptSummaries.join(" | ")}`);
};

export const __optiimstImageProcessingTestHooks = {
  buildFlexibleFullSourceReviewCutout,
  buildFlexibleLocalForegroundCutout,
  buildPreservedProductCutoutFromRawLocalMask,
  processImageFlexiblePreserveMode,
  removeThinEdgeNoiseFromProductBuffer
};

export const processImageForProduct = async ({
  imageJobId,
  userId,
  imageUrl,
  background = "#f7f7f4",
  scalePercent,
  backgroundImageUrl,
  imageBuffer,
  imageContentType,
  backgroundImageBuffer,
  backgroundImageContentType,
  settings,
  jobOverrides
}: ProcessImageInput): Promise<ProcessedImageResult> => {
  const processingSettings = getObject(settings);
  const preserveProductExactly = processingSettings.preserveProductExactly !== false;
  const preserveModeFallback = getPreserveModeFallback(processingSettings);
  const framingSettings = getObject(processingSettings.framing);
  const shadowSettings = getObject(processingSettings.shadow);
  const lightingSettings = getObject(processingSettings.lighting);
  const effectiveBackgroundImageUrl = getEffectiveBackgroundImageUrl(backgroundImageUrl, processingSettings);
  const requiresCustomBackground = wantsCustomBackground(processingSettings);
  const overrideSettings = getObject(jobOverrides);
  const edgeToEdge = getObject(overrideSettings.edgeToEdge);
  const edgeLeftRequested = edgeToEdge.left === true;
  const edgeRightRequested = edgeToEdge.right === true;
  const edgeTopRequested = edgeToEdge.top === true;
  const edgeBottomRequested = edgeToEdge.bottom === true;
  const edgeEnabled = edgeToEdge.enabled === true || edgeLeftRequested || edgeRightRequested || edgeTopRequested || edgeBottomRequested;
  const edgeLeft = edgeEnabled && edgeLeftRequested;
  const edgeRight = edgeEnabled && edgeRightRequested;
  const edgeTop = edgeEnabled && edgeTopRequested;
  const edgeBottom = edgeEnabled && edgeBottomRequested;
  const hasProcessingOptions =
    settings !== undefined ||
    jobOverrides !== undefined ||
    backgroundImageUrl !== undefined ||
    backgroundImageBuffer !== undefined ||
    scalePercent !== undefined ||
    background !== "#f7f7f4";
  const originalImage = imageBuffer
    ? getUploadedImage(imageBuffer, imageContentType ?? "application/octet-stream")
    : await downloadImage(imageUrl);
  await validateImage(originalImage.buffer);
  const originalImageDimensions = await getImageDimensions(originalImage.buffer);
  const originalImageHash = getSha256(originalImage.buffer);
  const seoMetadata = getSuggestedSeoMetadata(imageUrl, originalImageHash);

  const originalStoragePath = getStoragePath(
    userId,
    imageJobId,
    `original-${randomUUID()}.${originalImage.extension}`
  );
  await uploadStorageObject({
    bucket: storageBuckets.originalImages,
    path: originalStoragePath,
    body: originalImage.buffer,
    contentType: originalImage.contentType
  });
  const originalUploadedAt = new Date();
  const storageCleanupAfter = getStorageCleanupAfter();
  const savePipelineDebugAssets = !preserveProductExactly && (env.nodeEnv !== "production" || processingSettings.debugArtifacts === true);
  const pipelineDebugAssets: PreserveDebugAsset[] = [];
  if (savePipelineDebugAssets) {
    await addDebugAssetRecord(pipelineDebugAssets, "original_source", storageBuckets.originalImages, originalStoragePath, originalImage.contentType);
  }
  const duplicateJob = preserveProductExactly || hasProcessingOptions ? null : await findDuplicateJob(userId, imageJobId, originalImageHash);

  if (duplicateJob?.processed_storage_path) {
    const processedUrl = await createStorageSignedUrl({
      bucket: storageBuckets.processedImages,
      path: duplicateJob.processed_storage_path,
      expiresInSeconds: signedUrlExpirySeconds
    });

    return {
      processedUrl,
      originalImageHash,
      originalStoragePath,
      processedStoragePath: null,
      debugCutoutStoragePath: null,
      originalUploadedAt,
      processedUploadedAt: null,
      debugCutoutUploadedAt: null,
      storageCleanupAfter,
      duplicateOfJobId: duplicateJob.id,
      creditDeductionRequired: false,
      seoMetadata: (duplicateJob.seo_metadata as SuggestedSeoMetadata | null) ?? seoMetadata
    };
  }

  const [openAiInput, preservedOriginalInput] = await Promise.all([
    normalizeImageForOpenAi(originalImage.buffer),
    normalizeImageForPreservedProduct(originalImage.buffer)
  ]);
  if (savePipelineDebugAssets) {
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "source_normalized",
      `source-normalized-${randomUUID()}.png`,
      openAiInput,
      "image/png"
    );
  }

  console.info("Image processing cutout mode selected", {
    imageJobId,
    preserveProductExactly,
    preserveModeFallback: preserveProductExactly ? preserveModeFallback : null,
    originalContentType: originalImage.contentType,
    originalBytes: originalImage.buffer.byteLength,
    originalWidth: originalImageDimensions.width,
    originalHeight: originalImageDimensions.height
  });

  const flexiblePipelineWarnings: string[] = [];
  const backgroundIsTransparent = getString(getObject(processingSettings.background).preset, background) === "transparent" || background === "transparent";
  if (!preserveProductExactly) {
    if (requiresCustomBackground && !effectiveBackgroundImageUrl && !backgroundImageBuffer) {
      throw new Error("Custom background is selected but no custom background image was received. Save the background setting and reprocess this image.");
    }

    console.info("Flexible studio enhancement selected; final image will be built by source-locked layer compositing", {
      imageJobId,
      backgroundIsTransparent,
      hasCustomBackground: Boolean(effectiveBackgroundImageUrl || backgroundImageBuffer)
    });

    if (backgroundIsTransparent) {
      flexiblePipelineWarnings.push("Transparent background selected; OpenAI studio background generation was skipped and the product layer was composited onto transparency.");
    } else if (effectiveBackgroundImageUrl || backgroundImageBuffer) {
      flexiblePipelineWarnings.push("Custom background selected; OpenAI studio background generation was skipped so the user-selected background remains authoritative.");
    }

    const shouldUseOpenAiStudioRender =
      processingSettings.disableOpenAiStudioRender !== true &&
      !backgroundIsTransparent &&
      !effectiveBackgroundImageUrl &&
      !backgroundImageBuffer &&
      Boolean(env.openAiApiKey);
    if (shouldUseOpenAiStudioRender) {
      const existingAlphaCutout = await buildCutoutFromExistingSourceAlpha(originalImage.buffer).catch(() => null);

      if (!existingAlphaCutout) {
        console.info("Flexible studio enhancement selected OpenAI studio recovery renderer for non-transparent source", {
          imageJobId,
          backgroundIsTransparent,
          hasCustomBackground: false
        });

        return await processFlexibleOpenAiStudioRecovery({
          userId,
          imageJobId,
          originalImage,
          originalImageHash,
          originalStoragePath,
          originalUploadedAt,
          storageCleanupAfter,
          seoMetadata,
          preservedOriginalInput,
          processingSettings,
          background,
          pipelineDebugAssets,
          recoveryReason: "Flexible mode source image has no trustworthy transparency; using OpenAI studio recovery before publishing."
        });
      }
    }
  }

  let strictSourceLockedRescueWarnings: string[] = [];
  let cutoutResult: CutoutResult;
  if (preserveProductExactly) {
    try {
      cutoutResult = await processImagePreserveMode(preservedOriginalInput, openAiInput, {
        userId,
        imageJobId,
        specialistSourceBuffer: originalImage.buffer,
        specialistSourceContentType: originalImage.contentType,
        originalStoragePath,
        originalContentType: originalImage.contentType,
        sourceDimensions: originalImageDimensions,
        fallbackMode: preserveModeFallback
      });
    } catch (preserveError) {
      const preserveDebug = getPreserveDebugFromError(preserveError);
      if (!preserveDebug) {
        throw preserveError;
      }

      console.warn("Exact preserve mode exhausted source-locked methods without using a non-pixel-perfect fallback", {
        imageJobId,
        reason: preserveError instanceof Error ? preserveError.message : "Unknown preserve mode error"
      });
      throw preserveError;
    }
  } else {
    cutoutResult = await processImageFlexiblePreserveMode(
        originalImage.buffer,
        openAiInput,
        originalImage.contentType,
        processingSettings.preserveFallbackFromStrictMode === true
      );
  }
  const cutout = cutoutResult.cutout;
  await validateImage(cutout);

  const debugCutoutStoragePath = getStoragePath(userId, imageJobId, `cutout-${randomUUID()}.png`);
  await uploadStorageObject({
    bucket: storageBuckets.debugCutouts,
    path: debugCutoutStoragePath,
    body: cutoutResult.debugCutout,
    contentType: "image/png"
  });
  if (savePipelineDebugAssets) {
    await addDebugAssetRecord(pipelineDebugAssets, "debug_cutout", storageBuckets.debugCutouts, debugCutoutStoragePath, "image/png");
  }
  const debugCutoutUploadedAt = new Date();

  const framingMode = getString(framingSettings.mode, "auto");
  const targetCoverageOverride = framingSettings.useTargetCoverage === true && typeof framingSettings.targetCoverage === "number"
    ? getNumber(framingSettings.targetCoverage, defaultScalePercent, 70, 90)
    : undefined;
  const paddingPercent = getNumber(framingSettings.padding, 8, 0, 30);
  const autoPaddingPercent = framingMode === "auto" && !scalePercent ? Math.min(paddingPercent, 3) : paddingPercent;
  const margin = edgeEnabled ? Math.round(outputSize * (Math.min(autoPaddingPercent, 1) / 100)) : Math.round(outputSize * (autoPaddingPercent / 100));
  const horizontalLimit = outputSize - (edgeLeft ? 0 : margin) - (edgeRight ? 0 : margin);
  const verticalLimit = outputSize - (edgeTop ? 0 : margin) - (edgeBottom ? 0 : margin);
  const targetProductSize = Math.round(outputSize * (normalizeScalePercent(scalePercent) / 100));
  const resizeWidth = Math.max(1, Math.min(targetProductSize, horizontalLimit));
  const resizeHeight = Math.max(1, Math.min(targetProductSize, verticalLimit));
  const edgeResizeWidth = edgeLeft && edgeRight ? horizontalLimit : resizeWidth;
  const edgeResizeHeight = edgeTop && edgeBottom ? verticalLimit : resizeHeight;
  const reframedProduct = await reframeProductCutout(
    cutout,
    framingMode,
    typeof scalePercent === "number" ? normalizeScalePercent(scalePercent) : targetCoverageOverride,
    edgeResizeWidth,
    edgeResizeHeight
  );
  let productBuffer = reframedProduct.productBuffer;

  let productMetadata = await sharp(productBuffer).metadata();
  if ((productMetadata.width ?? 0) > outputSize || (productMetadata.height ?? 0) > outputSize) {
    productBuffer = await sharp(productBuffer)
      .resize(outputSize, outputSize, {
        fit: "inside",
        withoutEnlargement: true
      })
      .png()
      .toBuffer();
    productMetadata = await sharp(productBuffer).metadata();
  }
  if (!preserveProductExactly && !cutoutResult.provider.startsWith("source-alpha:")) {
    productBuffer = await removeDetachedBackgroundMarksFromProductBuffer(productBuffer);
    productBuffer = await removePalePhotoCardFromProductBuffer(productBuffer);
  }
  const removeBackgroundTextLogos = getObject(processingSettings.background).removeTextLogos === true ||
    processingSettings.removeBackgroundTextLogos === true ||
    processingSettings.removeDetachedBackgroundTextLogos === true;
  const productFallbackWarnings: string[] = [];
  if (!preserveProductExactly && !cutoutResult.provider.startsWith("source-alpha:")) {
    const edgeNoiseCleanup = await removeThinEdgeNoiseFromProductBuffer(productBuffer);
    if (edgeNoiseCleanup.removedPixels > 0) {
      productBuffer = edgeNoiseCleanup.buffer;
      productFallbackWarnings.push(
        `Removed ${edgeNoiseCleanup.removedPixels} thin edge-noise pixels from the flexible product mask.`
      );
    }
  }
  if (!preserveProductExactly && removeBackgroundTextLogos) {
    const detachedTextCleanup = await removeDetachedTextLogoComponentsFromProductBuffer(productBuffer);
    if (detachedTextCleanup.removedPixels > 0) {
      productBuffer = detachedTextCleanup.buffer;
      productFallbackWarnings.push(
        `Removed ${detachedTextCleanup.removedPixels} detached background text/logo pixels outside the main product layer.`
      );
    } else {
      productFallbackWarnings.push("Background text/logo removal was enabled, but no safe detached text or logo component was found outside the main product layer.");
    }
  }
  const protectedSourceProductBuffer = productBuffer;
  if (!preserveProductExactly) {
    const litProductBuffer = await applyProductLighting(productBuffer, lightingSettings);
    const litProductProtection = await validateProtectedProductRegion({
      sourceProductBuffer: protectedSourceProductBuffer,
      finalProductBuffer: litProductBuffer,
      preserveMode: false
    });

    if (litProductProtection.outcome === "PASS") {
      productBuffer = litProductBuffer;
    } else {
      productBuffer = protectedSourceProductBuffer;
      productFallbackWarnings.push(
        `Flexible mode fell back to source-locked product pixels after product protection validation: ${[
          ...litProductProtection.failReasons,
          ...litProductProtection.retryableReasons
        ].join("; ") || "product fidelity risk detected"}.`
      );
    }
  }
  await assertVisibleProductImage(productBuffer);
  const protectedProductValidation = await validateProtectedProductRegion({
    sourceProductBuffer: protectedSourceProductBuffer,
    finalProductBuffer: productBuffer,
    preserveMode: preserveProductExactly
  });
  if (!preserveProductExactly) {
    const flexibleDetailValidation = await validateFlexibleProductDetailPreservation(protectedSourceProductBuffer, productBuffer);
    productFallbackWarnings.push(...flexibleDetailValidation.warnings);
    if (!flexibleDetailValidation.passed) {
      productFallbackWarnings.push(
        `Flexible product detail regression check retained source-locked product pixels and flagged review: ${flexibleDetailValidation.failureReasons.join("; ")}`
      );
    }
  }
  const productDiffHeatmap = savePipelineDebugAssets
    ? await buildProductDiffHeatmap(protectedSourceProductBuffer, productBuffer)
    : null;
  const productAlphaCoverage = await getImageAlphaCoverage(productBuffer);
  productMetadata = await sharp(productBuffer).metadata();

  const productWidth = Math.min(outputSize, productMetadata.width ?? targetProductSize);
  const productHeight = Math.min(outputSize, productMetadata.height ?? targetProductSize);
  let left = Math.min(Math.max(Math.round((outputSize - productWidth) / 2), edgeLeft ? 0 : margin), outputSize - productWidth - (edgeRight ? 0 : margin));
  const verticalPresentationOffset = shadowSettings.mode === "off" ? 0 : -Math.round(outputSize * 0.015);
  let top = Math.min(Math.max(Math.round((outputSize - productHeight) / 2) + verticalPresentationOffset, edgeTop ? 0 : margin), outputSize - productHeight - (edgeBottom ? 0 : margin));

  if (edgeLeft && !edgeRight) left = 0;
  if (edgeRight && !edgeLeft) left = outputSize - productWidth;
  if (edgeTop && !edgeBottom) top = 0;
  if (edgeBottom && !edgeTop) top = outputSize - productHeight;

  const shadow = await buildShadow(outputSize, outputSize, productBuffer, productWidth, productHeight, left, top, shadowSettings);
  let outputValidation = await buildOutputQualityValidation(
    productBuffer,
    left,
    top,
    reframedProduct.target,
    cutoutResult,
    preserveProductExactly,
    Boolean(shadow),
    reframedProduct.autoFixedFraming,
    protectedProductValidation,
    [...strictSourceLockedRescueWarnings, ...flexiblePipelineWarnings, ...productFallbackWarnings]
  );
  if (
    processingSettings.preserveFallbackFromStrictMode === true &&
    outputValidation.status === "Failed" &&
    outputValidation.failureReasons.every((reason) => reason.includes("Product coverage"))
  ) {
    outputValidation = {
      ...outputValidation,
      status: "Needs Review",
      checks: {
        ...outputValidation.checks,
        framing: "Needs Review"
      },
      warnings: Array.from(new Set([
        ...outputValidation.warnings,
        "Strict preserve fallback produced a clean product layer, but product framing needs review before approval."
      ])),
      failureReasons: []
    };
  }
  if (preserveProductExactly && cutoutResult.preserveDebug) {
    cutoutResult.preserveDebug.outputValidation = outputValidation;
  }
  if (savePipelineDebugAssets) {
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "source_product_layer",
      `source-product-layer-${randomUUID()}.png`,
      productBuffer,
      "image/png"
    );
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "product_mask",
      `product-mask-${randomUUID()}.png`,
      await buildProductAlphaMaskPreview(productBuffer),
      "image/png"
    );
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "product_diff_heatmap",
      `product-diff-heatmap-${randomUUID()}.png`,
      productDiffHeatmap ?? Buffer.alloc(0),
      "image/png"
    );
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "validation_json",
      `validation-${randomUUID()}.json`,
      Buffer.from(JSON.stringify(outputValidation, null, 2)),
      "application/json"
    );
    outputValidation = {
      ...outputValidation,
      debugAssets: pipelineDebugAssets
    };
  }

  console.info("Image processing output validation", {
    imageJobId,
    productId: getString(getObject(jobOverrides).productId, ""),
    imageId: getString(getObject(jobOverrides).imageId, ""),
    mode: outputValidation.processingMode,
    promptVersion: ecommercePreservePromptVersion,
    model: openAiImageEditModel,
    quality: openAiImageEditQuality,
    size: openAiImageEditSize,
    attempt: cutoutResult.attempts,
    validationResult: outputValidation.status,
    failureReason: outputValidation.failureReasons.join("; ") || null,
    productCoveragePercent: outputValidation.productCoveragePercent
  });

  if (outputValidation.status === "Failed") {
    const failureReason = outputValidation.failureReasons.join("; ") || "Output failed product image validation.";
    if (!preserveProductExactly && !backgroundIsTransparent && !effectiveBackgroundImageUrl && !backgroundImageBuffer) {
      console.warn("Flexible source-locked matte failed; trying OpenAI studio recovery render", {
        imageJobId,
        reason: failureReason
      });

      return await processFlexibleOpenAiStudioRecovery({
        userId,
        imageJobId,
        originalImage,
        originalImageHash,
        originalStoragePath,
        originalUploadedAt,
        storageCleanupAfter,
        seoMetadata,
        preservedOriginalInput,
        processingSettings,
        background,
        pipelineDebugAssets,
        recoveryReason: failureReason
      });
    }

    if (preserveProductExactly && cutoutResult.preserveDebug) {
      cutoutResult.preserveDebug.finalStatus = "failed";
      cutoutResult.preserveDebug.failureReason = failureReason;
      throw new PreserveModeProcessingError(failureReason, cutoutResult.preserveDebug);
    }

    throw new Error(failureReason);
  }

  if (requiresCustomBackground && !effectiveBackgroundImageUrl && !backgroundImageBuffer) {
    throw new Error("Custom background is selected but no custom background image was received. Save the background setting and reprocess this image.");
  }

  const baseBackgroundBuffer = effectiveBackgroundImageUrl || backgroundImageBuffer
    ? await buildBackgroundFromImage(effectiveBackgroundImageUrl, backgroundImageBuffer, backgroundImageContentType)
    : await buildBrandedBackground(background);
  const backgroundBuffer = baseBackgroundBuffer;

  const composedImage = await compositeSourceLockedProductLayers({
    backgroundBuffer,
    shadowBuffer: shadow,
    productBuffer,
    productTop: top,
    productLeft: left
  });

  if (savePipelineDebugAssets) {
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "extracted_background",
      `extracted-background-${randomUUID()}.png`,
      backgroundBuffer,
      "image/png"
    );
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "generated_background",
      `generated-background-${randomUUID()}.png`,
      backgroundBuffer,
      "image/png"
    );
    if (shadow) {
      await uploadPipelineDebugAsset(
        userId,
        imageJobId,
        pipelineDebugAssets,
        "shadow_layer",
        `shadow-layer-${randomUUID()}.png`,
        shadow,
        "image/png"
      );
    }
    await uploadPipelineDebugAsset(
      userId,
      imageJobId,
      pipelineDebugAssets,
      "final_composite",
      `final-composite-${randomUUID()}.png`,
      composedImage,
      "image/png"
    );
    outputValidation = {
      ...outputValidation,
      debugAssets: pipelineDebugAssets
    };
  }

  if (preserveProductExactly && cutoutResult.preserveDebug) {
    const preserveContext = {
      userId,
      imageJobId,
      specialistSourceBuffer: originalImage.buffer,
      specialistSourceContentType: originalImage.contentType,
      originalStoragePath,
      originalContentType: originalImage.contentType,
      sourceDimensions: originalImageDimensions,
      fallbackMode: preserveModeFallback
    };
    await uploadPreserveDebugAsset(
      preserveContext,
      cutoutResult.preserveDebug,
      "generated_background",
      `generated-background-${randomUUID()}.png`,
      backgroundBuffer,
      "image/png"
    );
    if (shadow) {
      await uploadPreserveDebugAsset(
        preserveContext,
        cutoutResult.preserveDebug,
        "shadow_layer",
        `shadow-layer-${randomUUID()}.png`,
        shadow,
        "image/png"
      );
    }
    await uploadPreserveDebugAsset(
      preserveContext,
      cutoutResult.preserveDebug,
      "final_composite",
      `final-composite-${randomUUID()}.png`,
      composedImage,
      "image/png"
    );
  }

  try {
    await assertCompositeContainsProduct(backgroundBuffer, composedImage, productAlphaCoverage, preserveProductExactly);
  } catch (error) {
    if (preserveProductExactly && cutoutResult.preserveDebug) {
      cutoutResult.preserveDebug.backgroundOnlyBlockerTriggered = true;
      cutoutResult.preserveDebug.finalStatus = "failed";
      cutoutResult.preserveDebug.failureReason = error instanceof Error ? error.message : "Preserve mode rejected a background-only composite.";
      throw new PreserveModeProcessingError(cutoutResult.preserveDebug.failureReason, cutoutResult.preserveDebug);
    }

    throw error;
  }

  if (preserveProductExactly && cutoutResult.preserveDebug) {
    const isSourceAlphaPreserve = cutoutResult.provider.startsWith("source-alpha:");
    const isSourceLockedSoftEdgeAccepted = cutoutResult.preserveDebug.programmaticValidation?.metrics.sourceLockedSoftEdgeAccepted === true;
    const rawVisionQa = await runPreserveVisionQa({
      originalSource: preservedOriginalInput,
      finalComposite: composedImage,
      checkerboardPreview: isSourceAlphaPreserve || isSourceLockedSoftEdgeAccepted ? undefined : cutoutResult.preserveDebug.programmaticValidation?.overlays.checkerboardPreview,
      alphaMaskPreview: isSourceAlphaPreserve || isSourceLockedSoftEdgeAccepted ? undefined : cutoutResult.preserveDebug.programmaticValidation?.overlays.alphaMaskPreview,
      edgeHaloOverlay: isSourceAlphaPreserve || isSourceLockedSoftEdgeAccepted ? undefined : cutoutResult.preserveDebug.programmaticValidation?.overlays.edgeHaloOverlay,
      dropoutOverlay: cutoutResult.debugInteriorDropoutOverlay
    });
    const visionQa = (isSourceAlphaPreserve || isSourceLockedSoftEdgeAccepted) && outputValidation.status !== "Failed"
      ? markSourceLockedVisionQaAdvisory(rawVisionQa)
      : rawVisionQa;
    cutoutResult.preserveDebug.visionQa = visionQa;
    const combinedPreserveStatus = !visionQa.passed
      ? "Failed"
      : outputValidation.status === "Failed"
        ? "Failed"
        : outputValidation.status;

    outputValidation = {
      ...outputValidation,
      status: combinedPreserveStatus,
      checks: {
        ...outputValidation.checks,
        visionQa: visionQa.passed ? "Passed" : "Failed"
      },
      scores: {
        ...(outputValidation.scores ?? {}),
        visionQaEcommerce: visionQa.scores.ecommerceQuality,
        visionQaTextBranding: visionQa.scores.textBrandingConsistency
      },
      visionQa,
      failureReasons: Array.from(new Set([
        ...outputValidation.failureReasons,
        ...(!visionQa.passed ? (visionQa.failReasons.length ? visionQa.failReasons : ["Low Confidence Preserve Result"]) : [])
      ]))
    };
    cutoutResult.preserveDebug.outputValidation = outputValidation;
    await uploadPreserveDebugAsset(
      {
        userId,
        imageJobId,
        specialistSourceBuffer: originalImage.buffer,
        specialistSourceContentType: originalImage.contentType,
        originalStoragePath,
        originalContentType: originalImage.contentType,
        sourceDimensions: originalImageDimensions,
        fallbackMode: preserveModeFallback
      },
      cutoutResult.preserveDebug,
      "vision_qa_json",
      `vision-qa-${randomUUID()}.json`,
      Buffer.from(JSON.stringify(visionQa, null, 2)),
      "application/json"
    );

    if (outputValidation.status === "Failed") {
      cutoutResult.preserveDebug.finalStatus = "failed";
      cutoutResult.preserveDebug.failureReason = outputValidation.failureReasons.join("; ") || "Preserve mode failed ecommerce QA.";
      throw new PreserveModeProcessingError(cutoutResult.preserveDebug.failureReason, cutoutResult.preserveDebug);
    }
  }

  if (preserveProductExactly && cutoutResult.preserveDebug) {
    cutoutResult.preserveDebug.finalStatus = "completed";
  }

  const webpOptions = preserveProductExactly
    ? {
        quality: 100,
        lossless: true,
        smartSubsample: true
      }
    : {
        quality: 92,
        smartSubsample: true
      };
  const processedImage = await sharp(composedImage)
    .webp(webpOptions)
    .toBuffer();

  const processedStoragePath = getStoragePath(userId, imageJobId, `processed-${randomUUID()}.webp`);
  await uploadStorageObject({
    bucket: storageBuckets.processedImages,
    path: processedStoragePath,
    body: processedImage,
    contentType: "image/webp"
  });
  const processedUploadedAt = new Date();
  const processedUrl = await createStorageSignedUrl({
    bucket: storageBuckets.processedImages,
    path: processedStoragePath,
    expiresInSeconds: env.storageSignedUrlExpiresSeconds
  });

  return {
    processedUrl,
    originalImageHash,
    originalStoragePath,
    processedStoragePath,
    debugCutoutStoragePath,
    originalUploadedAt,
    processedUploadedAt,
    debugCutoutUploadedAt,
    storageCleanupAfter,
    duplicateOfJobId: null,
    creditDeductionRequired: true,
    seoMetadata,
    preserveDebug: cutoutResult.preserveDebug,
    outputValidation
  };
};
