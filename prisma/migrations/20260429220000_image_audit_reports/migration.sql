CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Product Image Health Report / Image Intelligence Report storage.
-- Existing Optivra account and store identifiers are text CUIDs, so store_id
-- and user_id intentionally match connected_sites.id and optivra_users.id.
CREATE TABLE IF NOT EXISTS "image_audit_scans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" TEXT NOT NULL,
  "user_id" TEXT,
  "source" TEXT NOT NULL DEFAULT 'woocommerce',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "products_scanned" INTEGER DEFAULT 0,
  "images_scanned" INTEGER DEFAULT 0,
  "main_images_scanned" INTEGER DEFAULT 0,
  "gallery_images_scanned" INTEGER DEFAULT 0,
  "variation_images_scanned" INTEGER DEFAULT 0,
  "categories_scanned" INTEGER DEFAULT 0,
  "products_without_main_image" INTEGER DEFAULT 0,
  "products_with_single_image" INTEGER DEFAULT 0,
  "scan_started_at" TIMESTAMPTZ,
  "scan_completed_at" TIMESTAMPTZ,
  "scan_duration_ms" INTEGER,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT "image_audit_scans_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "image_audit_scans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "optivra_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "image_audit_scans_status_check"
    CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS "image_audit_scan_metrics" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scan_id" UUID NOT NULL REFERENCES "image_audit_scans"("id") ON DELETE CASCADE,
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "product_image_health_score" NUMERIC(5,2),
  "seo_score" NUMERIC(5,2),
  "image_quality_score" NUMERIC(5,2),
  "catalogue_consistency_score" NUMERIC(5,2),
  "performance_score" NUMERIC(5,2),
  "completeness_score" NUMERIC(5,2),
  "google_shopping_readiness_score" NUMERIC(5,2),
  "missing_alt_text_count" INTEGER DEFAULT 0,
  "weak_alt_text_count" INTEGER DEFAULT 0,
  "generic_alt_text_count" INTEGER DEFAULT 0,
  "alt_text_mentions_product_count" INTEGER DEFAULT 0,
  "alt_text_mentions_category_count" INTEGER DEFAULT 0,
  "missing_image_title_count" INTEGER DEFAULT 0,
  "generic_filename_count" INTEGER DEFAULT 0,
  "duplicate_filename_count" INTEGER DEFAULT 0,
  "seo_ready_images_count" INTEGER DEFAULT 0,
  "cluttered_background_count" INTEGER DEFAULT 0,
  "low_contrast_count" INTEGER DEFAULT 0,
  "poor_centering_count" INTEGER DEFAULT 0,
  "product_too_small_count" INTEGER DEFAULT 0,
  "product_too_large_or_cropped_count" INTEGER DEFAULT 0,
  "low_resolution_count" INTEGER DEFAULT 0,
  "likely_blurry_count" INTEGER DEFAULT 0,
  "over_dark_count" INTEGER DEFAULT 0,
  "over_bright_count" INTEGER DEFAULT 0,
  "watermark_or_text_overlay_count" INTEGER DEFAULT 0,
  "clean_product_focus_count" INTEGER DEFAULT 0,
  "inconsistent_background_count" INTEGER DEFAULT 0,
  "inconsistent_aspect_ratio_count" INTEGER DEFAULT 0,
  "inconsistent_product_scale_count" INTEGER DEFAULT 0,
  "inconsistent_padding_count" INTEGER DEFAULT 0,
  "inconsistent_lighting_count" INTEGER DEFAULT 0,
  "dominant_aspect_ratio" TEXT,
  "dominant_background_style" TEXT,
  "total_original_bytes" BIGINT DEFAULT 0,
  "total_original_mb" NUMERIC(12,2) DEFAULT 0,
  "average_image_bytes" BIGINT DEFAULT 0,
  "largest_image_bytes" BIGINT DEFAULT 0,
  "oversized_image_count" INTEGER DEFAULT 0,
  "huge_dimension_image_count" INTEGER DEFAULT 0,
  "missing_webp_count" INTEGER DEFAULT 0,
  "estimated_optimised_bytes" BIGINT DEFAULT 0,
  "estimated_optimised_mb" NUMERIC(12,2) DEFAULT 0,
  "estimated_reduction_percent_low" NUMERIC(5,2) DEFAULT 0,
  "estimated_reduction_percent_high" NUMERIC(5,2) DEFAULT 0,
  "google_ready_images_count" INTEGER DEFAULT 0,
  "google_warning_images_count" INTEGER DEFAULT 0,
  "images_with_promotional_overlay_count" INTEGER DEFAULT 0,
  "images_with_non_product_focused_main_image_count" INTEGER DEFAULT 0,
  "images_with_light_background_count" INTEGER DEFAULT 0,
  "images_with_clean_background_count" INTEGER DEFAULT 0,
  "estimated_manual_minutes_low" INTEGER DEFAULT 0,
  "estimated_manual_minutes_high" INTEGER DEFAULT 0,
  "hourly_rate_used" NUMERIC(10,2) DEFAULT 40.00,
  "estimated_cost_saved_low" NUMERIC(12,2) DEFAULT 0,
  "estimated_cost_saved_high" NUMERIC(12,2) DEFAULT 0,
  "images_processed" INTEGER DEFAULT 0,
  "images_approved" INTEGER DEFAULT 0,
  "images_rejected" INTEGER DEFAULT 0,
  "images_failed" INTEGER DEFAULT 0,
  "average_processing_time_ms" INTEGER DEFAULT 0,
  "preserve_mode_count" INTEGER DEFAULT 0,
  "flexible_mode_count" INTEGER DEFAULT 0,
  "product_pixel_drift_warning_count" INTEGER DEFAULT 0,
  "low_foreground_confidence_count" INTEGER DEFAULT 0,
  "failed_integrity_check_count" INTEGER DEFAULT 0,
  "credits_used" INTEGER DEFAULT 0,
  "failed_safety_checks_not_charged" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "image_audit_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scan_id" UUID NOT NULL REFERENCES "image_audit_scans"("id") ON DELETE CASCADE,
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "product_id" TEXT NOT NULL,
  "product_name" TEXT,
  "product_sku" TEXT,
  "product_url" TEXT,
  "image_id" TEXT,
  "image_url" TEXT NOT NULL,
  "image_role" TEXT NOT NULL DEFAULT 'unknown',
  "category_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "category_names" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "filename" TEXT,
  "file_extension" TEXT,
  "mime_type" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "file_size_bytes" BIGINT,
  "alt_text" TEXT,
  "image_title" TEXT,
  "caption" TEXT,
  "aspect_ratio" NUMERIC(10,4),
  "background_style" TEXT,
  "detected_product_bbox" JSONB,
  "product_area_ratio" NUMERIC(8,4),
  "brightness_score" NUMERIC(8,4),
  "contrast_score" NUMERIC(8,4),
  "sharpness_score" NUMERIC(8,4),
  "clutter_score" NUMERIC(8,4),
  "quality_score" NUMERIC(5,2),
  "seo_score" NUMERIC(5,2),
  "consistency_score" NUMERIC(5,2),
  "performance_score" NUMERIC(5,2),
  "google_readiness_score" NUMERIC(5,2),
  "issue_count" INTEGER DEFAULT 0,
  "highest_severity" TEXT,
  "recommended_action" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT "image_audit_items_role_check"
    CHECK ("image_role" IN ('unknown', 'main', 'gallery', 'variation', 'category', 'thumbnail'))
);

CREATE TABLE IF NOT EXISTS "image_audit_issues" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scan_id" UUID NOT NULL REFERENCES "image_audit_scans"("id") ON DELETE CASCADE,
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "audit_item_id" UUID REFERENCES "image_audit_items"("id") ON DELETE CASCADE,
  "product_id" TEXT,
  "image_id" TEXT,
  "issue_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "recommended_action" TEXT NOT NULL,
  "action_type" TEXT,
  "confidence_score" NUMERIC(5,2),
  "status" TEXT NOT NULL DEFAULT 'open',
  "metadata" JSONB DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "resolved_at" TIMESTAMPTZ,
  CONSTRAINT "image_audit_issues_severity_check"
    CHECK ("severity" IN ('critical', 'high', 'medium', 'low', 'info')),
  CONSTRAINT "image_audit_issues_status_check"
    CHECK ("status" IN ('open', 'queued', 'resolved', 'ignored', 'dismissed')),
  CONSTRAINT "image_audit_issues_action_type_check"
    CHECK ("action_type" IS NULL OR "action_type" IN (
      'manual_review',
      'queue_processing',
      'preserve_background_replace',
      'standard_background_replace',
      'seo_update',
      'compress_image',
      'replace_main_image',
      'add_gallery_image',
      'regenerate_thumbnail',
      'fix_alt_text'
    ))
);

CREATE TABLE IF NOT EXISTS "image_audit_insights" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scan_id" UUID NOT NULL REFERENCES "image_audit_scans"("id") ON DELETE CASCADE,
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "insight_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metric_key" TEXT,
  "metric_value" NUMERIC,
  "suggested_action" TEXT,
  "action_type" TEXT,
  "action_filter" JSONB DEFAULT '{}'::JSONB,
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT "image_audit_insights_severity_check"
    CHECK ("severity" IN ('critical', 'high', 'medium', 'low', 'info')),
  CONSTRAINT "image_audit_insights_action_type_check"
    CHECK ("action_type" IS NULL OR "action_type" IN (
      'manual_review',
      'queue_processing',
      'preserve_background_replace',
      'standard_background_replace',
      'seo_update',
      'compress_image',
      'replace_main_image',
      'add_gallery_image',
      'regenerate_thumbnail',
      'fix_alt_text'
    ))
);

CREATE TABLE IF NOT EXISTS "image_audit_category_scores" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scan_id" UUID NOT NULL REFERENCES "image_audit_scans"("id") ON DELETE CASCADE,
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "category_id" TEXT,
  "category_name" TEXT NOT NULL,
  "products_scanned" INTEGER DEFAULT 0,
  "images_scanned" INTEGER DEFAULT 0,
  "health_score" NUMERIC(5,2),
  "seo_score" NUMERIC(5,2),
  "quality_score" NUMERIC(5,2),
  "consistency_score" NUMERIC(5,2),
  "performance_score" NUMERIC(5,2),
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "issue_count" INTEGER DEFAULT 0,
  "critical_issue_count" INTEGER DEFAULT 0,
  "high_issue_count" INTEGER DEFAULT 0,
  "medium_issue_count" INTEGER DEFAULT 0,
  "low_issue_count" INTEGER DEFAULT 0,
  "top_issue_type" TEXT,
  "recommendation" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT "image_audit_category_scores_priority_check"
    CHECK ("priority" IN ('critical', 'high', 'medium', 'low'))
);

CREATE TABLE IF NOT EXISTS "image_audit_recommendations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scan_id" UUID NOT NULL REFERENCES "image_audit_scans"("id") ON DELETE CASCADE,
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "estimated_images_affected" INTEGER DEFAULT 0,
  "estimated_minutes_saved_low" INTEGER DEFAULT 0,
  "estimated_minutes_saved_high" INTEGER DEFAULT 0,
  "action_filter" JSONB DEFAULT '{}'::JSONB,
  "status" TEXT DEFAULT 'available',
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT "image_audit_recommendations_priority_check"
    CHECK ("priority" IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT "image_audit_recommendations_status_check"
    CHECK ("status" IN ('available', 'queued', 'in_progress', 'completed', 'dismissed')),
  CONSTRAINT "image_audit_recommendations_action_type_check"
    CHECK ("action_type" IN (
      'manual_review',
      'queue_processing',
      'preserve_background_replace',
      'standard_background_replace',
      'seo_update',
      'compress_image',
      'replace_main_image',
      'add_gallery_image',
      'regenerate_thumbnail',
      'fix_alt_text'
    ))
);

CREATE INDEX IF NOT EXISTS "image_audit_scans_store_id_created_at_idx"
  ON "image_audit_scans"("store_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "image_audit_scans_store_id_status_idx"
  ON "image_audit_scans"("store_id", "status");
CREATE INDEX IF NOT EXISTS "image_audit_scans_user_id_idx"
  ON "image_audit_scans"("user_id");
CREATE INDEX IF NOT EXISTS "image_audit_scan_metrics_scan_id_idx"
  ON "image_audit_scan_metrics"("scan_id");
CREATE INDEX IF NOT EXISTS "image_audit_items_scan_id_idx"
  ON "image_audit_items"("scan_id");
CREATE INDEX IF NOT EXISTS "image_audit_items_store_id_product_id_idx"
  ON "image_audit_items"("store_id", "product_id");
CREATE INDEX IF NOT EXISTS "image_audit_items_scan_id_image_role_idx"
  ON "image_audit_items"("scan_id", "image_role");
CREATE INDEX IF NOT EXISTS "image_audit_items_scan_id_highest_severity_idx"
  ON "image_audit_items"("scan_id", "highest_severity");
CREATE INDEX IF NOT EXISTS "image_audit_issues_scan_id_severity_idx"
  ON "image_audit_issues"("scan_id", "severity");
CREATE INDEX IF NOT EXISTS "image_audit_issues_scan_id_issue_type_idx"
  ON "image_audit_issues"("scan_id", "issue_type");
CREATE INDEX IF NOT EXISTS "image_audit_issues_store_id_status_idx"
  ON "image_audit_issues"("store_id", "status");
CREATE INDEX IF NOT EXISTS "image_audit_insights_scan_id_display_order_idx"
  ON "image_audit_insights"("scan_id", "display_order");
CREATE INDEX IF NOT EXISTS "image_audit_category_scores_scan_id_priority_idx"
  ON "image_audit_category_scores"("scan_id", "priority");
CREATE INDEX IF NOT EXISTS "image_audit_recommendations_scan_id_priority_idx"
  ON "image_audit_recommendations"("scan_id", "priority");

CREATE OR REPLACE FUNCTION "optivra_set_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "image_audit_scans_set_updated_at" ON "image_audit_scans";
CREATE TRIGGER "image_audit_scans_set_updated_at"
  BEFORE UPDATE ON "image_audit_scans"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

DROP TRIGGER IF EXISTS "image_audit_scan_metrics_set_updated_at" ON "image_audit_scan_metrics";
CREATE TRIGGER "image_audit_scan_metrics_set_updated_at"
  BEFORE UPDATE ON "image_audit_scan_metrics"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

DROP TRIGGER IF EXISTS "image_audit_items_set_updated_at" ON "image_audit_items";
CREATE TRIGGER "image_audit_items_set_updated_at"
  BEFORE UPDATE ON "image_audit_items"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

DROP TRIGGER IF EXISTS "image_audit_issues_set_updated_at" ON "image_audit_issues";
CREATE TRIGGER "image_audit_issues_set_updated_at"
  BEFORE UPDATE ON "image_audit_issues"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

DROP TRIGGER IF EXISTS "image_audit_recommendations_set_updated_at" ON "image_audit_recommendations";
CREATE TRIGGER "image_audit_recommendations_set_updated_at"
  BEFORE UPDATE ON "image_audit_recommendations"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

CREATE OR REPLACE FUNCTION "optivra_current_app_user_id"()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims JSONB;
  direct_user_id TEXT;
BEGIN
  direct_user_id := NULLIF(current_setting('request.jwt.claim.user_id', true), '');
  IF direct_user_id IS NOT NULL THEN
    RETURN direct_user_id;
  END IF;

  BEGIN
    claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
  EXCEPTION
    WHEN others THEN
      claims := NULL;
  END;

  RETURN COALESCE(
    NULLIF(claims->>'user_id', ''),
    NULLIF(claims->>'sub', ''),
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION "optivra_owns_store"("target_store_id" TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user_id TEXT;
BEGIN
  app_user_id := "optivra_current_app_user_id"();
  IF app_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM "connected_sites"
    WHERE "connected_sites"."id" = "target_store_id"
      AND "connected_sites"."user_id" = app_user_id
  );
END;
$$;

ALTER TABLE "image_audit_scans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_audit_scan_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_audit_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_audit_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_audit_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_audit_category_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_audit_recommendations" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_scans' AND policyname = 'image_audit_scans_owner_access') THEN
    CREATE POLICY "image_audit_scans_owner_access" ON "image_audit_scans"
      FOR ALL
      USING ("optivra_owns_store"("store_id") OR "user_id" = "optivra_current_app_user_id"())
      WITH CHECK ("optivra_owns_store"("store_id") OR "user_id" = "optivra_current_app_user_id"());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_scan_metrics' AND policyname = 'image_audit_scan_metrics_owner_access') THEN
    CREATE POLICY "image_audit_scan_metrics_owner_access" ON "image_audit_scan_metrics"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_items' AND policyname = 'image_audit_items_owner_access') THEN
    CREATE POLICY "image_audit_items_owner_access" ON "image_audit_items"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_issues' AND policyname = 'image_audit_issues_owner_access') THEN
    CREATE POLICY "image_audit_issues_owner_access" ON "image_audit_issues"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_insights' AND policyname = 'image_audit_insights_owner_access') THEN
    CREATE POLICY "image_audit_insights_owner_access" ON "image_audit_insights"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_category_scores' AND policyname = 'image_audit_category_scores_owner_access') THEN
    CREATE POLICY "image_audit_category_scores_owner_access" ON "image_audit_category_scores"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_recommendations' AND policyname = 'image_audit_recommendations_owner_access') THEN
    CREATE POLICY "image_audit_recommendations_owner_access" ON "image_audit_recommendations"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;
END $$;

COMMENT ON TABLE "image_audit_scans" IS 'Top-level WooCommerce product image audit scan per connected store.';
COMMENT ON TABLE "image_audit_scan_metrics" IS 'Aggregated scores and counts for an image audit scan.';
COMMENT ON TABLE "image_audit_items" IS 'One scanned product image and its SEO, quality, consistency, performance, and feed-readiness scores.';
COMMENT ON TABLE "image_audit_issues" IS 'Specific image audit issues linked to a scan and optionally one image.';
COMMENT ON TABLE "image_audit_insights" IS 'Prioritized business insights generated from an image audit scan.';
COMMENT ON TABLE "image_audit_category_scores" IS 'Category-level image health summaries for a scan.';
COMMENT ON TABLE "image_audit_recommendations" IS 'Actionable image improvement recommendations produced by an audit scan.';
COMMENT ON COLUMN "image_audit_scans"."store_id" IS 'References connected_sites.id. This project uses text CUID store IDs rather than database UUID store IDs.';
