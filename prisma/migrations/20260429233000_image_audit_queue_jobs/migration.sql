CREATE TABLE IF NOT EXISTS "image_audit_queue_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scan_id" UUID NOT NULL REFERENCES "image_audit_scans"("id") ON DELETE CASCADE,
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recommendation_id" UUID REFERENCES "image_audit_recommendations"("id") ON DELETE SET NULL,
  "issue_id" UUID REFERENCES "image_audit_issues"("id") ON DELETE SET NULL,
  "audit_item_id" UUID REFERENCES "image_audit_items"("id") ON DELETE SET NULL,
  "action_type" TEXT NOT NULL,
  "job_kind" TEXT NOT NULL,
  "product_id" TEXT,
  "image_id" TEXT,
  "image_role" TEXT,
  "source" TEXT NOT NULL DEFAULT 'audit_report',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "background_preset" TEXT,
  "processing_mode" TEXT NOT NULL DEFAULT 'none',
  "requires_review" BOOLEAN NOT NULL DEFAULT true,
  "consumes_credit_when_processed" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ,
  "failure_reason" TEXT,
  CONSTRAINT "image_audit_queue_jobs_action_type_check"
    CHECK ("action_type" IN (
      'generate_alt_text',
      'optimise_image',
      'replace_background',
      'standardise_background',
      'resize_crop',
      'convert_webp',
      'review_manually',
      'add_main_image'
    )),
  CONSTRAINT "image_audit_queue_jobs_job_kind_check"
    CHECK ("job_kind" IN ('seo_only', 'optimisation', 'image_processing', 'review')),
  CONSTRAINT "image_audit_queue_jobs_priority_check"
    CHECK ("priority" IN ('critical', 'high', 'medium', 'low', 'info')),
  CONSTRAINT "image_audit_queue_jobs_status_check"
    CHECK ("status" IN ('queued', 'processing', 'needs_review', 'completed', 'resolved', 'failed', 'dismissed', 'cancelled')),
  CONSTRAINT "image_audit_queue_jobs_processing_mode_check"
    CHECK ("processing_mode" IN ('none', 'preserve'))
);

CREATE INDEX IF NOT EXISTS "image_audit_queue_jobs_scan_id_status_idx"
  ON "image_audit_queue_jobs"("scan_id", "status");
CREATE INDEX IF NOT EXISTS "image_audit_queue_jobs_store_id_created_at_idx"
  ON "image_audit_queue_jobs"("store_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "image_audit_queue_jobs_recommendation_id_idx"
  ON "image_audit_queue_jobs"("recommendation_id");
CREATE INDEX IF NOT EXISTS "image_audit_queue_jobs_issue_id_idx"
  ON "image_audit_queue_jobs"("issue_id");
CREATE INDEX IF NOT EXISTS "image_audit_queue_jobs_action_type_idx"
  ON "image_audit_queue_jobs"("action_type");
CREATE UNIQUE INDEX IF NOT EXISTS "image_audit_queue_jobs_issue_unique_idx"
  ON "image_audit_queue_jobs"("scan_id", "issue_id")
  WHERE "issue_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "image_audit_queue_jobs_recommendation_item_unique_idx"
  ON "image_audit_queue_jobs"("scan_id", "recommendation_id", "audit_item_id", "action_type")
  WHERE "recommendation_id" IS NOT NULL AND "audit_item_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "image_audit_queue_jobs_recommendation_only_unique_idx"
  ON "image_audit_queue_jobs"("scan_id", "recommendation_id", "action_type")
  WHERE "recommendation_id" IS NOT NULL AND "audit_item_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'image_audit_issues'
  ) THEN
    ALTER TABLE "image_audit_issues" DROP CONSTRAINT IF EXISTS "image_audit_issues_action_type_check";
    ALTER TABLE "image_audit_issues"
      ADD CONSTRAINT "image_audit_issues_action_type_check"
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
        'fix_alt_text',
        'generate_alt_text',
        'optimise_image',
        'replace_background',
        'standardise_background',
        'resize_crop',
        'convert_webp',
        'review_manually',
        'add_main_image'
      ));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'image_audit_insights'
  ) THEN
    ALTER TABLE "image_audit_insights" DROP CONSTRAINT IF EXISTS "image_audit_insights_action_type_check";
    ALTER TABLE "image_audit_insights"
      ADD CONSTRAINT "image_audit_insights_action_type_check"
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
        'fix_alt_text',
        'generate_alt_text',
        'optimise_image',
        'replace_background',
        'standardise_background',
        'resize_crop',
        'convert_webp',
        'review_manually',
        'add_main_image'
      ));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'image_audit_recommendations'
  ) THEN
    ALTER TABLE "image_audit_recommendations" DROP CONSTRAINT IF EXISTS "image_audit_recommendations_action_type_check";
    ALTER TABLE "image_audit_recommendations"
      ADD CONSTRAINT "image_audit_recommendations_action_type_check"
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
        'fix_alt_text',
        'generate_alt_text',
        'optimise_image',
        'replace_background',
        'standardise_background',
        'resize_crop',
        'convert_webp',
        'review_manually',
        'add_main_image'
      ));
  END IF;
END $$;

DROP TRIGGER IF EXISTS "image_audit_queue_jobs_set_updated_at" ON "image_audit_queue_jobs";
CREATE TRIGGER "image_audit_queue_jobs_set_updated_at"
  BEFORE UPDATE ON "image_audit_queue_jobs"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

ALTER TABLE "image_audit_queue_jobs" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_queue_jobs' AND policyname = 'image_audit_queue_jobs_owner_access') THEN
    CREATE POLICY "image_audit_queue_jobs_owner_access" ON "image_audit_queue_jobs"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;
END $$;

COMMENT ON TABLE "image_audit_queue_jobs" IS 'Queue requests created from Product Image Health Report issues and recommendations.';
COMMENT ON COLUMN "image_audit_queue_jobs"."consumes_credit_when_processed" IS 'True only for image-processing jobs if they later complete safely; creating an audit queue job never deducts credits.';
COMMENT ON COLUMN "image_audit_queue_jobs"."source" IS 'Origin of the queue request. Product Image Health Report jobs use audit_report.';

