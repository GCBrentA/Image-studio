import { ImageJobStatus } from "@prisma/client";
import type { Response } from "express";
import { deductCredit, getUserCredits } from "../services/creditService";
import { getPreserveDebugFromError, processImageForProduct } from "../services/imageProcessingService";
import { prisma } from "../utils/prisma";
import type { AuthenticatedRequest } from "../middleware/apiTokenAuth";

type ProcessImageBody = {
  image_url?: unknown;
  image_data?: unknown;
  image_filename?: unknown;
  image_mime_type?: unknown;
  background?: unknown;
  scale_percent?: unknown;
  background_image_url?: unknown;
  background_image_data?: unknown;
  background_image_filename?: unknown;
  background_image_mime_type?: unknown;
  settings?: unknown;
  jobOverrides?: unknown;
};

const maxInlineImageBytes = 15 * 1024 * 1024;

const decodeInlineImage = (
  data: unknown,
  mimeType: unknown
): { buffer: Buffer; contentType: string } | null => {
  if (typeof data !== "string" || !data.trim()) {
    return null;
  }

  const contentType = typeof mimeType === "string" && mimeType.startsWith("image/")
    ? mimeType
    : "application/octet-stream";
  const base64 = data.includes(",") ? data.split(",").pop() ?? "" : data;
  const buffer = Buffer.from(base64, "base64");

  if (buffer.byteLength <= 0 || buffer.byteLength > maxInlineImageBytes) {
    throw new Error("Uploaded image is missing or too large");
  }

  return {
    buffer,
    contentType
  };
};

export const processImage = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = request.auth;

  if (!auth) {
    response.status(401).json({
      status: "error",
      processed_url: null,
      credits_remaining: null,
      error: "Unauthorized"
    });
    return;
  }

  const body = request.body as ProcessImageBody;

  let inlineImage: { buffer: Buffer; contentType: string } | null = null;
  let inlineBackground: { buffer: Buffer; contentType: string } | null = null;

  try {
    inlineImage = decodeInlineImage(body.image_data, body.image_mime_type);
    inlineBackground = decodeInlineImage(body.background_image_data, body.background_image_mime_type);
  } catch (error) {
    response.status(400).json({
      status: "error",
      processed_url: null,
      credits_remaining: null,
      error: error instanceof Error ? error.message : "Invalid uploaded image"
    });
    return;
  }

  if (!inlineImage && (typeof body.image_url !== "string" || !body.image_url.trim())) {
    response.status(400).json({
      status: "error",
      processed_url: null,
      credits_remaining: null,
      error: "image_url or image_data is required"
    });
    return;
  }

  const sourceImageUrl = typeof body.image_url === "string" && body.image_url.trim()
    ? body.image_url.trim()
    : `uploaded://${typeof body.image_filename === "string" && body.image_filename.trim() ? body.image_filename.trim() : "wordpress-media"}`;

  const credits = await getUserCredits(auth.userId);

  if (credits.credits_remaining < 1) {
    response.status(402).json({
      status: "error",
      processed_url: null,
      credits_remaining: credits.credits_remaining,
      low_credit_thresholds: credits.low_credit_thresholds,
      error: credits.error_if_any ?? "No credits remaining"
    });
    return;
  }

  const imageJob = await prisma.imageJob.create({
    data: {
      user_id: auth.userId,
      original_url: sourceImageUrl,
      status: ImageJobStatus.processing
    }
  });

  try {
    const result = await processImageForProduct({
      imageJobId: imageJob.id,
      userId: auth.userId,
      imageUrl: sourceImageUrl,
      imageBuffer: inlineImage?.buffer,
      imageContentType: inlineImage?.contentType,
      imageFileName: typeof body.image_filename === "string" ? body.image_filename : undefined,
      background: typeof body.background === "string" ? body.background : undefined,
      scalePercent: typeof body.scale_percent === "number" ? body.scale_percent : undefined,
      backgroundImageUrl:
        typeof body.background_image_url === "string" ? body.background_image_url : undefined,
      backgroundImageBuffer: inlineBackground?.buffer,
      backgroundImageContentType: inlineBackground?.contentType,
      backgroundImageFileName: typeof body.background_image_filename === "string" ? body.background_image_filename : undefined,
      settings: typeof body.settings === "object" && body.settings !== null ? body.settings : undefined,
      jobOverrides: typeof body.jobOverrides === "object" && body.jobOverrides !== null ? body.jobOverrides : undefined
    });

    await prisma.imageJob.update({
      where: {
        id: imageJob.id
      },
      data: {
        processed_url: result.processedUrl,
        original_image_hash: result.originalImageHash,
        duplicate_of_job_id: result.duplicateOfJobId,
        original_storage_path: result.originalStoragePath,
        processed_storage_path: result.processedStoragePath,
        debug_cutout_storage_path: result.debugCutoutStoragePath,
        original_uploaded_at: result.originalUploadedAt,
        processed_uploaded_at: result.processedUploadedAt,
        debug_cutout_uploaded_at: result.debugCutoutUploadedAt,
        storage_cleanup_after: result.storageCleanupAfter,
        seo_metadata: result.preserveDebug
          ? {
              ...result.seoMetadata,
              preserve_debug: result.preserveDebug,
              output_validation: result.outputValidation
            }
          : result.outputValidation
            ? {
                ...result.seoMetadata,
                output_validation: result.outputValidation
              }
            : result.seoMetadata,
        status: ImageJobStatus.completed
      }
    });

    if (!result.creditDeductionRequired) {
      response.status(200).json({
        status: "completed",
        duplicate: true,
        duplicate_of_job_id: result.duplicateOfJobId,
        processed_url: result.processedUrl,
        processed_storage_bucket: result.processedStoragePath ? "processed-images" : null,
        processed_storage_path: result.processedStoragePath,
        credits_remaining: credits.credits_remaining,
        low_credit_thresholds: credits.low_credit_thresholds,
        seo_metadata: result.seoMetadata,
        preserve_debug: result.preserveDebug,
        output_validation: result.outputValidation
      });
      return;
    }

    const deduction = await deductCredit(auth.userId, {
      imageJobId: imageJob.id
    });

    if (deduction.error_if_any) {
      response.status(402).json({
        status: "error",
        processed_url: null,
        credits_remaining: deduction.credits_remaining,
        low_credit_thresholds: deduction.low_credit_thresholds,
        error: deduction.error_if_any
      });
      return;
    }

    response.status(201).json({
      status: "completed",
      duplicate: false,
      processed_url: result.processedUrl,
      processed_storage_bucket: result.processedStoragePath ? "processed-images" : null,
      processed_storage_path: result.processedStoragePath,
      credits_remaining: deduction.credits_remaining,
      low_credit_thresholds: deduction.low_credit_thresholds,
      seo_metadata: result.seoMetadata,
      preserve_debug: result.preserveDebug,
      output_validation: result.outputValidation
    });
  } catch (error) {
    const preserveDebug = getPreserveDebugFromError(error);
    console.error("Image processing failed", {
      imageJobId: imageJob.id,
      userId: auth.userId,
      imageUrl: sourceImageUrl,
      preserveDebug,
      error
    });

    await prisma.imageJob.update({
      where: {
        id: imageJob.id
      },
      data: {
        status: ImageJobStatus.failed,
        seo_metadata: preserveDebug ? { preserve_debug: preserveDebug } : undefined
      }
    });

    response.status(422).json({
      status: "failed",
      processed_url: null,
      credits_remaining: credits.credits_remaining,
      low_credit_thresholds: credits.low_credit_thresholds,
      error: error instanceof Error ? error.message : "Image processing failed",
      preserve_debug: preserveDebug
    });
  }
};
