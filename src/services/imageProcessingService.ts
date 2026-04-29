import { createHash, randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { env } from "../config/env";
import { prisma } from "../utils/prisma";
import { removeImageBackground, removeImageBackgroundWithSpecialistModel } from "./backgroundRemovalService";
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
const outputSize = 2000;
const defaultScalePercent = 94;
const signedUrlExpirySeconds = env.storageSignedUrlExpiresSeconds;
const defaultBackgroundImagePath = path.resolve(process.cwd(), "public/site/assets/optivra-default-background.png");

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
  preserveDebug?: PreserveDebugInfo;
};

type PreserveModeFallback = "fail_safe" | "local_experimental" | "external_provider";
type PreserveMaskSource = "ai_mask" | "local_fallback" | "failed";
type PreserveRgbIntegrity = {
  passed: boolean;
  foregroundMeanDelta: number | null;
  alphaCoverage: number | null;
};

export type PreserveDebugAsset = {
  kind: "original_source" | "ai_cutout" | "alpha_mask" | "preserved_cutout" | "final_composite" | "background_only_comparison";
  bucket: string;
  path: string;
  url: string | null;
  contentType: string;
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
  connectedComponentCount: number;
  largestComponentPixels: number;
  largestComponentCoveragePercent: number;
  largestComponentSharePercent: number;
  passed: boolean;
  failureReasons: string[];
};

export type PreserveDebugInfo = {
  preserveMode: true;
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
  assets: PreserveDebugAsset[];
};

class PreserveModeProcessingError extends Error {
  public readonly preserveDebug: PreserveDebugInfo;

  public constructor(message: string, preserveDebug: PreserveDebugInfo) {
    super(message);
    this.name = "PreserveModeProcessingError";
    this.preserveDebug = preserveDebug;
  }
}

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

const addExistingPreserveDebugAsset = async (
  debug: PreserveDebugInfo,
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

  debug.assets.push({
    kind,
    bucket,
    path: assetPath,
    url,
    contentType
  });
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
    description: `Optimized 2000x2000 WebP product image for ${siteName}.`,
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

const processImageFlexibleMode = async (openAiInput: Buffer): Promise<CutoutResult> => {
  const aiCutout = await removeImageBackground(openAiInput, "flexible-cutout");
  await validateImage(aiCutout);

  return {
    cutout: aiCutout,
    debugCutout: aiCutout,
    provider: "openai:gpt-image-1:flexible-cutout",
    attempts: 1,
    validation: {
      alphaCoverage: await getImageAlphaCoverage(aiCutout),
      foregroundMeanDelta: 0
    }
  };
};

const processImagePreserveMode = async (
  preservedOriginalBuffer: Buffer,
  openAiInput: Buffer,
  context: PreserveDebugContext
): Promise<CutoutResult> => {
  const workingDimensions = await getImageDimensions(preservedOriginalBuffer);
  const debug: PreserveDebugInfo = {
    preserveMode: true,
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
    assets: []
  };
  await addExistingPreserveDebugAsset(debug, "original_source", storageBuckets.originalImages, context.originalStoragePath, context.originalContentType);

  console.info("Image preserve-mode masking started", {
    imageJobId: context.imageJobId,
    provider: "imgly:background-removal-node:medium",
    fallbackProvider: "openai:gpt-image-1:preserve-mask-refined",
    fallbackMode: context.fallbackMode,
    sourceWidth: context.sourceDimensions.width,
    sourceHeight: context.sourceDimensions.height,
    workingWidth: workingDimensions.width,
    workingHeight: workingDimensions.height
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

    const result = await buildPreservedProductCutoutFromAlpha(
      preservedOriginalBuffer,
      aiAlpha,
      provider,
      attempt,
      {
        allowLocalAssist: false,
        maskSource: "ai_mask",
        prevalidatedMask: maskDiagnostics
      }
    );
    debug.finalStatus = "validating_foreground_integrity";
    debug.maskSource = "ai_mask";
    debug.mask = result.preserveDebug?.mask ?? maskDiagnostics;
    debug.rgbIntegrity = {
      passed: true,
      foregroundMeanDelta: result.validation.foregroundMeanDelta,
      alphaCoverage: result.validation.alphaCoverage
    };
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
      provider: "openai:gpt-image-1:preserve-mask-refined",
      attempt: 2,
      stage: "refining_edges" as const,
      alphaAlignment: "square-fill" as const,
      getMaskCutoutBuffer: () => removeImageBackground(openAiInput, "preserve-mask-refined")
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

  if (context.fallbackMode === "local_experimental") {
    console.warn("Image preserve-mode local fallback enabled by experimental config", {
      imageJobId: context.imageJobId,
      attempt: 2,
      fallbackMode: context.fallbackMode
    });

    const fallback = await buildPreservedProductCutoutFromLocalMask(preservedOriginalBuffer);
    const localMask = fallback.preserveDebug?.mask ?? null;

    if (!localMask?.passed) {
      throw new PreserveModeProcessingError("Experimental local foreground fallback did not pass strict mask quality checks.", {
        ...debug,
        finalStatus: "failed",
        maskSource: "local_fallback",
        mask: localMask,
        failureReason: "Experimental local foreground fallback did not pass strict mask quality checks."
      });
    }

    await uploadPreserveDebugAsset(
      context,
      debug,
      "preserved_cutout",
      `local-fallback-preserved-cutout-${randomUUID()}.png`,
      fallback.cutout,
      "image/png"
    );

    return {
      ...fallback,
      attempts: 2,
      preserveDebug: {
        ...debug,
        finalStatus: "validating_foreground_integrity",
        maskSource: "local_fallback",
        mask: localMask,
        rgbIntegrity: {
          passed: true,
          foregroundMeanDelta: fallback.validation.foregroundMeanDelta,
          alphaCoverage: fallback.validation.alphaCoverage
        },
        failureReason: null
      }
    };
  }

  if (context.fallbackMode === "external_provider") {
    errors.push("External specialist background-removal provider is not configured yet.");
  }

  const failureReason = errors.join(" | ") || "Preserve mode could not produce a trustworthy product mask.";
  debug.finalStatus = "failed";
  debug.maskSource = "failed";
  debug.failureReason = failureReason;
  console.error("Image preserve-mode failed safely", {
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
    "Preserve mode could not produce a trustworthy product mask. The job was stopped for manual review instead of completing a background-only or partial-product output.",
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
    "openai:gpt-image-1:preserve-mask",
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

const buildPreservedProductCutoutFromAlpha = async (
  preservedOriginalBuffer: Buffer,
  candidateAlpha: Buffer,
  provider: string,
  attempts: number,
  options: {
    allowLocalAssist: boolean;
    maskSource: PreserveMaskSource;
    prevalidatedMask?: PreserveMaskDiagnostics;
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
  const alpha = localAlpha ? chooseBaseProductAlpha(candidateAlpha, localAlpha) : candidateAlpha;
  const initialMaskDiagnostics = options.prevalidatedMask ?? analyzeAlphaMask(alpha, width, height);

  if (!initialMaskDiagnostics.passed) {
    throw new Error(`Preserve mode rejected ${options.maskSource}: ${initialMaskDiagnostics.failureReasons.join("; ")}`);
  }

  const assistedAlpha = options.allowLocalAssist
    ? expandMaskWithOriginalForeground(originalRaw, alpha, width, height)
    : alpha;
  const safeAlpha = options.allowLocalAssist
    ? getSafeAlphaMask(alpha, await smoothAlphaMask(assistedAlpha, width, height))
    : alpha;
  const finalMaskDiagnostics = options.allowLocalAssist
    ? analyzeAlphaMask(safeAlpha, width, height)
    : initialMaskDiagnostics;

  if (!finalMaskDiagnostics.passed) {
    throw new Error(`Preserve mode rejected the refined product mask: ${finalMaskDiagnostics.failureReasons.join("; ")}`);
  }

  const backgroundPalette = buildBackgroundPalette(originalRaw, safeAlpha, width, height);
  const productRgba = removeEdgeMatte(originalRaw, safeAlpha, width, height, backgroundPalette);
  const visualValidation = getCutoutVisualPresence(productRgba, safeAlpha);

  if (!visualValidation.isVisible) {
    throw new Error("Preserve mode rejected the cutout because the detected foreground is visually indistinguishable from the source background.");
  }

  const cutout = await sharp(productRgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
  const validation = await validatePreservedForegroundIntegrity(preservedOriginalBuffer, cutout);

  return {
    cutout,
    debugCutout: cutout,
    provider,
    attempts,
    validation,
    debugAlphaMask: await buildAlphaMaskPreview(safeAlpha, width, height),
    preserveDebug: {
      preserveMode: true,
      fallbackMode: options.allowLocalAssist ? "local_experimental" : "fail_safe",
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
      mask: finalMaskDiagnostics,
      backgroundOnlyBlockerTriggered: false,
      rgbIntegrity: {
        passed: true,
        foregroundMeanDelta: validation.foregroundMeanDelta,
        alphaCoverage: validation.alphaCoverage
      },
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
  let solidPixelCount = 0;
  let totalDelta = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const cutoutIndex = pixel * 4;
    const currentAlpha = cutoutRgba[cutoutIndex + 3] ?? 0;
    alpha[pixel] = currentAlpha;

    if (currentAlpha < 245) {
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

const removeEdgeMatte = (
  originalRgb: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
  palette: Array<{ r: number; g: number; b: number }>
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

  if (palette.length === 0) {
    return rgba;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const currentAlpha = alpha[pixel] ?? 0;

      if (currentAlpha <= 0 || currentAlpha >= 250) {
        continue;
      }

      const targetIndex = pixel * 4;
      const r = rgba[targetIndex] ?? 0;
      const g = rgba[targetIndex + 1] ?? 0;
      const b = rgba[targetIndex + 2] ?? 0;
      const distance = closestPaletteDistance(r, g, b, palette);
      const saturation = getRgbSaturation(r, g, b);

      if (distance >= 82 && saturation >= 0.1) {
        continue;
      }

      const replacement = findNearestSolidProductColor(rgba, width, height, x, y, 6);

      if (replacement) {
        rgba[targetIndex] = replacement.r;
        rgba[targetIndex + 1] = replacement.g;
        rgba[targetIndex + 2] = replacement.b;
      }
    }
  }

  return rgba;
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

  return dilateAlphaMask(
    keepMainAlphaComponents(expandForegroundFromSeeds(rgba, alpha, backgroundPalette, width, height), width, height),
    width,
    height,
    1
  );
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

const smoothAlphaMask = async (alpha: Buffer, width: number, height: number): Promise<Buffer> =>
  sharp(alpha, {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .blur(0.35)
    .raw()
    .toBuffer();

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

  return Math.min(Math.max(scalePercent, 75), 88);
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

  return "fail_safe";
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

  const brightness = 1 + getNumber(lightingSettings.brightness, 0, -100, 100) / 200;
  const contrast = getNumber(lightingSettings.contrast, 0, -100, 100);
  const contrastFactor = 1 + contrast / 100;
  const contrastIntercept = -128 * (contrastFactor - 1);
  const saturation = lightingSettings.neutralizeTint === true ? 0.98 : 1;
  const gamma = lightingSettings.shadowLift === true ? 1.08 : 1;

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
  const coverage = getAlphaCoverage(alpha);
  const minCoverage = Math.max(1200, Math.round(metadata.width * metadata.height * 0.004));

  if (coverage < minCoverage) {
    throw new Error("Product cutout was empty after background removal. No image was replaced; reprocess this image with preserve product enabled.");
  }
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

  if (background === "optivra-default" && existsSync(defaultBackgroundImagePath)) {
    return sharp(defaultBackgroundImagePath)
      .resize(outputSize, outputSize, {
        fit: "cover",
        position: "centre"
      })
      .png()
      .toBuffer();
  }

  const presetColors: Record<string, string> = {
    white: "#ffffff",
    "soft-white": "#ffffff",
    "cool-studio": "#eef4ff",
    "warm-studio": "#fff5ec",
    "optivra-default": "#f4f6f8"
  };
  const backgroundColor = presetColors[background] ?? background;
  const safeBackground = /^#[0-9a-f]{6}$/i.test(background) ? background : "#ffffff";
  const safeColor = /^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : safeBackground;
  const backgroundSvg = `
    <svg width="${outputSize}" height="${outputSize}" viewBox="0 0 ${outputSize} ${outputSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.55" stop-color="${safeColor}"/>
          <stop offset="1" stop-color="#f4f6f8"/>
        </linearGradient>
      </defs>
      <rect width="2000" height="2000" fill="url(#bg)"/>
      <rect x="80" y="80" width="1840" height="1840" rx="120" fill="none" stroke="rgba(0,0,0,0.035)" stroke-width="4"/>
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

  return sharp(backgroundImage.buffer)
    .rotate()
    .resize(outputSize, outputSize, {
      fit: "cover",
      position: "centre"
    })
    .png()
    .toBuffer();
};

export const processImageForProduct = async ({
  imageJobId,
  userId,
  imageUrl,
  background = "#ffffff",
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
    background !== "#ffffff";
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

  console.info("Image processing cutout mode selected", {
    imageJobId,
    preserveProductExactly,
    preserveModeFallback: preserveProductExactly ? preserveModeFallback : null,
    originalContentType: originalImage.contentType,
    originalBytes: originalImage.buffer.byteLength,
    originalWidth: originalImageDimensions.width,
    originalHeight: originalImageDimensions.height
  });

  const cutoutResult = preserveProductExactly
    ? await processImagePreserveMode(preservedOriginalInput, openAiInput, {
        userId,
        imageJobId,
        specialistSourceBuffer: originalImage.buffer,
        specialistSourceContentType: originalImage.contentType,
        originalStoragePath,
        originalContentType: originalImage.contentType,
        sourceDimensions: originalImageDimensions,
        fallbackMode: preserveModeFallback
      })
    : await processImageFlexibleMode(openAiInput);
  const cutout = cutoutResult.cutout;
  await validateImage(cutout);

  const debugCutoutStoragePath = getStoragePath(userId, imageJobId, `cutout-${randomUUID()}.png`);
  await uploadStorageObject({
    bucket: storageBuckets.debugCutouts,
    path: debugCutoutStoragePath,
    body: cutoutResult.debugCutout,
    contentType: "image/png"
  });
  const debugCutoutUploadedAt = new Date();

  const framingMode = getString(framingSettings.mode, "auto");
  const paddingPercent = getNumber(framingSettings.padding, 8, 0, 30);
  const autoPaddingPercent = framingMode === "auto" && !scalePercent ? Math.min(paddingPercent, 2) : paddingPercent;
  const margin = edgeEnabled ? Math.round(outputSize * (Math.min(autoPaddingPercent, 1) / 100)) : Math.round(outputSize * (autoPaddingPercent / 100));
  const horizontalLimit = outputSize - (edgeLeft ? 0 : margin) - (edgeRight ? 0 : margin);
  const verticalLimit = outputSize - (edgeTop ? 0 : margin) - (edgeBottom ? 0 : margin);
  const targetProductSize = Math.round(outputSize * (normalizeScalePercent(scalePercent) / 100));
  const resizeWidth = Math.max(1, Math.min(targetProductSize, horizontalLimit));
  const resizeHeight = Math.max(1, Math.min(targetProductSize, verticalLimit));
  const edgeResizeWidth = edgeLeft && edgeRight ? horizontalLimit : resizeWidth;
  const edgeResizeHeight = edgeTop && edgeBottom ? verticalLimit : resizeHeight;
  let productBuffer = await sharp(cutout)
    .rotate()
    .ensureAlpha()
    .trim({
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      },
      threshold: 8
    })
    .resize({
      width: edgeResizeWidth,
      height: edgeResizeHeight,
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

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
  productBuffer = preserveProductExactly
    ? productBuffer
    : await applyProductLighting(productBuffer, lightingSettings);
  await assertVisibleProductImage(productBuffer);
  const productAlphaCoverage = await getImageAlphaCoverage(productBuffer);
  productMetadata = await sharp(productBuffer).metadata();

  const productWidth = Math.min(outputSize, productMetadata.width ?? targetProductSize);
  const productHeight = Math.min(outputSize, productMetadata.height ?? targetProductSize);
  let left = Math.min(Math.max(Math.round((outputSize - productWidth) / 2), edgeLeft ? 0 : margin), outputSize - productWidth - (edgeRight ? 0 : margin));
  let top = Math.min(Math.max(Math.round((outputSize - productHeight) / 2), edgeTop ? 0 : margin), outputSize - productHeight - (edgeBottom ? 0 : margin));

  if (edgeLeft && !edgeRight) left = 0;
  if (edgeRight && !edgeLeft) left = outputSize - productWidth;
  if (edgeTop && !edgeBottom) top = 0;
  if (edgeBottom && !edgeTop) top = outputSize - productHeight;

  const shadow = await buildShadow(outputSize, outputSize, productBuffer, productWidth, productHeight, left, top, shadowSettings);

  if (requiresCustomBackground && !effectiveBackgroundImageUrl && !backgroundImageBuffer) {
    throw new Error("Custom background is selected but no custom background image was received. Save the background setting and reprocess this image.");
  }

  const backgroundBuffer = effectiveBackgroundImageUrl || backgroundImageBuffer
    ? await buildBackgroundFromImage(effectiveBackgroundImageUrl, backgroundImageBuffer, backgroundImageContentType)
    : await buildBrandedBackground(background);

  const composites = [
    ...(shadow ? [{ input: shadow, top: 0, left: 0 }] : []),
    { input: productBuffer, top, left }
  ];
  const composedImage = await sharp(backgroundBuffer)
    .composite(composites)
    .png()
    .toBuffer();

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
      "background_only_comparison",
      `background-only-comparison-${randomUUID()}.png`,
      backgroundBuffer,
      "image/png"
    );
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
    preserveDebug: cutoutResult.preserveDebug
  };
};
