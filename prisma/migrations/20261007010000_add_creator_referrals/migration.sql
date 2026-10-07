CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CreatorReferral" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "propertyId" TEXT,
    "retainedPropertyId" TEXT NOT NULL,
    "businessNameSnapshot" TEXT NOT NULL,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreatorReferral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Creator_slug_key" ON "Creator"("slug");
CREATE UNIQUE INDEX "CreatorReferral_propertyId_key" ON "CreatorReferral"("propertyId");
CREATE UNIQUE INDEX "CreatorReferral_retainedPropertyId_key" ON "CreatorReferral"("retainedPropertyId");
CREATE INDEX "CreatorReferral_creatorId_attributedAt_idx" ON "CreatorReferral"("creatorId", "attributedAt");
ALTER TABLE "CreatorReferral" ADD CONSTRAINT "CreatorReferral_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorReferral" ADD CONSTRAINT "CreatorReferral_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;