ALTER TABLE "connected_sites"
  ADD COLUMN IF NOT EXISTS "previous_api_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "api_token_rotated_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "connected_sites_previous_api_token_hash_idx"
  ON "connected_sites"("previous_api_token_hash");
