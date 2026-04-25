DO $$
BEGIN
	CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'growth', 'pro', 'agency');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
	CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
	CREATE TYPE "CreditLedgerReason" AS ENUM ('trial', 'usage', 'reset', 'purchase');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
	CREATE TYPE "ImageJobStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "optivra_users" (
	"id" TEXT NOT NULL,
	"email" TEXT NOT NULL,
	"password_hash" TEXT NOT NULL,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "optivra_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "connected_sites" (
	"id" TEXT NOT NULL,
	"user_id" TEXT NOT NULL,
	"domain" TEXT NOT NULL,
	"api_token_hash" TEXT NOT NULL,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "connected_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" TEXT NOT NULL,
	"user_id" TEXT NOT NULL,
	"plan" "SubscriptionPlan" NOT NULL,
	"status" "SubscriptionStatus" NOT NULL,
	"current_period_end" TIMESTAMP(3) NOT NULL,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "credit_ledger" (
	"id" TEXT NOT NULL,
	"user_id" TEXT NOT NULL,
	"change_amount" INTEGER NOT NULL,
	"reason" "CreditLedgerReason" NOT NULL,
	"idempotency_key" TEXT,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "image_jobs" (
	"id" TEXT NOT NULL,
	"user_id" TEXT NOT NULL,
	"original_url" TEXT NOT NULL,
	"processed_url" TEXT,
	"status" "ImageJobStatus" NOT NULL DEFAULT 'queued',
	"credit_deducted_at" TIMESTAMP(3),
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "image_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "optivra_users_email_key" ON "optivra_users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "connected_sites_user_id_domain_key" ON "connected_sites"("user_id", "domain");
CREATE INDEX IF NOT EXISTS "connected_sites_user_id_idx" ON "connected_sites"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_idempotency_key_key" ON "credit_ledger"("idempotency_key");
CREATE INDEX IF NOT EXISTS "credit_ledger_user_id_idx" ON "credit_ledger"("user_id");
CREATE INDEX IF NOT EXISTS "credit_ledger_reason_idx" ON "credit_ledger"("reason");
CREATE INDEX IF NOT EXISTS "image_jobs_user_id_idx" ON "image_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "image_jobs_status_idx" ON "image_jobs"("status");

DO $$
BEGIN
	ALTER TABLE "connected_sites"
		ADD CONSTRAINT "connected_sites_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
	ALTER TABLE "subscriptions"
		ADD CONSTRAINT "subscriptions_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
	ALTER TABLE "credit_ledger"
		ADD CONSTRAINT "credit_ledger_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
	ALTER TABLE "image_jobs"
		ADD CONSTRAINT "image_jobs_user_id_fkey"
		FOREIGN KEY ("user_id") REFERENCES "optivra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "optivra_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "connected_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "image_jobs" ENABLE ROW LEVEL SECURITY;
