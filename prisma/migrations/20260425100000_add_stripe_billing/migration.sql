ALTER TABLE "optivra_users" ADD COLUMN "stripe_customer_id" TEXT;

ALTER TABLE "subscriptions"
  ADD COLUMN "stripe_subscription_id" TEXT,
  ADD COLUMN "stripe_price_id" TEXT,
  ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "stripe_events" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "optivra_users_stripe_customer_id_key" ON "optivra_users"("stripe_customer_id");
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX "stripe_events_type_idx" ON "stripe_events"("type");
