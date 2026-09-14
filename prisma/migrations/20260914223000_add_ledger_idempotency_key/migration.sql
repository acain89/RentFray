ALTER TABLE "LedgerEntry"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key"
ON "LedgerEntry"("idempotencyKey");
