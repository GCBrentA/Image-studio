import { randomUUID } from "crypto";
import sharp from "sharp";
import { env } from "../../config/env";
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
};

export type ProcessedImageResult = {
  processedUrl: string;
  originalStoragePath: string;
  processedStoragePath: string;
  debugCutoutStoragePath: string;
  originalUploadedAt: Date;
  processedUploadedAt: Date;
  debugCutoutUploadedAt: Date;
  storageCleanupAfter: Date;
};

const maxImageBytes = 15 * 1024 * 1024;
const outputSize = 1200;
const defaultScalePercent = 82;

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

const normalizeScalePercent = (scalePercent?: number): number => {
  if (!scalePercent) {
    return defaultScalePercent;
  }

  return Math.min(Math.max(scalePercent, 75), 88);
};

const buildShadow = async (width: number, height: number): Promise<Buffer> => {
  const shadowSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${width / 2}" cy="${height * 0.82}" rx="${width * 0.32}" ry="${height * 0.055}" fill="rgba(0,0,0,0.24)" />
    </svg>
  `;

  return sharp(Buffer.from(shadowSvg)).blur(22).png().toBuffer();
};

export const processImageForProduct = async ({
  imageJobId,
  userId,
  imageUrl,
  background = "#ffffff",
  scalePercent
}: ProcessImageInput): Promise<ProcessedImageResult> => {
  const originalImage = await downloadImage(imageUrl);
  await validateImage(originalImage.buffer);

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

  const cutout = await removeImageBackground(originalImage.buffer);
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
  const productBuffer = await sharp(cutout)
    .rotate()
    .resize({
      width: targetProductSize,
      height: targetProductSize,
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();

  const productMetadata = await sharp(productBuffer).metadata();
  const productWidth = productMetadata.width ?? targetProductSize;
  const productHeight = productMetadata.height ?? targetProductSize;
  const left = Math.round((outputSize - productWidth) / 2);
  const top = Math.round((outputSize - productHeight) / 2);
  const shadow = await buildShadow(outputSize, outputSize);

  const processedImage = await sharp({
    create: {
      width: outputSize,
      height: outputSize,
      channels: 4,
      background
    }
  })
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
    .png({
      compressionLevel: 9
    })
    .toBuffer();

  const processedStoragePath = getStoragePath(userId, imageJobId, `processed-${randomUUID()}.png`);
  await uploadStorageObject({
    bucket: storageBuckets.processedImages,
    path: processedStoragePath,
    body: processedImage,
    contentType: "image/png"
  });
  const processedUploadedAt = new Date();
  const processedUrl = await createStorageSignedUrl({
    bucket: storageBuckets.processedImages,
    path: processedStoragePath,
    expiresInSeconds: env.storageSignedUrlExpiresSeconds
  });

  return {
    processedUrl,
    originalStoragePath,
    processedStoragePath,
    debugCutoutStoragePath,
    originalUploadedAt,
    processedUploadedAt,
    debugCutoutUploadedAt,
    storageCleanupAfter: getStorageCleanupAfter()
  };
};
