ALTER TABLE "credit_ledger"
  ADD COLUMN IF NOT EXISTS "balance_after" INTEGER NOT NULL DEFAULT 0;

UPDATE "credit_ledger"
SET "balance_after" = 0
WHERE "balance_after" IS NULL;

ALTER TABLE "credit_ledger"
  ALTER COLUMN "balance_after" SET DEFAULT 0,
  ALTER COLUMN "balance_after" SET NOT NULL;
