import { createHash, randomUUID } from "crypto";
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
  background?: string;
  scalePercent?: number;
  backgroundImageUrl?: string;
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
const defaultScalePercent = 82;
const signedUrlExpirySeconds = env.storageSignedUrlExpiresSeconds;

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

  const response = await fetch(imageUrl, {
    headers: {
      accept: "image/*"
    }
  });

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

const normalizeScalePercent = (scalePercent?: number): number => {
  if (!scalePercent) {
    return defaultScalePercent;
  }

  return Math.min(Math.max(scalePercent, 75), 88);
};

const buildShadow = async (width: number, height: number, productWidth: number, productHeight: number, productTop: number): Promise<Buffer> => {
  const shadowCy = Math.min(height - 100, productTop + productHeight * 0.9);
  const shadowSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${width / 2}" cy="${shadowCy}" rx="${Math.max(productWidth * 0.34, width * 0.12)}" ry="${Math.max(productHeight * 0.045, height * 0.025)}" fill="rgba(0,0,0,0.23)" />
    </svg>
  `;

  return sharp(Buffer.from(shadowSvg)).blur(22).png().toBuffer();
};

const buildBrandedBackground = (background: string): Buffer => {
  const safeBackground = /^#[0-9a-f]{6}$/i.test(background) ? background : "#ffffff";
  const backgroundSvg = `
    <svg width="${outputSize}" height="${outputSize}" viewBox="0 0 ${outputSize} ${outputSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="0.55" stop-color="${safeBackground}"/>
          <stop offset="1" stop-color="#f4f6f8"/>
        </linearGradient>
      </defs>
      <rect width="2000" height="2000" fill="url(#bg)"/>
      <rect x="80" y="80" width="1840" height="1840" rx="120" fill="none" stroke="rgba(0,0,0,0.035)" stroke-width="4"/>
    </svg>
  `;

  return Buffer.from(backgroundSvg);
};

const buildBackgroundFromImage = async (backgroundImageUrl: string): Promise<Buffer> => {
  const backgroundImage = await downloadImage(backgroundImageUrl);
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
  backgroundImageUrl
}: ProcessImageInput): Promise<ProcessedImageResult> => {
  const originalImage = await downloadImage(imageUrl);
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
  const duplicateJob = await findDuplicateJob(userId, imageJobId, originalImageHash);

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
  const cutout = await removeImageBackground(openAiInput);
  await validateImage(cutout);

  const debugCutoutStoragePath = getStoragePath(userId, imageJobId, `cutout-${randomUUID()}.png`);
  await uploadStorageObject({
    bucket: storageBuckets.debugCutouts,
    path: debugCutoutStoragePath,
    body: cutout,
    contentType: "image/png"
  });
  const debugCutoutUploadedAt = new Date();

  const targetProductSize = Math.round(outputSize * (normalizeScalePercent(scalePercent) / 100));
  const margin = Math.round(outputSize * 0.08);
  const productBuffer = await sharp(cutout)
    .rotate()
    .trim({
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .resize({
      width: Math.min(targetProductSize, outputSize - margin * 2),
      height: Math.min(targetProductSize, outputSize - margin * 2),
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();

  const productMetadata = await sharp(productBuffer).metadata();
  const productWidth = productMetadata.width ?? targetProductSize;
  const productHeight = productMetadata.height ?? targetProductSize;
  const left = Math.min(Math.max(Math.round((outputSize - productWidth) / 2), margin), outputSize - productWidth - margin);
  const top = Math.min(Math.max(Math.round((outputSize - productHeight) / 2), margin), outputSize - productHeight - margin);
  const shadow = await buildShadow(outputSize, outputSize, productWidth, productHeight, top);

  const backgroundBuffer = backgroundImageUrl
    ? await buildBackgroundFromImage(backgroundImageUrl)
    : buildBrandedBackground(background);

  const processedImage = await sharp(backgroundBuffer)
    .composite([
      {
        input: shadow,
        top: 0,
        left: 0
      },
      {
        input: productBuffer,
        top,
        left
      }
    ])
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
