ALTER TABLE "image_jobs"
  ADD COLUMN "original_storage_path" TEXT,
  ADD COLUMN "processed_storage_path" TEXT,
  ADD COLUMN "debug_cutout_storage_path" TEXT,
  ADD COLUMN "original_uploaded_at" TIMESTAMP(3),
  ADD COLUMN "processed_uploaded_at" TIMESTAMP(3),
  ADD COLUMN "debug_cutout_uploaded_at" TIMESTAMP(3),
  ADD COLUMN "storage_cleanup_after" TIMESTAMP(3);

CREATE INDEX "image_jobs_storage_cleanup_after_idx" ON "image_jobs"("storage_cleanup_after");
