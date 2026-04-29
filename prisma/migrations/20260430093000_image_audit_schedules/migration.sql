CREATE TABLE IF NOT EXISTS "image_audit_scan_schedules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE,
  "user_id" TEXT REFERENCES "optivra_users"("id") ON DELETE SET NULL,
  "frequency" TEXT NOT NULL DEFAULT 'off',
  "scan_mode" TEXT NOT NULL DEFAULT 'updated',
  "email_report" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'pending_plugin',
  "remote_trigger_supported" BOOLEAN NOT NULL DEFAULT false,
  "scheduled_scan_requested" BOOLEAN NOT NULL DEFAULT false,
  "last_requested_at" TIMESTAMPTZ,
  "last_scan_completed_at" TIMESTAMPTZ,
  "next_scan_at" TIMESTAMPTZ,
  "scan_options" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "monthly_report_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "image_audit_scan_schedules_store_unique" UNIQUE ("store_id"),
  CONSTRAINT "image_audit_scan_schedules_frequency_check" CHECK ("frequency" IN ('off', 'weekly', 'monthly')),
  CONSTRAINT "image_audit_scan_schedules_scan_mode_check" CHECK ("scan_mode" IN ('updated', 'full')),
  CONSTRAINT "image_audit_scan_schedules_status_check" CHECK ("status" IN ('off', 'active', 'pending_plugin', 'requested', 'running', 'error'))
);

CREATE TABLE IF NOT EXISTS "image_audit_monthly_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" TEXT NOT NULL REFERENCES "connected_sites"("id") ON DELETE CASCADE,
  "user_id" TEXT REFERENCES "optivra_users"("id") ON DELETE SET NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "previous_scan_id" UUID REFERENCES "image_audit_scans"("id") ON DELETE SET NULL,
  "current_scan_id" UUID REFERENCES "image_audit_scans"("id") ON DELETE SET NULL,
  "previous_health_score" NUMERIC(5,2),
  "current_health_score" NUMERIC(5,2),
  "score_improvement" NUMERIC(5,2) DEFAULT 0,
  "issues_found" INTEGER DEFAULT 0,
  "issues_resolved" INTEGER DEFAULT 0,
  "images_processed" INTEGER DEFAULT 0,
  "estimated_time_saved_minutes_low" INTEGER DEFAULT 0,
  "estimated_time_saved_minutes_high" INTEGER DEFAULT 0,
  "top_remaining_opportunities" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "email_status" TEXT NOT NULL DEFAULT 'skipped',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "image_audit_monthly_reports_period_unique" UNIQUE ("store_id", "period_start"),
  CONSTRAINT "image_audit_monthly_reports_email_status_check" CHECK ("email_status" IN ('queued', 'sent', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS "image_audit_scan_schedules_store_id_idx"
  ON "image_audit_scan_schedules"("store_id");
CREATE INDEX IF NOT EXISTS "image_audit_scan_schedules_next_scan_at_idx"
  ON "image_audit_scan_schedules"("next_scan_at")
  WHERE "frequency" <> 'off';
CREATE INDEX IF NOT EXISTS "image_audit_monthly_reports_store_period_idx"
  ON "image_audit_monthly_reports"("store_id", "period_start" DESC);

DROP TRIGGER IF EXISTS "image_audit_scan_schedules_set_updated_at" ON "image_audit_scan_schedules";
CREATE TRIGGER "image_audit_scan_schedules_set_updated_at"
  BEFORE UPDATE ON "image_audit_scan_schedules"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

DROP TRIGGER IF EXISTS "image_audit_monthly_reports_set_updated_at" ON "image_audit_monthly_reports";
CREATE TRIGGER "image_audit_monthly_reports_set_updated_at"
  BEFORE UPDATE ON "image_audit_monthly_reports"
  FOR EACH ROW EXECUTE FUNCTION "optivra_set_updated_at"();

ALTER TABLE "image_audit_scan_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_audit_monthly_reports" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_scan_schedules' AND policyname = 'image_audit_scan_schedules_owner_access') THEN
    CREATE POLICY "image_audit_scan_schedules_owner_access" ON "image_audit_scan_schedules"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'image_audit_monthly_reports' AND policyname = 'image_audit_monthly_reports_owner_access') THEN
    CREATE POLICY "image_audit_monthly_reports_owner_access" ON "image_audit_monthly_reports"
      FOR ALL
      USING ("optivra_owns_store"("store_id"))
      WITH CHECK ("optivra_owns_store"("store_id"));
  END IF;
END $$;

COMMENT ON TABLE "image_audit_scan_schedules" IS 'Recurring Product Image Health Report schedule intent. WooCommerce plugin executes scans because it has catalogue/media access.';
COMMENT ON COLUMN "image_audit_scan_schedules"."status" IS 'pending_plugin means the backend has saved intent but the WooCommerce plugin must execute via admin load or WP-Cron.';
COMMENT ON TABLE "image_audit_monthly_reports" IS 'Monthly Product Image Health Report summary groundwork generated from completed audit scans.';
