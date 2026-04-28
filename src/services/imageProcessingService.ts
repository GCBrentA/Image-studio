import { createHash, randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { env } from "../config/env";
import { prisma } from "../utils/prisma";
import { removeImageBackground } from "./backgroundRemovalService";
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

export const processingModes = [
  "background_only_cleanup",
  "background_replacement",
  "framing_canvas_adjustment",
  "seo_metadata_only",
  "creative_product_enhancement"
] as const;

export type ProcessingMode = typeof processingModes[number];

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
const productChangedError =
  "Product area changed too much. Result rejected to protect catalogue accuracy.";
const defaultBackgroundImagePath = path.resolve(process.cwd(), "public/site/assets/optivra-default-background.png");

type DownloadedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
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

const normalizeImageForOpenAi = async (imageBuffer: Buffer): Promise<Buffer> =>
  sharp(imageBuffer)
    .rotate()
    .resize({
      width: 1536,
      height: 1536,
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();

const buildPreservedProductCutout = async (
  normalizedOriginalBuffer: Buffer,
  aiCutoutBuffer: Buffer
): Promise<Buffer> => {
  const cutoutMetadata = await sharp(aiCutoutBuffer).metadata();

  if (!cutoutMetadata.width || !cutoutMetadata.height) {
    throw new Error("Product mask could not be read");
  }

  const alpha = await sharp(aiCutoutBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .toBuffer();
  const originalRgb = await sharp(normalizedOriginalBuffer)
    .resize(cutoutMetadata.width, cutoutMetadata.height, {
      fit: "contain",
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .removeAlpha()
    .png()
    .toBuffer();

  return sharp(originalRgb)
    .joinChannel(alpha)
    .png()
    .toBuffer();
};

const assertProductShapePreserved = async (
  productBuffer: Buffer,
  finalPngBuffer: Buffer,
  productLeft: number,
  productTop: number,
  productWidth: number,
  productHeight: number
): Promise<void> => {
  const [originalRaw, finalRaw] = await Promise.all([
    sharp(productBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer(),
    sharp(finalPngBuffer)
      .extract({
        left: productLeft,
        top: productTop,
        width: productWidth,
        height: productHeight
      })
      .ensureAlpha()
      .raw()
      .toBuffer()
  ]);

  let comparedPixels = 0;
  let alphaChangedPixels = 0;

  for (let index = 0; index < originalRaw.length; index += 4) {
    const alpha = originalRaw[index + 3] ?? 0;

    if (alpha < 24) {
      continue;
    }

    comparedPixels += 1;
    const finalAlpha = finalRaw[index + 3] ?? 0;

    if (Math.abs(alpha - finalAlpha) > 12) {
      alphaChangedPixels += 1;
    }
  }

  if (comparedPixels === 0) {
    throw new Error(productChangedError);
  }

  const changedRatio = alphaChangedPixels / comparedPixels;

  if (changedRatio > 0.01) {
    throw new Error(productChangedError);
  }
};

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

const normalizeProcessingMode = (value: unknown): ProcessingMode =>
  processingModes.includes(value as ProcessingMode)
    ? value as ProcessingMode
    : "background_only_cleanup";

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
  const processingMode = normalizeProcessingMode(processingSettings.processingMode ?? processingSettings.mode);
  const preserveProductExactly =
    processingMode !== "creative_product_enhancement" &&
    (processingSettings.preserveProductExactly !== false ||
      ["background_only_cleanup", "background_replacement"].includes(processingMode));
  const framingSettings = getObject(processingSettings.framing);
  const shadowSettings = getObject(processingSettings.shadow);
  const lightingSettings = getObject(processingSettings.lighting);
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
  const duplicateJob = hasProcessingOptions ? null : await findDuplicateJob(userId, imageJobId, originalImageHash);

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

  const openAiInput = await normalizeImageForOpenAi(originalImage.buffer);

  if (processingMode === "seo_metadata_only") {
    const processedImage = await sharp(originalImage.buffer)
      .rotate()
      .webp({
        quality: 92,
        smartSubsample: true
      })
      .toBuffer();
    const processedStoragePath = getStoragePath(userId, imageJobId, `metadata-only-${randomUUID()}.webp`);
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
      creditDeductionRequired: false,
      seoMetadata
    };
  }

  const aiCutout = await removeImageBackground(openAiInput);
  await validateImage(aiCutout);
  const cutout = preserveProductExactly
    ? await buildPreservedProductCutout(openAiInput, aiCutout)
    : aiCutout;
  await validateImage(cutout);

  const debugCutoutStoragePath = getStoragePath(userId, imageJobId, `cutout-${randomUUID()}.png`);
  await uploadStorageObject({
    bucket: storageBuckets.debugCutouts,
    path: debugCutoutStoragePath,
    body: aiCutout,
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
  productBuffer = await applyProductLighting(productBuffer, lightingSettings);
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

  const backgroundBuffer = backgroundImageUrl || backgroundImageBuffer
    ? await buildBackgroundFromImage(backgroundImageUrl, backgroundImageBuffer, backgroundImageContentType)
    : await buildBrandedBackground(background);

  const composites = [
    ...(shadow ? [{ input: shadow, top: 0, left: 0 }] : []),
    { input: productBuffer, top, left }
  ];
  const composedImage = await sharp(backgroundBuffer)
    .composite(composites)
    .png()
    .toBuffer();

  if (preserveProductExactly) {
    await assertProductShapePreserved(productBuffer, composedImage, left, top, productWidth, productHeight);
  }

  const processedImage = await sharp(composedImage)
    .webp({
      quality: 92,
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
    debugCutoutStoragePath,
    originalUploadedAt,
    processedUploadedAt,
    debugCutoutUploadedAt,
    storageCleanupAfter,
    duplicateOfJobId: null,
    creditDeductionRequired: true,
    seoMetadata
  };
};
