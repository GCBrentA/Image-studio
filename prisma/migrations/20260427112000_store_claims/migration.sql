ALTER TABLE "connected_sites"
  ADD COLUMN IF NOT EXISTS "canonical_domain" TEXT,
  ADD COLUMN IF NOT EXISTS "site_url" TEXT,
  ADD COLUMN IF NOT EXISTS "home_url" TEXT,
  ADD COLUMN IF NOT EXISTS "wordpress_install_id" TEXT,
  ADD COLUMN IF NOT EXISTS "plugin_version" TEXT,
  ADD COLUMN IF NOT EXISTS "woocommerce_version" TEXT,
  ADD COLUMN IF NOT EXISTS "claim_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "first_connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "free_credits_granted_at" TIMESTAMP(3);

UPDATE "connected_sites"
SET "canonical_domain" = COALESCE("canonical_domain", regexp_replace(lower("domain"), '^www\.', '')),
    "first_connected_at" = COALESCE("first_connected_at", "created_at")
WHERE "canonical_domain" IS NULL OR "first_connected_at" IS NULL;

CREATE INDEX IF NOT EXISTS "connected_sites_canonical_domain_idx" ON "connected_sites"("canonical_domain");
CREATE INDEX IF NOT EXISTS "connected_sites_wordpress_install_id_idx" ON "connected_sites"("wordpress_install_id");
CREATE INDEX IF NOT EXISTS "connected_sites_claim_status_idx" ON "connected_sites"("claim_status");

CREATE TABLE IF NOT EXISTS "free_credit_grants" (
  "id" TEXT NOT NULL,
  "canonical_domain" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "store_id" TEXT,
  "credits_granted" INTEGER NOT NULL,
  "grant_type" TEXT NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  CONSTRAINT "free_credit_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "free_credit_grants_canonical_domain_grant_type_key"
  ON "free_credit_grants"("canonical_domain", "grant_type");
CREATE INDEX IF NOT EXISTS "free_credit_grants_account_id_idx" ON "free_credit_grants"("account_id");
CREATE INDEX IF NOT EXISTS "free_credit_grants_store_id_idx" ON "free_credit_grants"("store_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'free_credit_grants' AND constraint_name = 'free_credit_grants_account_id_fkey'
  ) THEN
    ALTER TABLE "free_credit_grants"
      ADD CONSTRAINT "free_credit_grants_account_id_fkey"
      FOREIGN KEY ("account_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'free_credit_grants' AND constraint_name = 'free_credit_grants_store_id_fkey'
  ) THEN
    ALTER TABLE "free_credit_grants"
      ADD CONSTRAINT "free_credit_grants_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "connected_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "store_transfer_audit" (
  "id" TEXT NOT NULL,
  "old_account_id" TEXT NOT NULL,
  "new_account_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "canonical_domain" TEXT NOT NULL,
  "transfer_token_hash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "confirmed_by_install_id" TEXT,
  CONSTRAINT "store_transfer_audit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_transfer_audit_transfer_token_hash_key" ON "store_transfer_audit"("transfer_token_hash");
CREATE INDEX IF NOT EXISTS "store_transfer_audit_canonical_domain_idx" ON "store_transfer_audit"("canonical_domain");
CREATE INDEX IF NOT EXISTS "store_transfer_audit_status_idx" ON "store_transfer_audit"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'store_transfer_audit' AND constraint_name = 'store_transfer_audit_old_account_id_fkey'
  ) THEN
    ALTER TABLE "store_transfer_audit"
      ADD CONSTRAINT "store_transfer_audit_old_account_id_fkey"
      FOREIGN KEY ("old_account_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'store_transfer_audit' AND constraint_name = 'store_transfer_audit_new_account_id_fkey'
  ) THEN
    ALTER TABLE "store_transfer_audit"
      ADD CONSTRAINT "store_transfer_audit_new_account_id_fkey"
      FOREIGN KEY ("new_account_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'store_transfer_audit' AND constraint_name = 'store_transfer_audit_store_id_fkey'
  ) THEN
    ALTER TABLE "store_transfer_audit"
      ADD CONSTRAINT "store_transfer_audit_store_id_fkey"
      FOREIGN KEY ("store_id") REFERENCES "connected_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
