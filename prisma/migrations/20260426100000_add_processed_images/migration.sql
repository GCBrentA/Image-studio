CREATE TABLE IF NOT EXISTS "processed_images" (
  "id" TEXT NOT NULL,
  "image_job_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "processed_url" TEXT NOT NULL,
  "storage_path" TEXT,
  "seo_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cleanup_after" TIMESTAMP(3),

  CONSTRAINT "processed_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "processed_images_image_job_id_key" ON "processed_images"("image_job_id");
CREATE INDEX IF NOT EXISTS "processed_images_user_id_idx" ON "processed_images"("user_id");
CREATE INDEX IF NOT EXISTS "processed_images_cleanup_after_idx" ON "processed_images"("cleanup_after");

DO $$
BEGIN
  ALTER TABLE "processed_images"
    ADD CONSTRAINT "processed_images_image_job_id_fkey"
    FOREIGN KEY ("image_job_id") REFERENCES "image_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "processed_images"
    ADD CONSTRAINT "processed_images_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "processed_images" ENABLE ROW LEVEL SECURITY;
