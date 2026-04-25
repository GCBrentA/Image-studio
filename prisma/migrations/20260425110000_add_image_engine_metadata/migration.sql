ALTER TABLE "image_jobs"
  ADD COLUMN "original_image_hash" TEXT,
  ADD COLUMN "duplicate_of_job_id" TEXT,
  ADD COLUMN "seo_metadata" JSONB;

CREATE INDEX "image_jobs_user_id_original_image_hash_idx" ON "image_jobs"("user_id", "original_image_hash");
