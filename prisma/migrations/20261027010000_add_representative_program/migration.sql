-- Additive representative foundation only. No existing tables or records change.
CREATE TABLE "Representative" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "passwordHash" TEXT,
    "loginEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "resetTokenHash" TEXT,
    "resetTokenExpiresAt" TIMESTAMPTZ(3),
    "resetTokenSessionVersion" INTEGER,
    CONSTRAINT "Representative_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Representative_email_normalized" CHECK ("email" = lower(btrim("email")) AND length("email") BETWEEN 3 AND 254 AND position('@' in "email") > 1),
    CONSTRAINT "Representative_slug_valid" CHECK ("slug" ~ '^[a-z][a-z0-9-]{1,47}$' AND right("slug", 1) <> '-' AND "slug" <> 'portal'),
    CONSTRAINT "Representative_session_version_valid" CHECK ("sessionVersion" >= 0),
    CONSTRAINT "Representative_reset_valid" CHECK (
      ("resetTokenHash" IS NULL AND "resetTokenExpiresAt" IS NULL AND "resetTokenSessionVersion" IS NULL) OR
      ("resetTokenHash" IS NOT NULL AND "resetTokenHash" ~ '^[a-f0-9]{64}$' AND "resetTokenExpiresAt" IS NOT NULL AND "resetTokenSessionVersion" IS NOT NULL AND "resetTokenSessionVersion" >= 0))
);
CREATE TABLE "RepresentativeAgreement" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL,
    "approvedByAdminId" TEXT NOT NULL,
    "agreementReference" TEXT,
    "agreementVersion" TEXT,
    CONSTRAINT "RepresentativeAgreement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RepresentativeAgreement_dates_valid" CHECK ("expiresAt" > "effectiveAt"),
    CONSTRAINT "RepresentativeAgreement_approval_valid" CHECK (length(btrim("approvedByAdminId")) > 0)
);
CREATE TABLE "RepresentativeReferral" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "businessNameSnapshot" TEXT NOT NULL,
    "businessCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "attributedAt" TIMESTAMPTZ(3) NOT NULL,
    "businessExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "authorizingAgreementId" TEXT,
    "productScope" TEXT NOT NULL DEFAULT 'UNKNOWN',
    CONSTRAINT "RepresentativeReferral_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RepresentativeReferral_dates_valid" CHECK ("capturedAt" <= "businessCreatedAt" AND "attributedAt" >= "businessCreatedAt" AND "businessExpiresAt" > "businessCreatedAt"),
    CONSTRAINT "RepresentativeReferral_product_valid" CHECK ("productScope" IN ('UNKNOWN', 'RENTFRAY') AND ("productScope" = 'RENTFRAY' OR "authorizingAgreementId" IS NULL))
);
CREATE TABLE "RepresentativePayout" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByAdminId" TEXT NOT NULL,
    "reportingMonth" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "externalPayoutReference" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "RepresentativePayout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RepresentativePayout_amount_valid" CHECK ("amountCents" > 0),
    CONSTRAINT "RepresentativePayout_month_valid" CHECK ("reportingMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "RepresentativePayout_record_valid" CHECK ("paidAt" <= "recordedAt" AND length(btrim("recordedByAdminId")) > 0 AND length(btrim("operationKey")) > 0 AND length(btrim("externalPayoutReference")) > 0)
);
CREATE UNIQUE INDEX "Representative_email_key" ON "Representative"("email");
CREATE UNIQUE INDEX "Representative_slug_key" ON "Representative"("slug");
CREATE UNIQUE INDEX "Representative_resetTokenHash_key" ON "Representative"("resetTokenHash");
CREATE UNIQUE INDEX "RepresentativeAgreement_id_representativeId_key" ON "RepresentativeAgreement"("id", "representativeId");
CREATE INDEX "RepresentativeAgreement_representativeId_effectiveAt_idx" ON "RepresentativeAgreement"("representativeId", "effectiveAt");
CREATE UNIQUE INDEX "RepresentativeReferral_propertyId_key" ON "RepresentativeReferral"("propertyId");
CREATE INDEX "RepresentativeReferral_portfolio_idx" ON "RepresentativeReferral"("representativeId", "businessCreatedAt", "id");
CREATE UNIQUE INDEX "RepresentativePayout_operationKey_key" ON "RepresentativePayout"("operationKey");
CREATE UNIQUE INDEX "RepresentativePayout_externalPayoutReference_key" ON "RepresentativePayout"("externalPayoutReference");
CREATE INDEX "RepresentativePayout_representativeId_paidAt_id_idx" ON "RepresentativePayout"("representativeId", "paidAt", "id");
ALTER TABLE "RepresentativeAgreement" ADD CONSTRAINT "RepresentativeAgreement_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepresentativeReferral" ADD CONSTRAINT "RepresentativeReferral_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepresentativeReferral" ADD CONSTRAINT "RepresentativeReferral_agreement_fkey" FOREIGN KEY ("authorizingAgreementId", "representativeId") REFERENCES "RepresentativeAgreement"("id", "representativeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepresentativePayout" ADD CONSTRAINT "RepresentativePayout_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
