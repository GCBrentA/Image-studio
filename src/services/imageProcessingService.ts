import { randomUUID } from "crypto";
import { mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { env } from "../../config/env";
import { removeImageBackground } from "./backgroundRemovalService";

export type ProcessImageInput = {
  imageUrl: string;
  background?: string;
  scalePercent?: number;
};

export type ProcessedImageResult = {
  processedUrl: string;
  outputPath: string;
};

const processedImageDirectory = path.resolve(process.cwd(), "storage", "processed-images");
const maxImageBytes = 15 * 1024 * 1024;
const outputSize = 1200;
const defaultScalePercent = 82;

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

const downloadImage = async (imageUrl: string): Promise<Buffer> => {
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

  return imageBuffer;
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
  imageUrl,
  background = "#ffffff",
  scalePercent
}: ProcessImageInput): Promise<ProcessedImageResult> => {
  const originalImage = await downloadImage(imageUrl);
  await validateImage(originalImage);

  const cutout = await removeImageBackground(originalImage);
  await validateImage(cutout);

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

  await mkdir(processedImageDirectory, {
    recursive: true
  });

  const fileName = `${randomUUID()}.png`;
  const outputPath = path.join(processedImageDirectory, fileName);

  await sharp({
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
    .toFile(outputPath);

  return {
    outputPath,
    processedUrl: `${env.publicBaseUrl.replace(/\/$/, "")}/processed-images/${fileName}`
  };
};
