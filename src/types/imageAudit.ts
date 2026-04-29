export type ImageAuditScanStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type ImageAuditSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ImageAuditActionType =
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

export type ImageAuditItemInput = {
  product_id: string;
  product_name?: string;
  product_sku?: string;
  product_url?: string;
  image_id?: string;
  image_url: string;
  image_role?: string;
  category_ids?: string[];
  category_names?: string[];
  filename?: string;
  file_extension?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  file_size_bytes?: number;
  alt_text?: string;
  image_title?: string;
  caption?: string;
};

export type StartImageAuditRequest = {
  store_id?: unknown;
  source?: unknown;
  scan_options?: unknown;
};

export type StartImageAuditResponse = {
  scan_id: string;
  status: ImageAuditScanStatus;
};

export type ImageAuditItemsRequest = {
  items?: unknown;
};

export type ImageAuditItemsResponse = {
  inserted_count: number;
  total_count: number;
};

export type ImageAuditReportResponse = {
  scan: Record<string, unknown>;
  metrics: Record<string, unknown> | null;
  insights?: Record<string, unknown>[];
  top_insights?: Record<string, unknown>[];
  recommendations?: Record<string, unknown>[];
  top_recommendations?: Record<string, unknown>[];
  category_scores?: Record<string, unknown>[];
  issue_summary?: Record<string, unknown>;
  top_items_needing_attention?: Record<string, unknown>[];
};

