export type AuditQueueActionType =
  | "generate_alt_text"
  | "optimise_image"
  | "replace_background"
  | "standardise_background"
  | "resize_crop"
  | "convert_webp"
  | "review_manually"
  | "add_main_image";

export type AuditQueueJobKind = "seo_only" | "image_processing" | "review";

export type AuditQueueActionPolicy = {
  actionType: AuditQueueActionType;
  jobKind: AuditQueueJobKind;
  consumesCreditWhenProcessed: boolean;
  requiresReview: boolean;
  processingMode: "preserve" | "none";
  statusAfterFailure: "open" | "needs_review";
};

const actionAliases: Record<string, AuditQueueActionType> = {
  add_gallery_image: "review_manually",
  add_main_image: "add_main_image",
  add_main_image_reminder: "add_main_image",
  background_replacement: "replace_background",
  compress_image: "optimise_image",
  convert_to_webp: "convert_webp",
  crop: "resize_crop",
  crop_resize: "resize_crop",
  fix_alt_text: "generate_alt_text",
  main_image_reminder: "add_main_image",
  manual_review: "review_manually",
  optimise_images: "optimise_image",
  optimize_image: "optimise_image",
  optimize_images: "optimise_image",
  preserve_background_replace: "replace_background",
  queue_processing: "replace_background",
  regenerate_thumbnail: "resize_crop",
  replace_main_image: "add_main_image",
  resize: "resize_crop",
  seo_update: "generate_alt_text",
  standard_background_replace: "standardise_background",
  standardise_backgrounds: "standardise_background",
  standardize_background: "standardise_background",
  standardize_backgrounds: "standardise_background",
  webp_conversion: "convert_webp"
};

export const mapAuditActionToQueueAction = (actionType: unknown, issueType?: unknown): AuditQueueActionType => {
  const normalized = typeof actionType === "string" ? actionType.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_") : "";
  if (normalized && actionAliases[normalized]) {
    return actionAliases[normalized];
  }

  const issue = typeof issueType === "string" ? issueType.trim().toLowerCase() : "";
  if (issue.includes("alt")) {
    return "generate_alt_text";
  }
  if (issue.includes("filename")) {
    return "generate_alt_text";
  }
  if (issue.includes("webp")) {
    return "convert_webp";
  }
  if (issue.includes("oversized") || issue.includes("dimension")) {
    return "optimise_image";
  }
  if (issue.includes("background")) {
    return issue.includes("inconsistent") ? "standardise_background" : "replace_background";
  }
  if (issue.includes("crop") || issue.includes("centering") || issue.includes("frame") || issue.includes("aspect")) {
    return "resize_crop";
  }
  if (issue.includes("main_image") || issue.includes("main image")) {
    return "add_main_image";
  }

  return "review_manually";
};

export const classifyAuditQueueAction = (actionType: AuditQueueActionType): AuditQueueActionPolicy => {
  if (actionType === "generate_alt_text") {
    return {
      actionType,
      jobKind: "seo_only",
      consumesCreditWhenProcessed: false,
      requiresReview: true,
      processingMode: "none",
      statusAfterFailure: "open"
    };
  }

  if (
    actionType === "optimise_image" ||
    actionType === "convert_webp" ||
    actionType === "replace_background" ||
    actionType === "standardise_background" ||
    actionType === "resize_crop"
  ) {
    return {
      actionType,
      jobKind: "image_processing",
      consumesCreditWhenProcessed: true,
      requiresReview: true,
      processingMode: "preserve",
      statusAfterFailure: "needs_review"
    };
  }

  return {
    actionType,
    jobKind: "review",
    consumesCreditWhenProcessed: false,
    requiresReview: true,
    processingMode: "none",
    statusAfterFailure: "open"
  };
};
