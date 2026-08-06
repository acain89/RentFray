-- Only one unmoved-out current tenant assignment may exist per unit.
CREATE UNIQUE INDEX "TenantAssignment_one_current_per_unit"
ON "TenantAssignment" ("unitId")
WHERE "isCurrent" = true
  AND "moveOutDate" IS NULL;

-- Each Payment may produce only one payment ledger entry.
CREATE UNIQUE INDEX "LedgerEntry_one_payment_entry_per_payment"
ON "LedgerEntry" ("paymentId")
WHERE "paymentId" IS NOT NULL
  AND "entryType" = 'PAYMENT';

-- Each Payment may produce only one processing-fee ledger entry.
CREATE UNIQUE INDEX "LedgerEntry_one_processing_fee_per_payment"
ON "LedgerEntry" ("paymentId")
WHERE "paymentId" IS NOT NULL
  AND "entryType" = 'CHARGE'
  AND "chargeType" = 'PROCESSING_FEE';

-- Each Payment may produce only one ACH return/refund/dispute reversal.
CREATE UNIQUE INDEX "LedgerEntry_one_reversal_per_payment"
ON "LedgerEntry" ("paymentId")
WHERE "paymentId" IS NOT NULL
  AND "entryType" = 'ADJUSTMENT'
  AND "referenceNumber" LIKE '%:reversal';
