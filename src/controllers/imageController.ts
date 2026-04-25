import { ImageJobStatus } from "@prisma/client";
import type { Response } from "express";
import { deductCredit, getUserCredits } from "../services/creditService";
import { processImageForProduct } from "../services/imageProcessingService";
import { prisma } from "../utils/prisma";
import type { AuthenticatedRequest } from "../middleware/apiTokenAuth";

type ProcessImageBody = {
  image_url?: unknown;
  background?: unknown;
  scale_percent?: unknown;
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

  if (typeof body.image_url !== "string" || !body.image_url.trim()) {
    response.status(400).json({
      status: "error",
      processed_url: null,
      credits_remaining: null,
      error: "image_url is required"
    });
    return;
  }

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
      original_url: body.image_url,
      status: ImageJobStatus.processing
    }
  });

  try {
    const result = await processImageForProduct({
      imageJobId: imageJob.id,
      userId: auth.userId,
      imageUrl: body.image_url,
      background: typeof body.background === "string" ? body.background : undefined,
      scalePercent: typeof body.scale_percent === "number" ? body.scale_percent : undefined
    });

    await prisma.imageJob.update({
      where: {
        id: imageJob.id
      },
      data: {
        processed_url: result.processedUrl,
        original_storage_path: result.originalStoragePath,
        processed_storage_path: result.processedStoragePath,
        debug_cutout_storage_path: result.debugCutoutStoragePath,
        original_uploaded_at: result.originalUploadedAt,
        processed_uploaded_at: result.processedUploadedAt,
        debug_cutout_uploaded_at: result.debugCutoutUploadedAt,
        storage_cleanup_after: result.storageCleanupAfter,
        status: ImageJobStatus.completed
      }
    });

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
      processed_url: result.processedUrl,
      credits_remaining: deduction.credits_remaining,
      low_credit_thresholds: deduction.low_credit_thresholds
    });
  } catch (error) {
    console.error("Image processing failed", {
      imageJobId: imageJob.id,
      userId: auth.userId,
      imageUrl: body.image_url,
      error
    });

    await prisma.imageJob.update({
      where: {
        id: imageJob.id
      },
      data: {
        status: ImageJobStatus.failed
      }
    });

    response.status(422).json({
      status: "failed",
      processed_url: null,
      credits_remaining: credits.credits_remaining,
      low_credit_thresholds: credits.low_credit_thresholds,
      error: error instanceof Error ? error.message : "Image processing failed"
    });
  }
};
