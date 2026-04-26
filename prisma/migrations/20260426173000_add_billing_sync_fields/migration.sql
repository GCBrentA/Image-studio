ALTER TABLE "optivra_users"
  ADD COLUMN IF NOT EXISTS "billing_email" TEXT;

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "current_period_start" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billing_email" TEXT,
  ADD COLUMN IF NOT EXISTS "credits_reset_at" TIMESTAMP(3);
