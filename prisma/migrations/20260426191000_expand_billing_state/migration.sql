ALTER TABLE "optivra_users"
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_plan" "SubscriptionPlan",
  ADD COLUMN IF NOT EXISTS "billing_status" "SubscriptionStatus",
  ADD COLUMN IF NOT EXISTS "current_period_start" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "current_period_end" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "credits_included" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_remaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_used" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_reset_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "optivra_users_stripe_subscription_id_key"
  ON "optivra_users"("stripe_subscription_id");

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT,
  ADD COLUMN IF NOT EXISTS "credits_included" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_remaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_used" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "stripe_events"
  ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "event_type" TEXT,
  ADD COLUMN IF NOT EXISTS "raw_event" JSONB,
  ADD COLUMN IF NOT EXISTS "account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS "error_message" TEXT;

UPDATE "stripe_events"
SET
  "stripe_event_id" = COALESCE("stripe_event_id", "id"),
  "event_type" = COALESCE("event_type", "type"),
  "status" = CASE WHEN "processed_at" IS NULL THEN "received" ELSE 'processed' END
WHERE "stripe_event_id" IS NULL OR "event_type" IS NULL;

ALTER TABLE "stripe_events"
  ALTER COLUMN "stripe_event_id" SET NOT NULL,
  ALTER COLUMN "event_type" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "stripe_events_stripe_event_id_key"
  ON "stripe_events"("stripe_event_id");

CREATE INDEX IF NOT EXISTS "stripe_events_event_type_idx"
  ON "stripe_events"("event_type");

CREATE INDEX IF NOT EXISTS "stripe_events_account_id_idx"
  ON "stripe_events"("account_id");

CREATE INDEX IF NOT EXISTS "stripe_events_status_idx"
  ON "stripe_events"("status");

ALTER TABLE "credit_ledger"
  ADD COLUMN IF NOT EXISTS "account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "balance_after" INTEGER,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT;

UPDATE "credit_ledger"
SET
  "account_id" = COALESCE("account_id", "user_id"),
  "amount" = COALESCE("amount", "change_amount"),
  "source" = COALESCE("source", "reason"::TEXT)
WHERE "account_id" IS NULL OR "amount" IS NULL OR "source" IS NULL;

CREATE INDEX IF NOT EXISTS "credit_ledger_account_id_idx"
  ON "credit_ledger"("account_id");

CREATE INDEX IF NOT EXISTS "credit_ledger_source_idx"
  ON "credit_ledger"("source");

CREATE INDEX IF NOT EXISTS "credit_ledger_stripe_event_id_idx"
  ON "credit_ledger"("stripe_event_id");
