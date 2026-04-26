CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPlan') THEN
    CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'growth', 'pro', 'agency');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "optivra_users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "optivra_users"
  ADD COLUMN IF NOT EXISTS "billing_email" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_plan" "SubscriptionPlan",
  ADD COLUMN IF NOT EXISTS "billing_status" "SubscriptionStatus",
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "current_period_start" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "current_period_end" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "credits_included" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_remaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_used" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_reset_at" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "optivra_users_stripe_customer_id_key"
  ON "optivra_users"("stripe_customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "optivra_users_stripe_subscription_id_key"
  ON "optivra_users"("stripe_subscription_id");

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL DEFAULT 'starter',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'incomplete',
  "current_period_end" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_plan" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_status" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_email" TEXT,
  ADD COLUMN IF NOT EXISTS "current_period_start" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "current_period_end" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "credits_included" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_remaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_used" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credits_reset_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_key"
  ON "subscriptions"("stripe_subscription_id");

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx"
  ON "subscriptions"("user_id");

CREATE INDEX IF NOT EXISTS "subscriptions_status_idx"
  ON "subscriptions"("status");

CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stripe_event_id" TEXT UNIQUE NOT NULL,
  "event_type" TEXT NOT NULL,
  "processed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "raw_event" JSONB,
  "account_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'processed',
  "error_message" TEXT
);

ALTER TABLE "stripe_events"
  ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "event_type" TEXT,
  ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "raw_event" JSONB,
  ADD COLUMN IF NOT EXISTS "account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS "error_message" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stripe_events' AND column_name = 'type'
  ) THEN
    UPDATE "stripe_events"
    SET "event_type" = COALESCE("event_type", "type")
    WHERE "event_type" IS NULL;
  END IF;
END $$;

UPDATE "stripe_events"
SET "stripe_event_id" = COALESCE("stripe_event_id", "id"::TEXT)
WHERE "stripe_event_id" IS NULL;

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

CREATE TABLE IF NOT EXISTS "credit_ledger" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "description" TEXT,
  "stripe_event_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "credit_ledger"
  ADD COLUMN IF NOT EXISTS "account_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "balance_after" INTEGER,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credit_ledger' AND column_name = 'user_id'
  ) THEN
    UPDATE "credit_ledger"
    SET "account_id" = COALESCE("account_id", "user_id")
    WHERE "account_id" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credit_ledger' AND column_name = 'reason'
  ) THEN
    UPDATE "credit_ledger"
    SET "source" = COALESCE("source", "reason"::TEXT)
    WHERE "source" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credit_ledger' AND column_name = 'change_amount'
  ) THEN
    UPDATE "credit_ledger"
    SET "amount" = COALESCE("amount", "change_amount")
    WHERE "amount" IS NULL;
  END IF;
END $$;

UPDATE "credit_ledger"
SET
  "account_id" = COALESCE("account_id", 'unknown'),
  "source" = COALESCE("source", 'unknown'),
  "amount" = COALESCE("amount", 0),
  "balance_after" = COALESCE("balance_after", 0)
WHERE "account_id" IS NULL OR "source" IS NULL OR "amount" IS NULL OR "balance_after" IS NULL;

ALTER TABLE "credit_ledger"
  ALTER COLUMN "account_id" SET NOT NULL,
  ALTER COLUMN "source" SET NOT NULL,
  ALTER COLUMN "amount" SET NOT NULL,
  ALTER COLUMN "balance_after" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "credit_ledger_account_id_idx"
  ON "credit_ledger"("account_id");

CREATE INDEX IF NOT EXISTS "credit_ledger_source_idx"
  ON "credit_ledger"("source");

CREATE INDEX IF NOT EXISTS "credit_ledger_stripe_event_id_idx"
  ON "credit_ledger"("stripe_event_id");
